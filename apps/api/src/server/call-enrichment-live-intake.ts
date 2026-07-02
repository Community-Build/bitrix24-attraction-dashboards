import type {
  ActivityBindingSnapshot,
  ActivitySnapshot,
  CallSnapshot
} from "@bitrix24-reporting/contracts";

import type {
  ActivityBindingRow,
  ActivityRow,
  CallRow
} from "../bitrix/client.js";
import type {
  QueueAutomaticCallAnalysisInput,
  QueueAutomaticCallAnalysisResult
} from "./call-enrichment-orchestrator.js";
import { safeErrorMessage } from "./safe-error-message.js";

export interface CallEnrichmentLiveIntakeClient {
  listCalls(input: { activityIds?: string[] }): Promise<CallRow[]>;
  listActivitiesByIds(activityIds: string[]): Promise<ActivityRow[]>;
  listActivityBindings?(activityIds: string[]): Promise<ActivityBindingRow[]>;
}

export interface CallEnrichmentLiveIntakeRepository {
  upsertCalls(rows: CallSnapshot[]): Promise<number>;
  upsertActivities(rows: ActivitySnapshot[]): Promise<number>;
  upsertActivityBindings?(rows: ActivityBindingSnapshot[]): Promise<number>;
}

export interface CreateCallEnrichmentLiveIntakeQueueInput {
  client: CallEnrichmentLiveIntakeClient;
  repository: CallEnrichmentLiveIntakeRepository;
  queueAutomaticCallAnalysis(
    input: QueueAutomaticCallAnalysisInput
  ): Promise<QueueAutomaticCallAnalysisResult>;
  retryDelaysMs?: number[];
  sleep?: (delayMs: number) => Promise<void>;
}

export function createCallEnrichmentLiveIntakeQueue(
  input: CreateCallEnrichmentLiveIntakeQueueInput
) {
  const retryDelaysMs = input.retryDelaysMs ?? [0, 5_000, 20_000, 60_000];
  const sleep = input.sleep ?? defaultSleep;

  async function queueAutomaticCallAnalysis(
    callEvent: QueueAutomaticCallAnalysisInput
  ): Promise<QueueAutomaticCallAnalysisResult> {
    const hydratedCallEvent = await hydrateCallEvent(callEvent);
    return input.queueAutomaticCallAnalysis(hydratedCallEvent);
  }

  async function hydrateCallEvent(callEvent: QueueAutomaticCallAnalysisInput) {
    const activityId = normalizeId(callEvent.activityId);
    if (!activityId) {
      return callEvent;
    }

    const callRow = await findCallRowForEvent(callEvent, activityId);
    if (!callRow) {
      return callEvent;
    }

    const callSnapshot = mapCallRow(callRow, callEvent.callId, activityId);
    await input.repository.upsertCalls([callSnapshot]);

    const activityRows = await input.client.listActivitiesByIds([activityId]);
    if (activityRows.length > 0) {
      await input.repository.upsertActivities(activityRows.map(mapActivityRow));
    }

    if (input.client.listActivityBindings && input.repository.upsertActivityBindings) {
      try {
        const bindingRows = await input.client.listActivityBindings([activityId]);
        if (bindingRows.length > 0) {
          await input.repository.upsertActivityBindings(
            bindingRows.map(mapActivityBindingRow)
          );
        }
      } catch (error) {
        if (!isMissingActivityBindingError(error)) {
          throw error;
        }

        console.warn("call_enrichment.activity_bindings.skipped", {
          activityId,
          error: safeErrorMessage(error)
        });
      }
    }

    return {
      ...callEvent,
      callId: callSnapshot.id,
      activityId: callSnapshot.crmActivityId ?? callEvent.activityId ?? null,
      managerId: callSnapshot.portalUserId ?? callEvent.managerId ?? null,
      durationSeconds: callSnapshot.callDurationSeconds,
      occurredAt: callSnapshot.callStartDate
    } satisfies QueueAutomaticCallAnalysisInput;
  }

  async function findCallRowForEvent(
    callEvent: QueueAutomaticCallAnalysisInput,
    activityId: string
  ) {
    for (const delayMs of retryDelaysMs) {
      if (delayMs > 0) {
        await sleep(delayMs);
      }

      const rows = await input.client.listCalls({ activityIds: [activityId] });
      const matched =
        rows.find((row) => rowMatchesCallEvent(row, callEvent, activityId)) ??
        rows[0] ??
        null;
      if (matched) {
        return matched;
      }
    }

    return null;
  }

  return { queueAutomaticCallAnalysis };
}

function rowMatchesCallEvent(
  row: CallRow,
  callEvent: QueueAutomaticCallAnalysisInput,
  activityId: string
) {
  const eventCallId = normalizeId(callEvent.callId);
  return (
    normalizeId(row.CRM_ACTIVITY_ID) === activityId ||
    normalizeId(row.ID) === eventCallId ||
    normalizeId(row.CALL_ID) === eventCallId
  );
}

function mapCallRow(
  row: CallRow,
  eventCallId: string,
  eventActivityId: string
): CallSnapshot {
  const duration =
    typeof row.CALL_DURATION === "number"
      ? row.CALL_DURATION
      : Number(row.CALL_DURATION ?? 0);
  return {
    id: normalizeId(row.ID) ?? normalizeId(row.CALL_ID) ?? eventCallId,
    crmActivityId: normalizeId(row.CRM_ACTIVITY_ID) ?? eventActivityId,
    portalUserId: normalizeId(row.PORTAL_USER_ID),
    callType: normalizeId(row.CALL_TYPE),
    callStartDate: row.CALL_START_DATE,
    callDurationSeconds: Number.isFinite(duration) ? duration : 0,
    crmEntityType: row.CRM_ENTITY_TYPE,
    crmEntityId: normalizeId(row.CRM_ENTITY_ID),
    callFailedCode: normalizeId(row.CALL_FAILED_CODE)
  };
}

function mapActivityRow(row: ActivityRow): ActivitySnapshot {
  const completed = row.COMPLETED === "Y";
  return {
    id: String(row.ID),
    ownerTypeId: String(row.OWNER_TYPE_ID),
    ownerId: String(row.OWNER_ID),
    typeId: normalizeId(row.TYPE_ID),
    providerId: row.PROVIDER_ID,
    responsibleId: normalizeId(row.RESPONSIBLE_ID),
    createdTime: row.CREATED,
    deadline: row.DEADLINE ?? null,
    lastUpdated: row.LAST_UPDATED,
    completed,
    completedTime: completed ? row.COMPLETED_DATE ?? row.LAST_UPDATED : null
  };
}

function mapActivityBindingRow(row: ActivityBindingRow): ActivityBindingSnapshot {
  return {
    activityId: String(row.activityId),
    ownerTypeId: String(row.ownerTypeId),
    ownerId: String(row.ownerId)
  };
}

function normalizeId(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function isMissingActivityBindingError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("crm.activity.binding.list") &&
    /(NOT_FOUND|not found|Элемент не найден)/i.test(error.message)
  );
}
