import type {
  ActivitySnapshot,
  CallSnapshot,
  DealSnapshot
} from "@bitrix24-reporting/contracts";
import { describe, expect, it } from "vitest";

import {
  auditAttractionScope,
  buildAttractionScopeDealFilter,
  summarizeAuditRows
} from "../src/tools/audit-attraction-scope";

describe("audit-attraction-scope", () => {
  it("builds the Bitrix scope from category, manager ids and explicit range args", () => {
    expect(
      buildAttractionScopeDealFilter({
        categoryId: "10",
        managerIds: ["78", "11234"],
        from: "2025-05-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      })
    ).toEqual({
      CATEGORY_ID: "10",
      "@ASSIGNED_BY_ID": ["78", "11234"],
      ">=DATE_CREATE": "2025-05-01T00:00:00.000Z",
      "<=DATE_CREATE": "2026-04-30T23:59:59.999Z"
    });
  });

  it("returns read-only audit rows without pii and compares Bitrix counts to local SQLite counts", async () => {
    const localDeals: DealSnapshot[] = [
      {
        id: "D1",
        title: "Should stay internal and never appear in output",
        leadId: null,
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "78",
        sourceId: null,
        qualityValue: null,
        businessClubValue: null,
        targetGroupValue: null,
        meetingTypeValue: null,
        meetingDateValue: null,
        tariffValue: null,
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2025-05-10T10:00:00.000Z",
        dateModify: "2025-05-10T10:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ];

    const localActivities: ActivitySnapshot[] = [
      {
        id: "A_TODO_1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "78",
        createdTime: "2025-05-11T10:00:00.000Z",
        deadline: null,
        lastUpdated: "2025-05-11T10:00:00.000Z",
        completed: false,
        completedTime: null
      },
      {
        id: "A_MEETING_1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "1",
        providerId: "CRM_MEETING",
        responsibleId: "78",
        createdTime: "2025-05-12T10:00:00.000Z",
        deadline: null,
        lastUpdated: "2025-05-12T10:00:00.000Z",
        completed: true,
        completedTime: "2025-05-12T11:00:00.000Z"
      },
      {
        id: "A_CALL_1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "78",
        createdTime: "2025-05-13T10:00:00.000Z",
        deadline: null,
        lastUpdated: "2025-05-13T10:00:00.000Z",
        completed: true,
        completedTime: "2025-05-13T10:05:00.000Z"
      }
    ];

    const localCalls: CallSnapshot[] = [
      {
        id: "CALL_LOCAL_1",
        crmActivityId: "A_CALL_1",
        portalUserId: "78",
        callType: "2",
        callStartDate: "2025-05-13T10:00:00.000Z",
        callDurationSeconds: 64,
        crmEntityType: "DEAL",
        crmEntityId: "D1",
        callFailedCode: null
      }
    ];

    const result = await auditAttractionScope(
      {
        from: "2025-05-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      {
        fetchScopeDeals: async () => [
          {
            ID: "D1",
            ASSIGNED_BY_ID: "78",
            DATE_CREATE: "2025-05-10T10:00:00.000Z",
            CATEGORY_ID: "10"
          },
          {
            ID: "D2",
            ASSIGNED_BY_ID: "11234",
            DATE_CREATE: "2025-06-01T10:00:00.000Z",
            CATEGORY_ID: "10"
          }
        ],
        listActivitiesByProvider: async ({ providerId }) => {
          if (providerId === "CRM_TODO") {
            return [
              { ID: "A_TODO_1", OWNER_ID: "D1", PROVIDER_ID: "CRM_TODO" },
              { ID: "A_TODO_2", OWNER_ID: "D2", PROVIDER_ID: "CRM_TODO" }
            ];
          }

          if (providerId === "CRM_TASKS_TASK") {
            return [
              { ID: "A_TASK_1", OWNER_ID: "D1", PROVIDER_ID: "CRM_TASKS_TASK" }
            ];
          }

          if (providerId === "CRM_MEETING") {
            return [
              { ID: "A_MEETING_1", OWNER_ID: "D1", PROVIDER_ID: "CRM_MEETING" }
            ];
          }

          if (providerId === "VOXIMPLANT_CALL") {
            return [
              { ID: "A_CALL_1", OWNER_ID: "D1", PROVIDER_ID: "VOXIMPLANT_CALL" },
              { ID: "A_CALL_2", OWNER_ID: "D2", PROVIDER_ID: "VOXIMPLANT_CALL" }
            ];
          }

          return [];
        },
        listCallsByActivityIds: async ({ activityIds }) => [
          ...(activityIds.includes("A_CALL_1")
            ? [
                { ID: "CALL_BITRIX_1", CRM_ACTIVITY_ID: "A_CALL_1" },
                { ID: "CALL_BITRIX_2", CRM_ACTIVITY_ID: "A_CALL_1" }
              ]
            : []),
          ...(activityIds.includes("A_CALL_2")
            ? [
                {
                  ID: "CALL_BITRIX_3",
                  CRM_ACTIVITY_ID: null,
                  CRM_ENTITY_TYPE: "DEAL",
                  CRM_ENTITY_ID: "D2"
                }
              ]
            : [])
        ],
        loadLocalSnapshots: async () => ({
          deals: localDeals,
          activities: localActivities,
          calls: localCalls,
          currentScope: {
            scopeKey: null,
            reconciledAt: null,
            dealIds: ["D1", "D2"]
          }
        })
      }
    );

    expect(result.rows).toEqual([
      {
        dealId: "D1",
        managerId: "78",
        bitrixCallCount: 2,
        bitrixMeetingCount: 1,
        bitrixTaskCount: 2,
        localCallCount: 1,
        localMeetingCount: 1,
        localTaskCount: 1,
        missingReasons: ["call_count_mismatch", "task_count_mismatch"]
      },
      {
        dealId: "D2",
        managerId: "11234",
        bitrixCallCount: 1,
        bitrixMeetingCount: 0,
        bitrixTaskCount: 1,
        localCallCount: 0,
        localMeetingCount: 0,
        localTaskCount: 0,
        missingReasons: [
          "call_count_mismatch",
          "missing_local_deal",
          "task_count_mismatch"
        ]
      }
    ]);

    expect(Object.keys(result.rows[0] ?? {}).sort()).toEqual([
      "bitrixCallCount",
      "bitrixMeetingCount",
      "bitrixTaskCount",
      "dealId",
      "localCallCount",
      "localMeetingCount",
      "localTaskCount",
      "managerId",
      "missingReasons"
    ]);
  });

  it("summarizes mismatch counts across all audited deals", () => {
    expect(
      summarizeAuditRows([
        {
          dealId: "D1",
          managerId: "78",
          bitrixCallCount: 2,
          bitrixMeetingCount: 1,
          bitrixTaskCount: 2,
          localCallCount: 1,
          localMeetingCount: 1,
          localTaskCount: 1,
          missingReasons: ["call_count_mismatch", "task_count_mismatch"]
        },
        {
          dealId: "D2",
          managerId: "11234",
          bitrixCallCount: 1,
          bitrixMeetingCount: 0,
          bitrixTaskCount: 1,
          localCallCount: 0,
          localMeetingCount: 0,
          localTaskCount: 0,
          missingReasons: [
            "call_count_mismatch",
            "missing_local_deal",
            "task_count_mismatch"
          ]
        }
      ])
    ).toEqual({
      dealsAudited: 2,
      mismatchedDeals: 2,
      dealsMissingLocally: 1,
      dealsMissingFromCurrentScope: 0,
      dealsExtraLocally: 0,
      categoryMismatches: 0,
      managerMismatches: 0,
      dealsMissingInBitrix: 0,
      bitrixCallCount: 3,
      bitrixMeetingCount: 1,
      bitrixTaskCount: 3,
      localCallCount: 1,
      localMeetingCount: 1,
      localTaskCount: 1
    });
  });

  it("classifies current-projection deals that moved out of scope or disappeared upstream", async () => {
    const localDeals: DealSnapshot[] = [
      {
        id: "138542",
        title: null,
        leadId: null,
        categoryId: "10",
        stageId: "C10:PREPARATION",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "78",
        sourceId: null,
        qualityValue: null,
        businessClubValue: null,
        targetGroupValue: null,
        meetingTypeValue: null,
        meetingDateValue: null,
        tariffValue: null,
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2025-05-10T10:00:00.000Z",
        dateModify: "2025-05-10T10:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      },
      {
        id: "139938",
        title: null,
        leadId: null,
        categoryId: "10",
        stageId: "C10:PREPARATION",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "78",
        sourceId: null,
        qualityValue: null,
        businessClubValue: null,
        targetGroupValue: null,
        meetingTypeValue: null,
        meetingDateValue: null,
        tariffValue: null,
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2025-05-11T10:00:00.000Z",
        dateModify: "2025-05-11T10:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ];

    const result = await auditAttractionScope(
      {
        categoryId: "10",
        managerIds: ["78"],
        from: "2025-05-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      {
        fetchScopeDeals: async () => [],
        fetchDealsByIds: async () => [
          {
            ID: "138542",
            ASSIGNED_BY_ID: "78",
            DATE_CREATE: "2025-05-10T10:00:00.000Z",
            CATEGORY_ID: "12"
          }
        ],
        listActivitiesByProvider: async () => [],
        listCallsByActivityIds: async () => [],
        loadLocalSnapshots: async () => ({
          deals: localDeals,
          activities: [],
          calls: [],
          currentScope: {
            scopeKey: "category:10:assigned:78",
            reconciledAt: "2026-07-27T07:00:00.000Z",
            dealIds: ["138542", "139938"]
          }
        })
      }
    );

    expect(result.rows).toEqual([
      expect.objectContaining({
        dealId: "138542",
        missingReasons: ["extra_local_deal", "category_mismatch"]
      }),
      expect.objectContaining({
        dealId: "139938",
        missingReasons: ["extra_local_deal", "missing_in_bitrix"]
      })
    ]);
    expect(result.summary).toMatchObject({
      dealsAudited: 2,
      mismatchedDeals: 2,
      dealsExtraLocally: 2,
      categoryMismatches: 1,
      managerMismatches: 0,
      dealsMissingInBitrix: 1
    });
    expect(result.currentScope).toEqual({
      expectedScopeKey: "category:10:assigned:78",
      scopeKey: "category:10:assigned:78",
      reconciledAt: "2026-07-27T07:00:00.000Z",
      dealCount: 2,
      comparedDealCount: 2,
      matchesExpectedScope: true
    });
  });
});
