import type {
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  HourlyWeekdayWorkloadHeatmap,
  WorkloadHeatmapBasisInfo
} from "@bitrix24-reporting/contracts";
import { describe, expect, it } from "vitest";

import {
  buildDailyActivityReportRange,
  buildTelegramActivityReportMessages
} from "../src/server/telegram-activity-report";

const emptyCallPopulation = {
  totalCalls: 0,
  incomingCalls: 0,
  missedIncomingCalls: 0,
  outgoingCalls: 0,
  otherOutgoingCalls: 0,
  connectedCalls: 0,
  failedCalls: 0,
  callsOverThirtySeconds: 0,
  connectedCallsOverThirtySeconds: 0,
  averageDurationSeconds: 0
};

const emptyLinkedDealCalls = {
  ...emptyCallPopulation,
  dealCount: 0,
  averageCallsPerDeal: 0,
  stageBreakdown: []
};

const OUTGOING_CALLS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: "outgoing_calls",
  label: "Исходящие звонки"
};
const TASKS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: "tasks",
  label: "Задачи"
};
const CREATED_TASKS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: "created_tasks",
  label: "Созданные задачи"
};
const CLOSED_TASKS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: "closed_tasks",
  label: "Закрытые задачи"
};
const MEETINGS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: "meetings",
  label: "Встречи"
};

function emptyHourlyWeekdayWorkloadHeatmap(
  basis: WorkloadHeatmapBasisInfo
): HourlyWeekdayWorkloadHeatmap {
  return {
    basis,
    hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    weekdays: [
      { weekday: 1 as const, label: "Пн" },
      { weekday: 2 as const, label: "Вт" },
      { weekday: 3 as const, label: "Ср" },
      { weekday: 4 as const, label: "Чт" },
      { weekday: 5 as const, label: "Пт" },
      { weekday: 6 as const, label: "Сб" },
      { weekday: 7 as const, label: "Вс" }
    ],
    cells: [],
    total: 0,
    gridTotal: 0,
    outsideGridTotal: 0,
    peak: null
  };
}

function createActivitiesReport(
  managerRows: ActivitiesWorkloadReport["managerRows"]
): ActivitiesWorkloadReport {
  return {
    range: {
      from: "2026-06-04T00:00:00.000+03:00",
      to: "2026-06-04T20:00:00.000+03:00"
    },
    totalDealCount: 0,
    totalCreatedCount: managerRows.reduce(
      (total, row) => total + row.createdCount,
      0
    ),
    totalRescheduledCount: 0,
    totalClosedCount: managerRows.reduce(
      (total, row) => total + row.closedCount,
      0
    ),
    totalMeetingCount: managerRows.reduce(
      (total, row) => total + row.meetingCount,
      0
    ),
    warnings: [],
    conversionEventRows: [],
    managerRows,
    comparisons: []
  };
}

function createCallsReport(
  managerRows: CallsWorkloadReport["managerRows"]
): CallsWorkloadReport {
  return {
    range: {
      from: "2026-06-04T00:00:00.000+03:00",
      to: "2026-06-04T20:00:00.000+03:00"
    },
    totalDealCount: 0,
    totalCalls: managerRows.reduce((total, row) => total + row.totalCalls, 0),
    totalIncomingCalls: managerRows.reduce(
      (total, row) => total + row.incomingCalls,
      0
    ),
    totalMissedIncomingCalls: managerRows.reduce(
      (total, row) => total + row.missedIncomingCalls,
      0
    ),
    totalOutgoingCalls: managerRows.reduce(
      (total, row) => total + row.outgoingCalls,
      0
    ),
    totalOtherOutgoingCalls: managerRows.reduce(
      (total, row) => total + row.otherOutgoingCalls,
      0
    ),
    totalConnectedCalls: managerRows.reduce(
      (total, row) => total + row.connectedCalls,
      0
    ),
    totalFailedCalls: managerRows.reduce(
      (total, row) => total + row.failedCalls,
      0
    ),
    totalCallsOverThirtySeconds: 0,
    totalConnectedCallsOverThirtySeconds: 0,
    allCalls: emptyCallPopulation,
    linkedDealCalls: {
      ...emptyCallPopulation,
      totalDealCount: 0
    },
    warnings: [],
    managerRows,
    comparisons: []
  };
}

function createActivityRow(
  input: Partial<ActivitiesWorkloadReport["managerRows"][number]> & {
    managerId: string;
    managerName: string;
  }
): ActivitiesWorkloadReport["managerRows"][number] {
  return {
    managerId: input.managerId,
    managerName: input.managerName,
    dealCount: 0,
    createdCount: input.createdCount ?? 0,
    rescheduledCount: 0,
    closedCount: input.closedCount ?? 0,
    meetingCount: input.meetingCount ?? 0,
    averageCreatedPerDeal: 0,
    averageRescheduledPerDeal: 0,
    averageClosedPerDeal: 0,
    averageMeetingsPerDeal: 0,
    meetingTypeBreakdown: [],
    businessClubBreakdown: [],
    meetingBusinessClubBreakdown: [],
    tasksHourlyHeatmap:
      input.tasksHourlyHeatmap ??
      emptyHourlyWeekdayWorkloadHeatmap(TASKS_HEATMAP_BASIS),
    createdTasksHourlyHeatmap:
      input.createdTasksHourlyHeatmap ??
      emptyHourlyWeekdayWorkloadHeatmap(CREATED_TASKS_HEATMAP_BASIS),
    closedTasksHourlyHeatmap:
      input.closedTasksHourlyHeatmap ??
      emptyHourlyWeekdayWorkloadHeatmap(CLOSED_TASKS_HEATMAP_BASIS),
    meetingsHourlyHeatmap:
      input.meetingsHourlyHeatmap ??
      emptyHourlyWeekdayWorkloadHeatmap(MEETINGS_HEATMAP_BASIS),
    slaMetrics: [],
    stageBreakdown: []
  };
}

function createCallRow(
  input: Partial<CallsWorkloadReport["managerRows"][number]> & {
    managerId: string;
    managerName: string;
  }
): CallsWorkloadReport["managerRows"][number] {
  return {
    managerId: input.managerId,
    managerName: input.managerName,
    dealCount: 0,
    totalCalls: input.totalCalls ?? 0,
    incomingCalls: input.incomingCalls ?? 0,
    missedIncomingCalls: input.missedIncomingCalls ?? 0,
    outgoingCalls: input.outgoingCalls ?? 0,
    otherOutgoingCalls: input.otherOutgoingCalls ?? 0,
    connectedCalls: input.connectedCalls ?? 0,
    failedCalls: input.failedCalls ?? 0,
    callsOverThirtySeconds: 0,
    connectedCallsOverThirtySeconds: 0,
    averageCallsPerDeal: 0,
    averageDurationSeconds: 0,
    allCalls: emptyCallPopulation,
    linkedDealCalls: emptyLinkedDealCalls,
    callsHourlyHeatmap:
      input.callsHourlyHeatmap ??
      emptyHourlyWeekdayWorkloadHeatmap(OUTGOING_CALLS_HEATMAP_BASIS),
    stageBreakdown: []
  };
}

describe("telegram activity report", () => {
  it("builds the current local day range up to the scheduled send time", () => {
    expect(
      buildDailyActivityReportRange({
        now: new Date("2026-06-04T17:00:00.000Z"),
        timezone: "Europe/Istanbul",
        reportTime: "20:00"
      })
    ).toEqual({
      from: "2026-06-04T00:00:00.000+03:00",
      to: "2026-06-04T20:00:00.000+03:00"
    });
  });

  it("builds one copy-ready message per configured team and omits unassigned managers", () => {
    const messages = buildTelegramActivityReportMessages({
      moduleName: "Привлечение",
      timezone: "Europe/Istanbul",
      now: new Date("2026-06-04T17:00:00.000Z"),
      lastSyncFinishedAt: "2026-06-04T16:40:00.000Z",
      managerCatalog: [
        { id: "1", name: "Анна" },
        { id: "2", name: "Борис" },
        { id: "3", name: "Какулия Илья" },
        { id: "4", name: "Дарья Бычкова" }
      ],
      managerTeams: [
        {
          id: "Привлечение 1.0",
          name: "Привлечение 1.0",
          managerIds: ["1", "2"]
        },
        {
          id: "Привлечение 2.0",
          name: "Привлечение 2.0",
          managerIds: ["3"]
        }
      ],
      activities: createActivitiesReport([
        createActivityRow({
          managerId: "1",
          managerName: "Анна",
          createdCount: 3,
          closedCount: 2,
          meetingCount: 1
        }),
        createActivityRow({
          managerId: "3",
          managerName: "Какулия Илья",
          createdCount: 10,
          closedCount: 9,
          meetingCount: 4
        }),
        createActivityRow({
          managerId: "4",
          managerName: "Дарья Бычкова",
          createdCount: 7,
          closedCount: 6,
          meetingCount: 2
        })
      ]),
      calls: createCallsReport([
        createCallRow({
          managerId: "1",
          managerName: "Анна",
          totalCalls: 5,
          incomingCalls: 1,
          outgoingCalls: 3,
          missedIncomingCalls: 1,
          connectedCalls: 4,
          failedCalls: 1
        }),
        createCallRow({
          managerId: "3",
          managerName: "Какулия Илья",
          totalCalls: 8,
          incomingCalls: 2,
          outgoingCalls: 6,
          missedIncomingCalls: 0,
          connectedCalls: 6,
          failedCalls: 2
        }),
        createCallRow({
          managerId: "4",
          managerName: "Дарья Бычкова",
          outgoingCalls: 4
        })
      ])
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("Активность: Привлечение 1.0 за 04.06.2026");
    expect(messages[0]).toContain("Последний sync: 04.06.2026, 19:40");
    expect(messages[0]).toContain(
      [
        "Итого:",
        "Задачи: 3",
        "Закрыто задач: 2",
        "Исходящие звонки: 3",
        "Встречи: 1"
      ].join("\n")
    );
    expect(messages[0]).toContain(
      ["Задачи:", "Анна - 3", "Борис - 0"].join("\n")
    );
    expect(messages[0]).toContain(
      ["Закрыто задач:", "Анна - 2", "Борис - 0"].join("\n")
    );
    expect(messages[0]).toContain(
      [
        "Исходящие звонки:",
        "Анна - 3",
        "Борис - 0"
      ].join("\n")
    );
    expect(messages[0]).toContain(
      ["Встречи:", "Анна - 1", "Борис - 0"].join("\n")
    );
    expect(messages[0]).not.toContain("Какулия");
    expect(messages[1]).toContain("Активность: Привлечение 2.0 за 04.06.2026");
    expect(messages[1]).toContain(
      [
        "Итого:",
        "Задачи: 10",
        "Закрыто задач: 9",
        "Исходящие звонки: 6",
        "Встречи: 4"
      ].join("\n")
    );
    expect(messages[1]).toContain("Какулия Илья - 10");
    expect(messages.join("\n")).not.toContain("Дарья Бычкова");
    expect(messages.join("\n")).not.toContain("входящие");
    expect(messages.join("\n")).not.toContain("пропущенные");
  });

  it("splits long reports without dropping employee rows", () => {
    const managerRows = Array.from({ length: 8 }, (_, index) =>
      createActivityRow({
        managerId: String(index + 1),
        managerName: `Менеджер ${index + 1}`,
        createdCount: index + 1
      })
    );
    const messages = buildTelegramActivityReportMessages({
      moduleName: "Привлечение",
      timezone: "Europe/Istanbul",
      now: new Date("2026-06-04T17:00:00.000Z"),
      lastSyncFinishedAt: null,
      activities: createActivitiesReport(managerRows),
      calls: createCallsReport([]),
      maxMessageLength: 320
    });

    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 320)).toBe(true);
    expect(messages.join("\n")).toContain("Менеджер 1 - 1");
    expect(messages.join("\n")).toContain("Менеджер 8 - 8");
  });
});
