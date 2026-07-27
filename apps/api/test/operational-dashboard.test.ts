import type {
  ActivitySnapshot,
  CallSnapshot,
  DealSnapshot,
  OperationalThresholdSettings,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";
import { describe, expect, it } from "vitest";

import { buildOperationalDashboardReport } from "../src/domain/operational-dashboard";

const range = {
  from: "2026-06-01T00:00:00.000+03:00",
  to: "2026-06-30T23:59:59.999+03:00"
};
const now = "2026-06-10T12:00:00.000+03:00";

const thresholds: OperationalThresholdSettings = {
  stageAging: [
    {
      stageId: "C10:NEW",
      stageName: "База входящая",
      maxDaysOnStage: 1
    },
    {
      stageId: "C10:PREPARATION",
      stageName: "Звонок-знакомство",
      maxDaysOnStage: 3
    }
  ],
  noCallsMaxDays: 7,
  noActivityMaxDays: 5,
  slaBusinessHours: {
    sla1: 24,
    sla2: 5,
    sla3: 72
  },
  updatedAt: "2026-06-01T08:00:00.000Z"
};

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
    statusId: "C10:UC_9E0XYG",
    name: "Встреча-знакомство",
    semanticId: "P",
    sortOrder: 30
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:WON",
    name: "Передано в клуб",
    semanticId: "S",
    sortOrder: 90
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:LOSE",
    name: "Корзина",
    semanticId: "F",
    sortOrder: 100
  },
  {
    entityType: "deal",
    categoryId: "10",
    statusId: "C10:UC_EA3R76",
    name: "Возврат в Лидген(неквал)",
    semanticId: "F",
    sortOrder: 110
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "8",
    name: "Лидген УС",
    semanticId: null,
    sortOrder: 8
  }
];

function createDeal(input: Partial<DealSnapshot> & { id: string }): DealSnapshot {
  return {
    id: input.id,
    leadId: null,
    categoryId: input.categoryId ?? "10",
    stageId: input.stageId ?? "C10:PREPARATION",
    stageSemanticId: input.stageSemanticId ?? "P",
    opportunity: 10000,
    assignedById: input.assignedById ?? "6994",
    sourceId: input.sourceId ?? "8",
    qualityValue:
      input.qualityValue ?? "3.1 Готов ко встрече с представителем клуба",
    businessClubValue: input.businessClubValue ?? "ClubFirst заказчик",
    targetGroupValue: input.targetGroupValue ?? "ClubFirst продажа",
    meetingTypeValue: input.meetingTypeValue ?? null,
    meetingDateValue: input.meetingDateValue ?? null,
    meetingSlots: input.meetingSlots ?? [],
    tariffValue: input.tariffValue ?? null,
    conversionEventValue: input.conversionEventValue ?? null,
    refusalReasonValue: input.refusalReasonValue ?? null,
    refusalReasonDetail: input.refusalReasonDetail ?? null,
    dateCreate: input.dateCreate ?? "2026-06-01T09:00:00.000+03:00",
    dateModify: input.dateModify ?? "2026-06-10T10:00:00.000+03:00",
    dateClosed: input.dateClosed ?? null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null
  };
}

function createStageHistory(input: {
  dealId: string;
  stageId: string;
  createdTime: string;
  id?: string;
  stageSemanticId?: string | null;
}): StageHistorySnapshot {
  return {
    id: input.id ?? `${input.dealId}:${input.stageId}:${input.createdTime}`,
    ownerId: input.dealId,
    categoryId: "10",
    stageId: input.stageId,
    stageSemanticId:
      input.stageSemanticId ??
      stageCatalog.find((stage) => stage.statusId === input.stageId)?.semanticId ??
      "P",
    typeId: null,
    createdTime: input.createdTime
  };
}

function createActivity(
  dealId: string,
  input: Partial<ActivitySnapshot> = {}
): ActivitySnapshot {
  return {
    id: input.id ?? `A_${dealId}`,
    ownerTypeId: "2",
    ownerId: dealId,
    typeId: input.typeId ?? "6",
    providerId: input.providerId ?? "CRM_TODO",
    responsibleId: input.responsibleId ?? "6994",
    createdTime: input.createdTime ?? "2026-06-10T09:00:00.000+03:00",
    deadline: input.deadline ?? "2026-06-12T09:00:00.000+03:00",
    lastUpdated: input.lastUpdated ?? "2026-06-10T10:00:00.000+03:00",
    completed: input.completed ?? false,
    completedTime: input.completedTime ?? null
  };
}

function createCall(dealId: string, input: Partial<CallSnapshot> = {}): CallSnapshot {
  return {
    id: input.id ?? `CALL_${dealId}`,
    crmActivityId: input.crmActivityId ?? null,
    portalUserId: input.portalUserId ?? "6994",
    callType: input.callType ?? "1",
    callStartDate: input.callStartDate ?? "2026-06-10T10:00:00.000+03:00",
    callDurationSeconds: input.callDurationSeconds ?? 60,
    crmEntityType: input.crmEntityType ?? "DEAL",
    crmEntityId: input.crmEntityId ?? dealId,
    callFailedCode: input.callFailedCode ?? "200"
  };
}

function buildReport(input: {
  deals: DealSnapshot[];
  currentDealIds?: string[];
  stageHistory?: StageHistorySnapshot[];
  activities?: ActivitySnapshot[];
  calls?: CallSnapshot[];
  capRisks?: number;
}) {
  return buildOperationalDashboardReport({
    range,
    now,
    deals: input.deals,
    ...(input.currentDealIds
      ? { currentDealIds: new Set(input.currentDealIds) }
      : {}),
    stageCatalog,
    stageHistory: input.stageHistory ?? [],
    activities: input.activities ?? [],
    calls: input.calls ?? [],
    managerDirectory: [
      { id: "6994", name: "Анастасия Кузнецова" },
      { id: "13020", name: "Илья Какулия" }
    ],
    thresholds,
    wonStageIds: ["C10:WON"],
    dealUrlBuilder: (dealId) => `https://example.bitrix24.ru/crm/deal/details/${dealId}/`,
    ...(input.capRisks !== undefined ? { capRisks: input.capRisks } : {})
  });
}

describe("buildOperationalDashboardReport", () => {
  it("flags stage aging by latest current-stage entry", () => {
    const deals = [
      createDeal({ id: "RISK_4_DAYS" }),
      createDeal({ id: "CRITICAL_6_DAYS" }),
      createDeal({ id: "SAFE_2_DAYS" }),
      createDeal({ id: "BOUNCED_LATEST_ENTRY" })
    ];
    const stageHistory = [
      createStageHistory({
        dealId: "RISK_4_DAYS",
        stageId: "C10:PREPARATION",
        createdTime: "2026-06-06T12:00:00.000+03:00"
      }),
      createStageHistory({
        dealId: "CRITICAL_6_DAYS",
        stageId: "C10:PREPARATION",
        createdTime: "2026-06-04T12:00:00.000+03:00"
      }),
      createStageHistory({
        dealId: "SAFE_2_DAYS",
        stageId: "C10:PREPARATION",
        createdTime: "2026-06-08T12:00:00.000+03:00"
      }),
      createStageHistory({
        dealId: "BOUNCED_LATEST_ENTRY",
        stageId: "C10:PREPARATION",
        createdTime: "2026-06-01T12:00:00.000+03:00",
        id: "BOUNCED_A"
      }),
      createStageHistory({
        dealId: "BOUNCED_LATEST_ENTRY",
        stageId: "C10:UC_9E0XYG",
        createdTime: "2026-06-03T12:00:00.000+03:00",
        id: "BOUNCED_B"
      }),
      createStageHistory({
        dealId: "BOUNCED_LATEST_ENTRY",
        stageId: "C10:PREPARATION",
        createdTime: "2026-06-09T12:00:00.000+03:00",
        id: "BOUNCED_C"
      })
    ];
    const report = buildReport({
      deals,
      stageHistory,
      activities: deals.map((deal) => createActivity(deal.id)),
      calls: deals.map((deal) => createCall(deal.id))
    });

    expect(report.risks.map((risk) => risk.dealId)).toEqual([
      "CRITICAL_6_DAYS",
      "RISK_4_DAYS"
    ]);
    expect(report.risks.find((risk) => risk.dealId === "RISK_4_DAYS")).toMatchObject({
      daysOnStage: 4,
      stageMaxDays: 3,
      severity: "risk",
      flags: [expect.objectContaining({ rule: "stage_aging", severity: "risk" })]
    });
    expect(
      report.risks.find((risk) => risk.dealId === "CRITICAL_6_DAYS")
    ).toMatchObject({
      daysOnStage: 6,
      severity: "critical",
      flags: [
        expect.objectContaining({ rule: "stage_aging", severity: "critical" })
      ]
    });
  });

  it("flags open activity and recency hygiene without penalizing young deals", () => {
    const deals = [
      createDeal({ id: "COMPLETED_ONLY", stageId: "C10:UC_9E0XYG" }),
      createDeal({ id: "WITH_OPEN_TASK", stageId: "C10:UC_9E0XYG" }),
      createDeal({ id: "WITH_FAILED_CALL", stageId: "C10:UC_9E0XYG" }),
      createDeal({
        id: "YOUNG_NO_CALL",
        stageId: "C10:UC_9E0XYG",
        dateCreate: "2026-06-08T12:00:00.000+03:00"
      }),
      createDeal({ id: "OLD_NO_CALL", stageId: "C10:UC_9E0XYG" }),
      createDeal({ id: "OLD_NO_ACTIVITY", stageId: "C10:UC_9E0XYG" })
    ];
    const stageHistory = deals.map((deal) =>
      createStageHistory({
        dealId: deal.id,
        stageId: "C10:UC_9E0XYG",
        createdTime: "2026-06-09T12:00:00.000+03:00"
      })
    );
    const report = buildReport({
      deals,
      stageHistory,
      activities: [
        createActivity("COMPLETED_ONLY", {
          completed: true,
          completedTime: "2026-06-10T10:00:00.000+03:00"
        }),
        createActivity("WITH_OPEN_TASK"),
        createActivity("WITH_FAILED_CALL"),
        createActivity("YOUNG_NO_CALL"),
        createActivity("OLD_NO_CALL"),
        createActivity("OLD_NO_ACTIVITY", {
          createdTime: "2026-06-01T09:00:00.000+03:00",
          lastUpdated: "2026-06-01T09:00:00.000+03:00",
          deadline: "2026-06-20T09:00:00.000+03:00"
        })
      ],
      calls: [
        createCall("COMPLETED_ONLY"),
        createCall("WITH_OPEN_TASK"),
        createCall("WITH_FAILED_CALL", {
          callDurationSeconds: 0,
          callFailedCode: "304"
        }),
        createCall("OLD_NO_ACTIVITY")
      ]
    });
    const flagsByDeal = new Map(
      report.risks.map((risk) => [
        risk.dealId,
        risk.flags.map((flag) => flag.rule)
      ])
    );

    expect(flagsByDeal.get("COMPLETED_ONLY")).toEqual(["no_open_activity"]);
    expect(flagsByDeal.has("WITH_OPEN_TASK")).toBe(false);
    expect(flagsByDeal.has("WITH_FAILED_CALL")).toBe(false);
    expect(flagsByDeal.has("YOUNG_NO_CALL")).toBe(false);
    expect(flagsByDeal.get("OLD_NO_CALL")).toEqual(["no_recent_calls"]);
    expect(flagsByDeal.get("OLD_NO_ACTIVITY")).toEqual(["no_recent_activity"]);
  });

  it("counts flow metrics, planned work and meetings strictly by slot index", () => {
    const deals = [
      createDeal({
        id: "MEETING_SLOT_INTRO",
        meetingSlots: [
          {
            index: 1,
            dateValue: "2026-06-05T10:00:00.000+03:00",
            typeValue: "Встреча-знакомство",
            placeValue: null,
            calendarValue: null,
            eventId: null,
            source: "deal_fields"
          }
        ]
      }),
      createDeal({
        id: "MEETING_SLOT_ACTIVATION",
        meetingSlots: [
          {
            index: 1,
            dateValue: "2026-06-06T10:00:00.000+03:00",
            typeValue: "Активация",
            placeValue: null,
            calendarValue: null,
            eventId: null,
            source: "deal_fields"
          }
        ]
      }),
      createDeal({
        id: "PLANNED_MEETINGS",
        meetingSlots: [
          {
            index: 1,
            dateValue: "2026-06-10T14:00:00.000+03:00",
            typeValue: "Встреча-знакомство",
            placeValue: null,
            calendarValue: null,
            eventId: null,
            source: "deal_fields"
          },
          {
            index: 2,
            dateValue: "2026-06-11T12:00:00.000+03:00",
            typeValue: "Демонстрация",
            placeValue: null,
            calendarValue: null,
            eventId: null,
            source: "deal_fields"
          },
          {
            index: 3,
            dateValue: "2026-06-09T12:00:00.000+03:00",
            typeValue: "Активация",
            placeValue: null,
            calendarValue: null,
            eventId: null,
            source: "deal_fields"
          }
        ]
      }),
      createDeal({
        id: "WON_A_1",
        stageId: "C10:WON",
        stageSemanticId: "S",
        targetGroupValue: "Club A",
        dateCreate: "2026-06-01T09:00:00.000+03:00",
        dateClosed: "2026-06-07T12:00:00.000+03:00"
      }),
      createDeal({
        id: "WON_A_2",
        stageId: "C10:WON",
        stageSemanticId: "S",
        targetGroupValue: "Club A",
        dateCreate: "2026-06-05T09:00:00.000+03:00",
        dateClosed: "2026-06-08T12:00:00.000+03:00"
      }),
      createDeal({
        id: "LOST_DEFAULT",
        stageId: "C10:LOSE",
        stageSemanticId: "F"
      }),
      createDeal({
        id: "LOST_RETURNED",
        stageId: "C10:UC_EA3R76",
        stageSemanticId: "F"
      })
    ];
    const report = buildReport({
      deals,
      stageHistory: [
        createStageHistory({
          dealId: "WON_A_1",
          stageId: "C10:WON",
          createdTime: "2026-06-07T12:00:00.000+03:00",
          stageSemanticId: "S"
        }),
        createStageHistory({
          dealId: "WON_A_2",
          stageId: "C10:WON",
          createdTime: "2026-06-08T12:00:00.000+03:00",
          stageSemanticId: "S"
        }),
        createStageHistory({
          dealId: "LOST_DEFAULT",
          stageId: "C10:LOSE",
          createdTime: "2026-06-08T12:00:00.000+03:00",
          stageSemanticId: "F"
        }),
        createStageHistory({
          dealId: "LOST_RETURNED",
          stageId: "C10:UC_EA3R76",
          createdTime: "2026-06-09T12:00:00.000+03:00",
          stageSemanticId: "F"
        })
      ],
      activities: [
        createActivity("PLANNED_MEETINGS", {
          id: "TASK_TODAY",
          deadline: "2026-06-10T16:00:00.000+03:00"
        }),
        createActivity("PLANNED_MEETINGS", {
          id: "TASK_TOMORROW",
          deadline: "2026-06-11T16:00:00.000+03:00"
        })
      ]
    });

    expect(report.meetingsHeld).toEqual({
      total: 3,
      bySlot: [
        { slotIndex: 1, slotLabel: "Встреча 1", count: 2 },
        { slotIndex: 2, slotLabel: "Встреча 2", count: 0 },
        { slotIndex: 3, slotLabel: "Встреча 3", count: 1 }
      ]
    });
    expect(report.planned).toMatchObject({
      meetingsToday: [
        { slotIndex: 1, slotLabel: "Встреча 1", count: 1 },
        { slotIndex: 2, slotLabel: "Встреча 2", count: 0 },
        { slotIndex: 3, slotLabel: "Встреча 3", count: 0 }
      ],
      meetingsTomorrow: [
        { slotIndex: 1, slotLabel: "Встреча 1", count: 0 },
        { slotIndex: 2, slotLabel: "Встреча 2", count: 1 },
        { slotIndex: 3, slotLabel: "Встреча 3", count: 0 }
      ],
      tasksToday: 1,
      tasksTomorrow: 1
    });
    expect(report.sales).toMatchObject({
      total: 2,
      byClub: [
        {
          targetGroupKey: "Club A",
          targetGroupLabel: "Club A",
          wonDeals: 2,
          averageDaysToWin: 4.63
        }
      ]
    });
    expect(report.lostDeals).toBe(2);
  });

  it("keeps out-of-category deals and tasks out of operational totals", () => {
    const inScopeDeal = createDeal({ id: "IN_SCOPE" });
    const outOfScopeDeal = createDeal({
      id: "OUT_OF_SCOPE",
      categoryId: "28",
      stageId: "C28:NEW"
    });
    const report = buildReport({
      deals: [inScopeDeal, outOfScopeDeal],
      activities: [
        createActivity("IN_SCOPE", {
          id: "TASK_IN_SCOPE",
          deadline: "2026-06-10T16:00:00.000+03:00"
        }),
        createActivity("OUT_OF_SCOPE", {
          id: "TASK_OUT_OF_SCOPE",
          deadline: "2026-06-10T16:00:00.000+03:00"
        })
      ],
      calls: [createCall("IN_SCOPE"), createCall("OUT_OF_SCOPE")]
    });

    expect(report.createdDeals).toBe(1);
    expect(report.openDeals).toBe(1);
    expect(report.planned.tasksToday).toBe(1);
    expect(report.stageWip.map((stage) => stage.stageId)).toEqual([
      "C10:PREPARATION"
    ]);
  });

  it("keeps retained snapshots in historical totals but excludes non-current deals from WIP, plans and risks", () => {
    const currentDeal = createDeal({ id: "CURRENT" });
    const movedDeal = createDeal({ id: "MOVED_TO_WARMUP" });
    const report = buildReport({
      deals: [currentDeal, movedDeal],
      currentDealIds: ["CURRENT"],
      activities: [
        createActivity("CURRENT", {
          id: "TASK_CURRENT",
          deadline: "2026-06-10T16:00:00.000+03:00"
        }),
        createActivity("MOVED_TO_WARMUP", {
          id: "TASK_MOVED",
          deadline: "2026-06-10T16:00:00.000+03:00"
        })
      ]
    });

    expect(report.createdDeals).toBe(2);
    expect(report.openDeals).toBe(1);
    expect(report.planned.tasksToday).toBe(1);
    expect(report.currentScope).toEqual({
      status: "ready",
      reconciledAt: null,
      dealCount: 1
    });
    expect(report.risks.map((risk) => risk.dealId)).not.toContain(
      "MOVED_TO_WARMUP"
    );
    expect(report.stageWip).toEqual([
      expect.objectContaining({
        stageId: "C10:PREPARATION",
        openDeals: 1
      })
    ]);
  });

  it("groups sales by target group instead of customer business club", () => {
    const report = buildReport({
      deals: [
        createDeal({
          id: "WON_TARGET_A",
          stageId: "C10:WON",
          stageSemanticId: "S",
          businessClubValue: "Customer Club",
          targetGroupValue: "Sale Club A",
          dateCreate: "2026-06-01T09:00:00.000+03:00",
          dateClosed: "2026-06-04T12:00:00.000+03:00"
        }),
        createDeal({
          id: "WON_TARGET_B",
          stageId: "C10:WON",
          stageSemanticId: "S",
          businessClubValue: "Customer Club",
          targetGroupValue: "Sale Club B",
          dateCreate: "2026-06-01T09:00:00.000+03:00",
          dateClosed: "2026-06-05T12:00:00.000+03:00"
        })
      ],
      stageHistory: [
        createStageHistory({
          dealId: "WON_TARGET_A",
          stageId: "C10:WON",
          createdTime: "2026-06-04T12:00:00.000+03:00",
          stageSemanticId: "S"
        }),
        createStageHistory({
          dealId: "WON_TARGET_B",
          stageId: "C10:WON",
          createdTime: "2026-06-05T12:00:00.000+03:00",
          stageSemanticId: "S"
        })
      ]
    });

    expect(report.sales.byClub.map((club) => club.targetGroupLabel)).toEqual([
      "Sale Club A",
      "Sale Club B"
    ]);
    expect(report.sales.byClub.map((club) => club.targetGroupLabel)).not.toContain(
      "Customer Club"
    );
  });

  it("returns all sorted risks by default and supports an explicit cap", () => {
    const riskyDeals = Array.from({ length: 6 }, (_, index) =>
      createDeal({
        id: `RISK_${String(index + 1).padStart(2, "0")}`,
        dateCreate: "2026-06-01T09:00:00.000+03:00"
      })
    );
    const input = {
      deals: [
        ...riskyDeals,
        createDeal({
          id: "WON_OLD",
          stageId: "C10:WON",
          stageSemanticId: "S",
          dateCreate: "2026-06-01T09:00:00.000+03:00"
        }),
        createDeal({
          id: "LOST_OLD",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          dateCreate: "2026-06-01T09:00:00.000+03:00"
        })
      ],
      stageHistory: riskyDeals.map((deal) =>
        createStageHistory({
          dealId: deal.id,
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-01T09:00:00.000+03:00"
        })
      ),
      activities: riskyDeals.map((deal) => createActivity(deal.id)),
      calls: riskyDeals.map((deal) => createCall(deal.id))
    };
    const report = buildReport(input);

    expect(report.riskSummary.total).toBe(6);
    expect(report.risks).toHaveLength(6);
    expect(report.risks.map((risk) => risk.dealId)).toEqual([
      "RISK_01",
      "RISK_02",
      "RISK_03",
      "RISK_04",
      "RISK_05",
      "RISK_06"
    ]);
    expect(report.risks.map((risk) => risk.dealId)).not.toContain("WON_OLD");
    expect(report.risks.map((risk) => risk.dealId)).not.toContain("LOST_OLD");

    const cappedReport = buildReport({ ...input, capRisks: 3 });

    expect(cappedReport.riskSummary.total).toBe(6);
    expect(cappedReport.risks.map((risk) => risk.dealId)).toEqual([
      "RISK_01",
      "RISK_02",
      "RISK_03"
    ]);
  });

  it("uses configured SLA business-hour thresholds in summaries and managers", () => {
    const deal = createDeal({
      id: "SLA_LATE",
      dateCreate: "2026-06-10T03:00:00.000+03:00"
    });
    const report = buildReport({
      deals: [deal],
      stageHistory: [
        createStageHistory({
          dealId: "SLA_LATE",
          stageId: "C10:PREPARATION",
          createdTime: "2026-06-10T03:00:00.000+03:00"
        })
      ],
      activities: [createActivity("SLA_LATE")],
      calls: [
        createCall("SLA_LATE", {
          callStartDate: "2026-06-10T09:00:00.000+03:00"
        })
      ]
    });

    expect(report.sla).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slaKey: "sla2",
          thresholdBusinessHours: 5,
          lateCount: 1,
          onTimeCount: 0
        })
      ])
    );
    expect(report.managers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          managerId: "6994",
          slaLateCount: expect.any(Number)
        })
      ])
    );
    expect(
      report.managers.find((manager) => manager.managerId === "6994")
        ?.slaLateCount
    ).toBeGreaterThanOrEqual(1);
  });

  it("uses exact deal-level durations for aggregate SLA medians", () => {
    const deals = [
      createDeal({
        id: "SLA_1H",
        assignedById: "6994",
        dateCreate: "2026-06-10T00:00:00.000+03:00"
      }),
      createDeal({
        id: "SLA_9H",
        assignedById: "6994",
        dateCreate: "2026-06-10T00:00:00.000+03:00"
      }),
      createDeal({
        id: "SLA_10H",
        assignedById: "13020",
        dateCreate: "2026-06-10T00:00:00.000+03:00"
      })
    ];
    const report = buildReport({
      deals,
      activities: deals.map((deal) => createActivity(deal.id)),
      calls: [
        createCall("SLA_1H", {
          callStartDate: "2026-06-10T01:00:00.000+03:00"
        }),
        createCall("SLA_9H", {
          callStartDate: "2026-06-10T09:00:00.000+03:00"
        }),
        createCall("SLA_10H", {
          callStartDate: "2026-06-10T10:00:00.000+03:00",
          portalUserId: "13020"
        })
      ]
    });
    const sla2 = report.sla.find((metric) => metric.slaKey === "sla2");

    expect(sla2).toMatchObject({
      medianHours: 9,
      onTimeCount: 1,
      lateCount: 2
    });
  });
});
