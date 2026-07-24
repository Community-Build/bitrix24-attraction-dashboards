import { describe, expect, it } from "vitest";
import type { DealSnapshot } from "@bitrix24-reporting/contracts";

import { buildSourceCohortConversionReport } from "../src/domain/source-cohort-conversion";

function makeDeal(overrides: Partial<DealSnapshot>): DealSnapshot {
  return {
    id: "deal",
    leadId: null,
    categoryId: "10",
    stageId: "C10:PREPARATION",
    stageSemanticId: "P",
    opportunity: 0,
    assignedById: "7",
    sourceId: "LIDGEN",
    qualityValue: "3.1 Готов ко встрече",
    businessClubValue: "ClubFirst Future",
    targetGroupValue: null,
    dateCreate: "2026-05-01T10:00:00.000Z",
    dateModify: "2026-05-01T10:00:00.000Z",
    dateClosed: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    ...overrides
  };
}

describe("buildSourceCohortConversionReport", () => {
  it("builds a source cohort report with manager, open-stage and target-group breakdowns", () => {
    const result = buildSourceCohortConversionReport({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        makeDeal({
          id: "won",
          assignedById: "7",
          stageId: "C10:WON",
          stageSemanticId: "S",
          targetGroupValue: "ClubFirst Russia",
          dateCreate: "2026-05-05T10:00:00.000Z",
          dateClosed: "2026-05-16T10:00:00.000Z"
        }),
        makeDeal({
          id: "open",
          assignedById: "8",
          stageId: "C10:MEETING",
          stageSemanticId: "P",
          dateCreate: "2026-05-10T10:00:00.000Z"
        }),
        makeDeal({
          id: "lost",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          businessClubValue: "ClubFirst One",
          dateCreate: "2026-05-20T10:00:00.000Z",
          dateClosed: "2026-05-25T10:00:00.000Z"
        }),
        makeDeal({
          id: "june",
          dateCreate: "2026-06-02T10:00:00.000Z"
        })
      ],
      stageCatalog: [
        {
          entityType: "source",
          categoryId: null,
          statusId: "LIDGEN",
          name: "Лидген УС",
          semanticId: null
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:MEETING",
          name: "Встреча-знакомство",
          semanticId: "P",
          sortOrder: 30
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
        }
      ],
      stageHistory: [
        {
          id: "won-stage",
          ownerId: "won",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-05-16T10:00:00.000Z"
        }
      ],
      managerDirectory: [
        { id: "7", name: "Иван" },
        { id: "8", name: "Мария" }
      ]
    });

    expect(result.totalCreatedDeals).toBe(3);
    expect(result.totalWonDeals).toBe(1);
    expect(result.totalLostDeals).toBe(1);
    expect(result.totalReturnedDeals).toBe(0);
    expect(result.totalOpenDeals).toBe(1);
    expect(result.winRate).toBeCloseTo(33.33, 2);
    expect(result.averageDaysToWin).toBe(11);
    expect(result.cohortMonths).toEqual([
      { cohortMonth: "2026-05", cohortLabel: "Май 2026", totalCreatedDeals: 3 },
      { cohortMonth: "2026-06", cohortLabel: "Июнь 2026", totalCreatedDeals: 1 }
    ]);

    expect(result.rows).toEqual([
      {
        id: "LIDGEN|3.1 Готов ко встрече|ClubFirst Future",
        sourceKey: "LIDGEN",
        sourceLabel: "Лидген УС",
        qualityKey: "3.1 Готов ко встрече",
        qualityLabel: "3.1 Готов ко встрече",
        customerKey: "ClubFirst Future",
        customerLabel: "ClubFirst Future",
        createdDeals: 2,
        wonDeals: 1,
        lostDeals: 0,
        returnedDeals: 0,
        openDeals: 1,
        winRate: 50,
        averageDaysToWin: 11,
        managerBreakdown: [
          {
            managerId: "7",
            managerName: "Иван",
            createdDeals: 1,
            wonDeals: 1,
            lostDeals: 0,
            returnedDeals: 0,
            openDeals: 0,
            winRate: 100,
            averageDaysToWin: 11,
            openStageBreakdown: []
          },
          {
            managerId: "8",
            managerName: "Мария",
            createdDeals: 1,
            wonDeals: 0,
            lostDeals: 0,
            returnedDeals: 0,
            openDeals: 1,
            winRate: 0,
            averageDaysToWin: 0,
            openStageBreakdown: [
              {
                stageId: "C10:MEETING",
                stageName: "Встреча-знакомство",
                openDeals: 1
              }
            ]
          }
        ],
        openStageBreakdown: [
          {
            stageId: "C10:MEETING",
            stageName: "Встреча-знакомство",
            openDeals: 1
          }
        ],
        targetGroupBreakdown: [
          {
            targetGroupKey: "ClubFirst Russia",
            targetGroupLabel: "ClubFirst Russia",
            wonDeals: 1,
            averageDaysToWin: 11
          }
        ]
      },
      {
        id: "LIDGEN|3.1 Готов ко встрече|ClubFirst One",
        sourceKey: "LIDGEN",
        sourceLabel: "Лидген УС",
        qualityKey: "3.1 Готов ко встрече",
        qualityLabel: "3.1 Готов ко встрече",
        customerKey: "ClubFirst One",
        customerLabel: "ClubFirst One",
        createdDeals: 1,
        wonDeals: 0,
        lostDeals: 1,
        returnedDeals: 0,
        openDeals: 0,
        winRate: 0,
        averageDaysToWin: 0,
        managerBreakdown: [
          {
            managerId: "7",
            managerName: "Иван",
            createdDeals: 1,
            wonDeals: 0,
            lostDeals: 1,
            returnedDeals: 0,
            openDeals: 0,
            winRate: 0,
            averageDaysToWin: 0,
            openStageBreakdown: []
          }
        ],
        openStageBreakdown: [],
        targetGroupBreakdown: []
      }
    ]);
  });

  it("uses the first WON transition for the sales cycle", () => {
    const result = buildSourceCohortConversionReport({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        makeDeal({
          id: "rewon",
          stageId: "C10:WON",
          stageSemanticId: "S",
          targetGroupValue: "ClubFirst Russia",
          dateCreate: "2026-05-01T10:00:00.000Z",
          dateClosed: "2026-05-21T10:00:00.000Z"
        })
      ],
      stageCatalog: [
        {
          entityType: "source",
          categoryId: null,
          statusId: "LIDGEN",
          name: "Лидген УС",
          semanticId: null
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 100
        }
      ],
      stageHistory: [
        {
          id: "won-first",
          ownerId: "rewon",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-05-05T10:00:00.000Z"
        },
        {
          id: "won-second",
          ownerId: "rewon",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-05-21T10:00:00.000Z"
        }
      ],
      managerDirectory: [{ id: "7", name: "Иван" }]
    });

    expect(result.averageDaysToWin).toBe(4);
    expect(result.rows[0]?.averageDaysToWin).toBe(4);
    expect(result.rows[0]?.targetGroupBreakdown[0]?.averageDaysToWin).toBe(4);
  });

  it("keeps repairable rejection and return routes out of loss totals", () => {
    const result = buildSourceCohortConversionReport({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        makeDeal({
          id: "repairable",
          stageId: "C10:UC_XEEP0A",
          stageSemanticId: "F",
          dateCreate: "2026-05-10T10:00:00.000Z"
        }),
        makeDeal({
          id: "returned",
          stageId: "C10:UC_EA3R76",
          stageSemanticId: "F",
          dateCreate: "2026-05-11T10:00:00.000Z"
        }),
        makeDeal({
          id: "lost",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          dateCreate: "2026-05-12T10:00:00.000Z"
        })
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:UC_XEEP0A",
          name: "Отклонено потребителем",
          semanticId: "F",
          sortOrder: 80
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
          statusId: "C10:UC_EA3R76",
          name: "Возврат в Лидген(неквал)",
          semanticId: "F",
          sortOrder: 100
        }
      ],
      stageHistory: [],
      managerDirectory: [{ id: "7", name: "Иван" }]
    });

    expect(result).toMatchObject({
      totalCreatedDeals: 3,
      totalWonDeals: 0,
      totalLostDeals: 1,
      totalReturnedDeals: 1,
      totalOpenDeals: 1
    });
    expect(result.rows[0]).toMatchObject({
      createdDeals: 3,
      wonDeals: 0,
      lostDeals: 1,
      returnedDeals: 1,
      openDeals: 1
    });
  });
});
