import { describe, expect, it } from "vitest";

import type {
  DealSnapshot,
  DealStageFactSnapshot,
  DealTouchpointFactSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";
import { buildSourceCohortTrajectoryReport } from "../src/domain/source-cohort-trajectory";

function deal(input: Partial<DealSnapshot> & Pick<DealSnapshot, "id">): DealSnapshot {
  return {
    id: input.id,
    title: null,
    contactId: input.contactId ?? null,
    leadId: null,
    categoryId: input.categoryId ?? "10",
    stageId: input.stageId ?? "C10:NEW",
    stageSemanticId: input.stageSemanticId ?? "P",
    opportunity: null,
    assignedById: input.assignedById ?? "501",
    sourceId: input.sourceId ?? "LIDGEN",
    qualityValue: input.qualityValue ?? "3.1 Готов ко встрече",
    businessClubValue: input.businessClubValue ?? "ClubFirst One",
    targetGroupValue: null,
    meetingTypeValue: null,
    meetingDateValue: null,
    tariffValue: null,
    conversionEventValue: null,
    refusalReasonValue: null,
    refusalReasonDetail: null,
    dateCreate: input.dateCreate ?? "2026-06-01T09:00:00.000Z",
    dateModify: input.dateModify ?? "2026-06-10T09:00:00.000Z",
    dateClosed: input.dateClosed ?? null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null
  };
}

function history(input: {
  id: string;
  dealId: string;
  stageId: string;
  createdTime: string;
  stageSemanticId?: string | null;
}): StageHistorySnapshot {
  return {
    id: input.id,
    ownerId: input.dealId,
    categoryId: "10",
    stageId: input.stageId,
    stageSemanticId: input.stageSemanticId ?? "P",
    typeId: null,
    createdTime: input.createdTime
  };
}

function stageFact(input: {
  factId: string;
  dealId: string;
  stageId: string;
  enteredAt: string;
  leftAt?: string | null;
  stageSemanticId?: string | null;
}): DealStageFactSnapshot {
  const catalogStage = stageCatalog.find((stage) => stage.statusId === input.stageId);

  return {
    factId: input.factId,
    sourceSystem: "bitrix24",
    sourceEntityId: input.factId,
    dealId: input.dealId,
    contactId: null,
    leadId: null,
    categoryId: "10",
    stageId: input.stageId,
    stageName: catalogStage?.name ?? null,
    stageSemanticId: input.stageSemanticId ?? catalogStage?.semanticId ?? "P",
    enteredAt: input.enteredAt,
    leftAt: input.leftAt ?? null,
    managerId: "501",
    sourceId: "LIDGEN",
    sortOrder: catalogStage?.sortOrder ?? null,
    payloadJson: null
  };
}

function touchpoint(
  input: Partial<DealTouchpointFactSnapshot> &
    Pick<DealTouchpointFactSnapshot, "factId" | "kind" | "occurredAt" | "dealId">
): DealTouchpointFactSnapshot {
  return {
    sourceSystem: "bitrix24",
    sourceEntityType: input.kind,
    sourceEntityId: input.factId,
    contactId: null,
    leadId: null,
    managerId: input.managerId ?? null,
    sourceId: input.sourceId ?? null,
    stageIdAtEvent: input.stageIdAtEvent ?? null,
    stageNameAtEvent: null,
    linkConfidence: input.linkConfidence ?? "high",
    linkReason: input.linkReason ?? "fixture",
    payloadJson: input.payloadJson ?? null,
    ...input
  };
}

const stageCatalog: StageCatalogEntry[] = [
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:NEW",
    name: "База входящая",
    semanticId: "P",
    sortOrder: 10
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:PREPARATION",
    name: "Звонок-знакомство",
    semanticId: "P",
    sortOrder: 20
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:MEETING",
    name: "Встреча-знакомство",
    semanticId: "P",
    sortOrder: 40
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:DEMO",
    name: "Демонстрация",
    semanticId: "P",
    sortOrder: 60
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:CONTRACT",
    name: "Контракт (договор+счёт)",
    semanticId: "P",
    sortOrder: 70
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:LOSE",
    name: "Корзина",
    semanticId: "F",
    sortOrder: 90
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:WON",
    name: "Передано в клуб",
    semanticId: "S",
    sortOrder: 100
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "LIDGEN",
    name: "Лидген УС",
    semanticId: null
  }
];

function successfulCall(
  input: Pick<DealTouchpointFactSnapshot, "factId" | "dealId" | "occurredAt"> &
    Partial<DealTouchpointFactSnapshot>
) {
  return touchpoint({
    kind: "call",
    linkConfidence: "high",
    payloadJson: JSON.stringify({
      direction: "outgoing",
      connected: true,
      overThirtySeconds: true
    }),
    ...input
  });
}

function eventVisit(
  input: Partial<EventVisitFactSnapshot> &
    Pick<EventVisitFactSnapshot, "visitId" | "dealId" | "eventId" | "eventDate">
): EventVisitFactSnapshot {
  return {
    contactId: null,
    leadId: null,
    managerId: "501",
    sourceId: "LIDGEN",
    currentStageId: "DT:SUCCESS",
    currentStageName: "Посетил",
    invitedAt: null,
    confirmedAt: null,
    attendedAt: input.eventDate,
    refusedAt: null,
    finalStatus: "attended",
    stageIdAtEvent: "C10:DEMO",
    linkConfidence: "high",
    linkReason: "event_visit_deal",
    payloadJson: null,
    ...input
  };
}

function event(
  input: Partial<EventSnapshot> & Pick<EventSnapshot, "eventId" | "eventDate">
): EventSnapshot {
  return {
    eventId: input.eventId,
    entityTypeId: input.entityTypeId ?? 1042,
    categoryId: input.categoryId ?? 10,
    title: input.title ?? input.eventId,
    eventDate: input.eventDate,
    startAt: input.startAt ?? input.eventDate,
    endAt: input.endAt ?? input.eventDate,
    stageId: input.stageId ?? "DT:SUCCESS",
    stageName: input.stageName ?? "Проведено",
    status: input.status ?? "completed",
    eventTypeId: input.eventTypeId ?? "intro",
    eventTypeLabel: input.eventTypeLabel ?? "Знакомство с клубом",
    formatId: input.formatId ?? "offline",
    createdTime: input.createdTime ?? input.eventDate,
    updatedTime: input.updatedTime ?? input.eventDate
  };
}

describe("buildSourceCohortTrajectoryReport", () => {
  it("builds the core conversion path and keeps event depth separate from contract conversion", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      now: new Date("2026-06-30T23:59:59.999Z"),
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "three-events-won",
          stageId: "C10:WON",
          stageSemanticId: "S",
          dateClosed: "2026-06-08T09:00:00.000Z"
        }),
        deal({ id: "first-call-only" }),
        deal({ id: "contract-no-event", stageId: "C10:CONTRACT" })
      ],
      stageCatalog,
      dealStageFacts: [
        stageFact({
          factId: "won-base",
          dealId: "three-events-won",
          stageId: "C10:NEW",
          enteredAt: "2026-06-01T09:00:00.000Z",
          leftAt: "2026-06-07T09:00:00.000Z"
        }),
        stageFact({
          factId: "won-contract",
          dealId: "three-events-won",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-06-07T09:00:00.000Z",
          leftAt: "2026-06-08T09:00:00.000Z"
        }),
        stageFact({
          factId: "won-transferred",
          dealId: "three-events-won",
          stageId: "C10:WON",
          enteredAt: "2026-06-08T09:00:00.000Z",
          stageSemanticId: "S"
        }),
        stageFact({
          factId: "contract-base",
          dealId: "contract-no-event",
          stageId: "C10:NEW",
          enteredAt: "2026-06-01T09:00:00.000Z",
          leftAt: "2026-06-04T09:00:00.000Z"
        }),
        stageFact({
          factId: "contract-stage",
          dealId: "contract-no-event",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-06-04T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        touchpoint({
          factId: "won-first-attempt",
          kind: "call",
          dealId: "three-events-won",
          occurredAt: "2026-06-01T10:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: false,
            overThirtySeconds: false
          })
        }),
        successfulCall({
          factId: "won-confirmed-call",
          dealId: "three-events-won",
          occurredAt: "2026-06-02T09:00:00.000Z"
        }),
        touchpoint({
          factId: "won-meeting-scheduled",
          kind: "meeting_date_changed",
          dealId: "three-events-won",
          occurredAt: "2026-06-02T10:00:00.000Z",
          payloadJson: JSON.stringify({
            previousMeetingDate: null,
            nextMeetingDate: "2026-06-03T09:00:00.000Z"
          })
        }),
        touchpoint({
          factId: "won-meeting-completed",
          kind: "meeting",
          dealId: "three-events-won",
          occurredAt: "2026-06-03T09:00:00.000Z",
          payloadJson: JSON.stringify({
            createdTime: "2026-06-02T10:00:00.000Z",
            scheduledAt: "2026-06-03T09:00:00.000Z",
            completed: true
          })
        }),
        touchpoint({
          factId: "call-only-attempt",
          kind: "call",
          dealId: "first-call-only",
          occurredAt: "2026-06-01T11:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: false,
            overThirtySeconds: false
          })
        }),
        successfulCall({
          factId: "contract-confirmed-call",
          dealId: "contract-no-event",
          occurredAt: "2026-06-01T12:00:00.000Z"
        }),
        touchpoint({
          factId: "contract-meeting",
          kind: "meeting",
          dealId: "contract-no-event",
          occurredAt: "2026-06-03T09:00:00.000Z",
          payloadJson: JSON.stringify({
            createdTime: "2026-06-02T09:00:00.000Z",
            scheduledAt: "2026-06-03T09:00:00.000Z",
            completed: true
          })
        })
      ],
      eventVisitFacts: [
        eventVisit({
          visitId: "event-1-visit",
          eventId: "event-1",
          dealId: "three-events-won",
          eventDate: "2026-06-04T09:00:00.000Z",
          attendedAt: "2026-07-01T09:00:00.000Z"
        }),
        eventVisit({
          visitId: "event-1-duplicate",
          eventId: "event-1",
          dealId: "three-events-won",
          eventDate: "2026-06-04T09:00:00.000Z"
        }),
        eventVisit({
          visitId: "event-2-visit",
          eventId: "event-2",
          dealId: "three-events-won",
          eventDate: "2026-06-05T09:00:00.000Z"
        }),
        eventVisit({
          visitId: "event-3-visit",
          eventId: "event-3",
          dealId: "three-events-won",
          eventDate: "2026-06-06T09:00:00.000Z"
        })
      ]
    });

    const journey = report.conversionJourney;
    expect(journey).toBeDefined();
    expect(
      journey!.coreSteps.map((step) => [
        step.stepKey,
        step.deals,
        step.rateFromPrevious,
        step.dropoffDeals
      ])
    ).toEqual([
      ["created", 3, 100, 0],
      ["first_call", 3, 100, 0],
      ["confirmed_conversation", 2, 66.67, 1],
      ["meeting_scheduled", 2, 100, 0],
      ["meeting_completed", 2, 100, 0],
      ["contract", 2, 100, 0],
      ["transferred", 1, 50, 1]
    ]);
    expect(
      journey!.eventSteps.map((step) => [
        step.stepKey,
        step.deals,
        step.rateFromPrevious
      ])
    ).toEqual([
      ["event_1", 1, 50],
      ["event_2", 1, 100],
      ["event_3_plus", 1, 100]
    ]);
    expect(journey!.eventDepthRows).toEqual([
      expect.objectContaining({
        depthKey: "0",
        deals: 1,
        contractDeals: 1,
        contractRate: 100,
        transferredDeals: 0
      }),
      expect.objectContaining({ depthKey: "1", deals: 0 }),
      expect.objectContaining({ depthKey: "2", deals: 0 }),
      expect.objectContaining({
        depthKey: "3_plus",
        deals: 1,
        contractDeals: 1,
        contractRate: 100,
        transferredDeals: 1,
        transferredRate: 100
      })
    ]);
  });

  it("calculates previous-step rates as conditional intersections, not raw step ratios", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        deal({ id: "call-and-meeting", stageId: "C10:MEETING" }),
        deal({ id: "call-no-meeting", stageId: "C10:PREPARATION" }),
        deal({ id: "meeting-no-call", stageId: "C10:MEETING" }),
        deal({ id: "meeting-no-call-2", stageId: "C10:MEETING" })
      ],
      stageCatalog,
      stageHistory: [
        history({
          id: "call-and-meeting-new",
          dealId: "call-and-meeting",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "call-and-meeting-meeting",
          dealId: "call-and-meeting",
          stageId: "C10:MEETING",
          createdTime: "2026-06-03T09:00:00.000Z"
        }),
        history({
          id: "call-no-meeting-new",
          dealId: "call-no-meeting",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "call-no-meeting-call-stage",
          dealId: "call-no-meeting",
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-02T09:00:00.000Z"
        }),
        history({
          id: "meeting-no-call-new",
          dealId: "meeting-no-call",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "meeting-no-call-meeting",
          dealId: "meeting-no-call",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        }),
        history({
          id: "meeting-no-call-2-new",
          dealId: "meeting-no-call-2",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "meeting-no-call-2-meeting",
          dealId: "meeting-no-call-2",
          stageId: "C10:MEETING",
          createdTime: "2026-06-05T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        successfulCall({
          factId: "call-and-meeting-call",
          dealId: "call-and-meeting",
          occurredAt: "2026-06-02T09:00:00.000Z"
        }),
        successfulCall({
          factId: "call-no-meeting-call",
          dealId: "call-no-meeting",
          occurredAt: "2026-06-02T09:00:00.000Z"
        })
      ]
    });

    const meetingStep = report.factSteps.find((step) => step.stepKey === "meeting_stage");

    expect(report.factSteps.map((step) => [step.stepKey, step.deals])).toEqual([
      ["created", 4],
      ["first_successful_call", 2],
      ["meeting_stage", 3],
      ["completed_meeting", 0],
      ["attended_event", 0],
      ["contract_stage", 0],
      ["won", 0]
    ]);
    expect(meetingStep).toEqual(
      expect.objectContaining({
        deals: 3,
        rateFromPrevious: 50
      })
    );
  });

  it("keeps medium contact fallback calls out of the direct first-call numerator", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "medium-fallback-call" })],
      stageCatalog,
      stageHistory: [
        history({
          id: "medium-fallback-call-new",
          dealId: "medium-fallback-call",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        successfulCall({
          factId: "medium-fallback-call-fact",
          dealId: "medium-fallback-call",
          occurredAt: "2026-06-02T09:00:00.000Z",
          linkConfidence: "medium",
          linkReason: "contact_recent_deal"
        })
      ]
    });

    expect(report.overallSignals.firstSuccessfulCallFallbackDeals).toBe(1);
    expect(report.overallSignals.firstSuccessfulCallDeals).toBe(0);
    expect(report.overallSignals.noSuccessfulCallDeals).toBe(1);
    expect(report.dataQuality.warnings).toContain(
      "Есть успешные звонки только с косвенной связью по контакту; они показаны отдельно и не входят в основной показатель первого звонка."
    );
  });

  it("marks rows with fewer than 10 deals as low sample", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "small-a" }), deal({ id: "small-b" })],
      stageCatalog
    });

    expect(report.managerRows[0]).toEqual(
      expect.objectContaining({
        totalDeals: 2,
        dataQualityStatus: "low_sample"
      })
    );
  });

  it("counts initial stage dwell from deal creation when history starts after creation", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "history-after-create", stageId: "C10:PREPARATION" })],
      stageCatalog,
      stageHistory: [
        history({
          id: "history-after-create-prep",
          dealId: "history-after-create",
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-03T09:00:00.000Z"
        })
      ]
    });

    expect(report.stageNodes.find((stage) => stage.stageId === "C10:NEW")).toEqual(
      expect.objectContaining({
        reachedDeals: 1,
        medianDaysOnStage: 2
      })
    );
    expect(
      Object.fromEntries(
        report.stageTransitions.map((transition) => [
          `${transition.fromStageId ?? "START"}->${transition.toStageId}`,
          transition.deals
        ])
      )
    ).toMatchObject({
      "START->C10:NEW": 1,
      "C10:NEW->C10:PREPARATION": 1
    });
  });

  it("resolves key stages and terminal losses by stable stage ids before names", () => {
    const renamedStageCatalog = stageCatalog
      .filter((stage) => stage.statusId !== "C10:LOSE")
      .map((stage) => {
        if (stage.statusId === "C10:MEETING") {
          return { ...stage, name: "Очная диагностика" };
        }
        if (stage.statusId === "C10:CONTRACT") {
          return { ...stage, name: "Согласование договора и счета" };
        }
        return stage;
      })
      .concat({
        entityType: "deal",
        categoryId: "10",
        statusId: "C10:DECLINED",
        name: "Отклонено потребителем",
        semanticId: "P",
        sortOrder: 95
      });
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        deal({ id: "renamed-stages", stageId: "C10:CONTRACT" }),
        deal({ id: "declined-loss", stageId: "C10:DECLINED" })
      ],
      stageCatalog: renamedStageCatalog,
      stageHistory: [
        history({
          id: "renamed-stages-new",
          dealId: "renamed-stages",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "renamed-stages-meeting",
          dealId: "renamed-stages",
          stageId: "C10:MEETING",
          createdTime: "2026-06-03T09:00:00.000Z"
        }),
        history({
          id: "renamed-stages-contract",
          dealId: "renamed-stages",
          stageId: "C10:CONTRACT",
          createdTime: "2026-06-05T09:00:00.000Z"
        }),
        history({
          id: "declined-loss-new",
          dealId: "declined-loss",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "declined-loss-stage",
          dealId: "declined-loss",
          stageId: "C10:DECLINED",
          createdTime: "2026-06-04T09:00:00.000Z"
        })
      ]
    });

    expect(report.overallSignals.meetingStageDeals).toBe(1);
    expect(report.overallSignals.contractStageDeals).toBe(1);
    expect(report.overallSignals.contractWithoutWinDeals).toBe(1);
    expect(report.overallSignals.lostDeals).toBe(1);
    expect(report.overallSignals.openDeals).toBe(1);
    expect(report.stageNodes.find((stage) => stage.stageId === "C10:DECLINED")).toEqual(
      expect.objectContaining({
        reachedDeals: 1,
        medianDaysOnStage: null
      })
    );
  });

  it("keeps CRM stages separate from factual calls, meetings and event visits", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "fast-stalled",
          assignedById: "501",
          stageId: "C10:MEETING",
          sourceId: "LIDGEN",
          businessClubValue: "ClubFirst One"
        }),
        deal({
          id: "slow-won",
          assignedById: "502",
          stageId: "C10:WON",
          stageSemanticId: "S",
          sourceId: "LIDGEN",
          businessClubValue: "ClubFirst Future",
          dateClosed: "2026-06-20T09:00:00.000Z"
        }),
        deal({
          id: "lost-no-touch",
          assignedById: "501",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          sourceId: "WEB",
          businessClubValue: "ClubFirst One"
        })
      ],
      stageCatalog,
      stageHistory: [
        history({
          id: "h1",
          dealId: "fast-stalled",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "h2",
          dealId: "fast-stalled",
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-01T12:00:00.000Z"
        }),
        history({
          id: "h3",
          dealId: "fast-stalled",
          stageId: "C10:MEETING",
          createdTime: "2026-06-02T09:00:00.000Z"
        }),
        history({
          id: "h4",
          dealId: "slow-won",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "h5",
          dealId: "slow-won",
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-03T09:00:00.000Z"
        }),
        history({
          id: "h6",
          dealId: "slow-won",
          stageId: "C10:MEETING",
          createdTime: "2026-06-05T09:00:00.000Z"
        }),
        history({
          id: "h7",
          dealId: "slow-won",
          stageId: "C10:DEMO",
          createdTime: "2026-06-12T09:00:00.000Z"
        }),
        history({
          id: "h8",
          dealId: "slow-won",
          stageId: "C10:CONTRACT",
          createdTime: "2026-06-14T09:00:00.000Z"
        }),
        history({
          id: "h8a",
          dealId: "slow-won",
          stageId: "C10:WON",
          stageSemanticId: "S",
          createdTime: "2026-06-20T09:00:00.000Z"
        }),
        history({
          id: "h9",
          dealId: "lost-no-touch",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "h10",
          dealId: "lost-no-touch",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          createdTime: "2026-06-06T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        touchpoint({
          factId: "call-fast",
          kind: "call",
          dealId: "fast-stalled",
          managerId: "501",
          occurredAt: "2026-06-01T10:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        }),
        touchpoint({
          factId: "call-slow",
          kind: "call",
          dealId: "slow-won",
          managerId: "502",
          occurredAt: "2026-06-03T10:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        }),
        touchpoint({
          factId: "meeting-slow",
          kind: "meeting",
          dealId: "slow-won",
          managerId: "502",
          occurredAt: "2026-06-06T09:00:00.000Z",
          payloadJson: JSON.stringify({
            completed: true,
            scheduledAt: "2026-06-06T09:00:00.000Z"
          })
        })
      ],
      eventVisitFacts: [
        {
          visitId: "visit-slow",
          eventId: "event-1",
          dealId: "slow-won",
          contactId: null,
          leadId: null,
          managerId: "502",
          sourceId: "LIDGEN",
          currentStageId: "DT:SUCCESS",
          currentStageName: "Посетил",
          invitedAt: "2026-06-07T09:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-06-10T09:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-06-10T09:00:00.000Z",
          stageIdAtEvent: "C10:MEETING",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        } satisfies EventVisitFactSnapshot
      ],
      managerDirectory: [
        { id: "501", name: "Анастасия Кузнецова" },
        { id: "502", name: "Мария Иванова" }
      ]
    });

    expect(report.totalDeals).toBe(3);
    expect(report.stageNodes.map((stage) => [stage.stageName, stage.reachedDeals])).toEqual([
      ["База входящая", 3],
      ["Звонок-знакомство", 2],
      ["Встреча-знакомство", 2],
      ["Демонстрация", 1],
      ["Контракт (договор+счёт)", 1],
      ["Корзина", 1],
      ["Передано в клуб", 1]
    ]);
    expect(
      report.stageNodes.find((stage) => stage.stageName === "Корзина")
        ?.medianDaysOnStage
    ).toBeNull();
    expect(report.actionNodes.map((node) => [node.actionKey, node.reachedDeals])).toEqual([
      ["first_successful_call", 2],
      ["completed_meeting", 1],
      ["attended_event", 1]
    ]);
    const stageTransitionsByKey = Object.fromEntries(
      report.stageTransitions.map((transition) => [
        `${transition.fromStageId ?? "START"}->${transition.toStageId}`,
        transition
      ])
    );
    expect(stageTransitionsByKey["START->C10:NEW"]).toEqual(
      expect.objectContaining({
        fromStageId: null,
        toStageId: "C10:NEW",
        deals: 3,
        conversionRate: 100
      })
    );
    expect(stageTransitionsByKey["C10:NEW->C10:PREPARATION"]).toEqual(
      expect.objectContaining({
        deals: 2,
        conversionRate: 66.67
      })
    );
    expect(stageTransitionsByKey["C10:NEW->C10:LOSE"]).toEqual(
      expect.objectContaining({
        deals: 1,
        conversionRate: 33.33
      })
    );
    expect(stageTransitionsByKey["C10:MEETING->C10:DEMO"]).toEqual(
      expect.objectContaining({
        deals: 1,
        conversionRate: 50
      })
    );
    expect(report.overallSignals.meetingStageWithoutFactDeals).toBe(1);
    expect(report.overallSignals.completedMeetingWithoutNextStageDeals).toBe(0);
    expect(report.overallSignals.noSuccessfulCallDeals).toBe(1);
    expect(report.overallSignals.successfulCallWithoutMeetingStageDeals).toBe(0);
    expect(report.overallSignals.attendedEventWithoutContractDeals).toBe(0);
    expect(report.overallSignals.contractWithoutWinDeals).toBe(0);
    expect(report.overallSignals.contractStageDeals).toBe(1);
    expect(report.overallSignals.contractStageRate).toBe(33.33);
    expect(report.overallSignals.medianDaysToContractStage).toBe(13);
    expect(report.overallSignals.medianDaysOnContractStage).toBe(6);
    expect(report.factSteps.map((step) => [step.stepKey, step.deals])).toEqual([
      ["created", 3],
      ["first_successful_call", 2],
      ["meeting_stage", 2],
      ["completed_meeting", 1],
      ["attended_event", 1],
      ["contract_stage", 1],
      ["won", 1]
    ]);
    expect(report.conversionGaps.map((gap) => [gap.gapKey, gap.deals])).toEqual([
      ["no_successful_call", 1],
      ["successful_call_without_meeting_stage", 0],
      ["meeting_stage_without_fact", 1],
      ["completed_meeting_without_next_stage", 0],
      ["attended_event_without_contract", 0],
      ["contract_without_win", 0]
    ]);

    expect(report.managerRows).toEqual([
      expect.objectContaining({
        managerId: "501",
        managerName: "Анастасия Кузнецова",
        totalDeals: 2,
        firstSuccessfulCallDeals: 1,
        meetingStageDeals: 1,
        completedMeetingDeals: 0,
        attendedEventDeals: 0,
        noSuccessfulCallDeals: 1,
        successfulCallWithoutMeetingStageDeals: 0,
        attendedEventWithoutContractDeals: 0,
        contractWithoutWinDeals: 0,
        meetingStageWithoutFactDeals: 1,
        wonDeals: 0,
        lostDeals: 1,
        dataQualityStatus: "low_sample"
      }),
      expect.objectContaining({
        managerId: "502",
        managerName: "Мария Иванова",
        totalDeals: 1,
        firstSuccessfulCallDeals: 1,
        completedMeetingDeals: 1,
        attendedEventDeals: 1,
        noSuccessfulCallDeals: 0,
        successfulCallWithoutMeetingStageDeals: 0,
        attendedEventWithoutContractDeals: 0,
        contractStageDeals: 1,
        contractWithoutWinDeals: 0,
        contractStageRate: 100,
        medianDaysToContractStage: 13,
        medianDaysOnContractStage: 6,
        wonDeals: 1,
        dataQualityStatus: "low_sample"
      })
    ]);
    expect(report.dataQuality.warnings).toContain(
      "Разрезы с N < 10 нельзя использовать для жесткого ранжирования менеджеров, источников, заказчиков или качества."
    );
  });

  it("builds event-date cohorts and includes later outcomes without a time cutoff", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      now: new Date("2026-07-20T09:00:00.000Z"),
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "mature-event-won",
          qualityValue: "3.1 Готов ко встрече",
          dateCreate: "2026-04-01T09:00:00.000Z",
          stageId: "C10:WON",
          stageSemanticId: "S",
          dateClosed: "2026-06-25T09:00:00.000Z"
        }),
        deal({
          id: "recent-event-open",
          qualityValue: "Без итогового качества",
          dateCreate: "2026-06-01T09:00:00.000Z"
        })
      ],
      stageCatalog,
      dealStageFacts: [
        stageFact({
          factId: "mature-event-contract",
          dealId: "mature-event-won",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-06-20T09:00:00.000Z",
          leftAt: "2026-06-25T09:00:00.000Z"
        }),
        stageFact({
          factId: "mature-event-transferred",
          dealId: "mature-event-won",
          stageId: "C10:WON",
          stageSemanticId: "S",
          enteredAt: "2026-06-25T09:00:00.000Z"
        }),
        stageFact({
          factId: "future-contract-after-recent-event",
          dealId: "recent-event-open",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-08-01T09:00:00.000Z"
        })
      ],
      events: [
        event({
          eventId: "old-event",
          title: "Апрельское знакомство",
          eventDate: "2026-04-10T09:00:00.000Z"
        }),
        event({
          eventId: "recent-event",
          title: "Июньское знакомство",
          eventDate: "2026-06-20T09:00:00.000Z"
        })
      ],
      eventVisitFacts: [
        eventVisit({
          visitId: "old-event-visit",
          eventId: "old-event",
          dealId: "mature-event-won",
          eventDate: "2026-04-10T09:00:00.000Z"
        }),
        eventVisit({
          visitId: "recent-event-visit",
          eventId: "recent-event",
          dealId: "recent-event-open",
          eventDate: "2026-06-20T09:00:00.000Z"
        })
      ]
    });

    expect(report.qualityRows.map((row) => [row.label, row.totalDeals])).toEqual([
      ["3.1 Готов ко встрече", 1],
      ["Без итогового качества", 1]
    ]);
    expect(report.eventPerformance).toEqual(
      expect.objectContaining({
        totalEvents: 2,
        invitedVisits: 2,
        attendedVisits: 2,
        attendanceRate: 100,
        contractAfterVisits: 1,
        transferredAfterVisits: 1
      })
    );
    expect(report.eventPerformance.eventRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "old-event",
          invitedVisits: 1,
          attendedVisits: 1,
          attendanceRate: 100,
          contractRate: 100,
          transferredRate: 100,
          medianDaysToContract: 71
        }),
        expect.objectContaining({
          key: "recent-event",
          invitedVisits: 1,
          attendedVisits: 1,
          attendanceRate: 100,
          contractRate: 0,
          transferredRate: 0
        })
      ])
    );
  });

  it("keeps non-attended deals created before the event cohort in the invitation denominator", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      now: new Date("2026-07-20T09:00:00.000Z"),
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "prior-cohort-no-show",
          dateCreate: "2026-03-01T09:00:00.000Z"
        })
      ],
      stageCatalog,
      events: [
        event({
          eventId: "april-event",
          eventDate: "2026-04-10T09:00:00.000Z"
        })
      ],
      eventVisitFacts: [
        eventVisit({
          visitId: "prior-cohort-no-show-visit",
          eventId: "april-event",
          dealId: "prior-cohort-no-show",
          eventDate: "2026-04-10T09:00:00.000Z",
          confirmedAt: "2026-04-05T09:00:00.000Z",
          attendedAt: null,
          finalStatus: "confirmed"
        })
      ]
    });

    expect(report.totalDeals).toBe(0);
    expect(report.eventPerformance).toEqual(
      expect.objectContaining({
        totalEvents: 1,
        invitedVisits: 1,
        attendedVisits: 0,
        attendanceRate: 0
      })
    );
    expect(report.eventPerformance.eventRows).toEqual([
      expect.objectContaining({
        key: "april-event",
        invitedVisits: 1,
        attendedVisits: 0,
        attendanceRate: 0
      })
    ]);
  });

  it("attributes a contract re-entry that happens after an attended event", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      now: new Date("2026-07-20T09:00:00.000Z"),
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "contract-reentry-after-event",
          dateCreate: "2026-04-01T09:00:00.000Z",
          stageId: "C10:CONTRACT"
        })
      ],
      stageCatalog,
      dealStageFacts: [
        stageFact({
          factId: "contract-before-event",
          dealId: "contract-reentry-after-event",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-04-05T09:00:00.000Z",
          leftAt: "2026-04-07T09:00:00.000Z"
        }),
        stageFact({
          factId: "left-contract-before-event",
          dealId: "contract-reentry-after-event",
          stageId: "C10:DEMO",
          enteredAt: "2026-04-07T09:00:00.000Z",
          leftAt: "2026-04-20T09:00:00.000Z"
        }),
        stageFact({
          factId: "contract-after-event",
          dealId: "contract-reentry-after-event",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-04-20T09:00:00.000Z"
        })
      ],
      events: [
        event({
          eventId: "event-before-contract-reentry",
          eventDate: "2026-04-10T09:00:00.000Z"
        })
      ],
      eventVisitFacts: [
        eventVisit({
          visitId: "contract-reentry-visit",
          eventId: "event-before-contract-reentry",
          dealId: "contract-reentry-after-event",
          eventDate: "2026-04-10T09:00:00.000Z"
        })
      ]
    });

    expect(report.eventPerformance).toEqual(
      expect.objectContaining({
        contractAfterVisits: 1
      })
    );
    expect(report.eventPerformance.eventRows).toEqual([
      expect.objectContaining({
        key: "event-before-contract-reentry",
        contractRate: 100,
        medianDaysToContract: 10
      })
    ]);
  });

  it("counts repeat event attendance separately from first attended event", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "repeat-events" })],
      stageCatalog,
      stageHistory: [
        history({
          id: "repeat-1",
          dealId: "repeat-events",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        })
      ],
      eventVisitFacts: [
        {
          visitId: "repeat-visit-1",
          eventId: "event-1",
          dealId: "repeat-events",
          contactId: null,
          leadId: null,
          managerId: "501",
          sourceId: "LIDGEN",
          currentStageId: "DT:SUCCESS",
          currentStageName: "Посетил",
          invitedAt: "2026-06-02T09:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-06-03T09:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-06-03T09:00:00.000Z",
          stageIdAtEvent: "C10:NEW",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        },
        {
          visitId: "repeat-visit-2",
          eventId: "event-2",
          dealId: "repeat-events",
          contactId: null,
          leadId: null,
          managerId: "501",
          sourceId: "LIDGEN",
          currentStageId: "DT:SUCCESS",
          currentStageName: "Посетил",
          invitedAt: "2026-06-05T09:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-06-07T09:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-06-07T09:00:00.000Z",
          stageIdAtEvent: "C10:NEW",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        }
      ]
    });

    expect(report.actionNodes.find((node) => node.actionKey === "attended_event")).toEqual(
      expect.objectContaining({
        reachedDeals: 1,
        medianDaysFromCreate: 2
      })
    );
    expect(report.overallSignals.repeatAttendedEventDeals).toBe(1);
    expect(report.overallSignals.repeatAttendedEventVisits).toBe(1);
    expect(report.managerRows[0]).toEqual(
      expect.objectContaining({
        repeatAttendedEventDeals: 1,
        repeatAttendedEventVisits: 1
      })
    );
  });

  it("does not report dwell time for loss outcome stages", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "loss-with-dwell",
          stageId: "C10:LOSE",
          stageSemanticId: "F"
        })
      ],
      stageCatalog,
      stageHistory: [],
      dealStageFacts: [
        stageFact({
          factId: "loss-new",
          dealId: "loss-with-dwell",
          stageId: "C10:NEW",
          enteredAt: "2026-06-01T09:00:00.000Z",
          leftAt: "2026-06-02T09:00:00.000Z"
        }),
        stageFact({
          factId: "loss-basket",
          dealId: "loss-with-dwell",
          stageId: "C10:LOSE",
          enteredAt: "2026-06-02T09:00:00.000Z",
          leftAt: "2026-06-05T09:00:00.000Z",
          stageSemanticId: "F"
        })
      ]
    });

    expect(report.stageNodes.find((stage) => stage.stageId === "C10:NEW")).toEqual(
      expect.objectContaining({
        medianDaysOnStage: 1
      })
    );
    expect(report.stageNodes.find((stage) => stage.stageId === "C10:LOSE")).toEqual(
      expect.objectContaining({
        stageName: "Корзина",
        reachedDeals: 1,
        medianDaysFromCreate: 1,
        medianDaysOnStage: null
      })
    );
  });

  it("uses canonical stage facts and counts one summed stage duration per deal", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "contract-reentered", stageId: "C10:CONTRACT" })],
      stageCatalog,
      stageHistory: [],
      dealStageFacts: [
        stageFact({
          factId: "contract-reentered-new",
          dealId: "contract-reentered",
          stageId: "C10:NEW",
          enteredAt: "2026-06-01T09:00:00.000Z",
          leftAt: "2026-06-02T09:00:00.000Z"
        }),
        stageFact({
          factId: "contract-reentered-contract-1",
          dealId: "contract-reentered",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-06-02T09:00:00.000Z",
          leftAt: "2026-06-04T09:00:00.000Z"
        }),
        stageFact({
          factId: "contract-reentered-demo",
          dealId: "contract-reentered",
          stageId: "C10:DEMO",
          enteredAt: "2026-06-04T09:00:00.000Z",
          leftAt: "2026-06-05T09:00:00.000Z"
        }),
        stageFact({
          factId: "contract-reentered-contract-2",
          dealId: "contract-reentered",
          stageId: "C10:CONTRACT",
          enteredAt: "2026-06-05T09:00:00.000Z",
          leftAt: "2026-06-08T09:00:00.000Z"
        })
      ]
    });

    const contractStage = report.stageNodes.find((stage) =>
      stage.stageName.includes("Контракт")
    );

    expect(report.overallSignals.contractStageDeals).toBe(1);
    expect(report.overallSignals.medianDaysToContractStage).toBe(1);
    expect(report.overallSignals.medianDaysOnContractStage).toBe(5);
    expect(contractStage).toEqual(
      expect.objectContaining({
        reachedDeals: 1,
        medianDaysFromCreate: 1,
        medianDaysOnStage: 5
      })
    );
    expect(
      Object.fromEntries(
        report.stageTransitions.map((transition) => [
          `${transition.fromStageId ?? "START"}->${transition.toStageId}`,
          transition.deals
        ])
      )
    ).toMatchObject({
      "START->C10:NEW": 1,
      "C10:NEW->C10:CONTRACT": 1,
      "C10:CONTRACT->C10:DEMO": 1,
      "C10:DEMO->C10:CONTRACT": 1
    });
    expect(report.dataQuality.stageHistoryDeals).toBe(1);
  });

  it("counts completed meetings without a later forward stage", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "meeting-done-stalled", stageId: "C10:MEETING" })],
      stageCatalog,
      stageHistory: [
        history({
          id: "meeting-done-1",
          dealId: "meeting-done-stalled",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "meeting-done-2",
          dealId: "meeting-done-stalled",
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-02T09:00:00.000Z"
        }),
        history({
          id: "meeting-done-3",
          dealId: "meeting-done-stalled",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        touchpoint({
          factId: "meeting-done-fact",
          kind: "meeting",
          dealId: "meeting-done-stalled",
          occurredAt: "2026-06-05T09:00:00.000Z",
          payloadJson: JSON.stringify({
            completed: true,
            scheduledAt: "2026-06-05T09:00:00.000Z"
          })
        })
      ]
    });

    expect(report.overallSignals.completedMeetingWithoutNextStageDeals).toBe(1);
    expect(report.managerRows[0]).toEqual(
      expect.objectContaining({
        completedMeetingDeals: 1,
        completedMeetingWithoutNextStageDeals: 1
      })
    );
  });

  it("exposes named conversion gaps for factual chain diagnostics", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "no-successful-call",
          assignedById: "501",
          sourceId: "LIDGEN",
          stageId: "C10:NEW"
        }),
        deal({
          id: "call-no-meeting-stage",
          assignedById: "501",
          sourceId: "LIDGEN",
          stageId: "C10:PREPARATION"
        }),
        deal({
          id: "meeting-stage-no-fact",
          assignedById: "502",
          sourceId: "WEB",
          stageId: "C10:MEETING"
        }),
        deal({
          id: "meeting-fact-no-next",
          assignedById: "502",
          sourceId: "WEB",
          stageId: "C10:MEETING"
        }),
        deal({
          id: "event-no-contract",
          assignedById: "503",
          sourceId: "EVENT",
          stageId: "C10:DEMO"
        }),
        deal({
          id: "contract-no-win",
          assignedById: "503",
          sourceId: "EVENT",
          stageId: "C10:CONTRACT"
        }),
        deal({
          id: "basket-terminal",
          assignedById: "503",
          sourceId: "EVENT",
          stageId: "C10:LOSE",
          stageSemanticId: "F"
        })
      ],
      stageCatalog,
      stageHistory: [
        history({
          id: "no-successful-call-new",
          dealId: "no-successful-call",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "call-no-meeting-stage-new",
          dealId: "call-no-meeting-stage",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "call-no-meeting-stage-call",
          dealId: "call-no-meeting-stage",
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-02T09:00:00.000Z"
        }),
        history({
          id: "meeting-stage-no-fact-new",
          dealId: "meeting-stage-no-fact",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "meeting-stage-no-fact-meeting",
          dealId: "meeting-stage-no-fact",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        }),
        history({
          id: "meeting-fact-no-next-new",
          dealId: "meeting-fact-no-next",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "meeting-fact-no-next-meeting",
          dealId: "meeting-fact-no-next",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        }),
        history({
          id: "event-no-contract-new",
          dealId: "event-no-contract",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "event-no-contract-meeting",
          dealId: "event-no-contract",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        }),
        history({
          id: "event-no-contract-demo",
          dealId: "event-no-contract",
          stageId: "C10:DEMO",
          createdTime: "2026-06-08T09:00:00.000Z"
        }),
        history({
          id: "contract-no-win-new",
          dealId: "contract-no-win",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "contract-no-win-meeting",
          dealId: "contract-no-win",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        }),
        history({
          id: "contract-no-win-demo",
          dealId: "contract-no-win",
          stageId: "C10:DEMO",
          createdTime: "2026-06-08T09:00:00.000Z"
        }),
        history({
          id: "contract-no-win-contract",
          dealId: "contract-no-win",
          stageId: "C10:CONTRACT",
          createdTime: "2026-06-12T09:00:00.000Z"
        }),
        history({
          id: "basket-terminal-new",
          dealId: "basket-terminal",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "basket-terminal-loss",
          dealId: "basket-terminal",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          createdTime: "2026-06-05T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        touchpoint({
          factId: "call-no-meeting-stage-call",
          kind: "call",
          dealId: "call-no-meeting-stage",
          occurredAt: "2026-06-02T10:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        }),
        ...[
          "meeting-stage-no-fact",
          "meeting-fact-no-next",
          "event-no-contract",
          "contract-no-win"
        ].map((dealId) =>
          touchpoint({
            factId: `${dealId}-call`,
            kind: "call",
            dealId,
            occurredAt: "2026-06-02T10:00:00.000Z",
            payloadJson: JSON.stringify({
              direction: "outgoing",
              connected: true,
              overThirtySeconds: true
            })
          })
        ),
        ...["meeting-fact-no-next", "event-no-contract", "contract-no-win"].map(
          (dealId) =>
            touchpoint({
              factId: `${dealId}-meeting`,
              kind: "meeting",
              dealId,
              occurredAt: "2026-06-05T09:00:00.000Z",
              payloadJson: JSON.stringify({
                completed: true,
                scheduledAt: "2026-06-05T09:00:00.000Z"
              })
            })
        )
      ],
      eventVisitFacts: [
        {
          visitId: "event-no-contract-visit",
          eventId: "event-1",
          dealId: "event-no-contract",
          contactId: null,
          leadId: null,
          managerId: "503",
          sourceId: "EVENT",
          currentStageId: "DT:SUCCESS",
          currentStageName: "Посетил",
          invitedAt: "2026-06-08T09:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-06-09T09:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-06-09T09:00:00.000Z",
          stageIdAtEvent: "C10:DEMO",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        } satisfies EventVisitFactSnapshot
      ]
    });

    expect(report.overallSignals).toEqual(
      expect.objectContaining({
        noSuccessfulCallDeals: 2,
        successfulCallWithoutMeetingStageDeals: 1,
        meetingStageWithoutFactDeals: 1,
        completedMeetingWithoutNextStageDeals: 1,
        attendedEventWithoutContractDeals: 1,
        contractWithoutWinDeals: 1
      })
    );
    expect(report.factSteps.map((step) => [step.stepKey, step.deals])).toEqual([
      ["created", 7],
      ["first_successful_call", 5],
      ["meeting_stage", 4],
      ["completed_meeting", 3],
      ["attended_event", 1],
      ["contract_stage", 1],
      ["won", 0]
    ]);
    expect(report.conversionGaps).toEqual([
      expect.objectContaining({
        gapKey: "no_successful_call",
        deals: 2,
        rate: 28.57,
        denominatorStepKey: "created"
      }),
      expect.objectContaining({
        gapKey: "successful_call_without_meeting_stage",
        deals: 1,
        rate: 20,
        denominatorStepKey: "first_successful_call"
      }),
      expect.objectContaining({
        gapKey: "meeting_stage_without_fact",
        deals: 1,
        rate: 25,
        denominatorStepKey: "meeting_stage"
      }),
      expect.objectContaining({
        gapKey: "completed_meeting_without_next_stage",
        deals: 1,
        rate: 33.33,
        denominatorStepKey: "completed_meeting"
      }),
      expect.objectContaining({
        gapKey: "attended_event_without_contract",
        deals: 1,
        rate: 100,
        denominatorStepKey: "attended_event"
      }),
      expect.objectContaining({
        gapKey: "contract_without_win",
        deals: 1,
        rate: 100,
        denominatorStepKey: "contract_stage"
      })
    ]);
    expect(report.managerRows.find((row) => row.managerId === "503")).toEqual(
      expect.objectContaining({
        totalDeals: 3,
        attendedEventWithoutContractDeals: 1,
        contractWithoutWinDeals: 1,
        lostDeals: 1,
        openDeals: 2
      })
    );
    expect(report.stageNodes.find((stage) => stage.stageId === "C10:LOSE")).toEqual(
      expect.objectContaining({
        reachedDeals: 1,
        medianDaysOnStage: null
      })
    );
  });

  it("ignores pre-creation touchpoints and uses the first valid action after deal creation", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "with-old-call" })],
      stageCatalog,
      stageHistory: [
        history({
          id: "old-1",
          dealId: "with-old-call",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        touchpoint({
          factId: "pre-create-call",
          kind: "call",
          dealId: "with-old-call",
          occurredAt: "2026-05-30T09:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        }),
        touchpoint({
          factId: "valid-call",
          kind: "call",
          dealId: "with-old-call",
          occurredAt: "2026-06-02T09:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        })
      ]
    });

    expect(
      report.actionNodes.find((node) => node.actionKey === "first_successful_call")
    ).toEqual(
      expect.objectContaining({
        reachedDeals: 1,
        medianDaysFromCreate: 1
      })
    );
  });

  it("requires first successful call to be both connected and over 30 seconds", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [deal({ id: "call-quality" })],
      stageCatalog,
      stageHistory: [
        history({
          id: "call-quality-new",
          dealId: "call-quality",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        touchpoint({
          factId: "long-failed-call",
          kind: "call",
          dealId: "call-quality",
          occurredAt: "2026-06-02T09:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: false,
            overThirtySeconds: true
          })
        }),
        touchpoint({
          factId: "short-connected-call",
          kind: "call",
          dealId: "call-quality",
          occurredAt: "2026-06-03T09:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: false
          })
        }),
        touchpoint({
          factId: "valid-connected-over-thirty-call",
          kind: "call",
          dealId: "call-quality",
          occurredAt: "2026-06-04T09:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        })
      ]
    });

    expect(
      report.actionNodes.find((node) => node.actionKey === "first_successful_call")
    ).toEqual(
      expect.objectContaining({
        reachedDeals: 1,
        medianDaysFromCreate: 3
      })
    );
    expect(report.overallSignals.noSuccessfulCallDeals).toBe(0);
    expect(report.overallSignals.slowFirstSuccessfulCallDeals).toBe(0);
  });

  it("builds speed buckets and stale WIP counters with deterministic report time", () => {
    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      now: new Date("2026-06-25T09:00:00.000Z"),
      wonStageIds: ["C10:WON"],
      deals: [
        deal({
          id: "fast-path",
          assignedById: "501",
          stageId: "C10:WON",
          stageSemanticId: "S",
          dateClosed: "2026-06-11T09:00:00.000Z"
        }),
        deal({
          id: "slow-path",
          assignedById: "501",
          stageId: "C10:CONTRACT"
        }),
        deal({
          id: "stale-after-meeting",
          assignedById: "502",
          stageId: "C10:MEETING"
        }),
        deal({
          id: "lost-after-meeting",
          assignedById: "502",
          stageId: "C10:LOSE",
          stageSemanticId: "F"
        }),
        deal({
          id: "no-facts",
          assignedById: "503",
          stageId: "C10:NEW"
        })
      ],
      stageCatalog,
      stageHistory: [
        history({
          id: "fast-new",
          dealId: "fast-path",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "fast-meeting",
          dealId: "fast-path",
          stageId: "C10:MEETING",
          createdTime: "2026-06-03T09:00:00.000Z"
        }),
        history({
          id: "fast-demo",
          dealId: "fast-path",
          stageId: "C10:DEMO",
          createdTime: "2026-06-05T09:00:00.000Z"
        }),
        history({
          id: "fast-contract",
          dealId: "fast-path",
          stageId: "C10:CONTRACT",
          createdTime: "2026-06-08T09:00:00.000Z"
        }),
        history({
          id: "fast-won",
          dealId: "fast-path",
          stageId: "C10:WON",
          stageSemanticId: "S",
          createdTime: "2026-06-11T09:00:00.000Z"
        }),
        history({
          id: "slow-new",
          dealId: "slow-path",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "slow-meeting",
          dealId: "slow-path",
          stageId: "C10:MEETING",
          createdTime: "2026-06-09T09:00:00.000Z"
        }),
        history({
          id: "slow-demo",
          dealId: "slow-path",
          stageId: "C10:DEMO",
          createdTime: "2026-06-15T09:00:00.000Z"
        }),
        history({
          id: "slow-contract",
          dealId: "slow-path",
          stageId: "C10:CONTRACT",
          createdTime: "2026-06-16T09:00:00.000Z"
        }),
        history({
          id: "stale-new",
          dealId: "stale-after-meeting",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "stale-meeting",
          dealId: "stale-after-meeting",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        }),
        history({
          id: "lost-new",
          dealId: "lost-after-meeting",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        }),
        history({
          id: "lost-meeting",
          dealId: "lost-after-meeting",
          stageId: "C10:MEETING",
          createdTime: "2026-06-04T09:00:00.000Z"
        }),
        history({
          id: "lost-basket",
          dealId: "lost-after-meeting",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          createdTime: "2026-06-06T09:00:00.000Z"
        }),
        history({
          id: "no-facts-new",
          dealId: "no-facts",
          stageId: "C10:NEW",
          createdTime: "2026-06-01T09:00:00.000Z"
        })
      ],
      dealTouchpointFacts: [
        touchpoint({
          factId: "fast-call",
          kind: "call",
          dealId: "fast-path",
          occurredAt: "2026-06-02T09:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        }),
        touchpoint({
          factId: "fast-meeting-fact",
          kind: "meeting",
          dealId: "fast-path",
          occurredAt: "2026-06-03T09:00:00.000Z",
          payloadJson: JSON.stringify({
            completed: true
          })
        }),
        touchpoint({
          factId: "slow-call",
          kind: "call",
          dealId: "slow-path",
          occurredAt: "2026-06-06T09:00:00.000Z",
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        }),
        touchpoint({
          factId: "slow-meeting-fact",
          kind: "meeting",
          dealId: "slow-path",
          occurredAt: "2026-06-10T09:00:00.000Z",
          payloadJson: JSON.stringify({
            completed: true
          })
        }),
        touchpoint({
          factId: "stale-meeting-fact",
          kind: "meeting",
          dealId: "stale-after-meeting",
          occurredAt: "2026-06-05T09:00:00.000Z",
          payloadJson: JSON.stringify({
            completed: true
          })
        }),
        touchpoint({
          factId: "lost-meeting-fact",
          kind: "meeting",
          dealId: "lost-after-meeting",
          occurredAt: "2026-06-05T09:00:00.000Z",
          payloadJson: JSON.stringify({
            completed: true
          })
        })
      ],
      eventVisitFacts: [
        {
          visitId: "fast-event",
          eventId: "event-fast",
          dealId: "fast-path",
          contactId: null,
          leadId: null,
          managerId: "501",
          sourceId: "LIDGEN",
          currentStageId: "DT:SUCCESS",
          currentStageName: "Посетил",
          invitedAt: "2026-06-04T09:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-06-06T09:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-06-06T09:00:00.000Z",
          stageIdAtEvent: "C10:DEMO",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        },
        {
          visitId: "slow-event",
          eventId: "event-slow",
          dealId: "slow-path",
          contactId: null,
          leadId: null,
          managerId: "501",
          sourceId: "LIDGEN",
          currentStageId: "DT:SUCCESS",
          currentStageName: "Посетил",
          invitedAt: "2026-06-17T09:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-06-20T09:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-06-20T09:00:00.000Z",
          stageIdAtEvent: "C10:CONTRACT",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        }
      ]
    });

    const speedByKey = new Map(
      report.speedSteps.map((step) => [step.stepKey, step])
    );
    const firstSuccessfulCallSpeed = speedByKey.get("first_successful_call");
    const completedMeetingSpeed = speedByKey.get("completed_meeting");
    const attendedEventSpeed = speedByKey.get("attended_event");
    const contractStageSpeed = speedByKey.get("contract_stage");
    const postMeetingNextStageSpeed = speedByKey.get("post_meeting_next_stage");

    expect(firstSuccessfulCallSpeed).toBeDefined();
    expect(completedMeetingSpeed).toBeDefined();
    expect(attendedEventSpeed).toBeDefined();
    expect(contractStageSpeed).toBeDefined();
    expect(postMeetingNextStageSpeed).toBeDefined();

    expect(firstSuccessfulCallSpeed).toEqual(
      expect.objectContaining({
        totalDeals: 5,
        medianDays: 3,
        slaDays: 3,
        slowDeals: 1,
        slowRate: 20
      })
    );
    expect(
      Object.fromEntries(
        (firstSuccessfulCallSpeed?.buckets ?? []).map((bucket) => [
          bucket.bucketKey,
          bucket.deals
        ])
      )
    ).toMatchObject({
      "0-1": 1,
      "1-3": 0,
      "3-7": 1,
      no_fact: 3
    });
    expect(completedMeetingSpeed).toEqual(
      expect.objectContaining({
        totalDeals: 5,
        slowDeals: 1
      })
    );
    expect(attendedEventSpeed).toEqual(
      expect.objectContaining({
        slowDeals: 1
      })
    );
    expect(contractStageSpeed).toEqual(
      expect.objectContaining({
        slowDeals: 1
      })
    );
    expect(postMeetingNextStageSpeed).toEqual(
      expect.objectContaining({
        totalDeals: 4,
        slowDeals: 0
      })
    );
    expect(
      Object.fromEntries(
        (postMeetingNextStageSpeed?.buckets ?? []).map((bucket) => [
          bucket.bucketKey,
          bucket.deals
        ])
      )
    ).toMatchObject({
      "0-3": 1,
      "3-7": 1,
      "7-14": 0,
      no_fact: 2
    });
    expect(report.overallSignals).toEqual(
      expect.objectContaining({
        slowFirstSuccessfulCallDeals: 1,
        slowCompletedMeetingDeals: 1,
        slowAttendedEventDeals: 1,
        slowContractStageDeals: 1,
        staleAfterCompletedMeetingDeals: 1,
        staleOpenContractStageDeals: 0
      })
    );
    expect(report.managerRows.find((row) => row.managerId === "501")).toEqual(
      expect.objectContaining({
        slowFirstSuccessfulCallDeals: 1,
        slowCompletedMeetingDeals: 1,
        slowAttendedEventDeals: 1,
        slowContractStageDeals: 1,
        staleAfterCompletedMeetingDeals: 0,
        staleOpenContractStageDeals: 0
      })
    );
    expect(report.managerRows.find((row) => row.managerId === "502")).toEqual(
      expect.objectContaining({
        staleAfterCompletedMeetingDeals: 1
      })
    );
  });

  it("builds source and customer loss shapes from canonical gaps", () => {
    const deals: DealSnapshot[] = [];
    const stageHistory: StageHistorySnapshot[] = [];
    const touchpoints: DealTouchpointFactSnapshot[] = [];
    const atDay = (day: number) =>
      `2026-06-${String(day).padStart(2, "0")}T09:00:00.000Z`;
    const addStage = (dealId: string, stageId: string, day: number, semantic?: string) => {
      const input: Parameters<typeof history>[0] = {
        id: `${dealId}-${stageId}-${day}`,
        dealId,
        stageId,
        createdTime: atDay(day)
      };
      if (semantic !== undefined) {
        input.stageSemanticId = semantic;
      }
      stageHistory.push(history(input));
    };
    const addCall = (dealId: string) => {
      touchpoints.push(
        touchpoint({
          factId: `${dealId}-call`,
          kind: "call",
          dealId,
          occurredAt: atDay(1),
          payloadJson: JSON.stringify({
            direction: "outgoing",
            connected: true,
            overThirtySeconds: true
          })
        })
      );
    };
    const addMeeting = (dealId: string) => {
      touchpoints.push(
        touchpoint({
          factId: `${dealId}-meeting`,
          kind: "meeting",
          dealId,
          occurredAt: atDay(4),
          payloadJson: JSON.stringify({ completed: true })
        })
      );
    };

    for (let index = 0; index < 5; index += 1) {
      const id = `source-early-loss-${index}`;
      deals.push(
        deal({
          id,
          assignedById: "501",
          sourceId: "SOURCE_A",
          businessClubValue: "Club Early",
          stageId: "C10:NEW"
        })
      );
      addStage(id, "C10:NEW", 1);
    }

    for (let index = 0; index < 4; index += 1) {
      const id = `source-meeting-stall-${index}`;
      deals.push(
        deal({
          id,
          assignedById: "501",
          sourceId: "SOURCE_B",
          businessClubValue: "Club Meeting",
          stageId: "C10:MEETING"
        })
      );
      addStage(id, "C10:NEW", 1);
      addStage(id, "C10:MEETING", 3);
      addCall(id);
      addMeeting(id);
    }

    for (let index = 0; index < 3; index += 1) {
      const id = `customer-contract-block-${index}`;
      deals.push(
        deal({
          id,
          assignedById: "502",
          sourceId: "SOURCE_C",
          businessClubValue: "Club Contract",
          stageId: "C10:CONTRACT"
        })
      );
      addStage(id, "C10:NEW", 1);
      addStage(id, "C10:CONTRACT", 6);
      addCall(id);
    }

    for (let index = 0; index < 4; index += 1) {
      const id = `customer-terminal-loss-${index}`;
      deals.push(
        deal({
          id,
          assignedById: "503",
          sourceId: "SOURCE_D",
          businessClubValue: "Club Basket",
          stageId: "C10:LOSE"
        })
      );
      addStage(id, "C10:NEW", 1);
      addStage(id, "C10:MEETING", 3);
      addStage(id, "C10:DEMO", 6);
      addStage(id, "C10:LOSE", 8, "F");
      addCall(id);
      addMeeting(id);
    }

    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      now: new Date("2026-06-25T09:00:00.000Z"),
      wonStageIds: ["C10:WON"],
      deals,
      stageCatalog,
      stageHistory,
      dealTouchpointFacts: touchpoints
    });

    const sourceA = report.sourceRows.find((row) => row.key === "SOURCE_A");
    const sourceB = report.sourceRows.find((row) => row.key === "SOURCE_B");
    const customerContract = report.customerRows.find(
      (row) => row.key === "Club Contract"
    );
    const customerBasket = report.customerRows.find(
      (row) => row.key === "Club Basket"
    );

    expect(sourceA?.lossShape).toEqual(
      expect.objectContaining({
        dominantShapeKey: "not_reached_successful_call",
        dominantDeals: 5
      })
    );
    expect(sourceB?.lossShape).toEqual(
      expect.objectContaining({
        dominantShapeKey: "meeting_fact_without_next_stage",
        dominantDeals: 4
      })
    );
    expect(customerContract?.lossShape).toEqual(
      expect.objectContaining({
        dominantShapeKey: "contract_without_win",
        dominantDeals: 3
      })
    );
    expect(customerBasket?.lossShape).toEqual(
      expect.objectContaining({
        dominantShapeKey: "terminal_loss",
        terminalLossDeals: 4,
        openWipDeals: 0
      })
    );
    expect(customerBasket?.lossShape.reasons.map((reason) => reason.shapeKey)).toEqual([
      "terminal_loss"
    ]);
    expect(sourceB?.lossShape.reasons[0]).toEqual(
      expect.objectContaining({
        shapeKey: "meeting_fact_without_next_stage",
        recommendedQuestion: "Почему после встречи нет следующего шага?"
      })
    );
  });

  it("builds deterministic manager diagnostics from canonical trajectory facts", () => {
    const deals: DealSnapshot[] = [];
    const stageHistory: StageHistorySnapshot[] = [];
    const touchpoints: DealTouchpointFactSnapshot[] = [];
    const atDay = (day: number) =>
      `2026-06-${String(day).padStart(2, "0")}T09:00:00.000Z`;
    const addDeal = (input: {
      id: string;
      managerId: string;
      currentStageId: string;
      stageSemanticId?: string | undefined;
      stageDays: Array<{
        stageId: string;
        day: number;
        stageSemanticId?: string | undefined;
      }>;
      callDay?: number | undefined;
      meetingDay?: number | undefined;
      dateClosedDay?: number | undefined;
    }) => {
      deals.push(
        deal({
          id: input.id,
          assignedById: input.managerId,
          stageId: input.currentStageId,
          stageSemanticId: input.stageSemanticId ?? "P",
          dateClosed: input.dateClosedDay ? atDay(input.dateClosedDay) : null
        })
      );

      for (const [index, stage] of input.stageDays.entries()) {
        const stageInput: Parameters<typeof history>[0] = {
          id: `${input.id}-stage-${index}`,
          dealId: input.id,
          stageId: stage.stageId,
          createdTime: atDay(stage.day)
        };
        if (stage.stageSemanticId !== undefined) {
          stageInput.stageSemanticId = stage.stageSemanticId;
        }
        stageHistory.push(
          history(stageInput)
        );
      }

      if (input.callDay !== undefined) {
        touchpoints.push(
          touchpoint({
            factId: `${input.id}-call`,
            kind: "call",
            dealId: input.id,
            managerId: input.managerId,
            occurredAt: atDay(input.callDay),
            payloadJson: JSON.stringify({
              direction: "outgoing",
              connected: true,
              overThirtySeconds: true
            })
          })
        );
      }

      if (input.meetingDay !== undefined) {
        touchpoints.push(
          touchpoint({
            factId: `${input.id}-meeting`,
            kind: "meeting",
            dealId: input.id,
            managerId: input.managerId,
            occurredAt: atDay(input.meetingDay),
            payloadJson: JSON.stringify({ completed: true })
          })
        );
      }
    };

    for (let index = 0; index < 10; index += 1) {
      addDeal({
        id: `fast-stall-${index}`,
        managerId: "501",
        currentStageId: index < 3 ? "C10:MEETING" : "C10:NEW",
        stageDays:
          index < 3
            ? [
                { stageId: "C10:NEW", day: 1 },
                { stageId: "C10:MEETING", day: 3 }
              ]
            : [{ stageId: "C10:NEW", day: 1 }],
        callDay: 1,
        meetingDay: index < 3 ? 4 : undefined
      });
    }

    for (let index = 0; index < 10; index += 1) {
      addDeal({
        id: `slow-call-${index}`,
        managerId: "502",
        currentStageId: index < 5 ? "C10:WON" : "C10:NEW",
        stageSemanticId: index < 5 ? "S" : "P",
        stageDays:
          index < 5
            ? [
                { stageId: "C10:NEW", day: 1 },
                { stageId: "C10:MEETING", day: 3 },
                { stageId: "C10:CONTRACT", day: 10 },
                { stageId: "C10:WON", day: 15, stageSemanticId: "S" }
              ]
            : [{ stageId: "C10:NEW", day: 1 }],
        callDay: index < 5 ? 8 : undefined,
        meetingDay: index < 5 ? 4 : undefined,
        dateClosedDay: index < 5 ? 15 : undefined
      });
    }

    for (let index = 0; index < 10; index += 1) {
      addDeal({
        id: `contract-block-${index}`,
        managerId: "503",
        currentStageId: index < 3 ? "C10:CONTRACT" : "C10:NEW",
        stageDays:
          index < 3
            ? [
                { stageId: "C10:NEW", day: 1 },
                { stageId: "C10:CONTRACT", day: 4 }
              ]
            : [{ stageId: "C10:NEW", day: 1 }],
        callDay: index < 5 ? 2 : undefined
      });
    }

    for (let index = 0; index < 3; index += 1) {
      addDeal({
        id: `small-sample-${index}`,
        managerId: "504",
        currentStageId: "C10:NEW",
        stageDays: [{ stageId: "C10:NEW", day: 1 }]
      });
    }

    const report = buildSourceCohortTrajectoryReport({
      range: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      now: new Date("2026-06-25T09:00:00.000Z"),
      wonStageIds: ["C10:WON"],
      deals,
      stageCatalog,
      stageHistory,
      dealTouchpointFacts: touchpoints,
      managerDirectory: [
        { id: "501", name: "Кузнецова Анастасия" },
        { id: "502", name: "Иванов Медленный" },
        { id: "503", name: "Петров Контракт" },
        { id: "504", name: "Малый N" }
      ]
    });

    expect(report.managerDiagnostics.map((row) => row.status)).toEqual([
      "bottleneck",
      "bottleneck",
      "mixed",
      "low_sample"
    ]);

    const byManager = new Map(
      report.managerDiagnostics.map((row) => [row.managerId, row])
    );

    expect(byManager.get("501")).toEqual(
      expect.objectContaining({
        status: "mixed",
        recommendedFocus:
          "Проверить следующий шаг после встречи: факт есть, движения дальше нет."
      })
    );
    expect(byManager.get("501")?.strengths.map((signal) => signal.signalKey)).toContain(
      "strong_first_successful_call"
    );
    expect(byManager.get("501")?.bottlenecks.map((signal) => signal.signalKey)).toContain(
      "after_meeting_stall"
    );
    expect(byManager.get("502")?.bottlenecks.map((signal) => signal.signalKey)).toContain(
      "slow_first_successful_call"
    );
    expect(byManager.get("503")?.bottlenecks.map((signal) => signal.signalKey)).toContain(
      "contract_bottleneck"
    );
    expect(byManager.get("504")).toEqual(
      expect.objectContaining({
        status: "low_sample",
        bottlenecks: [],
        strengths: [],
        recommendedFocus:
          "Смотреть факты по сделкам, но не сравнивать менеджера в рейтинге.",
        sampleWarning: "N=3. Строка только для описания, не для рейтинга."
      })
    );
  });
});
