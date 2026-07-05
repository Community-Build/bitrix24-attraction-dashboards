import { describe, expect, it } from "vitest";

import { buildActivitiesWorkloadReport } from "../src/domain/operational-reports";

describe("buildActivitiesWorkloadReport", () => {
  it("adds per-manager created-task, closed-task and meeting heatmaps by weekday and hour from 9 to 21", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-05-04T00:00:00.000Z",
        to: "2026-05-10T23:59:59.999Z"
      },
      deals: [
        {
          id: "HEATMAP_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:MEETING",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: "Zoom",
          meetingDateValue: "2026-05-05T15:00:00.000Z",
          meetingSlots: [
            {
              index: 1,
              dateValue: "2026-05-05T15:00:00.000Z",
              typeValue: "Zoom",
              placeValue: null,
              calendarValue: null,
              eventId: null,
              source: "deal_fields"
            },
            {
              index: 2,
              dateValue: "2026-05-10T20:00:00.000Z",
              typeValue: "Офлайн",
              placeValue: null,
              calendarValue: null,
              eventId: null,
              source: "deal_fields"
            },
            {
              index: 3,
              dateValue: "2026-05-06T22:00:00.000Z",
              typeValue: "Zoom",
              placeValue: null,
              calendarValue: null,
              eventId: null,
              source: "deal_fields"
            }
          ],
          dateCreate: "2026-05-04T08:00:00.000Z",
          dateModify: "2026-05-10T20:30:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:MEETING",
          name: "Встреча-знакомство",
          semanticId: "P",
          sortOrder: 20
        }
      ],
      stageHistory: [],
      activities: [
        {
          id: "TASK_MONDAY",
          ownerTypeId: "2",
          ownerId: "HEATMAP_DEAL",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-05-04T09:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-05-04T09:30:00.000Z",
          completed: true,
          completedTime: "2026-05-04T09:30:00.000Z"
        },
        {
          id: "TASK_SUNDAY",
          ownerTypeId: "2",
          ownerId: "HEATMAP_DEAL",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-05-10T21:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-05-10T21:15:00.000Z",
          completed: true,
          completedTime: "2026-05-10T21:15:00.000Z"
        },
        {
          id: "TASK_OUTSIDE_HOUR",
          ownerTypeId: "2",
          ownerId: "HEATMAP_DEAL",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-05-06T22:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-05-06T22:15:00.000Z",
          completed: true,
          completedTime: "2026-05-06T22:15:00.000Z"
        }
      ],
      deadlineChanges: [],
      meetingDateChanges: [],
      managerDirectory: [{ id: "7", name: "Анна Куратор" }]
    });

    const row = result.managerRows.find((item) => item.managerId === "7");
    const tasksHeatmap = (row as any)?.tasksHourlyHeatmap;
    const createdTaskHeatmap = (row as any)?.createdTasksHourlyHeatmap;
    const closedTaskHeatmap = (row as any)?.closedTasksHourlyHeatmap;
    const meetingHeatmap = (row as any)?.meetingsHourlyHeatmap;
    const mondayTasks = tasksHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) => cell.weekday === 1 && cell.hour === 9
    );
    const sundayTasks = tasksHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 7 && cell.hour === 21
    );
    const createdMondayTask = createdTaskHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) => cell.weekday === 1 && cell.hour === 9
    );
    const createdSundayTask = createdTaskHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 7 && cell.hour === 21
    );
    const closedMondayTask = closedTaskHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) => cell.weekday === 1 && cell.hour === 9
    );
    const closedSundayTask = closedTaskHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 7 && cell.hour === 21
    );
    const outsideTask = closedTaskHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 3 && cell.hour === 22
    );
    const tuesdayMeeting = meetingHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 2 && cell.hour === 15
    );
    const sundayMeeting = meetingHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 7 && cell.hour === 20
    );
    const outsideMeeting = meetingHeatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 3 && cell.hour === 22
    );

    expect(createdTaskHeatmap?.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(createdTaskHeatmap?.weekdays.map((weekday: { label: string }) => weekday.label)).toEqual([
      "Пн",
      "Вт",
      "Ср",
      "Чт",
      "Пт",
      "Сб",
      "Вс"
    ]);
    expect(createdTaskHeatmap?.basis).toEqual({
      key: "created_tasks",
      label: "Созданные задачи"
    });
    expect(closedTaskHeatmap?.basis).toEqual({
      key: "closed_tasks",
      label: "Закрытые задачи"
    });
    expect(meetingHeatmap?.basis).toEqual({
      key: "meetings",
      label: "Встречи"
    });
    expect(tasksHeatmap?.basis).toEqual({
      key: "tasks",
      label: "Задачи"
    });
    expect(mondayTasks).toMatchObject({ count: 2, intensity: 5 });
    expect(mondayTasks?.segments).toEqual([
      { key: "created_tasks", label: "Созданные задачи", count: 1, intensity: 5 },
      { key: "closed_tasks", label: "Закрытые задачи", count: 1, intensity: 5 }
    ]);
    expect(sundayTasks).toMatchObject({ count: 2, intensity: 5 });
    expect(tasksHeatmap?.total).toBe(6);
    expect(tasksHeatmap?.gridTotal).toBe(4);
    expect(tasksHeatmap?.outsideGridTotal).toBe(2);
    expect(createdMondayTask).toMatchObject({ count: 1, intensity: 5 });
    expect(createdSundayTask).toMatchObject({ count: 1, intensity: 5 });
    expect(createdTaskHeatmap?.total).toBe(3);
    expect(createdTaskHeatmap?.gridTotal).toBe(2);
    expect(createdTaskHeatmap?.outsideGridTotal).toBe(1);
    expect(closedMondayTask).toMatchObject({ count: 1, intensity: 5 });
    expect(closedSundayTask).toMatchObject({ count: 1, intensity: 5 });
    expect(outsideTask).toBeUndefined();
    expect(closedTaskHeatmap?.total).toBe(3);
    expect(closedTaskHeatmap?.gridTotal).toBe(2);
    expect(closedTaskHeatmap?.outsideGridTotal).toBe(1);
    expect(tuesdayMeeting).toMatchObject({ count: 1, intensity: 5 });
    expect(tuesdayMeeting?.segments).toEqual([
      { key: "meeting_slot_1", label: "Встреча 1", count: 1, intensity: 5 },
      { key: "meeting_slot_2", label: "Встреча 2", count: 0, intensity: 0 },
      { key: "meeting_slot_3", label: "Встреча 3", count: 0, intensity: 0 }
    ]);
    expect(sundayMeeting).toMatchObject({ count: 1, intensity: 5 });
    expect(sundayMeeting?.segments).toEqual([
      { key: "meeting_slot_1", label: "Встреча 1", count: 0, intensity: 0 },
      { key: "meeting_slot_2", label: "Встреча 2", count: 1, intensity: 5 },
      { key: "meeting_slot_3", label: "Встреча 3", count: 0, intensity: 0 }
    ]);
    expect(outsideMeeting).toBeUndefined();
    expect(meetingHeatmap?.total).toBe(3);
    expect(meetingHeatmap?.gridTotal).toBe(2);
    expect(meetingHeatmap?.outsideGridTotal).toBe(1);
  });

  it("counts each dated deal meeting slot by its own meeting type", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      deals: [
        {
          id: "SLOT_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:MEETING",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: "ClubOne",
          targetGroupValue: null,
          meetingTypeValue: "Очная",
          meetingDateValue: "2026-05-04T10:00:00.000Z",
          meetingSlots: [
            {
              index: 1,
              dateValue: "2026-05-04T10:00:00.000Z",
              typeValue: "Очная",
              placeValue: "Офис К1",
              calendarValue: null,
              eventId: null,
              source: "deal_fields"
            },
            {
              index: 2,
              dateValue: "2026-05-06T10:00:00.000Z",
              typeValue: "Zoom",
              placeValue: null,
              calendarValue: null,
              eventId: "calendar-event-2",
              source: "deal_fields"
            },
            {
              index: 3,
              dateValue: "2026-05-08T10:00:00.000Z",
              typeValue: "Офлайн",
              placeValue: "Офис К2",
              calendarValue: null,
              eventId: null,
              source: "deal_fields"
            }
          ],
          dateCreate: "2026-05-01T09:00:00.000Z",
          dateModify: "2026-05-08T11:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:MEETING",
          name: "Встреча-знакомство",
          semanticId: "P",
          sortOrder: 20
        }
      ],
      stageHistory: [],
      activities: [],
      deadlineChanges: [],
      meetingDateChanges: [],
      managerDirectory: [{ id: "7", name: "Анна Куратор" }]
    });

    const managerRow = result.managerRows.find((row) => row.managerId === "7");

    expect(result.totalMeetingCount).toBe(3);
    expect(managerRow).toMatchObject({
      meetingCount: 3,
      averageMeetingsPerDeal: 3
    });
    expect(managerRow?.meetingTypeBreakdown).toEqual(
      expect.arrayContaining([
        {
          meetingTypeKey: "Zoom",
          meetingTypeLabel: "Zoom",
          count: 1
        },
        {
          meetingTypeKey: "Офлайн",
          meetingTypeLabel: "Офлайн",
          count: 1
        },
        {
          meetingTypeKey: "Очная",
          meetingTypeLabel: "Очная",
          count: 1
        }
      ])
    );
    expect(managerRow?.meetingBusinessClubBreakdown).toEqual(
      expect.arrayContaining([
        {
          businessClubKey: "ClubOne",
          businessClubLabel: "ClubOne",
          meetingSlotIndex: 2,
          meetingSlotLabel: "Встреча 2",
          meetingTypeKey: "Zoom",
          meetingTypeLabel: "Zoom",
          count: 1
        },
        {
          businessClubKey: "ClubOne",
          businessClubLabel: "ClubOne",
          meetingSlotIndex: 3,
          meetingSlotLabel: "Встреча 3",
          meetingTypeKey: "Офлайн",
          meetingTypeLabel: "Офлайн",
          count: 1
        },
        {
          businessClubKey: "ClubOne",
          businessClubLabel: "ClubOne",
          meetingSlotIndex: 1,
          meetingSlotLabel: "Встреча",
          meetingTypeKey: "Очная",
          meetingTypeLabel: "Очная",
          count: 1
        }
      ])
    );
  });

  it("does not inherit the first meeting type for later slots with empty type", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      deals: [
        {
          id: "SLOT_DEAL_WITH_EMPTY_TYPE",
          leadId: null,
          categoryId: "10",
          stageId: "C10:MEETING",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: "ClubOne",
          targetGroupValue: null,
          meetingTypeValue: "Мероприятие",
          meetingDateValue: "2026-05-04T10:00:00.000Z",
          meetingSlots: [
            {
              index: 1,
              dateValue: "2026-05-04T10:00:00.000Z",
              typeValue: "Мероприятие",
              placeValue: "Офис К1",
              calendarValue: null,
              eventId: null,
              source: "deal_fields"
            },
            {
              index: 2,
              dateValue: "2026-05-06T10:00:00.000Z",
              typeValue: null,
              placeValue: null,
              calendarValue: null,
              eventId: null,
              source: "deal_fields"
            }
          ],
          dateCreate: "2026-05-01T09:00:00.000Z",
          dateModify: "2026-05-08T11:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:MEETING",
          name: "Встреча-знакомство",
          semanticId: "P",
          sortOrder: 20
        }
      ],
      stageHistory: [],
      activities: [],
      deadlineChanges: [],
      meetingDateChanges: [],
      managerDirectory: [{ id: "7", name: "Анна Куратор" }]
    });

    const managerRow = result.managerRows.find((row) => row.managerId === "7");

    expect(managerRow?.meetingTypeBreakdown).toEqual(
      expect.arrayContaining([
        {
          meetingTypeKey: "Мероприятие",
          meetingTypeLabel: "Мероприятие",
          count: 1
        },
        {
          meetingTypeKey: "UNSPECIFIED",
          meetingTypeLabel: "Без типа встречи",
          count: 1
        }
      ])
    );
    expect(managerRow?.meetingBusinessClubBreakdown).toEqual(
      expect.arrayContaining([
        {
          businessClubKey: "ClubOne",
          businessClubLabel: "ClubOne",
          meetingSlotIndex: 2,
          meetingSlotLabel: "Встреча 2",
          meetingTypeKey: "UNSPECIFIED",
          meetingTypeLabel: "Без типа встречи",
          count: 1
        }
      ])
    );
  });

  it("aggregates created and closed activities by manager and stage while keeping deadline reschedules disabled", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      deals: [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 12000,
          assignedById: "7",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubOne",
          targetGroupValue: "ClubFirst",
          meetingTypeValue: "Очная",
          meetingDateValue: "2026-04-03T15:00:00.000Z",
          dateCreate: "2026-04-02T09:00:00.000Z",
          dateModify: "2026-04-05T11:00:00.000Z",
          dateClosed: "2026-04-05T11:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "2",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 5000,
          assignedById: "9",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubTwo",
          targetGroupValue: "ClubFuture",
          meetingTypeValue: "Онлайн",
          dateCreate: "2026-04-07T09:00:00.000Z",
          dateModify: "2026-04-10T11:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "3",
          leadId: null,
          categoryId: "20",
          stageId: "C20:NEW",
          stageSemanticId: "P",
          opportunity: 1000,
          assignedById: "4",
          sourceId: "AD",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-04-07T09:00:00.000Z",
          dateModify: "2026-04-07T09:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
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
          entityType: "source",
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 8
        }
      ],
      stageHistory: [
        {
          id: "T1",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T10:00:00.000Z"
        },
        {
          id: "T2",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T10:00:00.000Z"
        },
        {
          id: "T3",
          ownerId: "2",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-07T12:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "A1",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-04-02T10:00:00.000Z",
          deadline: "2026-04-03T15:00:00.000Z",
          lastUpdated: "2026-04-02T10:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "A2",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-04-03T12:00:00.000Z",
          deadline: "2026-04-03T15:00:00.000Z",
          lastUpdated: "2026-04-03T12:00:00.000Z",
          completed: true,
          completedTime: "2026-04-03T12:00:00.000Z"
        },
        {
          id: "A3",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-04-03T10:00:00.000Z",
          deadline: "2026-04-04T15:00:00.000Z",
          lastUpdated: "2026-04-04T10:00:00.000Z",
          completed: true,
          completedTime: "2026-04-04T10:00:00.000Z"
        },
        {
          id: "A4",
          ownerTypeId: "2",
          ownerId: "2",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "9",
          createdTime: "2026-04-07T13:00:00.000Z",
          deadline: "2026-04-08T13:00:00.000Z",
          lastUpdated: "2026-04-07T13:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "A5",
          ownerTypeId: "2",
          ownerId: "3",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: null,
          createdTime: "2026-04-07T13:00:00.000Z",
          deadline: "2026-04-08T13:00:00.000Z",
          lastUpdated: "2026-04-07T13:00:00.000Z",
          completed: false,
          completedTime: null
        }
      ],
      deadlineChanges: [
        {
          id: "D1",
          activityId: "A2",
          ownerId: "1",
          responsibleId: "7",
          previousDeadline: "2026-04-04T12:00:00.000Z",
          nextDeadline: "2026-04-04T15:00:00.000Z",
          changedAt: "2026-04-04T09:00:00.000Z"
        }
      ],
      managerDirectory: [
        { id: "7", name: "Анна Куратор" },
        { id: "9", name: "Илья Менеджер" },
        { id: "99", name: "Ольга Без событий" }
      ]
    });

    expect(result).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCreatedCount: 3,
      totalRescheduledCount: 0,
      totalClosedCount: 1,
      totalMeetingCount: 1,
      warnings: [
        "Deadline reschedule counts are disabled until a trustworthy Bitrix history source is available."
      ],
      conversionEventRows: [],
      managerRows: [
        {
          managerId: "7",
          managerName: "Анна Куратор",
          dealCount: 1,
          createdCount: 2,
          rescheduledCount: 0,
          closedCount: 1,
          meetingCount: 1,
          averageCreatedPerDeal: 2,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1,
          averageMeetingsPerDeal: 1,
          meetingTypeBreakdown: [
            {
              meetingTypeKey: "Очная",
              meetingTypeLabel: "Очная",
              count: 1
            }
          ],
          businessClubBreakdown: [
            {
              businessClubKey: "ClubOne",
              businessClubLabel: "ClubOne",
              dealCount: 1
            }
          ],
          meetingBusinessClubBreakdown: [
            {
              businessClubKey: "ClubOne",
              businessClubLabel: "ClubOne",
              meetingTypeKey: "Очная",
              meetingTypeLabel: "Очная",
              count: 1
            }
          ],
          tasksHourlyHeatmap: expect.any(Object),
          createdTasksHourlyHeatmap: expect.any(Object),
          closedTasksHourlyHeatmap: expect.any(Object),
          meetingsHourlyHeatmap: expect.any(Object),
          slaMetrics: [
            {
              slaKey: "sla1",
              label: "Время в работу",
              onTimeCount: 1,
              lateCount: 0,
              noTouchCount: 0,
              medianHours: 1
            },
            {
              slaKey: "sla2",
              label: "Первый контакт",
              onTimeCount: 0,
              lateCount: 1,
              noTouchCount: 0,
              medianHours: 0
            },
            {
              slaKey: "sla3",
              label: "Обработка лида",
              onTimeCount: 0,
              lateCount: 1,
              noTouchCount: 0,
              medianHours: 0
            }
          ],
          stageBreakdown: [
            {
              stageId: "C10:PREPARATION",
              stageName: "Звонок-знакомство",
              dealCount: 1,
              createdCount: 1,
              rescheduledCount: 0,
              closedCount: 0,
              averageCreatedPerDeal: 1,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 0
            },
            {
              stageId: "C10:UC_9E0XYG",
              stageName: "Встреча-знакомство",
              dealCount: 1,
              createdCount: 1,
              rescheduledCount: 0,
              closedCount: 1,
              averageCreatedPerDeal: 1,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 1
            }
          ]
        },
        {
          managerId: "9",
          managerName: "Илья Менеджер",
          dealCount: 1,
          createdCount: 1,
          rescheduledCount: 0,
          closedCount: 0,
          meetingCount: 0,
          averageCreatedPerDeal: 1,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 0,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [
            {
              businessClubKey: "ClubTwo",
              businessClubLabel: "ClubTwo",
              dealCount: 1
            }
          ],
          meetingBusinessClubBreakdown: [],
          tasksHourlyHeatmap: expect.any(Object),
          createdTasksHourlyHeatmap: expect.any(Object),
          closedTasksHourlyHeatmap: expect.any(Object),
          meetingsHourlyHeatmap: expect.any(Object),
          slaMetrics: [
            {
              slaKey: "sla1",
              label: "Время в работу",
              onTimeCount: 1,
              lateCount: 0,
              noTouchCount: 0,
              medianHours: 3
            },
            {
              slaKey: "sla2",
              label: "Первый контакт",
              onTimeCount: 0,
              lateCount: 1,
              noTouchCount: 0,
              medianHours: 0
            },
            {
              slaKey: "sla3",
              label: "Обработка лида",
              onTimeCount: 0,
              lateCount: 1,
              noTouchCount: 0,
              medianHours: 0
            }
          ],
          stageBreakdown: [
            {
              stageId: "C10:PREPARATION",
              stageName: "Звонок-знакомство",
              dealCount: 1,
              createdCount: 1,
              rescheduledCount: 0,
              closedCount: 0,
              averageCreatedPerDeal: 1,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 0
            }
          ]
        },
        {
          managerId: "99",
          managerName: "Ольга Без событий",
          dealCount: 0,
          createdCount: 0,
          rescheduledCount: 0,
          closedCount: 0,
          meetingCount: 0,
          averageCreatedPerDeal: 0,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 0,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          meetingBusinessClubBreakdown: [],
          tasksHourlyHeatmap: expect.any(Object),
          createdTasksHourlyHeatmap: expect.any(Object),
          closedTasksHourlyHeatmap: expect.any(Object),
          meetingsHourlyHeatmap: expect.any(Object),
          slaMetrics: [],
          stageBreakdown: []
        }
      ]
    });
  });

  it("counts deal meeting-date field values and retained overwrite history", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      deals: [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: "ClubOne",
          targetGroupValue: null,
          meetingTypeValue: "Zoom",
          meetingDateValue: "2026-05-01T10:00:00.000Z",
          dateCreate: "2026-03-01T09:00:00.000Z",
          dateModify: "2026-04-10T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:NEW",
          name: "Новая",
          semanticId: "P",
          sortOrder: 10
        }
      ],
      stageHistory: [],
      activities: [
        {
          id: "PLANNED_IN_PERIOD",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-04-05T10:00:00.000Z",
          deadline: "2026-04-20T10:00:00.000Z",
          lastUpdated: "2026-04-05T10:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "COMPLETED_WITH_SCHEDULE_AFTER_PERIOD",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-04-06T10:00:00.000Z",
          deadline: "2026-05-01T10:00:00.000Z",
          lastUpdated: "2026-05-01T10:00:00.000Z",
          completed: true,
          completedTime: "2026-05-01T10:00:00.000Z"
        },
        {
          id: "COMPLETED_WITH_SCHEDULE_IN_PERIOD",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-03-28T10:00:00.000Z",
          deadline: "2026-04-10T10:00:00.000Z",
          lastUpdated: "2026-05-01T11:00:00.000Z",
          completed: true,
          completedTime: "2026-05-01T11:00:00.000Z"
        }
      ],
      deadlineChanges: [],
      meetingDateChanges: [
        {
          id: "1:2026-04-12T10:00:00.000Z:meeting-date",
          dealId: "1",
          assignedById: "7",
          previousMeetingDate: "2026-04-10T10:00:00.000Z",
          nextMeetingDate: "2026-05-01T10:00:00.000Z",
          changedAt: "2026-04-12T10:00:00.000Z"
        }
      ],
      managerDirectory: [{ id: "7", name: "Анна Куратор" }]
    });

    const managerRow = result.managerRows.find((row) => row.managerId === "7");

    expect(result.totalMeetingCount).toBe(1);
    expect(managerRow).toMatchObject({
      meetingCount: 1,
      averageMeetingsPerDeal: 1,
      meetingTypeBreakdown: [
        {
          meetingTypeKey: "Zoom",
          meetingTypeLabel: "Zoom",
          count: 1
        }
      ],
      meetingBusinessClubBreakdown: [
        {
          businessClubKey: "ClubOne",
          businessClubLabel: "ClubOne",
          meetingTypeKey: "Zoom",
          meetingTypeLabel: "Zoom",
          count: 1
        }
      ]
    });
  });

  it("scopes SLA metrics to Leadgen US ready-to-meet deals", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      deals: [
        {
          id: "IN_SCOPE",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          dateCreate: "2026-04-02T09:00:00.000Z",
          dateModify: "2026-04-02T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "WRONG_SOURCE",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          dateCreate: "2026-04-03T09:00:00.000Z",
          dateModify: "2026-04-03T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "WRONG_QUALITY",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "8",
          qualityValue: "1 Готов к коммуникации",
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          dateCreate: "2026-04-04T09:00:00.000Z",
          dateModify: "2026-04-04T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Звонок-знакомство",
          semanticId: "P",
          sortOrder: 20
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 8
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "WEB",
          name: "Сайт",
          semanticId: null,
          sortOrder: 20
        }
      ],
      stageHistory: [
        {
          id: "IN_SCOPE_INTRO",
          ownerId: "IN_SCOPE",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T10:00:00.000Z"
        },
        {
          id: "WRONG_SOURCE_INTRO",
          ownerId: "WRONG_SOURCE",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T10:00:00.000Z"
        },
        {
          id: "WRONG_QUALITY_INTRO",
          ownerId: "WRONG_QUALITY",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-04T10:00:00.000Z"
        }
      ],
      activities: [],
      deadlineChanges: [],
      calls: [],
      managerDirectory: [{ id: "7", name: "Анна Куратор" }]
    });

    const managerRow = result.managerRows.find((row) => row.managerId === "7");

    expect(managerRow?.dealCount).toBe(3);
    expect(managerRow?.slaMetrics).toEqual([
      {
        slaKey: "sla1",
        label: "Время в работу",
        onTimeCount: 1,
        lateCount: 0,
        noTouchCount: 0,
        medianHours: 1
      },
      {
        slaKey: "sla2",
        label: "Первый контакт",
        onTimeCount: 0,
        lateCount: 1,
        noTouchCount: 0,
        medianHours: 0
      },
      {
        slaKey: "sla3",
        label: "Обработка лида",
        onTimeCount: 0,
        lateCount: 1,
        noTouchCount: 0,
        medianHours: 0
      }
    ]);
  });

  it("uses business-day SLA rules for intro transition and first call after the created cohort range", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      slaAsOf: "2026-05-03T12:00:00.000Z",
      deals: [
        {
          id: "SKIPPED_INTRO",
          leadId: null,
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "6994",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-04-22T10:00:00.000Z",
          dateModify: "2026-04-28T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
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
          sortOrder: 40
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 8
        }
      ],
      stageHistory: [
        {
          id: "BASE",
          ownerId: "SKIPPED_INTRO",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-22T10:00:00.000Z"
        },
        {
          id: "WORK",
          ownerId: "SKIPPED_INTRO",
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-22T11:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "LATE_CALL_ACTIVITY",
          ownerTypeId: "2",
          ownerId: "SKIPPED_INTRO",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "6994",
          createdTime: "2026-04-28T10:00:00.000Z",
          deadline: "2026-04-28T10:00:00.000Z",
          lastUpdated: "2026-04-28T10:05:00.000Z",
          completed: true,
          completedTime: "2026-04-28T10:05:00.000Z"
        }
      ],
      deadlineChanges: [],
      calls: [
        {
          id: "CALL_AFTER_RANGE",
          crmActivityId: "LATE_CALL_ACTIVITY",
          portalUserId: "6994",
          callType: "1",
          callStartDate: "2026-04-28T10:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "CONTACT",
          crmEntityId: "CONTACT_1",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "6994", name: "Анастасия Кузнецова" }]
    });

    const managerRow = result.managerRows.find((row) => row.managerId === "6994");
    const sla1 = managerRow?.slaMetrics.find((metric) => metric.slaKey === "sla1");
    const sla2 = managerRow?.slaMetrics.find((metric) => metric.slaKey === "sla2");

    expect(sla1).toEqual({
      slaKey: "sla1",
      label: "Время в работу",
      onTimeCount: 0,
      lateCount: 1,
      noTouchCount: 0,
      medianHours: 1
    });
    expect(sla2).toEqual({
      slaKey: "sla2",
      label: "Первый контакт",
      onTimeCount: 0,
      lateCount: 1,
      noTouchCount: 0,
      medianHours: 96
    });
  });

  it("uses configured business-hour thresholds for SLA calculations", () => {
    const input = {
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-20T23:59:59.999Z"
      },
      deals: [
        {
          id: "CUSTOM_SLA",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "6994",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-04-20T09:00:00.000Z",
          dateModify: "2026-04-20T15:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Звонок-знакомство",
          semanticId: "P",
          sortOrder: 20
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 8
        }
      ],
      stageHistory: [
        {
          id: "INTRO",
          ownerId: "CUSTOM_SLA",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-20T09:00:00.000Z"
        }
      ],
      activities: [],
      deadlineChanges: [],
      calls: [
        {
          id: "FIRST_CALL",
          crmActivityId: null,
          portalUserId: "6994",
          callType: "1",
          callStartDate: "2026-04-20T15:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "DEAL",
          crmEntityId: "CUSTOM_SLA",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "6994", name: "Анастасия Кузнецова" }]
    } satisfies Parameters<typeof buildActivitiesWorkloadReport>[0];

    const defaultResult = buildActivitiesWorkloadReport(input);
    const configuredResult = buildActivitiesWorkloadReport({
      ...input,
      slaBusinessHours: {
        sla1: 24,
        sla2: 5,
        sla3: 72
      }
    });

    const defaultSla2 = defaultResult.managerRows[0]?.slaMetrics.find(
      (metric) => metric.slaKey === "sla2"
    );
    const configuredSla2 = configuredResult.managerRows[0]?.slaMetrics.find(
      (metric) => metric.slaKey === "sla2"
    );

    expect(defaultSla2).toEqual({
      slaKey: "sla2",
      label: "Первый контакт",
      onTimeCount: 1,
      lateCount: 0,
      noTouchCount: 0,
      medianHours: 6
    });
    expect(configuredSla2).toEqual({
      slaKey: "sla2",
      label: "Первый контакт",
      onTimeCount: 0,
      lateCount: 1,
      noTouchCount: 0,
      medianHours: 6
    });
  });

  it("requires two calls and a next-stage transition within three business days on intro stage", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      slaAsOf: "2026-05-03T12:00:00.000Z",
      deals: [
        {
          id: "INTRO_PROCESSED",
          leadId: null,
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "6994",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-04-20T09:00:00.000Z",
          dateModify: "2026-04-22T22:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
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
          sortOrder: 40
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 8
        }
      ],
      stageHistory: [
        {
          id: "BASE",
          ownerId: "INTRO_PROCESSED",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-20T09:00:00.000Z"
        },
        {
          id: "INTRO",
          ownerId: "INTRO_PROCESSED",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-20T10:00:00.000Z"
        },
        {
          id: "NEXT",
          ownerId: "INTRO_PROCESSED",
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-22T22:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "CALL_ACTIVITY_1",
          ownerTypeId: "2",
          ownerId: "INTRO_PROCESSED",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "6994",
          createdTime: "2026-04-20T11:00:00.000Z",
          deadline: "2026-04-20T11:00:00.000Z",
          lastUpdated: "2026-04-20T11:10:00.000Z",
          completed: true,
          completedTime: "2026-04-20T11:10:00.000Z"
        },
        {
          id: "CALL_ACTIVITY_2",
          ownerTypeId: "2",
          ownerId: "INTRO_PROCESSED",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "6994",
          createdTime: "2026-04-22T21:00:00.000Z",
          deadline: "2026-04-22T21:00:00.000Z",
          lastUpdated: "2026-04-22T21:10:00.000Z",
          completed: true,
          completedTime: "2026-04-22T21:10:00.000Z"
        }
      ],
      deadlineChanges: [],
      calls: [
        {
          id: "CALL_1",
          crmActivityId: "CALL_ACTIVITY_1",
          portalUserId: "6994",
          callType: "1",
          callStartDate: "2026-04-20T11:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "CONTACT",
          crmEntityId: "CONTACT_1",
          callFailedCode: "200"
        },
        {
          id: "CALL_2",
          crmActivityId: "CALL_ACTIVITY_2",
          portalUserId: "6994",
          callType: "1",
          callStartDate: "2026-04-22T21:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "CONTACT",
          crmEntityId: "CONTACT_1",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "6994", name: "Анастасия Кузнецова" }]
    });

    const managerRow = result.managerRows.find((row) => row.managerId === "6994");
    const sla3 = managerRow?.slaMetrics.find((metric) => metric.slaKey === "sla3");

    expect(sla3).toEqual({
      slaKey: "sla3",
      label: "Обработка лида",
      onTimeCount: 1,
      lateCount: 0,
      noTouchCount: 0,
      medianHours: 60
    });
  });

  it("adds conversion event rows with invitation statuses and stage breakdown", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-05-25T00:00:00.000Z",
        to: "2026-06-01T00:00:00.000Z"
      },
      deals: [
        {
          id: "D1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:UC_61CBCU",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-05-20T09:00:00.000Z",
          dateModify: "2026-05-28T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "D2",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-05-20T09:00:00.000Z",
          dateModify: "2026-05-28T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "D3",
          leadId: null,
          categoryId: "10",
          stageId: "C10:UC_61CBCU",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-05-20T09:00:00.000Z",
          dateModify: "2026-05-28T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "OUT_OF_SCOPE",
          leadId: null,
          categoryId: "20",
          stageId: "C20:NEW",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          dateCreate: "2026-05-20T09:00:00.000Z",
          dateModify: "2026-05-28T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
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
          statusId: "C10:UC_61CBCU",
          name: "Активация",
          semanticId: "P",
          sortOrder: 50
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:UC_A249EJ",
          name: "Демонстрация",
          semanticId: "P",
          sortOrder: 60
        }
      ],
      stageHistory: [],
      activities: [],
      deadlineChanges: [],
      eventVisitFacts: [
        {
          visitId: "V1",
          eventId: "E1",
          dealId: "D1",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          currentStageId: "C10:UC_61CBCU",
          currentStageName: "Активация",
          invitedAt: "2026-05-28T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: null,
          refusedAt: "2026-05-28T12:00:00.000Z",
          finalStatus: "refused",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: "C10:UC_61CBCU",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName:
              "МСК Бизнес-диалог: Виктор Найшуллер 28.05.26 Виктор Найшуллер оффлайн"
          })
        },
        {
          visitId: "V2",
          eventId: "E1",
          dealId: "D2",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          currentStageId: "C10:PREPARATION",
          currentStageName: "Звонок-знакомство",
          invitedAt: "2026-05-28T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-05-28T13:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: "C10:PREPARATION",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName:
              "МСК Бизнес-диалог: Виктор Найшуллер 28.05.26 Виктор Найшуллер оффлайн"
          })
        },
        {
          visitId: "V3",
          eventId: "E1",
          dealId: "D3",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          currentStageId: "C10:UC_61CBCU",
          currentStageName: "Активация",
          invitedAt: "2026-05-28T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: null,
          refusedAt: null,
          finalStatus: "invited",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: "C10:UC_61CBCU",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName:
              "МСК Бизнес-диалог: Виктор Найшуллер 28.05.26 Виктор Найшуллер оффлайн"
          })
        },
        {
          visitId: "V4",
          eventId: "E2",
          dealId: "D3",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          currentStageId: "C10:UC_A249EJ",
          currentStageName: "Демонстрация",
          invitedAt: "2026-05-27T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: null,
          refusedAt: "2026-05-27T12:00:00.000Z",
          finalStatus: "refused",
          eventDate: "2026-05-27T00:00:00.000Z",
          stageIdAtEvent: "C10:UC_A249EJ",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName:
              "МСК НЕрандом кофе: Личный бренд 27.05.26 Артем Колесников, Евгения Першина оффлайн"
          })
        },
        {
          visitId: "V5",
          eventId: "E3",
          dealId: "OUT_OF_SCOPE",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          currentStageId: "C20:NEW",
          currentStageName: "Новая",
          invitedAt: "2026-05-28T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: "2026-05-28T13:00:00.000Z",
          refusedAt: null,
          finalStatus: "attended",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: "C20:NEW",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({ eventName: "Не из привлечения" })
        }
      ],
      dealTouchpointFacts: [
        {
          factId: "TP1",
          kind: "conversion_event_visit",
          sourceSystem: "bitrix24",
          sourceEntityType: "event_visit_fact",
          sourceEntityId: "V1",
          occurredAt: "2026-05-28T00:00:00.000Z",
          dealId: "D1",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          stageIdAtEvent: "C10:UC_61CBCU",
          stageNameAtEvent: "Активация (Встреча проведена)",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        },
        {
          factId: "TP2",
          kind: "conversion_event_visit",
          sourceSystem: "bitrix24",
          sourceEntityType: "event_visit_fact",
          sourceEntityId: "V2",
          occurredAt: "2026-05-28T00:00:00.000Z",
          dealId: "D2",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          stageIdAtEvent: "C10:PREPARATION",
          stageNameAtEvent: "Звонок-знакомство",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        },
        {
          factId: "TP3",
          kind: "conversion_event_visit",
          sourceSystem: "bitrix24",
          sourceEntityType: "event_visit_fact",
          sourceEntityId: "V3",
          occurredAt: "2026-05-28T00:00:00.000Z",
          dealId: "D3",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          stageIdAtEvent: "C10:UC_61CBCU",
          stageNameAtEvent: "Активация (Встреча проведена)",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        },
        {
          factId: "TP4",
          kind: "conversion_event_visit",
          sourceSystem: "bitrix24",
          sourceEntityType: "event_visit_fact",
          sourceEntityId: "V4",
          occurredAt: "2026-05-27T00:00:00.000Z",
          dealId: "D3",
          contactId: null,
          leadId: null,
          managerId: "7",
          sourceId: "WEB",
          stageIdAtEvent: "C10:UC_A249EJ",
          stageNameAtEvent: "Демонстрация (Event)",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
        }
      ],
      managerDirectory: []
    });

    expect(result.conversionEventRows).toEqual([
      {
        eventKey: "E1",
        eventName: "Бизнес-диалог: Виктор Найшуллер, 28.05",
        eventDate: "2026-05-28T00:00:00.000Z",
        invitedCount: 3,
        attendedCount: 1,
        refusedCount: 1,
        waitingCount: 1,
        stageBreakdown: [
          {
            stageId: "C10:UC_61CBCU",
            stageName: "Активация",
            invitedCount: 2
          },
          {
            stageId: "C10:PREPARATION",
            stageName: "Звонок-знакомство",
            invitedCount: 1
          }
        ]
      },
      {
        eventKey: "E2",
        eventName: "НЕрандом кофе: Личный бренд, 27.05",
        eventDate: "2026-05-27T00:00:00.000Z",
        invitedCount: 1,
        attendedCount: 0,
        refusedCount: 1,
        waitingCount: 0,
        stageBreakdown: [
          {
            stageId: "C10:UC_A249EJ",
            stageName: "Демонстрация",
            invitedCount: 1
          }
        ]
      }
    ]);
  });
});
