import { randomUUID } from "node:crypto";

import type {
  CallAnalysisContext,
  CallAnalysisResult
} from "./call-analysis-service.js";
import { CallAnalysisServiceError } from "./call-analysis-service.js";
import type {
  CallEnrichmentProposalDraft,
  SkippedCallEnrichmentCandidate
} from "./call-enrichment-diff.js";
import type { CallEnrichmentFollowUpNote } from "./call-enrichment-follow-up-note.js";
import type {
  CallAnalysisResultRecord,
  CreateEnrichmentProposalInput,
  SqliteRepository
} from "./sqlite-repository.js";

export interface QueueAutomaticCallAnalysisInput {
  callId: string;
  activityId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  managerId?: string | null;
  durationSeconds?: number | null;
  occurredAt?: string | null;
}

export type QueueAutomaticCallAnalysisResult =
  | { status: "queued"; callId: string }
  | { status: "duplicate"; callId: string; reason?: string }
  | { status: "skipped"; callId: string; reason: string };

export interface CallEnrichmentAnalysisService {
  getCallAnalysisContext(callId: string): Promise<CallAnalysisContext>;
  analyzeCall(input: {
    callId: string;
    triggerMode: "automatic";
  }): Promise<CallAnalysisResult>;
}

export interface CallEnrichmentPipeline {
  runAfterCallAnalysis(input: {
    callEvent: QueueAutomaticCallAnalysisInput;
    context: CallAnalysisContext;
    analysis: CallAnalysisResultRecord;
  }): Promise<CallEnrichmentPipelineResult>;
}

export interface CallEnrichmentPipelineResult {
  proposals: CallEnrichmentProposalDraft[];
  skipped?: SkippedCallEnrichmentCandidate[];
  followUpNote?: CallEnrichmentFollowUpNote | null;
  metadata?: Record<string, unknown>;
}

export interface CallEnrichmentProposalNotifier {
  sendProposalBatch(input: {
    batch: {
      id: string;
      callId: string;
      dealId: string;
      contactId: string | null;
      managerId: string;
      expiresAt: string;
    };
    proposals: CreateEnrichmentProposalInput[];
  }): Promise<void>;
  sendFollowUpNote?(input: {
    batch: {
      id: string;
      callId: string;
      dealId: string;
      contactId: string | null;
      managerId: string;
      expiresAt: string;
    };
    note: CallEnrichmentFollowUpNote;
  }): Promise<void>;
}

export interface CallEnrichmentOrchestratorRepository
  extends Pick<
    SqliteRepository,
    | "getEnrichmentProposalBatchByCallId"
    | "createEnrichmentProposalBatch"
    | "appendEnrichmentProposalEvent"
  > {}

export interface CreateCallEnrichmentOrchestratorInput {
  analysis: CallEnrichmentAnalysisService;
  repository: CallEnrichmentOrchestratorRepository;
  enrichmentPipeline?: CallEnrichmentPipeline;
  proposalNotifier?: CallEnrichmentProposalNotifier;
  pilotManagerIds?: string[];
  idGenerator?: () => string;
  now?: () => Date;
  proposalTtlMs?: number;
}

const DEFAULT_PROPOSAL_TTL_MS = 48 * 60 * 60 * 1_000;

export function createCallEnrichmentOrchestrator(
  input: CreateCallEnrichmentOrchestratorInput
) {
  const activeCallIds = new Set<string>();
  const idGenerator = input.idGenerator ?? randomUUID;
  const now = input.now ?? (() => new Date());
  const proposalTtlMs = input.proposalTtlMs ?? DEFAULT_PROPOSAL_TTL_MS;
  const pilotManagerIds = new Set(input.pilotManagerIds ?? []);
  const defaultEnrichmentPipeline: CallEnrichmentPipeline = {
    async runAfterCallAnalysis() {
      return { proposals: [] };
    }
  };
  const enrichmentPipeline =
    input.enrichmentPipeline ?? defaultEnrichmentPipeline;

  async function queueAutomaticCallAnalysis(
    callEvent: QueueAutomaticCallAnalysisInput
  ): Promise<QueueAutomaticCallAnalysisResult> {
    const callId = callEvent.callId;
    if (activeCallIds.has(callId)) {
      return { status: "duplicate", callId, reason: "CALL_ALREADY_ACTIVE" };
    }

    activeCallIds.add(callId);
    try {
      const existingBatch =
        await input.repository.getEnrichmentProposalBatchByCallId(callId);
      if (existingBatch) {
        return { status: "duplicate", callId, reason: "PROPOSAL_BATCH_EXISTS" };
      }

      const context = await input.analysis.getCallAnalysisContext(callId);
      const dealId = normalizeId(context.attributes.dealId);
      if (!dealId) {
        return { status: "skipped", callId, reason: "DEAL_NOT_RESOLVED" };
      }

      const managerId = normalizeId(context.attributes.managerId);
      if (!managerId) {
        return { status: "skipped", callId, reason: "MANAGER_NOT_RESOLVED" };
      }

      if (pilotManagerIds.size > 0 && !pilotManagerIds.has(managerId)) {
        await recordSkippedBatch({
          callEvent,
          context,
          dealId,
          managerId,
          reason: "MANAGER_NOT_IN_PILOT"
        });
        return { status: "skipped", callId, reason: "MANAGER_NOT_IN_PILOT" };
      }

      const analysisResult = await input.analysis.analyzeCall({
        callId,
        triggerMode: "automatic"
      });

      if (analysisResult.status === "skipped") {
        await recordSkippedBatch({
          callEvent,
          context,
          dealId,
          managerId,
          reason: "NO_DIALOGUE",
          metadata: {
            dialogueGate: {
              model: analysisResult.dialogueGate.model,
              promptVersion: analysisResult.dialogueGate.promptVersion,
              evidenceType: analysisResult.dialogueGate.gate.evidenceType,
              confidence: analysisResult.dialogueGate.gate.confidence
            }
          }
        });
        return { status: "skipped", callId, reason: "NO_DIALOGUE" };
      }

      if (isFailedOrNoConversation(analysisResult.result)) {
        await recordSkippedBatch({
          callEvent,
          context,
          dealId,
          managerId,
          reason: "FAILED_OR_NO_CONVERSATION",
          callAnalysisRunId: analysisResult.result.runId
        });
        return {
          status: "skipped",
          callId,
          reason: "FAILED_OR_NO_CONVERSATION"
        };
      }

      const enrichmentResult = await enrichmentPipeline.runAfterCallAnalysis({
        callEvent,
        context,
        analysis: analysisResult.result
      });

      if (enrichmentResult.proposals.length === 0) {
        const skippedBatch = await recordSkippedBatch({
          callEvent,
          context,
          dealId,
          managerId,
          reason: "NO_MATERIAL_UPDATES",
          callAnalysisRunId: analysisResult.result.runId,
          metadata: {
            skippedCandidates: enrichmentResult.skipped ?? [],
            ...(enrichmentResult.followUpNote
              ? { followUpNote: enrichmentResult.followUpNote }
              : {}),
            ...(enrichmentResult.metadata ?? {})
          }
        });
        if (enrichmentResult.followUpNote) {
          await input.proposalNotifier?.sendFollowUpNote?.({
            batch: skippedBatch.batch,
            note: enrichmentResult.followUpNote
          });
        }
        return { status: "skipped", callId, reason: "NO_MATERIAL_UPDATES" };
      }

      const createdBatch = await recordPendingBatch({
        callEvent,
        context,
        dealId,
        managerId,
        callAnalysisRunId: analysisResult.result.runId,
        proposals: enrichmentResult.proposals,
        metadata: {
          skippedCandidates: enrichmentResult.skipped ?? [],
          ...(enrichmentResult.metadata ?? {})
        }
      });
      await input.proposalNotifier?.sendProposalBatch(createdBatch);

      return { status: "queued", callId };
    } catch (error) {
      if (
        error instanceof CallAnalysisServiceError &&
        error.code === "CALL_ANALYSIS_ALREADY_RUNNING"
      ) {
        return {
          status: "duplicate",
          callId,
          reason: "CALL_ANALYSIS_ALREADY_RUNNING"
        };
      }

      throw error;
    } finally {
      activeCallIds.delete(callId);
    }
  }

  async function recordSkippedBatch(inputData: {
    callEvent: QueueAutomaticCallAnalysisInput;
    context: CallAnalysisContext;
    dealId: string;
    managerId: string;
    reason: string;
    callAnalysisRunId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const createdAt = now().toISOString();
    const batchId = idGenerator();
    await input.repository.createEnrichmentProposalBatch({
      id: batchId,
      callId: inputData.callEvent.callId,
      activityId: normalizeId(
        inputData.context.attributes.crmActivityId ?? inputData.callEvent.activityId
      ),
      dealId: inputData.dealId,
      contactId: normalizeId(
        inputData.context.attributes.contactId ?? inputData.callEvent.contactId
      ),
      managerId: inputData.managerId,
      callAnalysisRunId: inputData.callAnalysisRunId ?? null,
      status: "failed",
      expiresAt: new Date(Date.parse(createdAt) + proposalTtlMs).toISOString(),
      createdAt,
      updatedAt: createdAt,
      proposals: []
    });
    await input.repository.appendEnrichmentProposalEvent({
      id: idGenerator(),
      batchId,
      proposalId: null,
      actorType: "system",
      actorId: null,
      action: "batch.skipped",
      beforeStatus: null,
      afterStatus: "failed",
      reason: inputData.reason,
      metadata: inputData.metadata ?? null,
      createdAt
    });
    return {
      batch: {
        id: batchId,
        callId: inputData.callEvent.callId,
        dealId: inputData.dealId,
        contactId: normalizeId(
          inputData.context.attributes.contactId ?? inputData.callEvent.contactId
        ),
        managerId: inputData.managerId,
        expiresAt: new Date(Date.parse(createdAt) + proposalTtlMs).toISOString()
      }
    };
  }

  async function recordPendingBatch(inputData: {
    callEvent: QueueAutomaticCallAnalysisInput;
    context: CallAnalysisContext;
    dealId: string;
    managerId: string;
    callAnalysisRunId: string;
    proposals: CallEnrichmentProposalDraft[];
    metadata?: Record<string, unknown>;
  }) {
    const createdAt = now().toISOString();
    const batchId = idGenerator();
    const contactId = normalizeId(
      inputData.context.attributes.contactId ?? inputData.callEvent.contactId
    );
    const proposals = inputData.proposals.map((proposal) => ({
      ...proposal,
      id: idGenerator(),
      status: "pending" as const,
      createdAt,
      updatedAt: createdAt
    }));
    await input.repository.createEnrichmentProposalBatch({
      id: batchId,
      callId: inputData.callEvent.callId,
      activityId: normalizeId(
        inputData.context.attributes.crmActivityId ?? inputData.callEvent.activityId
      ),
      dealId: inputData.dealId,
      contactId,
      managerId: inputData.managerId,
      callAnalysisRunId: inputData.callAnalysisRunId,
      status: "pending",
      expiresAt: new Date(Date.parse(createdAt) + proposalTtlMs).toISOString(),
      createdAt,
      updatedAt: createdAt,
      proposals
    });
    await input.repository.appendEnrichmentProposalEvent({
      id: idGenerator(),
      batchId,
      proposalId: null,
      actorType: "system",
      actorId: null,
      action: "batch.created",
      beforeStatus: null,
      afterStatus: "pending",
      reason: null,
      metadata: {
        proposalCount: inputData.proposals.length,
        ...(inputData.metadata ?? {})
      },
      createdAt
    });
    return {
      batch: {
        id: batchId,
        callId: inputData.callEvent.callId,
        dealId: inputData.dealId,
        contactId,
        managerId: inputData.managerId,
        expiresAt: new Date(Date.parse(createdAt) + proposalTtlMs).toISOString()
      },
      proposals
    };
  }

  return {
    queueAutomaticCallAnalysis
  };
}

function isFailedOrNoConversation(result: CallAnalysisResultRecord) {
  const classification = result.aiEvaluation.callClassification;
  return (
    classification !== null &&
    typeof classification === "object" &&
    !Array.isArray(classification) &&
    (classification as { type?: unknown }).type === "failed_or_no_conversation"
  );
}

function normalizeId(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 && normalized !== "0" ? normalized : null;
}
