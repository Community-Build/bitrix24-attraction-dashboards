import type {
  ActivitySnapshot,
  CallSnapshot,
  DealMeetingDateChangeSnapshot,
  DealStageFactSnapshot,
  DealTouchpointFactSnapshot,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

function parsePayload(payloadJson: string | null) {
  if (!payloadJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function payloadBoolean(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "boolean" ? value : false;
}

function payloadNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function stageFactsToStageHistory(
  facts: DealStageFactSnapshot[]
): StageHistorySnapshot[] {
  return facts
    .map((fact) => {
      const payload = parsePayload(fact.payloadJson);
      const typeId = payloadNumber(payload, "typeId");

      return {
        id: fact.sourceEntityId || fact.factId,
        ownerId: fact.dealId,
        categoryId: fact.categoryId,
        stageId: fact.stageId,
        stageSemanticId: fact.stageSemanticId,
        typeId: typeId || null,
        createdTime: fact.enteredAt
      } satisfies StageHistorySnapshot;
    })
    .sort((left, right) => {
      const byOwner = left.ownerId.localeCompare(right.ownerId);
      if (byOwner !== 0) {
        return byOwner;
      }

      const byTime = left.createdTime.localeCompare(right.createdTime);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
}

export function touchpointFactsToCalls(
  facts: DealTouchpointFactSnapshot[]
): CallSnapshot[] {
  return facts
    .filter((fact) => fact.kind === "call")
    .map((fact) => {
      const payload = parsePayload(fact.payloadJson);
      const direction = payloadString(payload, "direction");
      const failedCode = payloadString(payload, "failedCode");
      const connected = payloadBoolean(payload, "connected");

      return {
        id: fact.sourceEntityId || fact.factId,
        crmActivityId: payloadString(payload, "activityId"),
        portalUserId: fact.managerId,
        callType: direction === "outgoing" ? "1" : direction === "incoming" ? "2" : null,
        callStartDate: fact.occurredAt,
        callDurationSeconds: payloadNumber(payload, "durationSeconds"),
        crmEntityType: fact.dealId ? "DEAL" : null,
        crmEntityId: fact.dealId,
        callFailedCode: failedCode ?? (connected ? "200" : null),
        linkReason: fact.linkReason,
        linkConfidence: fact.linkConfidence
      } satisfies CallSnapshot;
    })
    .sort((left, right) => {
      const byTime = left.callStartDate.localeCompare(right.callStartDate);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
}

export function touchpointFactsToActivities(
  facts: DealTouchpointFactSnapshot[]
): ActivitySnapshot[] {
  const taskRows = new Map<string, ActivitySnapshot>();
  const activities: ActivitySnapshot[] = [];

  for (const fact of facts) {
    const payload = parsePayload(fact.payloadJson);

    if (fact.kind === "task_created" || fact.kind === "task_completed") {
      const current =
        taskRows.get(fact.sourceEntityId) ??
        ({
          id: fact.sourceEntityId,
          ownerTypeId: fact.dealId ? "2" : fact.contactId ? "3" : "0",
          ownerId: fact.dealId ?? fact.contactId ?? "",
          typeId: null,
          providerId: payloadString(payload, "providerId"),
          responsibleId: fact.managerId,
          createdTime: fact.occurredAt,
          deadline: payloadString(payload, "deadline"),
          lastUpdated: fact.occurredAt,
          completed: false,
          completedTime: null,
          subject: payloadString(payload, "subject"),
          description: payloadString(payload, "description")
        } satisfies ActivitySnapshot);

      if (fact.kind === "task_created") {
        current.createdTime = fact.occurredAt;
        current.deadline = payloadString(payload, "deadline");
        current.providerId = payloadString(payload, "providerId");
        current.subject = payloadString(payload, "subject");
        current.description = payloadString(payload, "description");
      } else {
        current.completed = true;
        current.completedTime = fact.occurredAt;
        current.subject ??= payloadString(payload, "subject");
        current.description ??= payloadString(payload, "description");
      }
      current.lastUpdated =
        current.lastUpdated.localeCompare(fact.occurredAt) > 0
          ? current.lastUpdated
          : fact.occurredAt;
      taskRows.set(fact.sourceEntityId, current);
      continue;
    }

    if (fact.kind === "meeting") {
      activities.push({
        id: fact.sourceEntityId,
        ownerTypeId: fact.dealId ? "2" : fact.contactId ? "3" : "0",
        ownerId: fact.dealId ?? fact.contactId ?? "",
        typeId: "1",
        providerId: "CRM_MEETING",
        responsibleId: fact.managerId,
        createdTime: payloadString(payload, "createdTime") ?? fact.occurredAt,
        deadline: payloadString(payload, "scheduledAt"),
        lastUpdated: fact.occurredAt,
        completed: payloadBoolean(payload, "completed"),
        completedTime:
          payloadString(payload, "completedTime") ??
          (payloadBoolean(payload, "completed") ? fact.occurredAt : null),
        subject: payloadString(payload, "subject"),
        description: payloadString(payload, "description")
      });
    }
  }

  return [...taskRows.values(), ...activities].sort((left, right) => {
    const byTime = left.createdTime.localeCompare(right.createdTime);
    return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
  });
}

export function touchpointFactsToMeetingDateChanges(
  facts: DealTouchpointFactSnapshot[]
): DealMeetingDateChangeSnapshot[] {
  return facts
    .filter((fact) => fact.kind === "meeting_date_changed" && fact.dealId)
    .map((fact) => {
      const payload = parsePayload(fact.payloadJson);

      return {
        id: fact.sourceEntityId || fact.factId,
        dealId: fact.dealId as string,
        assignedById: fact.managerId,
        previousMeetingDate: payloadString(payload, "previousMeetingDate"),
        nextMeetingDate: payloadString(payload, "nextMeetingDate"),
        changedAt: fact.occurredAt
      } satisfies DealMeetingDateChangeSnapshot;
    })
    .sort((left, right) => {
      const byTime = left.changedAt.localeCompare(right.changedAt);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
}
