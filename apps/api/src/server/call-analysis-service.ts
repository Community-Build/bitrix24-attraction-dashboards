import { randomUUID } from "node:crypto";

import type {
  ActivitySnapshot,
  ActivityBindingSnapshot,
  CallSnapshot,
  DealSnapshot,
  ManagerDirectoryEntry,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";

import type {
  CallAnalysisResultRecord,
  CallAnalysisTriggerMode,
  SqliteRepository
} from "./sqlite-repository.js";
import {
  resolveCallRecordingDownload,
  type CallRecordingResolverClient,
  type ResolvedCallRecordingDownload
} from "./call-recording-resolver.js";
import type {
  DialogueGateInput,
  DialogueGateResult
} from "./openrouter-dialogue-gate.js";
import type {
  AnalyzeCallInput,
  CallAudioFormat,
  OpenRouterCallAnalysisResult
} from "./openrouter-call-analysis.js";

type FetchLike = typeof fetch;

export interface DownloadedCallRecording {
  audio: Buffer;
  audioFormat: CallAudioFormat;
}

export interface CallAnalysisAttributes {
  managerName?: string | null;
  startedAt?: string | null;
  callType?: string | null;
  bitrixDurationSeconds?: number | null;
  audioDurationSeconds?: number | null;
  dealId?: string | null;
  contactId?: string | null;
  dealCurrentStageName?: string | null;
  dealSourceId?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

export type DownloadCallRecording = (
  url: string
) => Promise<DownloadedCallRecording>;

export interface CallAnalysisProvider {
  analyzeCall(input: AnalyzeCallInput): Promise<OpenRouterCallAnalysisResult>;
}

export interface DialogueGateProvider {
  analyzeDialogue(input: DialogueGateInput): Promise<DialogueGateResult>;
}

export interface CallAnalysisRepository
  extends Pick<
    SqliteRepository,
    | "getCallById"
    | "getDealsByIds"
    | "getActivitiesByIds"
    | "getActivityBindingsByActivityIds"
    | "getStageAtDealTime"
    | "getManagerDirectory"
    | "getStageCatalog"
    | "getCallAnalysisResult"
    | "getLatestCallAnalysisRuns"
    | "startCallAnalysisRun"
    | "saveCallAnalysisResult"
    | "finishCallAnalysisRun"
    | "failCallAnalysisRun"
  > {}

export interface AnalyzeSelectedCallInput {
  callId: string;
  triggerMode?: CallAnalysisTriggerMode;
}

export interface AnalyzeSelectedCallResult {
  status: "ready";
  reusedExistingResult: boolean;
  result: CallAnalysisResultRecord;
}

export interface SkippedCallAnalysisResult {
  status: "skipped";
  reusedExistingResult: false;
  callId: string;
  dialogueGate: DialogueGateResult;
}

export type CallAnalysisResult =
  | AnalyzeSelectedCallResult
  | SkippedCallAnalysisResult;

export interface CallAnalysisContext {
  attributes: CallAnalysisAttributes;
}

export interface CreateCallAnalysisServiceInput {
  repository: CallAnalysisRepository;
  client: CallRecordingResolverClient;
  provider: CallAnalysisProvider;
  dialogueGate?: DialogueGateProvider;
  dialogueGateSkipConfidenceThreshold?: number;
  recordingRetryDelaysMs?: number[];
  sleep?: (delayMs: number) => Promise<void>;
  downloadRecording?: DownloadCallRecording;
  fetch?: FetchLike;
  recordingDownloadTimeoutMs?: number;
  maxRecordingBytes?: number;
  idGenerator?: () => string;
  now?: () => Date;
}

const DEFAULT_RECORDING_DOWNLOAD_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RECORDING_BYTES = 50 * 1024 * 1024;
const DEFAULT_DIALOGUE_GATE_SKIP_CONFIDENCE = 0.7;
const DEFAULT_AUTOMATIC_RECORDING_RETRY_DELAYS_MS = [
  0,
  30_000,
  90_000,
  180_000
];
const MAX_ANALYSIS_ERROR_MESSAGE_LENGTH = 1_000;

export class CallAnalysisServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "CallAnalysisServiceError";
  }
}

export function createCallAnalysisService(input: CreateCallAnalysisServiceInput) {
  const now = input.now ?? (() => new Date());
  const idGenerator = input.idGenerator ?? randomUUID;
  const sleep = input.sleep ?? defaultSleep;
  const automaticRecordingRetryDelaysMs =
    input.recordingRetryDelaysMs ?? DEFAULT_AUTOMATIC_RECORDING_RETRY_DELAYS_MS;
  const downloadRecording =
    input.downloadRecording ??
    createDefaultRecordingDownloader(input.fetch ?? fetch, {
      timeoutMs:
        input.recordingDownloadTimeoutMs ?? DEFAULT_RECORDING_DOWNLOAD_TIMEOUT_MS,
      maxBytes: input.maxRecordingBytes ?? DEFAULT_MAX_RECORDING_BYTES
    });

  return {
    async getCallAnalysisResult(callId: string) {
      return input.repository.getCallAnalysisResult(callId);
    },

    async getCallAnalysisContext(callId: string): Promise<CallAnalysisContext> {
      const call = await input.repository.getCallById(callId);
      if (!call) {
        throw new CallAnalysisServiceError(
          "CALL_NOT_FOUND",
          "Call was not found in local snapshot.",
          404
        );
      }

      return buildCallAnalysisContext({
        repository: input.repository,
        call
      });
    },

    async analyzeCall({
      callId,
      triggerMode = "manual"
    }: AnalyzeSelectedCallInput): Promise<CallAnalysisResult> {
      const existingResult = await input.repository.getCallAnalysisResult(callId);
      if (existingResult) {
        return {
          status: "ready",
          reusedExistingResult: true,
          result: existingResult
        };
      }

      const call = await input.repository.getCallById(callId);
      if (!call) {
        throw new CallAnalysisServiceError(
          "CALL_NOT_FOUND",
          "Call was not found in local snapshot.",
          404
        );
      }

      const latestRun = (await input.repository.getLatestCallAnalysisRuns([call.id]))[0];
      if (latestRun?.status === "queued" || latestRun?.status === "analyzing") {
        throw new CallAnalysisServiceError(
          "CALL_ANALYSIS_ALREADY_RUNNING",
          "Call analysis is already running for this call.",
          409
        );
      }

      let preparedRecording: PreparedCallRecording | null = null;
      const recordingRetryDelaysMs =
        triggerMode === "automatic" ? automaticRecordingRetryDelaysMs : [0];
      if (triggerMode === "automatic" && input.dialogueGate) {
        preparedRecording = await resolveAndDownloadCallRecording({
          client: input.client,
          call,
          downloadRecording,
          retryDelaysMs: recordingRetryDelaysMs,
          sleep
        });
        const dialogueGateResult = await input.dialogueGate.analyzeDialogue({
          callId: call.id,
          audio: preparedRecording.downloaded.audio,
          audioFormat: preparedRecording.downloaded.audioFormat,
          metadata: {
            durationSeconds: call.callDurationSeconds,
            callFailedCode: call.callFailedCode
          }
        });

        if (
          shouldSkipAfterDialogueGate(
            dialogueGateResult,
            input.dialogueGateSkipConfidenceThreshold
          )
        ) {
          return {
            status: "skipped",
            reusedExistingResult: false,
            callId: call.id,
            dialogueGate: dialogueGateResult
          };
        }
      }

      const runId = idGenerator();
      const startedAt = now().toISOString();
      await input.repository.startCallAnalysisRun({
        id: runId,
        callId: call.id,
        crmActivityId: normalizeId(call.crmActivityId),
        triggerMode,
        status: "analyzing",
        startedAt,
        recordingSource: null,
        recordingFileId: null,
        model: null,
        promptVersion: null
      });

      try {
        const context = await buildCallAnalysisContext({
          repository: input.repository,
          call
        });
        const recording =
          preparedRecording ??
          (await resolveAndDownloadCallRecording({
            client: input.client,
            call,
            downloadRecording,
            retryDelaysMs: recordingRetryDelaysMs,
            sleep
          }));
        const providerResult = await input.provider.analyzeCall({
          callId: call.id,
          audio: recording.downloaded.audio,
          audioFormat: recording.downloaded.audioFormat
        });
        const updatedAt = now().toISOString();
        const resultRecord = toResultRecord({
          runId,
          updatedAt,
          providerResult,
          attributes: context.attributes
        });

        await input.repository.saveCallAnalysisResult(resultRecord);
        await input.repository.finishCallAnalysisRun({
          runId,
          finishedAt: updatedAt,
          status: "ready",
          model: providerResult.model,
          promptVersion: providerResult.promptVersion,
          recordingSource: recording.recording.source,
          recordingFileId: recording.recording.fileId
        });

        return {
          status: "ready",
          reusedExistingResult: false,
          result: resultRecord
        };
      } catch (error) {
        const normalizedError = normalizeAnalysisError(error);
        await input.repository.failCallAnalysisRun({
          runId,
          failedAt: now().toISOString(),
          status: "error",
          errorCode: normalizedError.code,
          errorMessage: normalizedError.message
        });
        logCallAnalysisFailure({
          runId,
          callId: call.id,
          error: normalizedError,
          cause: error
        });
        throw normalizedError;
      }
    }
  };
}

interface PreparedCallRecording {
  recording: ResolvedCallRecordingDownload;
  downloaded: DownloadedCallRecording;
}

async function resolveAndDownloadCallRecording(input: {
  client: CallRecordingResolverClient;
  call: CallSnapshot;
  downloadRecording: DownloadCallRecording;
  retryDelaysMs: number[];
  sleep: (delayMs: number) => Promise<void>;
}): Promise<PreparedCallRecording> {
  for (const delayMs of input.retryDelaysMs) {
    if (delayMs > 0) {
      await input.sleep(delayMs);
    }

    const recording = await resolveCallRecordingDownload({
      client: input.client,
      call: {
        ID: input.call.id,
        CRM_ACTIVITY_ID: input.call.crmActivityId,
        CALL_RECORD_URL: null
      }
    });

    if (recording) {
      return {
        recording,
        downloaded: await input.downloadRecording(recording.url)
      };
    }
  }

  throw new CallAnalysisServiceError(
    "CALL_RECORDING_NOT_FOUND",
    "Call recording is not available for analysis.",
    404
  );
}

function shouldSkipAfterDialogueGate(
  result: DialogueGateResult,
  threshold = DEFAULT_DIALOGUE_GATE_SKIP_CONFIDENCE
) {
  return !result.gate.hasDialogue && result.gate.confidence >= threshold;
}

async function buildCallAnalysisContext(input: {
  repository: CallAnalysisRepository;
  call: CallSnapshot;
}) {
  const activityId = normalizeId(input.call.crmActivityId);
  const [activities, activityBindings, managers, stageCatalog] = await Promise.all([
    activityId ? input.repository.getActivitiesByIds([activityId]) : Promise.resolve([]),
    activityId
      ? input.repository.getActivityBindingsByActivityIds([activityId])
      : Promise.resolve([]),
    input.repository.getManagerDirectory(),
    input.repository.getStageCatalog()
  ]);
  const activity = activities[0] ?? null;
  const dealIdCandidates = resolveDealIdCandidates(
    input.call,
    activity,
    activityBindings
  );
  const deals =
    dealIdCandidates.length > 0
      ? await input.repository.getDealsByIds(dealIdCandidates)
      : [];
  const dealById = new Map(deals.map((nextDeal) => [nextDeal.id, nextDeal]));
  const deal = dealIdCandidates
    .map((dealId) => dealById.get(dealId) ?? null)
    .find((nextDeal): nextDeal is DealSnapshot => nextDeal !== null) ?? null;
  const dealId = deal?.id ?? dealIdCandidates[0] ?? null;
  const stageAtCall =
    dealId !== null
      ? await input.repository.getStageAtDealTime(dealId, input.call.callStartDate)
      : null;
  const managerId = resolveManagerId(input.call, activity, deal);
  const managerName = resolveManagerName(managerId, managers);
  const stageAtCallId = stageAtCall?.stageId ?? deal?.stageId ?? null;
  const stageAtCallName = resolveStageName(stageAtCallId, deal, stageCatalog);

  return {
    attributes: {
      callId: input.call.id,
      crmActivityId: activityId,
      managerId,
      managerName,
      startedAt: input.call.callStartDate,
      callType: resolveCallDirection(input.call.callType),
      callTypeLabel: formatCallTypeLabel(input.call),
      bitrixDurationSeconds: input.call.callDurationSeconds,
      callFailedCode: input.call.callFailedCode,
      dealId,
      contactId: deal?.contactId ?? null,
      dealCurrentStageId: deal?.stageId ?? null,
      dealCurrentStageName: resolveStageName(deal?.stageId ?? null, deal, stageCatalog),
      dealSourceId: deal?.sourceId ?? null,
      stageAtCallId,
      stageAtCallName,
      activityProviderId: activity?.providerId ?? null,
      activityResponsibleId: activity?.responsibleId ?? null
    } satisfies CallAnalysisAttributes
  };
}

function toResultRecord(input: {
  runId: string;
  updatedAt: string;
  providerResult: OpenRouterCallAnalysisResult;
  attributes: CallAnalysisAttributes;
}): CallAnalysisResultRecord {
  const aiEvaluation = toJsonRecord(input.providerResult.analysis.aiEvaluation);
  const rawAnalysis = toJsonRecord(input.providerResult.rawAnalysis);
  const rawAiEvaluation = toJsonRecord(rawAnalysis.aiEvaluation);

  return {
    callId: input.providerResult.callId,
    runId: input.runId,
    status: "ready",
    transcriptByRoles: input.providerResult.analysis.transcriptByRoles,
    fullTranscriptText: input.providerResult.analysis.fullTranscriptText,
    aiEvaluation,
    rawAiEvaluation:
      Object.keys(rawAiEvaluation).length > 0 ? rawAiEvaluation : { ...aiEvaluation },
    attributes: toJsonRecord(input.attributes),
    model: input.providerResult.model,
    promptVersion: input.providerResult.promptVersion,
    analyzedAt: input.providerResult.analyzedAt,
    updatedAt: input.updatedAt
  };
}

function normalizeAnalysisError(error: unknown) {
  if (error instanceof CallAnalysisServiceError) {
    return error;
  }

  const causeMessage = getSafeErrorMessage(error);
  return new CallAnalysisServiceError(
    "CALL_ANALYSIS_FAILED",
    causeMessage ? `Call analysis failed: ${causeMessage}` : "Call analysis failed.",
    500,
    error instanceof Error ? { cause: error } : undefined
  );
}

function logCallAnalysisFailure(input: {
  runId: string;
  callId: string;
  error: CallAnalysisServiceError;
  cause: unknown;
}) {
  console.error(
    "call_analysis.failed",
    JSON.stringify({
      runId: input.runId,
      callId: input.callId,
      errorCode: input.error.code,
      errorMessage: input.error.message,
      causeName: getErrorName(input.cause),
      causeMessage: getSafeErrorMessage(input.cause)
    })
  );
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return truncateAnalysisErrorMessage(error.message || error.name);
  }

  if (typeof error === "string") {
    return truncateAnalysisErrorMessage(error);
  }

  return "";
}

function truncateAnalysisErrorMessage(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_ANALYSIS_ERROR_MESSAGE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_ANALYSIS_ERROR_MESSAGE_LENGTH - 1)}…`;
}

function resolveDealIdCandidates(
  call: CallSnapshot,
  activity: ActivitySnapshot | null,
  activityBindings: ActivityBindingSnapshot[]
) {
  const candidates: string[] = [];
  const callDealId = normalizeId(call.crmEntityId);
  if (isDealEntity(call.crmEntityType) && callDealId) {
    candidates.push(callDealId);
  }

  const activityDealId = normalizeId(activity?.ownerId);
  if (activity?.ownerTypeId === "2" && activityDealId) {
    candidates.push(activityDealId);
  }

  for (const binding of activityBindings) {
    const bindingDealId = normalizeId(binding.ownerId);
    if (binding.ownerTypeId === "2" && bindingDealId) {
      candidates.push(bindingDealId);
    }
  }

  return Array.from(new Set(candidates));
}

function resolveManagerId(
  call: CallSnapshot,
  activity: ActivitySnapshot | null,
  deal: DealSnapshot | null
) {
  return (
    normalizeId(call.portalUserId) ??
    normalizeId(activity?.responsibleId) ??
    normalizeId(deal?.assignedById)
  );
}

function resolveManagerName(
  managerId: string | null,
  managers: ManagerDirectoryEntry[]
) {
  if (!managerId) {
    return null;
  }

  return managers.find((manager) => manager.id === managerId)?.name ?? null;
}

function resolveStageName(
  stageId: string | null,
  deal: DealSnapshot | null,
  stageCatalog: StageCatalogEntry[]
) {
  if (!stageId) {
    return null;
  }

  return (
    stageCatalog.find(
      (stage) =>
        stage.entityType === "deal" &&
        stage.statusId === stageId &&
        (stage.categoryId === deal?.categoryId || stage.categoryId === null)
    )?.name ?? null
  );
}

function resolveCallDirection(callType: string | null) {
  if (callType === "1") {
    return "outgoing";
  }

  if (callType === "2") {
    return "incoming";
  }

  return "unknown";
}

function formatCallTypeLabel(call: CallSnapshot) {
  const direction = resolveCallDirection(call.callType);
  if (direction === "incoming") {
    return "Входящий";
  }

  if (direction === "outgoing") {
    return call.callDurationSeconds > 30 ? "Исх >30" : "Исх <30";
  }

  return "Неизвестно";
}

function isDealEntity(value: string | null) {
  return value === "2" || value?.toUpperCase() === "DEAL";
}

function normalizeId(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 && normalized !== "0" ? normalized : null;
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function createDefaultRecordingDownloader(
  fetchImpl: FetchLike,
  options: {
    timeoutMs: number;
    maxBytes: number;
  }
): DownloadCallRecording {
  return async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new CallAnalysisServiceError(
          "CALL_RECORDING_DOWNLOAD_TIMEOUT",
          "Call recording download timed out.",
          504,
          error instanceof Error ? { cause: error } : undefined
        );
      }

      throw new CallAnalysisServiceError(
        "CALL_RECORDING_DOWNLOAD_FAILED",
        "Call recording download failed.",
        502,
        error instanceof Error ? { cause: error } : undefined
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new CallAnalysisServiceError(
        "CALL_RECORDING_DOWNLOAD_FAILED",
        "Call recording download failed.",
        502
      );
    }

    const contentLength = parseContentLength(response.headers.get("content-length"));
    if (contentLength !== null && contentLength > options.maxBytes) {
      throw new CallAnalysisServiceError(
        "CALL_RECORDING_TOO_LARGE",
        "Call recording is too large for analysis.",
        413
      );
    }

    const audio = await readResponseBodyWithLimit(response, options.maxBytes);

    return {
      audio,
      audioFormat: inferAudioFormat(
        response.headers.get("content-type"),
        url
      )
    };
  };
}

async function readResponseBodyWithLimit(response: Response, maxBytes: number) {
  if (!response.body) {
    const audio = Buffer.from(await response.arrayBuffer());
    assertRecordingSize(audio.byteLength, maxBytes);
    return audio;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new CallAnalysisServiceError(
          "CALL_RECORDING_TOO_LARGE",
          "Call recording is too large for analysis.",
          413
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

function assertRecordingSize(byteLength: number, maxBytes: number) {
  if (byteLength > maxBytes) {
    throw new CallAnalysisServiceError(
      "CALL_RECORDING_TOO_LARGE",
      "Call recording is too large for analysis.",
      413
    );
  }
}

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function parseContentLength(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function inferAudioFormat(
  contentType: string | null,
  url: string
): CallAudioFormat {
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const normalizedUrl = url.toLowerCase();

  if (normalizedContentType.includes("wav") || normalizedUrl.endsWith(".wav")) {
    return "wav";
  }
  if (normalizedContentType.includes("mp4") || normalizedUrl.endsWith(".m4a")) {
    return "m4a";
  }
  if (normalizedContentType.includes("aac") || normalizedUrl.endsWith(".aac")) {
    return "aac";
  }
  if (normalizedContentType.includes("ogg") || normalizedUrl.endsWith(".ogg")) {
    return "ogg";
  }
  if (normalizedContentType.includes("flac") || normalizedUrl.endsWith(".flac")) {
    return "flac";
  }

  return "mp3";
}
