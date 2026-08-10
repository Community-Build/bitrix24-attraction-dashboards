import type {
  ActivityBindingSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventVisitSnapshot,
  DealMeetingDateChangeSnapshot,
  DealSnapshot,
  DealStageFactSnapshot,
  DealTouchpointFactSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  EventVisitStageHistorySnapshot,
  IdentityLinkSnapshot,
  LeadSnapshot,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

const BITRIX_SOURCE_SYSTEM = "bitrix24";
const DEAL_OWNER_TYPE_ID = "2";
const CONTACT_OWNER_TYPE_ID = "3";

type StageLookupEntry = {
  name: string | null;
  semanticId: string | null;
  sortOrder: number | null;
};

type LinkedDealResolution = {
  deal: DealSnapshot | null;
  contactId: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export function buildIdentityLinks(input: {
  moduleKey: string;
  deals: DealSnapshot[];
  leads?: LeadSnapshot[];
}): IdentityLinkSnapshot[] {
  const rows: IdentityLinkSnapshot[] = input.deals.map((deal) => ({
    identityId: `identity:deal:${deal.id}`,
    moduleKey: input.moduleKey,
    dealId: deal.id,
    leadId: deal.leadId,
    contactId: deal.contactId ?? null,
    dealCategoryId: deal.categoryId,
    leadCategoryId: null,
    currentManagerId: deal.assignedById,
    currentStageId: deal.stageId,
    sourceId: deal.sourceId,
    createdAt: deal.dateCreate,
    updatedAt: deal.dateModify,
    linkConfidence: "high",
    linkReason: "deal_snapshot"
  }));

  for (const lead of input.leads ?? []) {
    const alreadyLinkedToDeal = input.deals.some((deal) => deal.leadId === lead.id);
    if (alreadyLinkedToDeal) {
      continue;
    }

    rows.push({
      identityId: `identity:lead:${lead.id}`,
      moduleKey: input.moduleKey,
      dealId: null,
      leadId: lead.id,
      contactId: null,
      dealCategoryId: null,
      leadCategoryId: null,
      currentManagerId: lead.assignedById,
      currentStageId: lead.statusId,
      sourceId: lead.sourceId,
      createdAt: lead.dateCreate,
      updatedAt: lead.dateModify,
      linkConfidence: "medium",
      linkReason: "lead_without_deal_snapshot"
    });
  }

  return rows.sort((left, right) => left.identityId.localeCompare(right.identityId));
}

export function buildDealStageFacts(input: {
  deals: DealSnapshot[];
  stageHistory: StageHistorySnapshot[];
  stageCatalog: StageCatalogEntry[];
}): DealStageFactSnapshot[] {
  const stageLookup = buildStageLookup(input.stageCatalog);
  const historyByDealId = groupStageHistoryByDeal(input.stageHistory);
  const rows: DealStageFactSnapshot[] = [];

  for (const deal of input.deals) {
    const historyRows = historyByDealId.get(deal.id) ?? [];
    const sourceRows =
      historyRows.length > 0
        ? historyRows
        : [
            {
              id: `current:${deal.id}:${deal.stageId}`,
              ownerId: deal.id,
              categoryId: deal.categoryId,
              stageId: deal.stageId,
              stageSemanticId: deal.stageSemanticId,
              typeId: null,
              createdTime: deal.dateCreate
            } satisfies StageHistorySnapshot
          ];

    sourceRows.forEach((row, index) => {
      const nextRow = sourceRows[index + 1];
      const catalogEntry = resolveStageCatalogEntry(stageLookup, deal.categoryId, row.stageId);

      rows.push({
        factId: `stage:deal:${deal.id}:${row.id}`,
        sourceSystem: BITRIX_SOURCE_SYSTEM,
        sourceEntityId: row.id,
        dealId: deal.id,
        contactId: deal.contactId ?? null,
        leadId: deal.leadId,
        categoryId: row.categoryId ?? deal.categoryId,
        stageId: row.stageId,
        stageName: catalogEntry?.name ?? null,
        stageSemanticId: row.stageSemanticId ?? catalogEntry?.semanticId ?? null,
        enteredAt: row.createdTime,
        leftAt: nextRow?.createdTime ?? null,
        managerId: deal.assignedById,
        sourceId: deal.sourceId,
        sortOrder: catalogEntry?.sortOrder ?? null,
        payloadJson:
          row.typeId === null
            ? null
            : JSON.stringify({
                typeId: row.typeId
              })
      });
    });
  }

  return rows.sort((left, right) => {
    const byDeal = left.dealId.localeCompare(right.dealId);
    if (byDeal !== 0) {
      return byDeal;
    }

    const byTime = left.enteredAt.localeCompare(right.enteredAt);
    return byTime !== 0 ? byTime : left.factId.localeCompare(right.factId);
  });
}

export function buildDealTouchpointFacts(input: {
  deals: DealSnapshot[];
  stageFacts: DealStageFactSnapshot[];
  activities: ActivitySnapshot[];
  activityBindings?: ActivityBindingSnapshot[];
  calls: CallSnapshot[];
  meetingDateChanges?: DealMeetingDateChangeSnapshot[];
  conversionEventVisits?: ConversionEventVisitSnapshot[];
}): DealTouchpointFactSnapshot[] {
  const dealById = new Map(input.deals.map((deal) => [deal.id, deal]));
  const dealByContactId = buildDealByContactId(input.deals);
  const activityById = new Map(input.activities.map((activity) => [activity.id, activity]));
  const bindingsByActivityId = groupActivityBindings(input.activityBindings ?? []);
  const rows: DealTouchpointFactSnapshot[] = [];

  for (const call of input.calls) {
    const activity = call.crmActivityId ? activityById.get(call.crmActivityId) ?? null : null;
    const resolution = resolveCallDeal({
      call,
      activity,
      bindingsByActivityId,
      dealById,
      dealByContactId
    });
    const deal = resolution.deal;
    const stageAtEvent = deal
      ? resolveStageFactAtTime(input.stageFacts, deal.id, call.callStartDate)
      : null;

    rows.push({
      factId: `call:${call.id}`,
      kind: "call",
      sourceSystem: BITRIX_SOURCE_SYSTEM,
      sourceEntityType: "call",
      sourceEntityId: call.id,
      occurredAt: call.callStartDate,
      dealId: deal?.id ?? null,
      contactId: deal?.contactId ?? resolution.contactId,
      leadId: deal?.leadId ?? null,
      managerId: call.portalUserId ?? activity?.responsibleId ?? null,
      sourceId: deal?.sourceId ?? null,
      stageIdAtEvent: stageAtEvent?.stageId ?? null,
      stageNameAtEvent: stageAtEvent?.stageName ?? null,
      linkConfidence: resolution.confidence,
      linkReason: resolution.reason,
      payloadJson: JSON.stringify({
        activityId: call.crmActivityId,
        direction: resolveCallDirection(call.callType),
        durationSeconds: call.callDurationSeconds,
        connected: isCallConnected(call),
        failed: isCallFailed(call),
        overThirtySeconds: call.callDurationSeconds > 30,
        failedCode: call.callFailedCode
      })
    });
  }

  for (const activity of input.activities) {
    if (isCallActivity(activity)) {
      continue;
    }

    const resolution = resolveActivityDeal(activity, dealById, dealByContactId);
    const deal = resolution.deal;
    const sourceId = deal?.sourceId ?? null;
    const contactId = deal?.contactId ?? resolution.contactId;

    if (isMeetingActivity(activity)) {
      const occurredAt = getMeetingCommunicationTime(activity);
      const stageAtEvent = deal
        ? resolveStageFactAtTime(input.stageFacts, deal.id, occurredAt)
        : null;

      rows.push({
        factId: `meeting:${activity.id}`,
        kind: "meeting",
        sourceSystem: BITRIX_SOURCE_SYSTEM,
        sourceEntityType: "activity",
        sourceEntityId: activity.id,
        occurredAt,
        dealId: deal?.id ?? null,
        contactId,
        leadId: deal?.leadId ?? null,
        managerId: activity.responsibleId,
        sourceId,
        stageIdAtEvent: stageAtEvent?.stageId ?? null,
        stageNameAtEvent: stageAtEvent?.stageName ?? null,
        linkConfidence: resolution.confidence,
        linkReason: resolution.reason,
        payloadJson: JSON.stringify({
          createdTime: activity.createdTime,
          scheduledAt: activity.deadline,
          completed: activity.completed,
          completedTime: activity.completedTime,
          subject: activity.subject ?? null,
          description: activity.description ?? null
        })
      });
      continue;
    }

    const createdStage = deal
      ? resolveStageFactAtTime(input.stageFacts, deal.id, activity.createdTime)
      : null;

    rows.push({
      factId: `task-created:${activity.id}`,
      kind: "task_created",
      sourceSystem: BITRIX_SOURCE_SYSTEM,
      sourceEntityType: "activity",
      sourceEntityId: activity.id,
      occurredAt: activity.createdTime,
      dealId: deal?.id ?? null,
      contactId,
      leadId: deal?.leadId ?? null,
      managerId: activity.responsibleId,
      sourceId,
      stageIdAtEvent: createdStage?.stageId ?? null,
      stageNameAtEvent: createdStage?.stageName ?? null,
      linkConfidence: resolution.confidence,
      linkReason: resolution.reason,
      payloadJson: JSON.stringify({
        deadline: activity.deadline,
        completed: activity.completed,
        completedTime: activity.completedTime,
        createdTime: activity.createdTime,
        providerId: activity.providerId,
        subject: activity.subject ?? null,
        description: activity.description ?? null
      })
    });

    if (!activity.completed || !activity.completedTime) {
      continue;
    }

    const completedStage = deal
      ? resolveStageFactAtTime(input.stageFacts, deal.id, activity.completedTime)
      : null;

    rows.push({
      factId: `task-completed:${activity.id}`,
      kind: "task_completed",
      sourceSystem: BITRIX_SOURCE_SYSTEM,
      sourceEntityType: "activity",
      sourceEntityId: activity.id,
      occurredAt: activity.completedTime,
      dealId: deal?.id ?? null,
      contactId,
      leadId: deal?.leadId ?? null,
      managerId: activity.responsibleId,
      sourceId,
      stageIdAtEvent: completedStage?.stageId ?? null,
      stageNameAtEvent: completedStage?.stageName ?? null,
      linkConfidence: resolution.confidence,
      linkReason: resolution.reason,
      payloadJson: JSON.stringify({
        deadline: activity.deadline,
        createdTime: activity.createdTime,
        completedTime: activity.completedTime,
        providerId: activity.providerId,
        subject: activity.subject ?? null,
        description: activity.description ?? null
      })
    });
  }

  for (const change of input.meetingDateChanges ?? []) {
    const deal = dealById.get(change.dealId) ?? null;
    const stageAtEvent = deal
      ? resolveStageFactAtTime(input.stageFacts, deal.id, change.changedAt)
      : null;

    rows.push({
      factId: `meeting-date-changed:${change.id}`,
      kind: "meeting_date_changed",
      sourceSystem: BITRIX_SOURCE_SYSTEM,
      sourceEntityType: "deal_meeting_date_change",
      sourceEntityId: change.id,
      occurredAt: change.changedAt,
      dealId: deal?.id ?? change.dealId,
      contactId: deal?.contactId ?? null,
      leadId: deal?.leadId ?? null,
      managerId: change.assignedById ?? deal?.assignedById ?? null,
      sourceId: deal?.sourceId ?? null,
      stageIdAtEvent: stageAtEvent?.stageId ?? null,
      stageNameAtEvent: stageAtEvent?.stageName ?? null,
      linkConfidence: deal ? "high" : "low",
      linkReason: deal ? "meeting_date_change_deal" : "meeting_date_change_missing_deal",
      payloadJson: JSON.stringify({
        previousMeetingDate: change.previousMeetingDate,
        nextMeetingDate: change.nextMeetingDate
      })
    });
  }

  for (const visit of input.conversionEventVisits ?? []) {
    const deal = visit.dealId ? dealById.get(visit.dealId) ?? null : null;
    const occurredAt = visit.updatedTime ?? visit.createdTime;
    const stageAtEvent = deal
      ? resolveStageFactAtTime(input.stageFacts, deal.id, occurredAt)
      : null;

    rows.push({
      factId: `conversion-event-visit:${visit.id}`,
      kind: "conversion_event_visit",
      sourceSystem: BITRIX_SOURCE_SYSTEM,
      sourceEntityType: "conversion_event_visit",
      sourceEntityId: visit.id,
      occurredAt,
      dealId: deal?.id ?? null,
      contactId: deal?.contactId ?? visit.contactId,
      leadId: deal?.leadId ?? null,
      managerId: visit.managerId ?? deal?.assignedById ?? null,
      sourceId: visit.sourceId ?? deal?.sourceId ?? null,
      stageIdAtEvent: stageAtEvent?.stageId ?? null,
      stageNameAtEvent: stageAtEvent?.stageName ?? null,
      linkConfidence: deal ? "high" : visit.dealId ? "low" : "medium",
      linkReason: deal
        ? "conversion_visit_deal"
        : visit.dealId
          ? "conversion_visit_missing_deal"
          : "conversion_visit_without_deal",
      payloadJson: JSON.stringify({
        eventId: visit.eventId ?? null,
        eventName: visit.eventName,
        eventDate: visit.eventDate,
        status: visit.status,
        visitStageId: visit.stageId,
        visitStageName: visit.stageName,
        upstreamDealId: visit.dealId
      })
    });
  }

  return rows.sort((left, right) => {
    const byTime = left.occurredAt.localeCompare(right.occurredAt);
    return byTime !== 0 ? byTime : left.factId.localeCompare(right.factId);
  });
}

export function buildEventVisitFacts(input: {
  visits: ConversionEventVisitSnapshot[];
  events: EventSnapshot[];
  visitStageHistory: EventVisitStageHistorySnapshot[];
  deals: DealSnapshot[];
  stageFacts: DealStageFactSnapshot[];
}): EventVisitFactSnapshot[] {
  const eventById = new Map(input.events.map((event) => [event.eventId, event]));
  const dealById = new Map(input.deals.map((deal) => [deal.id, deal]));
  const historyByVisitId = new Map<string, EventVisitStageHistorySnapshot[]>();

  for (const row of input.visitStageHistory) {
    const current = historyByVisitId.get(row.visitId) ?? [];
    current.push(row);
    current.sort((left, right) => {
      const byTime = left.changedAt.localeCompare(right.changedAt);
      return byTime !== 0 ? byTime : left.historyId.localeCompare(right.historyId);
    });
    historyByVisitId.set(row.visitId, current);
  }

  return input.visits
    .map((visit) => {
      const event = visit.eventId ? eventById.get(visit.eventId) ?? null : null;
      const historyRows = historyByVisitId.get(visit.id) ?? [];
      const statusTimes = resolveVisitStatusTimes(visit, historyRows);
      const eventDate = event?.eventDate ?? visit.eventDate;
      const resolution = resolveEventVisitDeal({
        visit,
        dealById
      });
      const deal = resolution.deal;
      const stageAtEvent = deal
        ? resolveStageFactAtTime(
            input.stageFacts,
            deal.id,
            statusTimes.invitedAt ?? visit.createdTime
          )
        : null;

      return {
        visitId: visit.id,
        eventId: visit.eventId ?? null,
        dealId: deal?.id ?? null,
        contactId: deal?.contactId ?? visit.contactId,
        leadId: deal?.leadId ?? null,
        managerId: visit.managerId ?? deal?.assignedById ?? null,
        sourceId: visit.sourceId ?? deal?.sourceId ?? null,
        currentStageId: visit.stageId,
        currentStageName: visit.stageName,
        invitedAt: statusTimes.invitedAt,
        confirmedAt: statusTimes.confirmedAt,
        attendedAt: statusTimes.attendedAt,
        refusedAt: statusTimes.refusedAt,
        finalStatus: resolveVisitFactFinalStatus(visit, statusTimes),
        eventDate,
        stageIdAtEvent: stageAtEvent?.stageId ?? null,
        linkConfidence: resolution.confidence,
        linkReason: resolution.reason,
        payloadJson: JSON.stringify({
          eventName: visit.eventName,
          eventStatus: event?.status ?? null,
          upstreamDealId: visit.dealId,
          visitUpdatedTime: visit.updatedTime
        })
      };
    })
    .sort((left, right) => {
      const byDate = (left.eventDate ?? "").localeCompare(right.eventDate ?? "");
      return byDate !== 0 ? byDate : left.visitId.localeCompare(right.visitId);
    });
}

export function buildConversionEventTouchpointFacts(input: {
  eventVisitFacts: EventVisitFactSnapshot[];
  stageFacts: DealStageFactSnapshot[];
}): DealTouchpointFactSnapshot[] {
  return input.eventVisitFacts
    .filter((fact) => Boolean(fact.dealId))
    .map((fact) => {
      const occurredAt =
        fact.invitedAt ?? fact.confirmedAt ?? fact.attendedAt ?? fact.refusedAt ?? fact.eventDate;
      const stageFact = input.stageFacts.find(
        (stage) =>
          stage.dealId === fact.dealId &&
          (!fact.stageIdAtEvent || stage.stageId === fact.stageIdAtEvent)
      );

      return {
        factId: `conversion-event-visit:${fact.visitId}`,
        kind: "conversion_event_visit",
        sourceSystem: BITRIX_SOURCE_SYSTEM,
        sourceEntityType: "event_visit_fact",
        sourceEntityId: fact.visitId,
        occurredAt: occurredAt ?? fact.eventDate ?? "1970-01-01T00:00:00.000Z",
        dealId: fact.dealId,
        contactId: fact.contactId,
        leadId: fact.leadId,
        managerId: fact.managerId,
        sourceId: fact.sourceId,
        stageIdAtEvent: fact.stageIdAtEvent,
        stageNameAtEvent: stageFact?.stageName ?? null,
        linkConfidence: fact.linkConfidence,
        linkReason: fact.linkReason,
        payloadJson: JSON.stringify({
          eventId: fact.eventId,
          eventDate: fact.eventDate,
          finalStatus: fact.finalStatus,
          invitedAt: fact.invitedAt,
          confirmedAt: fact.confirmedAt,
          attendedAt: fact.attendedAt,
          refusedAt: fact.refusedAt
        })
      } satisfies DealTouchpointFactSnapshot;
    })
    .sort((left, right) => {
      const byTime = left.occurredAt.localeCompare(right.occurredAt);
      return byTime !== 0 ? byTime : left.factId.localeCompare(right.factId);
    });
}

export function resolveStageFactAtTime(
  stageFacts: DealStageFactSnapshot[],
  dealId: string,
  timestamp: string
) {
  const targetTime = Date.parse(timestamp);
  if (!Number.isFinite(targetTime)) {
    return null;
  }

  const rows = stageFacts
    .filter((row) => row.dealId === dealId)
    .sort((left, right) => {
      const byTime = left.enteredAt.localeCompare(right.enteredAt);
      return byTime !== 0 ? byTime : left.factId.localeCompare(right.factId);
    });
  let resolved: DealStageFactSnapshot | null = null;

  for (const row of rows) {
    const enteredAt = Date.parse(row.enteredAt);
    const leftAt = row.leftAt ? Date.parse(row.leftAt) : Number.POSITIVE_INFINITY;

    if (
      Number.isFinite(enteredAt) &&
      targetTime >= enteredAt &&
      targetTime < leftAt
    ) {
      return row;
    }

    if (Number.isFinite(enteredAt) && enteredAt <= targetTime) {
      resolved = row;
    }
  }

  return resolved ?? rows[0] ?? null;
}

function buildStageLookup(stageCatalog: StageCatalogEntry[]) {
  const map = new Map<string, StageLookupEntry>();

  for (const entry of stageCatalog) {
    if (entry.entityType !== "deal") {
      continue;
    }

    map.set(stageLookupKey(entry.categoryId, entry.statusId), {
      name: entry.name,
      semanticId: entry.semanticId,
      sortOrder: entry.sortOrder ?? null
    });
    map.set(stageLookupKey(null, entry.statusId), {
      name: entry.name,
      semanticId: entry.semanticId,
      sortOrder: entry.sortOrder ?? null
    });
  }

  return map;
}

function resolveStageCatalogEntry(
  stageLookup: Map<string, StageLookupEntry>,
  categoryId: string | null,
  stageId: string
) {
  return (
    stageLookup.get(stageLookupKey(categoryId, stageId)) ??
    stageLookup.get(stageLookupKey(null, stageId)) ??
    null
  );
}

function stageLookupKey(categoryId: string | null, stageId: string) {
  return `${categoryId ?? "ANY"}:${stageId}`;
}

function groupStageHistoryByDeal(stageHistory: StageHistorySnapshot[]) {
  const map = new Map<string, StageHistorySnapshot[]>();

  for (const row of stageHistory) {
    const current = map.get(row.ownerId) ?? [];
    current.push(row);
    map.set(row.ownerId, current);
  }

  for (const rows of map.values()) {
    rows.sort((left, right) => {
      const byTime = left.createdTime.localeCompare(right.createdTime);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
  }

  return map;
}

function groupActivityBindings(activityBindings: ActivityBindingSnapshot[]) {
  const map = new Map<string, ActivityBindingSnapshot[]>();

  for (const binding of activityBindings) {
    const current = map.get(binding.activityId) ?? [];
    current.push(binding);
    map.set(binding.activityId, current);
  }

  return map;
}

function buildDealByContactId(deals: DealSnapshot[]) {
  const map = new Map<string, DealSnapshot[]>();

  for (const deal of deals) {
    if (!deal.contactId) {
      continue;
    }

    const current = map.get(deal.contactId) ?? [];
    current.push(deal);
    current.sort((left, right) => left.dateCreate.localeCompare(right.dateCreate));
    map.set(deal.contactId, current);
  }

  return map;
}

function resolveCallDeal(input: {
  call: CallSnapshot;
  activity: ActivitySnapshot | null;
  bindingsByActivityId: Map<string, ActivityBindingSnapshot[]>;
  dealById: Map<string, DealSnapshot>;
  dealByContactId: Map<string, DealSnapshot[]>;
}): LinkedDealResolution {
  const boundDeal = input.call.crmActivityId
    ? resolveBoundDeal(
        input.bindingsByActivityId.get(input.call.crmActivityId) ?? [],
        input.dealById
      )
    : null;
  if (boundDeal) {
    return {
      deal: boundDeal,
      contactId: boundDeal.contactId ?? null,
      confidence: "high",
      reason: "activity_binding_deal"
    };
  }

  if (input.activity?.ownerTypeId === DEAL_OWNER_TYPE_ID) {
    const deal = input.dealById.get(input.activity.ownerId) ?? null;
    if (deal) {
      return {
        deal,
        contactId: deal.contactId ?? null,
        confidence: "high",
        reason: "activity_owner_deal"
      };
    }
  }

  if (isDealCallEntityType(input.call.crmEntityType) && input.call.crmEntityId) {
    const deal = input.dealById.get(input.call.crmEntityId) ?? null;
    if (deal) {
      return {
        deal,
        contactId: deal.contactId ?? null,
        confidence: "high",
        reason: "call_entity_deal"
      };
    }
  }

  const contactId =
    input.activity?.ownerTypeId === CONTACT_OWNER_TYPE_ID
      ? input.activity.ownerId
      : isContactCallEntityType(input.call.crmEntityType)
        ? input.call.crmEntityId
        : null;
  const contactDeal = contactId
    ? resolveSingleActiveDealForContact(contactId, input.dealByContactId)
    : null;

  if (contactId && contactDeal) {
    return {
      deal: contactDeal,
      contactId,
      confidence: "medium",
      reason: "contact_single_deal_fallback"
    };
  }

  return {
    deal: null,
    contactId,
    confidence: "low",
    reason: contactId ? "contact_without_unique_deal" : "unlinked_call"
  };
}

function resolveEventVisitDeal(input: {
  visit: ConversionEventVisitSnapshot;
  dealById: Map<string, DealSnapshot>;
}): LinkedDealResolution {
  if (input.visit.dealId) {
    const deal = input.dealById.get(input.visit.dealId) ?? null;
    if (deal) {
      return {
        deal,
        contactId: deal.contactId ?? input.visit.contactId,
        confidence: "high",
        reason: "event_visit_deal"
      };
    }

    return {
      deal: null,
      contactId: input.visit.contactId,
      confidence: "low",
      reason: "event_visit_deal_out_of_scope"
    };
  }

  return {
    deal: null,
    contactId: input.visit.contactId,
    confidence: "low",
    reason: input.visit.contactId
      ? "event_visit_without_direct_deal"
      : "event_visit_without_identity"
  };
}

function resolveActivityDeal(
  activity: ActivitySnapshot,
  dealById: Map<string, DealSnapshot>,
  dealByContactId: Map<string, DealSnapshot[]>
): LinkedDealResolution {
  if (activity.ownerTypeId === DEAL_OWNER_TYPE_ID) {
    const deal = dealById.get(activity.ownerId) ?? null;
    if (deal) {
      return {
        deal,
        contactId: deal.contactId ?? null,
        confidence: "high",
        reason: "activity_owner_deal"
      };
    }
  }

  if (activity.ownerTypeId === CONTACT_OWNER_TYPE_ID) {
    const deal = resolveSingleActiveDealForContact(activity.ownerId, dealByContactId);
    if (deal) {
      return {
        deal,
        contactId: activity.ownerId,
        confidence: "medium",
        reason: "contact_single_deal_fallback"
      };
    }

    return {
      deal: null,
      contactId: activity.ownerId,
      confidence: "low",
      reason: "contact_without_unique_deal"
    };
  }

  return {
    deal: null,
    contactId: null,
    confidence: "low",
    reason: "activity_without_deal"
  };
}

function resolveBoundDeal(
  bindings: ActivityBindingSnapshot[],
  dealById: Map<string, DealSnapshot>
) {
  for (const binding of bindings) {
    if (binding.ownerTypeId !== DEAL_OWNER_TYPE_ID) {
      continue;
    }

    const deal = dealById.get(binding.ownerId);
    if (deal) {
      return deal;
    }
  }

  return null;
}

function resolveSingleActiveDealForContact(
  contactId: string,
  dealByContactId: Map<string, DealSnapshot[]>
) {
  const deals = dealByContactId.get(contactId) ?? [];
  if (deals.length !== 1) {
    return null;
  }

  return deals[0] ?? null;
}

function isCallActivity(activity: ActivitySnapshot) {
  return activity.typeId === "2" || activity.providerId === "VOXIMPLANT_CALL";
}

function isMeetingActivity(activity: ActivitySnapshot) {
  return activity.typeId === "1" || activity.providerId === "CRM_MEETING";
}

function getMeetingCommunicationTime(activity: ActivitySnapshot) {
  return activity.completedTime ?? activity.lastUpdated ?? activity.createdTime;
}

function resolveVisitStatusTimes(
  visit: ConversionEventVisitSnapshot,
  historyRows: EventVisitStageHistorySnapshot[]
) {
  const result: {
    invitedAt: string | null;
    confirmedAt: string | null;
    attendedAt: string | null;
    refusedAt: string | null;
  } = {
    invitedAt: visit.createdTime || null,
    confirmedAt: null,
    attendedAt: null,
    refusedAt: null
  };

  for (const row of historyRows) {
    const status = resolveVisitFinalStatus(row.stageName, "unknown");
    if (status === "invited" && !result.invitedAt) {
      result.invitedAt = row.changedAt;
    } else if (status === "confirmed" && !result.confirmedAt) {
      result.confirmedAt = row.changedAt;
    } else if (status === "attended" && !result.attendedAt) {
      result.attendedAt = row.changedAt;
    } else if (status === "refused" && !result.refusedAt) {
      result.refusedAt = row.changedAt;
    }
  }

  const finalStatus = resolveVisitFinalStatus(visit.stageName, visit.status);
  if (finalStatus === "invited" && !result.invitedAt) {
    result.invitedAt = visit.createdTime;
  } else if (finalStatus === "confirmed" && !result.confirmedAt) {
    result.confirmedAt = visit.updatedTime;
  } else if (finalStatus === "attended" && !result.attendedAt) {
    result.attendedAt = visit.updatedTime;
  } else if (finalStatus === "refused" && !result.refusedAt) {
    result.refusedAt = visit.updatedTime;
  }

  return result;
}

function resolveVisitFinalStatus(
  stageName: string | null | undefined,
  fallbackStatus: ConversionEventVisitSnapshot["status"]
): EventVisitFactSnapshot["finalStatus"] {
  const label = normalizeStatusLabel(stageName);
  const stageCode = label.split(":").pop() ?? label;

  if (label.includes("посетил") || label.includes("на мероприятии") || label.includes("дошел")) {
    return "attended";
  }

  if (stageCode === "success") {
    return "attended";
  }

  if (label.includes("пойду") || label.includes("подтверж")) {
    return "confirmed";
  }

  if (stageCode === "preparation") {
    return "confirmed";
  }

  if (label.includes("отказ") || label.includes("не пойдет")) {
    return "refused";
  }

  if (stageCode === "fail") {
    return "refused";
  }

  if (label.includes("не дош") || label.includes("не приш")) {
    return "missed";
  }

  if (label.includes("приглаш")) {
    return "invited";
  }

  if (stageCode === "new") {
    return "invited";
  }

  if (
    fallbackStatus === "attended" ||
    fallbackStatus === "confirmed" ||
    fallbackStatus === "refused" ||
    fallbackStatus === "invited"
  ) {
    return fallbackStatus;
  }

  return "unknown";
}

function resolveVisitFactFinalStatus(
  visit: ConversionEventVisitSnapshot,
  statusTimes: {
    invitedAt: string | null;
    confirmedAt: string | null;
    attendedAt: string | null;
    refusedAt: string | null;
  }
): EventVisitFactSnapshot["finalStatus"] {
  if (statusTimes.attendedAt) {
    return "attended";
  }

  const currentStatus = resolveVisitFinalStatus(visit.stageName, visit.status);
  if (currentStatus === "attended") {
    return "attended";
  }

  if (currentStatus === "missed") {
    return "missed";
  }

  if (statusTimes.refusedAt || currentStatus === "refused") {
    return "refused";
  }

  if (statusTimes.confirmedAt || currentStatus === "confirmed") {
    return "confirmed";
  }

  if (statusTimes.invitedAt || currentStatus === "invited") {
    return "invited";
  }

  return "unknown";
}

function normalizeStatusLabel(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е");
}

function isDealCallEntityType(value: string | null) {
  return value === DEAL_OWNER_TYPE_ID || value?.toUpperCase() === "DEAL";
}

function isContactCallEntityType(value: string | null) {
  return value === CONTACT_OWNER_TYPE_ID || value?.toUpperCase() === "CONTACT";
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

function normalizeCallStatusCode(code: string | null) {
  return code?.trim() ?? "";
}

function isCallConnected(call: CallSnapshot) {
  if (call.callDurationSeconds <= 0) {
    return false;
  }

  const statusCode = normalizeCallStatusCode(call.callFailedCode);
  return statusCode.length === 0 || statusCode === "200";
}

function isCallFailed(call: CallSnapshot) {
  return resolveCallDirection(call.callType) === "outgoing" && !isCallConnected(call);
}
