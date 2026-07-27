import { describe, expect, it } from "vitest";

import { ATTRACTION_MANAGER_IDS } from "../src/domain/attraction-managers";
import { performLeadgenSync } from "../src/domain/leadgen-sync";
import { buildAcquisitionOutcomesReport } from "../src/domain/operational-reports";
import {
  DEAL_CUSTOM_FIELDS_COVERAGE_VERSION,
  performManualSync
} from "../src/domain/sync";

describe("performManualSync", () => {
  const defaultAttractionManagerIds = ATTRACTION_MANAGER_IDS;
  const attractionScopeKey = `category:10:assigned:${[
    ...defaultAttractionManagerIds
  ].sort().join(",")}`;

  it("runs a leadgen-only sync for category 28 without touching attraction category 10", async () => {
    const requestedDealCategories: string[][] = [];
    const storedDeals: unknown[][] = [];
    const storedStageHistory: unknown[][] = [];
    const storedActivities: unknown[][] = [];
    const storedActivityBindings: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const storedManagers: unknown[][] = [];
    const activityRequests: unknown[] = [];
    const callRequests: unknown[] = [];
    const stageHistoryRequests: unknown[] = [];
    let syncRunScopeKey: string | null = null;
    const storedCursors: unknown[] = [];

    const repo = {
      getLatestSuccessCursor: async () => "2026-05-01T00:00:00.000Z",
      getSnapshotStats: async () => ({
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      replaceStageCatalog: async () => undefined,
      getDealIdsByCategoryIds: async (
        categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        expect(categoryIds).toEqual(["28"]);
        expect(assignedByIds).toEqual(["501", "502"]);
        return ["LG_ALLOWED"];
      },
      getActivitiesByIds: async () => [],
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async (rows: unknown[]) => {
        storedStageHistory.push(rows);
        return rows.length;
      },
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityBindings: async (rows: unknown[]) => {
        storedActivityBindings.push(rows);
        return rows.length;
      },
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async (rows: unknown[]) => {
        storedManagers.push(rows);
        return rows.length;
      },
      createSyncRun: async (input: { scopeKey: string }) => {
        syncRunScopeKey = input.scopeKey;
        return 128;
      },
      setSyncCursor: async (input: unknown) => {
        storedCursors.push(input);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["28"]);
        return [
          {
            entityType: "deal" as const,
            categoryId: "28",
            statusId: "C28:NEW",
            name: "Новый лид",
            semanticId: "P",
            sortOrder: 10
          }
        ];
      },
      fetchSourceCatalog: async () => [
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Сайт",
          semanticId: null,
          sortOrder: 10
        }
      ],
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1758715585") {
          return { R1: "Возврат" };
        }
        if (fieldName === "UF_CRM_1772109151192") {
          return { B1: "Корзина" };
        }
        return {};
      },
      listDeals: async (input: {
        categoryIds: string[];
        assignedByIds?: string[];
      }) => {
        requestedDealCategories.push(input.categoryIds);
        expect(input).toMatchObject({
          categoryIds: ["28"],
          assignedByIds: ["501", "502"]
        });
        return [
          {
            ID: "LG_ALLOWED",
            CONTACT_ID: "MUST_NOT_PERSIST",
            LEAD_ID: "MUST_NOT_PERSIST",
            DATE_CREATE: "2026-05-03T10:00:00.000Z",
            DATE_MODIFY: "2026-05-03T10:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "28",
            STAGE_ID: "C28:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 0,
            ASSIGNED_BY_ID: "501",
            SOURCE_ID: "WEB",
            UF_CRM_1758715585: "R1",
            UF_CRM_1772109151192: "B1",
            UTM_SOURCE: "google",
            UTM_MEDIUM: "cpc",
            UTM_CAMPAIGN: "leadgen-us",
            UTM_CONTENT: null,
            UTM_TERM: null
          },
          {
            ID: "LG_OLD_CREATED",
            CONTACT_ID: null,
            LEAD_ID: null,
            DATE_CREATE: "2025-12-31T20:59:59.000Z",
            DATE_MODIFY: "2026-05-03T11:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "28",
            STAGE_ID: "C28:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 0,
            ASSIGNED_BY_ID: "501",
            SOURCE_ID: "WEB",
            UF_CRM_1758715585: "R1",
            UF_CRM_1772109151192: "B1",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: "old-created",
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async (input: unknown) => {
        stageHistoryRequests.push(input);
        return [
          {
            ID: "SH1",
            OWNER_ID: "LG_ALLOWED",
            CATEGORY_ID: "28",
            STAGE_ID: "C28:NEW",
            STAGE_SEMANTIC_ID: "P",
            TYPE_ID: null,
            CREATED_TIME: "2026-05-03T10:15:00.000Z"
          }
        ];
      },
      listActivities: async (input: unknown) => {
        activityRequests.push(input);
        return [
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "LG_ALLOWED",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "501",
            CREATED: "2026-05-03T10:20:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-05-03T10:20:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-05-03T10:25:00.000Z"
          }
        ];
      },
      listActivityBindings: async (activityIds: string[]) => {
        expect(activityIds).toEqual(["A1"]);
        return [
          {
            activityId: "A1",
            ownerTypeId: "2",
            ownerId: "LG_ALLOWED"
          }
        ];
      },
      listCalls: async (input: unknown) => {
        callRequests.push(input);
        return [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "A1",
            PORTAL_USER_ID: "501",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-05-03T10:20:00.000Z",
            CALL_DURATION: "60",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "LG_ALLOWED",
            CALL_FAILED_CODE: "200"
          }
        ];
      },
      fetchUsers: async (input: { ids: string[] }) => {
        expect(input.ids).toEqual(["501"]);
        return [
          {
            ID: "501",
            NAME: "Лидген",
            LAST_NAME: "Менеджер"
          }
        ];
      }
    };

    const result = await performLeadgenSync({
      client,
      repository: repo as never,
      categoryId: "28",
      managerIds: ["501", "502"],
      now: () => "2026-05-14T00:00:00.000Z"
    });

    expect(requestedDealCategories).toEqual([["28"]]);
    expect(syncRunScopeKey).toBe("module:leadgen:category:28:assigned:501,502");
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "LG_ALLOWED",
          categoryId: "28",
          assignedById: "501",
          contactId: null,
          leadId: null,
          refusalReasonValue: "Возврат",
          utmCampaign: "leadgen-us"
        })
      ]
    ]);
    expect(activityRequests).toEqual([
      {
        ownerIds: ["LG_ALLOWED"],
        modifiedAfter: "2026-05-01T00:00:00.000Z"
      }
    ]);
    expect(stageHistoryRequests).toEqual([{ ownerIds: ["LG_ALLOWED"] }]);
    expect(callRequests).toEqual([
      { activityIds: ["A1"] },
      {
        callStartDateFrom: "2026-05-01T00:00:00.000Z",
        callStartDateTo: "2026-05-14T00:00:00.000Z",
        portalUserIds: ["501", "502"]
      }
    ]);
    expect(storedStageHistory).toEqual([
      [
        expect.objectContaining({
          ownerId: "LG_ALLOWED",
          categoryId: "28",
          stageId: "C28:NEW"
        })
      ]
    ]);
    expect(storedActivities).toEqual([
      [
        expect.objectContaining({
          id: "A1",
          ownerId: "LG_ALLOWED",
          responsibleId: "501"
        })
      ]
    ]);
    expect(storedActivityBindings).toEqual([
      [
        {
          activityId: "A1",
          ownerTypeId: "2",
          ownerId: "LG_ALLOWED"
        }
      ]
    ]);
    expect(storedCalls).toEqual([
      [
        expect.objectContaining({
          id: "CALL1",
          crmActivityId: "A1",
          portalUserId: "501",
          crmEntityId: "LG_ALLOWED"
        })
      ]
    ]);
    expect(storedManagers).toEqual([
      [
        {
          id: "501",
          name: "Лидген Менеджер"
        }
      ]
    ]);
    expect(result).toMatchObject({
      syncRunId: 128,
      dealsSynced: 1,
      mode: "delta",
      changes: {
        deals: 1,
        activities: 1,
        calls: 1,
        stageHistory: 1,
        managers: 1
      }
    });
    expect(storedCursors).toContainEqual(
      expect.objectContaining({
        key: "module:leadgen:category:28:assigned:501,502:deals:date_modify",
        cursorValue: "2026-05-03T11:00:00.000Z"
      })
    );
    expect(storedCursors).toContainEqual(
      expect.objectContaining({
        key: "module:leadgen:category:28:assigned:501,502:call_stats:call_start_date",
        cursorValue: "2026-05-14T00:00:00.000Z"
      })
    );
  });

  it("keeps an empty leadgen manager whitelist as an empty sync scope", async () => {
    let snapshotReads = 0;
    let cursorReads = 0;
    let listDealCalls = 0;
    let finishedSummary: unknown = null;
    const repo = {
      getSnapshotStats: async () => {
        snapshotReads += 1;
        return {
          deals: 99,
          activities: 0,
          calls: 0,
          stageHistory: 0
        };
      },
      getLatestSuccessCursor: async () => {
        cursorReads += 1;
        return "2026-05-01T00:00:00.000Z";
      },
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => rows.length,
      upsertManagerDirectory: async (rows: unknown[]) => rows.length,
      createSyncRun: async () => 129,
      finishSyncRun: async (input: unknown) => {
        finishedSummary = input;
      },
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      listDeals: async () => {
        listDealCalls += 1;
        return [];
      },
      fetchUsers: async () => []
    };

    const result = await performLeadgenSync({
      client,
      repository: repo as never,
      categoryId: "28",
      managerIds: [],
      now: () => "2026-05-14T00:00:00.000Z"
    });

    expect(snapshotReads).toBe(0);
    expect(cursorReads).toBe(0);
    expect(listDealCalls).toBe(0);
    expect(result).toMatchObject({
      syncRunId: 129,
      dealsSynced: 0,
      modifiedAfter: null,
      snapshotBefore: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      },
      snapshotAfter: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      },
      diagnostics: ["leadgenSkipped=empty-scope", "leadgenManagers=0"]
    });
    expect(finishedSummary).toEqual(
      expect.objectContaining({
        status: "success",
        dealsSynced: 0,
        modifiedAfter: null
      })
    );
  });

  it("keeps an empty attraction manager whitelist as an empty sync scope", async () => {
    let snapshotReads = 0;
    let cursorReads = 0;
    let stageCatalogFetches = 0;
    let listDealCalls = 0;
    let syncRunScopeKey: string | null = null;
    let finishedSummary: unknown = null;
    let currentScopeReplacement: unknown = null;
    const repo = {
      getLatestSuccessCursor: async () => {
        cursorReads += 1;
        return "2026-05-01T00:00:00.000Z";
      },
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 0,
      getSnapshotStats: async () => {
        snapshotReads += 1;
        return {
          deals: 99,
          activities: 12,
          calls: 7,
          stageHistory: 21
        };
      },
      getCurrentAttractionScope: async () => ({
        scopeKey: attractionScopeKey,
        reconciledAt: "2026-05-31T10:00:00.000Z",
        dealIds: ["D_OLD"]
      }),
      replaceCurrentAttractionScope: async (input: unknown) => {
        currentScopeReplacement = input;
      },
      createSyncRun: async (input: { scopeKey: string }) => {
        syncRunScopeKey = input.scopeKey;
        return 130;
      },
      finishSyncRun: async (input: unknown) => {
        finishedSummary = input;
      },
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => {
        stageCatalogFetches += 1;
        return [];
      },
      fetchSourceCatalog: async () => [],
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => {
        listDealCalls += 1;
        return [];
      },
      fetchUsers: async () => []
    };

    const result = await performManualSync({
      client: client as never,
      repository: repo as never,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      assignedByIds: [],
      now: () => "2026-06-01T10:00:00.000Z"
    });

    expect(snapshotReads).toBe(0);
    expect(cursorReads).toBe(0);
    expect(stageCatalogFetches).toBe(0);
    expect(listDealCalls).toBe(0);
    expect(syncRunScopeKey).toBe("category:10");
    expect(result).toMatchObject({
      syncRunId: 130,
      dealsSynced: 0,
      modifiedAfter: null,
      snapshotBefore: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      },
      snapshotAfter: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      },
      diagnostics: [
        "attractionSkipped=empty-scope",
        "attractionManagers=0",
        "currentScopeDeals=0"
      ]
    });
    expect(currentScopeReplacement).toEqual({
      scopeKey: "category:10",
      dealIds: [],
      reconciledAt: "2026-06-01T10:00:00.000Z"
    });
    expect(finishedSummary).toEqual(
      expect.objectContaining({
        status: "success",
        dealsSynced: 0,
        modifiedAfter: null
      })
    );
  });

  it("backfills leadgen supplemental calls from call-stat coverage instead of the deal cursor", async () => {
    const callRequests: Array<{
      activityIds?: string[];
      callStartDateFrom?: string;
      callStartDateTo?: string;
      portalUserIds?: string[];
    }> = [];
    const cursorWrites: Array<{ key: string; cursorValue: string }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const storedCalls: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-05-19T00:00:00.000Z",
      getSyncCursor: async (key: string) =>
        key.endsWith(":deals:date_modify") ? "2026-05-19T00:00:00.000Z" : null,
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "call_stats",
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getCallHistoryBootstrappedAt: async () => null,
      getSnapshotStats: async () => ({
        deals: 163,
        activities: 325,
        calls: 0,
        stageHistory: 369
      }),
      replaceStageCatalog: async () => undefined,
      getDealIdsByCategoryIds: async () => ["LG_EXISTING"],
      getActivitiesByIds: async () => [],
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityBindings: async () => 0,
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async () => 0,
      markCallHistoryBootstrapped: async () => undefined,
      createSyncRun: async () => 130,
      setSyncCursor: async (input: { key: string; cursorValue: string }) => {
        cursorWrites.push(input);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listActivityBindings: async () => [],
      listCalls: async (input: {
        activityIds?: string[];
        callStartDateFrom?: string;
        callStartDateTo?: string;
        portalUserIds?: string[];
      }) => {
        callRequests.push(input);
        if (input.callStartDateFrom !== "2026-01-01T00:00:00+03:00") {
          return [];
        }
        return [
          {
            ID: "CALL_BACKFILL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "501",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-05-12T10:20:00.000Z",
            CALL_DURATION: "60",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "LG_EXISTING",
            CALL_FAILED_CODE: "200"
          }
        ];
      },
      fetchUsers: async () => []
    };

    const result = await performLeadgenSync({
      client,
      repository: repo as never,
      categoryId: "28",
      managerIds: ["501", "502"],
      now: () => "2026-05-19T12:00:00.000Z"
    });

    expect(callRequests).toContainEqual({
      callStartDateFrom: "2026-01-01T00:00:00+03:00",
      callStartDateTo: "2026-05-19T12:00:00.000Z",
      portalUserIds: ["501", "502"]
    });
    expect(storedCalls).toEqual([
      [
        expect.objectContaining({
          id: "CALL_BACKFILL",
          portalUserId: "501",
          crmEntityType: "DEAL",
          crmEntityId: "LG_EXISTING"
        })
      ]
    ]);
    expect(cursorWrites).toContainEqual(
      expect.objectContaining({
        key: "module:leadgen:category:28:assigned:501,502:call_stats:call_start_date",
        cursorValue: "2026-05-19T12:00:00.000Z"
      })
    );
    expect(coverageWrites).toContainEqual(
      expect.objectContaining({
        stream: "call_stats",
        providerId: "VOXIMPLANT_CALL",
        coveredFrom: "2026-01-01T00:00:00+03:00"
      })
    );
    expect(result.changes.calls).toBe(1);
  });

  it("hydrates missing leadgen call activities from supplemental call stats", async () => {
    const activityByIdRequests: string[][] = [];
    const bindingRequests: string[][] = [];
    const storedActivities: unknown[][] = [];
    const storedActivityBindings: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-05-19T00:00:00.000Z",
      getSyncCursor: async (key: string) =>
        key.endsWith(":deals:date_modify") ? "2026-05-19T00:00:00.000Z" : null,
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "call_stats",
      upsertSyncCoverage: async () => undefined,
      getCallHistoryBootstrappedAt: async () => null,
      getSnapshotStats: async () => ({
        deals: 163,
        activities: 55,
        calls: 55,
        stageHistory: 369
      }),
      replaceStageCatalog: async () => undefined,
      getDealIdsByCategoryIds: async () => ["LG_EXISTING"],
      getActivitiesByIds: async (activityIds: string[]) => {
        expect(activityIds).toEqual(["A_SUPPLEMENTAL"]);
        return [];
      },
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityBindings: async (rows: unknown[]) => {
        storedActivityBindings.push(rows);
        return rows.length;
      },
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async () => 0,
      markCallHistoryBootstrapped: async () => undefined,
      createSyncRun: async () => 132,
      setSyncCursor: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listActivitiesByIds: async (activityIds: string[]) => {
        activityByIdRequests.push(activityIds);
        return [
          {
            ID: "A_SUPPLEMENTAL",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "LG_EXISTING",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "501",
            CREATED: "2026-05-12T10:20:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-05-12T10:25:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-05-12T10:25:00.000Z"
          }
        ];
      },
      listActivityBindings: async (activityIds: string[]) => {
        bindingRequests.push(activityIds);
        return [
          {
            activityId: "A_SUPPLEMENTAL",
            ownerTypeId: "2",
            ownerId: "LG_EXISTING"
          }
        ];
      },
      listCalls: async (input: {
        activityIds?: string[];
        callStartDateFrom?: string;
      }) => {
        if (input.activityIds) {
          return [];
        }

        if (input.callStartDateFrom !== "2026-01-01T00:00:00+03:00") {
          return [];
        }

        return [
          {
            ID: "CALL_SUPPLEMENTAL",
            CRM_ACTIVITY_ID: "A_SUPPLEMENTAL",
            PORTAL_USER_ID: "501",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-05-12T10:20:00.000Z",
            CALL_DURATION: "60",
            CRM_ENTITY_TYPE: "CONTACT",
            CRM_ENTITY_ID: "CONTACT_1",
            CALL_FAILED_CODE: "200"
          }
        ];
      },
      fetchUsers: async () => []
    };

    const result = await performLeadgenSync({
      client,
      repository: repo as never,
      categoryId: "28",
      managerIds: ["501"],
      now: () => "2026-05-19T12:00:00.000Z"
    });

    expect(activityByIdRequests).toEqual([["A_SUPPLEMENTAL"]]);
    expect(bindingRequests).toEqual([]);
    expect(storedActivities).toEqual([
      [
        expect.objectContaining({
          id: "A_SUPPLEMENTAL",
          ownerTypeId: "2",
          ownerId: "LG_EXISTING",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "501"
        })
      ]
    ]);
    expect(storedActivityBindings).toEqual([[]]);
    expect(storedCalls).toEqual([
      [
        expect.objectContaining({
          id: "CALL_SUPPLEMENTAL",
          crmActivityId: "A_SUPPLEMENTAL",
          crmEntityType: "CONTACT"
        })
      ]
    ]);
    expect(result.changes).toEqual(
      expect.objectContaining({
        activities: 1,
        calls: 1
      })
    );
  });

  it("hydrates missing leadgen call activities from existing stored contact call snapshots", async () => {
    const missingActivityLookups: unknown[][] = [];
    const activityByIdRequests: string[][] = [];
    const bindingRequests: string[][] = [];
    const storedActivities: unknown[][] = [];
    const storedActivityBindings: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-05-19T00:00:00.000Z",
      getSyncCursor: async (key: string) =>
        key.endsWith(":call_stats:call_start_date")
          ? "2026-05-20T00:00:00.000Z"
          : "2026-05-19T00:00:00.000Z",
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getCallHistoryBootstrappedAt: async () => "2026-05-19T18:02:30.303Z",
      getSnapshotStats: async () => ({
        deals: 3361,
        activities: 6255,
        calls: 55,
        stageHistory: 10999
      }),
      replaceStageCatalog: async () => undefined,
      getDealIdsByCategoryIds: async () => ["LG_EXISTING"],
      getCallActivityIdsMissingActivities: async (
        limit: number,
        callStartDateFrom: string | null,
        ownerIds: string[] = []
      ) => {
        missingActivityLookups.push([limit, callStartDateFrom, ownerIds]);
        return ["A_STORED_CALL"];
      },
      getActivitiesByIds: async () => [],
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityBindings: async (rows: unknown[]) => {
        storedActivityBindings.push(rows);
        return rows.length;
      },
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async () => 0,
      markCallHistoryBootstrapped: async () => undefined,
      createSyncRun: async () => 133,
      setSyncCursor: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listActivitiesByIds: async (activityIds: string[]) => {
        activityByIdRequests.push(activityIds);
        return [
          {
            ID: "A_STORED_CALL",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "LG_EXISTING",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "501",
            CREATED: "2026-04-12T10:20:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-04-12T10:25:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-04-12T10:25:00.000Z"
          }
        ];
      },
      listActivityBindings: async (activityIds: string[]) => {
        bindingRequests.push(activityIds);
        return [
          {
            activityId: "A_STORED_CALL",
            ownerTypeId: "2",
            ownerId: "LG_EXISTING"
          }
        ];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        if (input.activityIds) {
          throw new Error("Stored call snapshots already contain these calls");
        }

        return [];
      },
      fetchUsers: async () => []
    };

    const result = await performLeadgenSync({
      client,
      repository: repo as never,
      categoryId: "28",
      managerIds: ["501"],
      now: () => "2026-05-20T12:00:00.000Z"
    });

    expect(missingActivityLookups).toEqual([
      [20_000, "2026-01-01T00:00:00+03:00", []]
    ]);
    expect(activityByIdRequests).toEqual([["A_STORED_CALL"]]);
    expect(bindingRequests).toEqual([]);
    expect(storedActivities).toEqual([
      [
        expect.objectContaining({
          id: "A_STORED_CALL",
          ownerTypeId: "2",
          ownerId: "LG_EXISTING",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "501"
        })
      ]
    ]);
    expect(storedActivityBindings).toEqual([[]]);
    expect(storedCalls).toEqual([[]]);
    expect(result.changes).toEqual(
      expect.objectContaining({
        activities: 1,
        calls: 0
      })
    );
  });

  it("backfills leadgen task activities from coverage instead of the advanced deal cursor", async () => {
    const activityRequests: Array<{
      ownerIds: string[];
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const storedActivities: unknown[][] = [];
    const cursorWrites: Array<{ key: string; cursorValue: string }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-05-19T00:00:00.000Z",
      getSyncCursor: async (key: string) =>
        key.endsWith(":deals:date_modify")
          ? "2026-05-19T00:00:00.000Z"
          : null,
      hasSyncCoverage: async (input: { stream: string; providerId: string | null }) =>
        !(
          input.stream === "activity_history" &&
          (input.providerId === "CRM_TODO" ||
            input.providerId === "CRM_TASKS_TASK")
        ),
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getCallHistoryBootstrappedAt: async () => "2026-05-19T00:00:00.000Z",
      getSnapshotStats: async () => ({
        deals: 163,
        activities: 6,
        calls: 0,
        stageHistory: 369
      }),
      replaceStageCatalog: async () => undefined,
      getDealIdsByCategoryIds: async () => ["LG_EXISTING"],
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityBindings: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 131,
      setSyncCursor: async (input: { key: string; cursorValue: string }) => {
        cursorWrites.push(input);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push(input);
        if (
          input.providerId === "CRM_TODO" &&
          input.modifiedAfter === "2026-01-01T00:00:00+03:00"
        ) {
          return [
            {
              ID: "TASK_BACKFILL",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "LG_EXISTING",
              TYPE_ID: "6",
              PROVIDER_ID: "CRM_TODO",
              RESPONSIBLE_ID: "501",
              CREATED: "2026-05-12T10:00:00.000Z",
              DEADLINE: null,
              LAST_UPDATED: "2026-05-12T10:30:00.000Z",
              COMPLETED: "Y",
              COMPLETED_DATE: "2026-05-12T10:30:00.000Z"
            }
          ];
        }
        return [];
      },
      listActivityBindings: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    const result = await performLeadgenSync({
      client,
      repository: repo as never,
      categoryId: "28",
      managerIds: ["501", "502"],
      now: () => "2026-05-19T12:00:00.000Z"
    });

    expect(activityRequests).toContainEqual({
      ownerIds: ["LG_EXISTING"],
      modifiedAfter: "2026-01-01T00:00:00+03:00",
      providerId: "CRM_TODO"
    });
    expect(activityRequests).toContainEqual({
      ownerIds: ["LG_EXISTING"],
      modifiedAfter: "2026-01-01T00:00:00+03:00",
      providerId: "CRM_TASKS_TASK"
    });
    expect(storedActivities).toEqual([
      [
        expect.objectContaining({
          id: "TASK_BACKFILL",
          providerId: "CRM_TODO",
          completed: true
        })
      ]
    ]);
    expect(cursorWrites).toContainEqual(
      expect.objectContaining({
        key: "module:leadgen:category:28:assigned:501,502:activities:last_updated",
        cursorValue: "2026-05-19T12:00:00.000Z"
      })
    );
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "activity_history",
          providerId: "CRM_TODO",
          coveredFrom: "2026-01-01T00:00:00+03:00"
        }),
        expect.objectContaining({
          stream: "activity_history",
          providerId: "CRM_TASKS_TASK",
          coveredFrom: "2026-01-01T00:00:00+03:00"
        })
      ])
    );
    expect(result.changes.activities).toBe(1);
  });

  it("runs a category-scoped delta sync for deals and operational snapshots", async () => {
    const calls: Array<{ modifiedAfter: string | null }> = [];
    let requestedDealStageCategories: string[] = [];
    let requestedSourceCatalog = false;
    const storedDeals: unknown[][] = [];
    const storedStageHistory: unknown[][] = [];
    const storedActivities: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const storedDeadlineChanges: unknown[][] = [];
    const storedConversionEventVisits: unknown[][] = [];
    const storedManagers: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async (
        categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        requestedDealStageCategories = categoryIds;
        expect(assignedByIds).toEqual(defaultAttractionManagerIds);
        return "2026-04-07T00:00:00.000Z";
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async (
        categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        expect(categoryIds).toEqual(["10"]);
        expect(assignedByIds).toEqual(defaultAttractionManagerIds);
        return ["D1", "D2"];
      },
      getActivitiesByIds: async (activityIds: string[]) => {
        expect(activityIds).toEqual(["A1", "A2"]);
        return [
          {
            id: "A2",
            ownerTypeId: "2",
            ownerId: "D2",
            typeId: "6",
            providerId: "CRM_TODO",
            responsibleId: "9",
            createdTime: "2026-04-08T10:00:00.000Z",
            deadline: "2026-04-09T12:00:00.000Z",
            lastUpdated: "2026-04-08T10:00:00.000Z",
            completed: false,
            completedTime: null
          }
        ];
      },
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async (rows: unknown[]) => {
        storedStageHistory.push(rows);
        return rows.length;
      },
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async (rows: unknown[]) => {
        storedDeadlineChanges.push(rows);
        return rows.length;
      },
      upsertConversionEventVisits: async (rows: unknown[]) => {
        storedConversionEventVisits.push(rows);
        return rows.length;
      },
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async (rows: unknown[]) => {
        storedManagers.push(rows);
        return rows.length;
      },
      createSyncRun: async () => 17,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return [
          {
            entityType: "deal" as const,
            categoryId: "10",
            statusId: "C10:NEW",
            name: "New",
            semanticId: "P",
            sortOrder: 10
          }
        ];
      },
      fetchSourceCatalog: async () => {
        requestedSourceCatalog = true;
        return [
          {
            entityType: "source" as const,
            categoryId: null,
            statusId: "WEB",
            name: "Website",
            semanticId: null,
            sortOrder: 10
          }
        ];
      },
      fetchDealQualityMap: async (fieldName: string) => {
        expect(fieldName).toBe("UF_CRM_1730380390");
        return {
          "6": "3.1 Готов ко встрече"
        };
      },
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_EVENT_OF") {
          return {
            "700": "Знакомство с клубом 29.04."
          };
        }

        if (fieldName === "UF_CRM_1647422744") {
          return {
            "182": "Клиенту не интересен формат"
          };
        }

        if (fieldName === "UF_CRM_1643901145") {
          return {
            "114": "Федеральный Москва"
          };
        }

        if (fieldName === "UF_CRM_1747682957") {
          return {
            "388": "ClubOne"
          };
        }

        if (fieldName === "UF_CRM_TARGET_GROUP") {
          return {
            "512": "ClubFirst"
          };
        }

        if (fieldName === "UF_CRM_MEETING_TYPE") {
          return {
            "90": "Очная"
          };
        }

        if (
          fieldName === "UF_CRM_1776949411825" ||
          fieldName === "UF_CRM_1772109151192"
        ) {
          return {};
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      fetchConversionEventDealFieldName: async () => "UF_CRM_EVENT_OF",
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        assignedByIds?: string[];
        customFieldNames?: string[];
      }) => {
        calls.push({ modifiedAfter: cursor.modifiedAfter });
        if (cursor.categoryIds[0] === "28") {
          expect(cursor.assignedByIds).toEqual(defaultAttractionManagerIds);
          return [];
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        expect(cursor.assignedByIds).toEqual(defaultAttractionManagerIds);
        expect(cursor.customFieldNames).toEqual(expect.arrayContaining([
          "UF_CRM_1730380390",
          "UF_CRM_1643901145",
          "UF_CRM_1747682957",
          "UF_CRM_TARGET_GROUP",
          "UF_CRM_MEETING_TYPE",
          "UF_CRM_MEETING_DATE",
          "UF_CRM_EVENT_OF",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890",
          "UF_CRM_1776949411825",
          "UF_CRM_1772109151192"
        ]));
        return [
          {
            ID: "D1",
            CONTACT_ID: "9001",
            LEAD_ID: "L1",
            DATE_CREATE: "2026-04-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-08T10:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 1000,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1730380390: "6",
            UF_CRM_1643901145: "114",
            UF_CRM_1747682957: "388",
            UF_CRM_TARGET_GROUP: "512",
            UF_CRM_MEETING_TYPE: "90",
            UF_CRM_MEETING_DATE: "2026-04-03T13:00:00.000Z",
            UF_CRM_EVENT_OF: "700",
            UF_CRM_1647422744: "182",
            UF_CRM_1647422890: "Не готов к формату клуба",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listConversionEventVisits: async (input: {
        modifiedAfter: string | null;
        reportYear: number;
        dealIds?: string[];
        contactIds?: string[];
        signal?: AbortSignal;
      }) => {
        expect(input).toMatchObject({
          modifiedAfter: "2026-04-07T00:00:00.000Z",
          reportYear: 2026,
          dealIds: ["D1", "D2"]
        });
        expect(input.contactIds).toBeUndefined();
        expect(input.signal).toBeInstanceOf(AbortSignal);
        return [
          {
            id: "VISIT-1",
            eventName: "Знакомство с клубом 29.04.",
            eventDate: "2026-04-29T00:00:00.000Z",
            status: "attended" as const,
            stageId: "DT:ATTENDED",
            stageName: "На мероприятии",
            dealId: "D1",
            contactId: "9001",
            managerId: "78",
            sourceId: "WEB",
            createdTime: "2026-04-20T10:00:00.000Z",
            updatedTime: "2026-04-29T13:56:00.000Z"
          },
          {
            id: "VISIT-CONTACT-ONLY",
            eventName: "Клубная встреча 30.04.",
            eventDate: "2026-04-30T00:00:00.000Z",
            status: "invited" as const,
            stageId: "DT:NEW",
            stageName: "Приглашен",
            dealId: null,
            contactId: "9001",
            managerId: "78",
            sourceId: "WEB",
            createdTime: "2026-04-20T11:00:00.000Z",
            updatedTime: "2026-04-20T11:00:00.000Z"
          }
        ];
      },
      listStageHistory: async (input: { categoryIds?: string[] }) => {
        expect(input.categoryIds).toEqual(["10"]);
        return [
          {
            ID: "H1",
            OWNER_ID: "D1",
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            TYPE_ID: 1,
            CREATED_TIME: "2026-04-08T10:00:00.000Z"
          }
        ];
      },
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
      }) => {
        expect(input.ownerIds).toEqual(["D1", "D2"]);
        expect(input.modifiedAfter).toBe("2026-04-07T00:00:00.000Z");
        return [
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D1",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "7",
            CREATED: "2026-04-08T10:30:00.000Z",
            DEADLINE: "2026-04-08T10:30:00.000Z",
            LAST_UPDATED: "2026-04-08T10:32:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-04-08T10:32:00.000Z"
          },
          {
            ID: "A2",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D2",
            TYPE_ID: "6",
            PROVIDER_ID: "CRM_TODO",
            RESPONSIBLE_ID: "9",
            CREATED: "2026-04-08T10:00:00.000Z",
            DEADLINE: "2026-04-10T12:00:00.000Z",
            LAST_UPDATED: "2026-04-09T09:00:00.000Z",
            COMPLETED: "N"
          }
        ];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        expect(input.activityIds).toEqual(["A1"]);
        return [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "A1",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-04-08T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async (input: { ids: string[] }) => {
        expect(input.ids.sort()).toEqual(["7", "78", "9"]);
        return [
          {
            ID: "7",
            NAME: "Анна",
            LAST_NAME: "Куратор"
          },
          {
            ID: "78",
            NAME: "Андрей",
            LAST_NAME: "Егоров"
          },
          {
            ID: "9",
            NAME: "Илья",
            LAST_NAME: "Менеджер"
          }
        ];
      }
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      tariffFieldName: "UF_CRM_1643901145",
      businessClubFieldName: "UF_CRM_1747682957",
      targetGroupFieldName: "UF_CRM_TARGET_GROUP",
      meetingTypeFieldName: "UF_CRM_MEETING_TYPE",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(calls).toEqual([{ modifiedAfter: "2026-04-07T00:00:00.000Z" }]);
    expect(requestedDealStageCategories).toEqual(["10"]);
    expect(requestedSourceCatalog).toBe(true);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D1",
          contactId: "9001",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubOne",
          targetGroupValue: "ClubFirst",
          meetingTypeValue: "Очная",
          meetingDateValue: "2026-04-03T13:00:00.000Z",
          tariffValue: "Федеральный Москва",
          conversionEventValue: "Знакомство с клубом 29.04.",
          refusalReasonValue: "Клиенту не интересен формат",
          refusalReasonDetail: "Не готов к формату клуба"
        })
      ]
    ]);
    expect(storedStageHistory).toEqual([
      [
        expect.objectContaining({
          id: "H1",
          ownerId: "D1"
        })
      ]
    ]);
    expect(storedActivities).toEqual([
      [
        expect.objectContaining({
          id: "A1",
          providerId: "VOXIMPLANT_CALL"
        }),
        expect.objectContaining({
          id: "A2",
          deadline: "2026-04-10T12:00:00.000Z"
        })
      ]
    ]);
    expect(storedDeadlineChanges).toEqual([
      [
        expect.objectContaining({
          activityId: "A2",
          previousDeadline: "2026-04-09T12:00:00.000Z",
          nextDeadline: "2026-04-10T12:00:00.000Z",
          changedAt: "2026-04-09T09:00:00.000Z"
        })
      ]
    ]);
    expect(storedCalls).toEqual([
      [
        expect.objectContaining({
          id: "CALL1",
          crmActivityId: "A1",
          callDurationSeconds: 64
        })
      ]
    ]);
    expect(storedConversionEventVisits).toEqual([
      [
        expect.objectContaining({
          id: "VISIT-1",
          eventName: "Знакомство с клубом 29.04.",
          dealId: "D1"
        })
      ]
    ]);
    expect(storedManagers).toEqual([
      [
        { id: "7", name: "Анна Куратор" },
        { id: "78", name: "Андрей Егоров" },
        { id: "9", name: "Илья Менеджер" }
      ]
    ]);
    expect(result).toMatchObject({
      syncRunId: 17,
      leadsSynced: 0,
      dealsSynced: 1,
      mode: "delta",
      modifiedAfter: "2026-04-07T00:00:00.000Z",
      finishedAt: "2026-04-09T00:00:00.000Z"
    });
    expect(result.changes).toEqual({
      deals: 1,
      dealBreakdown: {
        total: 1,
        created: 1,
        updated: 0,
        closed: 0,
        reopened: 0,
        unchanged: 0
      },
      activities: 2,
      calls: 1,
      stageHistory: 1,
      managers: 3
    });
  });

  it("keeps attraction sync scoped to attraction without requesting leadgen lookup data", async () => {
    const listDealRequests: Array<{
      categoryIds: string[];
      assignedByIds?: string[];
      customFieldNames?: string[];
    }> = [];
    const storedDeals: unknown[][] = [];
    let requestedStageCategories: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-05-01T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-05-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-05-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 0,
        calls: 0,
        stageHistory: 1
      }),
      getDealIdsByCategoryIds: async () => ["D_ATTRACTION"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 28,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async (categoryIds: string[]) => {
        requestedStageCategories = categoryIds;
        return [
          {
            entityType: "deal" as const,
            categoryId: "10",
            statusId: "C10:NEW",
            name: "Новая сделка",
            semanticId: "P",
            sortOrder: 10
          }
        ];
      },
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1776949411825") {
          return { R1: "Возврат" };
        }

        if (fieldName === "UF_CRM_1772109151192") {
          return { B1: "Корзина" };
        }

        return {};
      },
      listDeals: async (cursor: {
        categoryIds: string[];
        assignedByIds?: string[];
        customFieldNames?: string[];
      }) => {
        listDealRequests.push({
          categoryIds: cursor.categoryIds,
          ...(cursor.assignedByIds ? { assignedByIds: cursor.assignedByIds } : {}),
          ...(cursor.customFieldNames
            ? { customFieldNames: cursor.customFieldNames }
            : {})
        });

        if (cursor.categoryIds[0] === "28") {
          throw new Error("Attraction sync must not request leadgen category 28");
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        return [
          {
            ID: "D_ATTRACTION",
            CONTACT_ID: "9001",
            LEAD_ID: null,
            DATE_CREATE: "2026-05-02T10:00:00.000Z",
            DATE_MODIFY: "2026-05-02T10:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 1000,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-05-14T00:00:00.000Z"
    });

    expect(requestedStageCategories).toEqual(["10"]);
    expect(listDealRequests).toEqual([
      expect.objectContaining({
        categoryIds: ["10"],
        assignedByIds: defaultAttractionManagerIds,
        customFieldNames: expect.arrayContaining([
          "UF_CRM_1730380390",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890",
          "UF_CRM_1776949411825",
          "UF_CRM_1772109151192"
        ])
      })
    ]);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_ATTRACTION",
          categoryId: "10",
          contactId: "9001"
        })
      ]
    ]);
    expect(result.dealsSynced).toBe(1);
  });

  it("maps all deal meeting field slots into sorted meeting slots", async () => {
    const listDealRequests: Array<{ customFieldNames?: string[] }> = [];
    const storedDeals: unknown[][] = [];
    const requestedFieldMaps: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-05-01T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-05-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-05-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => ["D_MEETINGS"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 131,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        requestedFieldMaps.push(fieldName);
        return {
          "90": "Очная",
          "91": "Zoom",
          "92": "Офлайн",
          "301": "Офис К1",
          "302": "Офис К2",
          "401": "Основной календарь",
          "402": "Календарь клуба"
        };
      },
      listDeals: async (cursor: { customFieldNames?: string[] }) => {
        listDealRequests.push({
          ...(cursor.customFieldNames
            ? { customFieldNames: cursor.customFieldNames }
            : {})
        });
        return [
          {
            ID: "D_MEETINGS",
            CONTACT_ID: "9001",
            LEAD_ID: null,
            DATE_CREATE: "2026-05-02T10:00:00.000Z",
            DATE_MODIFY: "2026-05-03T10:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 1000,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1669784114991: "90",
            UF_CRM_1669784197394: "2026-05-04T10:00:00.000Z",
            UF_CRM_1669784273591: "301",
            UF_CRM_1677669882: "401",
            UF_CRM_MEET2_DT: "2026-05-06T10:00:00.000Z",
            UF_CRM_DEAL_MEET2_KIND: "91",
            UF_CRM_DEAL_MEET2_PLACE: "302",
            UF_CRM_DEAL_MEET2_CAL: "402",
            UF_CRM_DEAL_MEET2_EVENT: "event-2",
            UF_CRM_MEET3_DT: "2026-05-08T10:00:00.000Z",
            UF_CRM_DEAL_MEET3_KIND: "92",
            UF_CRM_DEAL_MEET3_PLACE: "558404",
            UF_CRM_DEAL_MEET3_CAL: "777",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client: client as never,
      repository: repo as never,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      meetingTypeFieldName: "UF_CRM_1669784114991",
      meetingDateFieldName: "UF_CRM_1669784197394",
      now: () => "2026-05-14T00:00:00.000Z"
    });

    expect(listDealRequests[0]?.customFieldNames).toEqual(
      expect.arrayContaining([
        "UF_CRM_1669784114991",
        "UF_CRM_1669784197394",
        "UF_CRM_1669784273591",
        "UF_CRM_1677669882",
        "UF_CRM_MEET2_DT",
        "UF_CRM_DEAL_MEET2_KIND",
        "UF_CRM_DEAL_MEET2_PLACE",
        "UF_CRM_DEAL_MEET2_CAL",
        "UF_CRM_DEAL_MEET2_EVENT",
        "UF_CRM_MEET3_DT",
        "UF_CRM_DEAL_MEET3_KIND",
        "UF_CRM_DEAL_MEET3_PLACE",
        "UF_CRM_DEAL_MEET3_CAL",
        "UF_CRM_DEAL_MEET3_EVENT"
      ])
    );
    expect(requestedFieldMaps).toEqual(
      expect.arrayContaining([
        "UF_CRM_1669784114991",
        "UF_CRM_1669784273591",
        "UF_CRM_1677669882",
        "UF_CRM_DEAL_MEET2_KIND",
        "UF_CRM_DEAL_MEET2_PLACE",
        "UF_CRM_DEAL_MEET2_CAL",
        "UF_CRM_DEAL_MEET3_KIND"
      ])
    );
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_MEETINGS",
          meetingTypeValue: "Очная",
          meetingDateValue: "2026-05-04T10:00:00.000Z",
          meetingSlots: [
            {
              index: 1 as const,
              dateValue: "2026-05-04T10:00:00.000Z",
              typeValue: "Очная",
              placeValue: "Офис К1",
              calendarValue: "Основной календарь",
              eventId: null,
              source: "deal_fields" as const
            },
            {
              index: 2 as const,
              dateValue: "2026-05-06T10:00:00.000Z",
              typeValue: "Zoom",
              placeValue: "Офис К2",
              calendarValue: "Календарь клуба",
              eventId: "event-2",
              source: "deal_fields"
            },
            {
              index: 3,
              dateValue: "2026-05-08T10:00:00.000Z",
              typeValue: "Офлайн",
              placeValue: null,
              calendarValue: null,
              eventId: null,
              source: "deal_fields" as const
            }
          ]
        })
      ]
    ]);
  });

  it("fetches stage history for closed deals during an initial full sync", async () => {
    let stageHistoryCategoryIds: string[] | undefined;
    const storedStageHistory: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => null,
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 0,
      getSnapshotStats: async () => ({
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => rows.length,
      upsertStageHistory: async (rows: unknown[]) => {
        storedStageHistory.push(rows);
        return rows.length;
      },
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 72,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [
        {
          ID: "D_OPEN",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-01T00:00:00.000Z",
          DATE_MODIFY: "2026-04-08T10:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        },
        {
          ID: "D_WON",
          LEAD_ID: null,
          DATE_CREATE: "2026-03-01T00:00:00.000Z",
          DATE_MODIFY: "2026-04-08T11:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:WON",
          STAGE_SEMANTIC_ID: "S",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async (input: { categoryIds?: string[] }) => {
        stageHistoryCategoryIds = input.categoryIds;
        return [
          {
            ID: "H_WON",
            OWNER_ID: "D_WON",
            CATEGORY_ID: "10",
            STAGE_ID: "C10:WON",
            STAGE_SEMANTIC_ID: "S",
            TYPE_ID: 1,
            CREATED_TIME: "2026-03-10T10:00:00.000Z"
          }
        ];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(stageHistoryCategoryIds).toEqual(["10"]);
    expect(storedStageHistory).toEqual([
      [
        expect.objectContaining({
          id: "H_WON",
          ownerId: "D_WON"
        })
      ]
    ]);
  });

  it("uses category stage-history fetch for very large delta deal windows", async () => {
    let stageHistoryRequest: { categoryIds?: string[]; ownerIds?: string[] } | null =
      null;
    const dealRows = Array.from({ length: 501 }, (_, index) => ({
      ID: `D${index + 1}`,
      LEAD_ID: null,
      DATE_CREATE: "2026-04-01T00:00:00.000Z",
      DATE_MODIFY: "2026-04-08T10:00:00.000Z",
      DATE_CLOSED: null,
      CATEGORY_ID: "10",
      STAGE_ID: "C10:NEW",
      STAGE_SEMANTIC_ID: "P",
      OPPORTUNITY: null,
      ASSIGNED_BY_ID: "78",
      SOURCE_ID: "WEB",
      UTM_SOURCE: null,
      UTM_MEDIUM: null,
      UTM_CAMPAIGN: null,
      UTM_CONTENT: null,
      UTM_TERM: null
    }));
    const storedStageHistory: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-08T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async (rows: unknown[]) => {
        storedStageHistory.push(rows);
        return rows.length;
      },
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 73,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => dealRows,
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async (input: {
        categoryIds?: string[];
        ownerIds?: string[];
      }) => {
        stageHistoryRequest = input;
        return [
          {
            ID: "H1",
            OWNER_ID: "D501",
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            TYPE_ID: 1,
            CREATED_TIME: "2026-04-08T10:00:00.000Z"
          },
          {
            ID: "H_OUT_OF_SCOPE",
            OWNER_ID: "D_OUT_OF_SCOPE",
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            TYPE_ID: 1,
            CREATED_TIME: "2026-04-08T10:00:00.000Z"
          }
        ];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(stageHistoryRequest).toMatchObject({ categoryIds: ["10"] });
    expect(storedStageHistory).toEqual([
      [expect.objectContaining({ id: "H1", ownerId: "D501" })]
    ]);
  });

  it("backfills conversion event visits once when the smart-process snapshot has no coverage yet", async () => {
    const conversionVisitRequests: Array<{
      modifiedAfter: string | null;
      reportYear: number;
    }> = [];
    const storedConversionEventVisits: unknown[][] = [];
    const coverageWrites: unknown[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-29T09:56:29.538Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "conversion_event_visits",
      upsertSyncCoverage: async (input: unknown) => {
        coverageWrites.push(input);
      },
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertConversionEventVisits: async (rows: unknown[]) => {
        storedConversionEventVisits.push(rows);
        return rows.length;
      },
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 42,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventVisits: async (input: {
        modifiedAfter: string | null;
        reportYear: number;
        dealIds?: string[];
        contactIds?: string[];
        signal?: AbortSignal;
      }) => {
        expect(input.dealIds).toEqual(["D1"]);
        expect(input.contactIds).toBeUndefined();
        conversionVisitRequests.push({
          modifiedAfter: input.modifiedAfter,
          reportYear: input.reportYear
        });
        return [
          {
            id: "VISIT-29-04",
            eventName: "Знакомство с клубом 29.04.",
            eventDate: "2026-04-29T00:00:00.000Z",
            status: "attended" as const,
            stageId: "DT:ATTENDED",
            stageName: "На мероприятии",
            dealId: "D1",
            contactId: "9001",
            managerId: "78",
            sourceId: "WEB",
            createdTime: "2026-04-20T10:00:00.000Z",
            updatedTime: "2026-04-29T13:56:00.000Z"
          }
        ];
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-30T15:05:00.000Z"
    });

    expect(conversionVisitRequests).toEqual([
      { modifiedAfter: null, reportYear: 2026 }
    ]);
    expect(storedConversionEventVisits).toEqual([
      [
        expect.objectContaining({
          id: "VISIT-29-04",
          eventName: "Знакомство с клубом 29.04."
        })
      ]
    ]);
    expect(coverageWrites).toContainEqual(
      expect.objectContaining({
        stream: "conversion_event_visits",
        coveredFrom: "0000-01-01T00:00:00.000Z"
      })
    );
  });

  it("treats old conversion-event coverage as stale when event inventory streams are added", async () => {
    const conversionVisitRequests: Array<{
      modifiedAfter: string | null;
      reportYear: number;
    }> = [];
    const conversionEventRequests: Array<{
      modifiedAfter: string | null;
      eventTypeIds?: string[];
    }> = [];
    const coverageChecks: unknown[] = [];
    const coverageWrites: unknown[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-29T09:56:29.538Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async (input: { stream: string; algorithmVersion: string }) => {
        coverageChecks.push(input);
        return (
          input.stream === "conversion_event_visits" &&
          input.algorithmVersion === "conversion-event-visits-v1"
        );
      },
      upsertSyncCoverage: async (input: unknown) => {
        coverageWrites.push(input);
      },
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getModuleEventTypeSettings: async () => [
        {
          moduleKey: "attraction",
          eventTypeId: "128",
          eventTypeLabel: "Мероприятие Привлечения",
          enabled: true,
          updatedAt: "2026-04-29T00:00:00.000Z"
        }
      ],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertConversionEventVisits: async () => 0,
      upsertEventSnapshots: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 45,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventVisits: async (input: {
        modifiedAfter: string | null;
        reportYear: number;
      }) => {
        conversionVisitRequests.push({
          modifiedAfter: input.modifiedAfter,
          reportYear: input.reportYear
        });
        return [];
      },
      listConversionEvents: async (input: {
        modifiedAfter: string | null;
        eventTypeIds?: string[];
      }) => {
        conversionEventRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.eventTypeIds ? { eventTypeIds: input.eventTypeIds } : {})
        });
        return [];
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-30T15:05:00.000Z"
    });

    expect(coverageChecks).toContainEqual(
      expect.objectContaining({
        stream: "conversion_event_visits",
        algorithmVersion: "conversion-event-visits-v2"
      })
    );
    expect(conversionVisitRequests).toEqual([
      { modifiedAfter: null, reportYear: 2026 }
    ]);
    expect(conversionEventRequests).toEqual([
      { modifiedAfter: null, eventTypeIds: ["128"] }
    ]);
    expect(coverageWrites).toContainEqual(
      expect.objectContaining({
        stream: "conversion_event_visits",
        algorithmVersion: "conversion-event-visits-v2"
      })
    );
  });

  it("hydrates event inventory for referenced conversion visits even without planned type settings", async () => {
    const conversionEventRequests: Array<{
      modifiedAfter: string | null;
      eventIds?: string[];
      eventTypeIds?: string[];
    }> = [];
    const storedEventSnapshots: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-05-25T01:19:32.564Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "conversion_event_visits",
      upsertSyncCoverage: async () => undefined,
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getModuleEventTypeSettings: async () => [],
      getConversionEventIdsMissingEventSnapshots: async () => ["OLD_EVENT"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertConversionEventVisits: async () => 1,
      upsertEventSnapshots: async (rows: unknown[]) => {
        storedEventSnapshots.push(rows);
        return rows.length;
      },
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 47,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventVisits: async () => [
        {
          id: "VISIT_NEW_EVENT",
          eventId: "NEW_EVENT",
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "invited" as const,
          stageId: "DT162_14:NEW",
          stageName: "Приглашен",
          dealId: "D1",
          contactId: "C1",
          managerId: "78",
          sourceId: "WEB",
          createdTime: "2026-05-25T12:00:00.000Z",
          updatedTime: "2026-05-25T12:00:00.000Z"
        }
      ],
      listConversionEvents: async (input: {
        modifiedAfter: string | null;
        eventIds?: string[];
        eventTypeIds?: string[];
      }) => {
        conversionEventRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.eventIds ? { eventIds: input.eventIds } : {}),
          ...(input.eventTypeIds ? { eventTypeIds: input.eventTypeIds } : {})
        });
        return (input.eventIds ?? []).map((eventId) => ({
          eventId,
          entityTypeId: 137,
          categoryId: 12,
          title: eventId === "NEW_EVENT" ? "Гостевая встреча 28.05." : "Старое мероприятие",
          eventDate: "2026-05-28T00:00:00.000Z",
          startAt: "2026-05-28T00:00:00.000Z",
          endAt: null,
          stageId: "DT137_12:PLANNED",
          stageName: "Планируется",
          status: "planned" as const,
          eventTypeId: "128",
          eventTypeLabel: "Мероприятие Привлечения",
          formatId: null,
          createdTime: "2026-05-20T12:00:00.000Z",
          updatedTime: "2026-05-20T12:00:00.000Z"
        }));
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-05-27T10:00:00.000Z"
    });

    expect(conversionEventRequests).toEqual([
      {
        modifiedAfter: null,
        eventIds: ["NEW_EVENT", "OLD_EVENT"]
      }
    ]);
    expect(storedEventSnapshots).toEqual([
      [
        expect.objectContaining({ eventId: "NEW_EVENT" }),
        expect.objectContaining({ eventId: "OLD_EVENT" })
      ]
    ]);
  });

  it("prunes stale conversion-event snapshots to scoped deals and enabled planned event types", async () => {
    const pruneCalls: unknown[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-29T09:56:29.538Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "conversion_event_visits",
      upsertSyncCoverage: async () => undefined,
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getModuleEventTypeSettings: async () => [
        {
          moduleKey: "attraction",
          eventTypeId: "128",
          eventTypeLabel: "Мероприятие Привлечения",
          enabled: true,
          updatedAt: "2026-04-29T00:00:00.000Z"
        },
        {
          moduleKey: "attraction",
          eventTypeId: "999",
          eventTypeLabel: "Клубная активность",
          enabled: false,
          updatedAt: "2026-04-29T00:00:00.000Z"
        }
      ],
      pruneConversionEventSnapshots: async (input: unknown) => {
        pruneCalls.push(input);
        return {
          conversionEventVisits: 2,
          eventVisitStageHistory: 2,
          eventVisitFacts: 2,
          dealTouchpointFacts: 2,
          eventSnapshots: 1
        };
      },
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertConversionEventVisits: async () => 0,
      upsertEventSnapshots: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 46,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventVisits: async (input: {
        dealIds?: string[];
        contactIds?: string[];
      }) => {
        expect(input.dealIds).toEqual(["D1"]);
        expect(input.contactIds).toBeUndefined();
        return [];
      },
      listConversionEvents: async (input: { eventTypeIds?: string[] }) => {
        expect(input.eventTypeIds).toEqual(["128"]);
        return [];
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-30T15:05:00.000Z"
    });

    expect(pruneCalls).toEqual([
      {
        scopedDealIds: ["D1"],
        enabledEventTypeIds: ["128"]
      }
    ]);
  });

  it("preserves conversion event type options when the Bitrix metadata fetch fails", async () => {
    let finishedDiagnostics: string[] = [];
    const replacedOptionRows: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-29T09:56:29.538Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async () => true,
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      replaceConversionEventTypeOptions: async (rows: unknown[]) => {
        replacedOptionRows.push(rows);
        return rows.length;
      },
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 46,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
      },
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventTypeOptions: async () => {
        throw Object.assign(new Error("ACCESS_DENIED"), {
          name: "BitrixApiError"
        });
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-30T15:05:00.000Z"
    });

    expect(replacedOptionRows).toEqual([]);
    expect(finishedDiagnostics).toContain(
      "conversionEventTypeOptionsError=BitrixApiError"
    );
  });

  it("keeps the main sync successful when conversion event discovery is access denied", async () => {
    let finishedDiagnostics: string[] = [];
    let failedSync = false;
    const coverageWrites: unknown[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-29T09:56:29.538Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "conversion_event_visits",
      upsertSyncCoverage: async (input: unknown) => {
        coverageWrites.push(input);
      },
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertConversionEventVisits: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 43,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
      },
      failSyncRun: async () => {
        failedSync = true;
      }
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventVisits: async () => {
        throw Object.assign(new Error("ACCESS_DENIED"), {
          name: "BitrixApiError"
        });
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-30T15:05:00.000Z"
    });

    expect(result.syncRunId).toBe(43);
    expect(failedSync).toBe(false);
    expect(finishedDiagnostics).toContain(
      "conversionEventVisitsError=BitrixApiError"
    );
    expect(coverageWrites).not.toContainEqual(
      expect.objectContaining({
        stream: "conversion_event_visits"
      })
    );
  });

  it("keeps the main sync successful when conversion event visits time out", async () => {
    let finishedDiagnostics: string[] = [];
    let failedSync = false;
    let conversionEventRequestAborted = false;
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-29T09:56:29.538Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "conversion_event_visits",
      upsertSyncCoverage: async () => undefined,
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertConversionEventVisits: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 44,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
      },
      failSyncRun: async () => {
        failedSync = true;
      }
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventVisits: async (input: {
        signal?: AbortSignal;
      }) =>
        new Promise<never>((_resolve, reject) => {
          input.signal?.addEventListener("abort", () => {
            conversionEventRequestAborted = true;
            reject(input.signal?.reason);
          });
        }),
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-30T15:05:00.000Z",
      conversionEventVisitsTimeoutMs: 1
    });

    expect(result.syncRunId).toBe(44);
    expect(failedSync).toBe(false);
    expect(conversionEventRequestAborted).toBe(true);
    expect(finishedDiagnostics).toContain(
      "conversionEventVisitsError=AbortError"
    );
  });

  it("does not synthesize event visit stage history or mark coverage when the stage-history fetch fails", async () => {
    let finishedDiagnostics: string[] = [];
    const coverageWrites: unknown[] = [];
    const storedEventVisitStageHistory: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-29T09:56:29.538Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-04-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 0,
        stageHistory: 1
      }),
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "conversion_event_visits",
      upsertSyncCoverage: async (input: unknown) => {
        coverageWrites.push(input);
      },
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertConversionEventVisits: async () => 1,
      upsertEventVisitStageHistory: async (rows: unknown[]) => {
        storedEventVisitStageHistory.push(rows);
        return rows.length;
      },
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 62,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
      },
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listConversionEventVisits: async () => [
        {
          id: "VISIT-STAGE-HISTORY-FAILS",
          eventName: "Гостевая встреча 28.05.",
          eventDate: "2026-05-28T00:00:00.000Z",
          status: "confirmed" as const,
          stageId: "DT162_14:PREPARATION",
          stageName: "Пойду",
          dealId: "D1",
          contactId: "C1",
          managerId: "78",
          sourceId: "WEB",
          createdTime: "2026-05-18T12:00:00.000Z",
          updatedTime: "2026-05-20T12:00:00.000Z"
        }
      ],
      listConversionEventVisitStageHistory: async () => {
        throw new Error("crm.stagehistory.list failed");
      },
      listActivities: async () => [],
      listCalls: async () => [],
      listStageHistory: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-05-25T12:00:00.000Z"
    });

    expect(storedEventVisitStageHistory).toEqual([[]]);
    expect(finishedDiagnostics).toContain(
      "conversionEventVisitStageHistoryError=Error"
    );
    expect(coverageWrites).not.toContainEqual(
      expect.objectContaining({
        stream: "conversion_event_visits"
      })
    );
  });

  it("hydrates target group from contact fields when the deal itself has no target-group field", async () => {
    const storedDeals: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-07T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async (rows: unknown[]) => {
        return rows.length;
      },
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 19,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (
          fieldName === "UF_CRM_1647422744" ||
          fieldName === "UF_CRM_1776949411825" ||
          fieldName === "UF_CRM_1772109151192"
        ) {
          return {};
        }

        throw new Error(`Unexpected deal field map request: ${fieldName}`);
      },
      fetchContactFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1691070302") {
          return {
            "4734": "ClubFirst Russia",
            "4986": "ClubFirst Ladies"
          };
        }

        throw new Error(`Unexpected contact field map request: ${fieldName}`);
      },
      listDeals: async () => [
        {
          ID: "D_CONTACT_TARGET",
          CONTACT_ID: "4964",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-01T00:00:00.000Z",
          DATE_MODIFY: "2026-04-08T10:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "11",
          STAGE_ID: "C11:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: 1000,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listContacts: async (input: {
        ids: string[];
        customFieldNames?: string[];
      }) => {
        expect(input.ids).toEqual(["4964"]);
        expect(input.customFieldNames).toEqual([
          "UF_CRM_1712252375",
          "UF_CRM_1691070302"
        ]);
        return [
          {
            ID: "4964",
            UF_CRM_1712252375: "140488",
            UF_CRM_1691070302: "4986"
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      contactTargetGroupFieldName: "UF_CRM_1712252375",
      legacyContactTargetGroupFieldName: "UF_CRM_1691070302",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_CONTACT_TARGET",
          targetGroupValue: "ClubFirst Russia"
        })
      ]
    ]);
  });

  it("drops unresolved raw Bitrix target-group ids instead of leaking them into snapshots", async () => {
    const storedDeals: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-07T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 20,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (
          fieldName === "UF_CRM_1647422744" ||
          fieldName === "UF_CRM_1776949411825" ||
          fieldName === "UF_CRM_1772109151192"
        ) {
          return {};
        }

        throw new Error(`Unexpected deal field map request: ${fieldName}`);
      },
      fetchContactFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1691070302") {
          return {
            "4734": "ClubFirst Russia",
            "4986": "ClubFirst Ladies"
          };
        }

        throw new Error(`Unexpected contact field map request: ${fieldName}`);
      },
      listDeals: async () => [
        {
          ID: "D_CONTACT_TARGET_UNKNOWN",
          CONTACT_ID: "4508",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-01T00:00:00.000Z",
          DATE_MODIFY: "2026-04-08T10:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "11",
          STAGE_ID: "C11:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: 1000,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listContacts: async () => [
        {
          ID: "4508",
          UF_CRM_1712252375: "395454",
          UF_CRM_1691070302: null
        }
      ],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      contactTargetGroupFieldName: "UF_CRM_1712252375",
      legacyContactTargetGroupFieldName: "UF_CRM_1691070302",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_CONTACT_TARGET_UNKNOWN",
          targetGroupValue: null
        })
      ]
    ]);
  });

  it("falls back to full backfill when no successful cursor exists", async () => {
    const repo = {
      getLatestSuccessCursor: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return null;
      },
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 1,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const cursors: Array<string | null> = [];
    const client = {
      fetchDealStages: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return [];
      },
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null; categoryIds: string[] }) => {
        cursors.push(cursor.modifiedAfter);
        if (cursor.categoryIds[0] === "28") {
          return [];
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        return [];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(cursors).toEqual([null]);
    expect(result.mode).toBe("full");
  });

  it("prefers the shared attraction loss reason field without fetching linked leadgen deals", async () => {
    const storedDeals: unknown[][] = [];
    const dealRequests: Array<{ categoryIds: string[]; customFieldNames?: string[] }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-07T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 18,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:LOSE",
          name: "Корзина",
          semanticId: "F",
          sortOrder: 90
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:RETURN",
          name: "Возврат в Лидген(неквал)",
          semanticId: "F",
          sortOrder: 100
        }
      ],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1647422744") {
          return { "182": "Общая причина" };
        }

        if (fieldName === "UF_CRM_1776949411825") {
          return { "301": "Не соответствует критериям" };
        }

        if (fieldName === "UF_CRM_1772109151192") {
          return { "401": "Перестал выходить на связь" };
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        dealRequests.push(
          cursor.customFieldNames
            ? {
                categoryIds: cursor.categoryIds,
                customFieldNames: cursor.customFieldNames
              }
            : {
                categoryIds: cursor.categoryIds
              }
        );

        if (cursor.categoryIds[0] === "10") {
          return [
            {
              ID: "A_LOSE",
              LEAD_ID: null,
              DATE_CREATE: "2026-03-20T10:00:00.000Z",
              DATE_MODIFY: "2026-04-08T10:00:00.000Z",
              DATE_CLOSED: "2026-04-08T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:LOSE",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1647422744: "182",
              UF_CRM_1647422890: "Общая детализация",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            },
            {
              ID: "A_RETURN",
              LEAD_ID: null,
              DATE_CREATE: "2026-03-21T10:00:00.000Z",
              DATE_MODIFY: "2026-04-09T10:00:00.000Z",
              DATE_CLOSED: "2026-04-09T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:RETURN",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1647422744: "182",
              UF_CRM_1647422890: "Общая детализация",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            }
          ];
        }

        expect(cursor.categoryIds).toEqual(["28"]);
        expect(cursor.customFieldNames).toEqual([
          "UF_CRM_1730360968",
          "UF_CRM_1647422890",
          "UF_CRM_1776949411825",
          "UF_CRM_1772109151192"
        ]);

        return [
          {
            ID: "L1",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-19T10:00:00.000Z",
            DATE_MODIFY: "2026-04-08T09:00:00.000Z",
            DATE_CLOSED: "2026-04-08T09:00:00.000Z",
            CATEGORY_ID: "28",
            STAGE_ID: "C28:LOSE",
            STAGE_SEMANTIC_ID: "F",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1730360968: "A_LOSE",
            UF_CRM_1647422890: "Деталь корзины",
            UF_CRM_1772109151192: "401",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          },
          {
            ID: "L2",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-20T10:00:00.000Z",
            DATE_MODIFY: "2026-04-09T09:00:00.000Z",
            DATE_CLOSED: "2026-04-09T09:00:00.000Z",
            CATEGORY_ID: "28",
            STAGE_ID: "C28:LOSE",
            STAGE_SEMANTIC_ID: "F",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1730360968: "A_RETURN",
            UF_CRM_1647422890: "Деталь неквала",
            UF_CRM_1758715585: "301",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(dealRequests).toEqual([
      expect.objectContaining({
        categoryIds: ["10"],
        customFieldNames: expect.arrayContaining([
          "UF_CRM_1730380390",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890",
          "UF_CRM_1776949411825",
          "UF_CRM_1772109151192"
        ])
      })
    ]);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "A_LOSE",
          refusalReasonValue: "Общая причина",
          refusalReasonDetail: "Общая детализация"
        }),
        expect.objectContaining({
          id: "A_RETURN",
          refusalReasonValue: "Общая причина",
          refusalReasonDetail: "Общая детализация"
        })
      ]
    ]);
  });

  it("resolves attraction basket and confirmed return loss reasons from attraction dictionaries without leadgen lookup", async () => {
    const storedDeals: unknown[][] = [];
    const dealRequests: Array<{ categoryIds: string[]; customFieldNames?: string[] }> = [];
    const fieldMapRequests: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => null,
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () => null,
      getSnapshotStats: async () => ({
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 66,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      setSyncCursor: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:LOSE",
          name: "Корзина",
          semanticId: "F",
          sortOrder: 90
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:UC_EA3R76",
          name: "Возврат в Лидген(неквал)",
          semanticId: "F",
          sortOrder: 100
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Сайт",
          semanticId: null,
          sortOrder: 10
        }
      ],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        fieldMapRequests.push(fieldName);
        if (fieldName === "UF_CRM_1647422744") {
          return {};
        }

        if (fieldName === "UF_CRM_1776949411825") {
          return { "901": "Возврат: санитарная причина" };
        }

        if (fieldName === "UF_CRM_1772109151192") {
          return { "401": "Перестал выходить на связь" };
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        dealRequests.push({
          categoryIds: cursor.categoryIds,
          ...(cursor.customFieldNames
            ? { customFieldNames: cursor.customFieldNames }
            : {})
        });

        if (cursor.categoryIds[0] === "10") {
          return [
            {
              ID: "A_LOSE",
              LEAD_ID: null,
              DATE_CREATE: "2026-05-08T10:00:00.000Z",
              DATE_MODIFY: "2026-05-08T10:00:00.000Z",
              DATE_CLOSED: "2026-05-08T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:LOSE",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1772109151192: "401",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            },
            {
              ID: "156080",
              LEAD_ID: null,
              DATE_CREATE: "2026-05-09T10:00:00.000Z",
              DATE_MODIFY: "2026-05-09T10:00:00.000Z",
              DATE_CLOSED: "2026-05-09T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:UC_EA3R76",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1776949411825: "901",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            },
            {
              ID: "156184",
              LEAD_ID: null,
              DATE_CREATE: "2026-05-10T10:00:00.000Z",
              DATE_MODIFY: "2026-05-10T10:00:00.000Z",
              DATE_CLOSED: "2026-05-10T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:UC_EA3R76",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1776949411825: "901",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            },
            {
              ID: "156194",
              LEAD_ID: null,
              DATE_CREATE: "2026-05-11T10:00:00.000Z",
              DATE_MODIFY: "2026-05-11T10:00:00.000Z",
              DATE_CLOSED: "2026-05-11T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:UC_EA3R76",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1776949411825: "901",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            },
            {
              ID: "156306",
              LEAD_ID: null,
              DATE_CREATE: "2026-05-12T10:00:00.000Z",
              DATE_MODIFY: "2026-05-12T10:00:00.000Z",
              DATE_CLOSED: "2026-05-12T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:UC_EA3R76",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1776949411825: "901",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            }
          ];
        }

        throw new Error(`Unexpected deal category request: ${cursor.categoryIds.join(",")}`);
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-10T00:00:00.000Z"
    });

    expect(dealRequests.map((request) => request.categoryIds)).toEqual([
      ["10"]
    ]);
    expect(dealRequests[0]?.customFieldNames).toEqual(expect.arrayContaining([
      "UF_CRM_1730380390",
      "UF_CRM_1647422744",
      "UF_CRM_1647422890",
      "UF_CRM_1776949411825",
      "UF_CRM_1772109151192"
    ]));
    expect(fieldMapRequests).toEqual(expect.arrayContaining([
      "UF_CRM_1647422744",
      "UF_CRM_1776949411825",
      "UF_CRM_1772109151192"
    ]));
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "A_LOSE",
          categoryId: "10",
          refusalReasonValue: "Перестал выходить на связь"
        }),
        expect.objectContaining({
          id: "156080",
          categoryId: "10",
          refusalReasonValue: "Возврат: санитарная причина"
        }),
        expect.objectContaining({
          id: "156184",
          categoryId: "10",
          refusalReasonValue: "Возврат: санитарная причина"
        }),
        expect.objectContaining({
          id: "156194",
          categoryId: "10",
          refusalReasonValue: "Возврат: санитарная причина"
        }),
        expect.objectContaining({
          id: "156306",
          categoryId: "10",
          refusalReasonValue: "Возврат: санитарная причина"
        })
      ]
    ]);

    const report = buildAcquisitionOutcomesReport({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      },
      deals: storedDeals[0] as Parameters<typeof buildAcquisitionOutcomesReport>[0]["deals"],
      stageCatalog: [
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
      managerDirectory: [{ id: "78", name: "Егоров Андрей" }]
    });

    expect(report.topLossReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stageId: "C10:UC_EA3R76",
          stageName: "Возврат в Лидген(неквал)",
          reasonLabel: "Возврат: санитарная причина",
          count: 4
        }),
        expect.objectContaining({
          stageId: "C10:LOSE",
          stageName: "Корзина",
          reasonLabel: "Перестал выходить на связь",
          count: 1
        })
      ])
    );
  });

  it("bootstraps the full operational history once even during a delta deal sync", async () => {
    const activitySyncCursors: Array<string | null> = [];
    const bootstrapMarks: string[] = [];
    const repo = {
      getLatestSuccessCursor: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return "2026-04-10T00:00:00.000Z";
      },
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-10T00:00:00.000Z",
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 1,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 1,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 1,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 33,
      markOperationalHistoryBootstrapped: async (timestamp: string) => {
        bootstrapMarks.push(timestamp);
      },
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null; categoryIds: string[] }) => {
        expect(cursor.modifiedAfter).toBe("2026-04-10T00:00:00.000Z");
        if (cursor.categoryIds[0] === "28") {
          return [];
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        return [
          {
            ID: "D1",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-11T00:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activitySyncCursors.push(input.modifiedAfter);
        return [
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D1",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "7",
            CREATED: "2026-03-03T10:30:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-03-03T10:32:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-03-03T10:32:00.000Z"
          }
        ];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        expect(input.activityIds).toEqual(["A1"]);
        return [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "A1",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-03-03T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async () => [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
      ]
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activitySyncCursors).toEqual([null]);
    expect(bootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
    expect(result).toMatchObject({
      syncRunId: 33,
      leadsSynced: 0,
      dealsSynced: 1,
      mode: "delta",
      modifiedAfter: "2026-04-10T00:00:00.000Z",
      finishedAt: "2026-04-13T09:00:00.000Z"
    });
    expect(result.changes).toEqual({
      deals: 1,
      dealBreakdown: {
        total: 1,
        created: 1,
        updated: 0,
        closed: 0,
        reopened: 0,
        unchanged: 0
      },
      activities: 1,
      calls: 1,
      stageHistory: 0,
      managers: 1
    });
  });

  it("backfills historical call activities before the regular delta activity sync", async () => {
    const activityRequests: Array<{
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const callRequests: Array<{
      activityIds?: string[];
    }> = [];
    let stageHistoryCalls = 0;
    const storedActivities: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const callBootstrapMarks: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => null,
      getCallActivityHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 44,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async (timestamp: string) => {
        callBootstrapMarks.push(timestamp);
      },
      markCallActivityHistoryBootstrapped: async (timestamp: string) => {
        callBootstrapMarks.push(`v2:${timestamp}`);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => {
        stageHistoryCalls += 1;
        return [];
      },
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activityRequests.push(
          input.providerId
            ? {
                modifiedAfter: input.modifiedAfter,
                providerId: input.providerId
              }
            : {
                modifiedAfter: input.modifiedAfter
              }
        );

        if (
          input.providerId === "VOXIMPLANT_CALL" &&
          input.modifiedAfter === null
        ) {
          return [
            {
              ID: "A_CALL",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "2",
              PROVIDER_ID: "VOXIMPLANT_CALL",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-03T10:30:00.000Z",
              DEADLINE: null,
              LAST_UPDATED: "2026-03-03T10:32:00.000Z",
              COMPLETED: "Y",
              COMPLETED_DATE: "2026-03-03T10:32:00.000Z"
            }
          ];
        }

        return [];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        callRequests.push({ activityIds: input.activityIds ?? [] });
        if (!input.activityIds || input.activityIds.length === 0) {
          return [];
        }

        expect(input.activityIds).toEqual(["A_CALL"]);
        return [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "A_CALL",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-03-03T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async () => [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
      ]
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      { modifiedAfter: null, providerId: "VOXIMPLANT_CALL" },
      {
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      }
    ]);
    expect(callRequests).toEqual([{ activityIds: ["A_CALL"] }]);
    expect(stageHistoryCalls).toBe(1);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_CALL",
        providerId: "VOXIMPLANT_CALL",
        ownerId: "D1"
      })
    ]);
    expect(storedCalls[0]).toEqual([
      expect.objectContaining({
        id: "CALL1",
        crmActivityId: "A_CALL"
      })
    ]);
    expect(callBootstrapMarks).toEqual([
      "2026-04-13T09:00:00.000Z",
      "v2:2026-04-13T09:00:00.000Z"
    ]);
  });

  it("hydrates missing deal-owned call activities for existing call snapshots", async () => {
    const missingActivityRequests: string[][] = [];
    const storedActivities: unknown[][] = [];
    const listCallRequests: Array<{ activityIds?: string[] }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async (activityIds: string[]) => {
        expect(activityIds).toEqual(["A_MISSING_CALL"]);
        return [];
      },
      getCallActivityIdsMissingActivities: async () => ["A_MISSING_CALL"],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 46,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listActivitiesByIds: async (activityIds: string[]) => {
        missingActivityRequests.push(activityIds);
        return [
          {
            ID: "A_MISSING_CALL",
            OWNER_TYPE_ID: 2 as unknown as string,
            OWNER_ID: "D1",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: 7 as unknown as string,
            CREATED: "2026-03-03T10:30:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-03-03T10:32:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-03-03T10:32:00.000Z"
          }
        ];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        listCallRequests.push({ activityIds: input.activityIds ?? [] });
        return [
          {
            ID: "CALL_MISSING",
            CRM_ACTIVITY_ID: "A_MISSING_CALL",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-03-03T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async (input: { ids: string[] }) => {
        expect(input.ids).toEqual(["7"]);
        return [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
        ];
      }
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(missingActivityRequests).toEqual([["A_MISSING_CALL"]]);
    expect(listCallRequests).toEqual([{ activityIds: ["A_MISSING_CALL"] }]);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_MISSING_CALL",
        providerId: "VOXIMPLANT_CALL",
        ownerTypeId: "2",
        ownerId: "D1",
        responsibleId: "7"
      })
    ]);
  });

  it("backfills historical meeting activities once via CRM_MEETING provider", async () => {
    const activityRequests: Array<{
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const meetingBootstrapMarks: string[] = [];
    const storedActivities: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 45,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async (timestamp: string) => {
        meetingBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activityRequests.push(
          input.providerId
            ? {
                modifiedAfter: input.modifiedAfter,
                providerId: input.providerId
              }
            : {
                modifiedAfter: input.modifiedAfter
              }
        );

        if (
          input.providerId === "CRM_MEETING" &&
          input.modifiedAfter === null
        ) {
          return [
            {
              ID: "A_MEETING",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "1",
              PROVIDER_ID: "CRM_MEETING",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-17T10:00:00.000Z",
              DEADLINE: "2026-03-18T16:00:00.000Z",
              LAST_UPDATED: "2026-03-17T10:00:00.000Z",
              COMPLETED: "N"
            }
          ];
        }

        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      {
        modifiedAfter: null,
        providerId: "CRM_MEETING"
      },
      {
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      }
    ]);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_MEETING",
        providerId: "CRM_MEETING",
        typeId: "1",
        ownerId: "D1",
        deadline: "2026-03-18T16:00:00.000Z"
      })
    ]);
    expect(meetingBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("backfills historical task activities once via CRM task providers", async () => {
    const activityRequests: Array<{
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const taskBootstrapMarks: string[] = [];
    const storedActivities: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 47,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async (timestamp: string) => {
        taskBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activityRequests.push(
          input.providerId
            ? {
                modifiedAfter: input.modifiedAfter,
                providerId: input.providerId
              }
            : {
                modifiedAfter: input.modifiedAfter
              }
        );

        if (input.providerId === "CRM_TODO" && input.modifiedAfter === null) {
          return [
            {
              ID: "A_TODO",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "6",
              PROVIDER_ID: "CRM_TODO",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-10T10:00:00.000Z",
              DEADLINE: "2026-03-11T10:00:00.000Z",
              LAST_UPDATED: "2026-03-10T10:00:00.000Z",
              COMPLETED: "N"
            }
          ];
        }

        if (
          input.providerId === "CRM_TASKS_TASK" &&
          input.modifiedAfter === null
        ) {
          return [
            {
              ID: "A_TASK",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "6",
              PROVIDER_ID: "CRM_TASKS_TASK",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-12T10:00:00.000Z",
              DEADLINE: "2026-03-13T10:00:00.000Z",
              LAST_UPDATED: "2026-03-12T10:00:00.000Z",
              COMPLETED: "Y",
              COMPLETED_DATE: "2026-03-12T12:00:00.000Z"
            }
          ];
        }

        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
      ]
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      {
        modifiedAfter: null,
        providerId: "CRM_TODO"
      },
      {
        modifiedAfter: null,
        providerId: "CRM_TASKS_TASK"
      },
      {
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      }
    ]);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_TODO",
        providerId: "CRM_TODO",
        ownerId: "D1"
      }),
      expect.objectContaining({
        id: "A_TASK",
        providerId: "CRM_TASKS_TASK",
        ownerId: "D1"
      })
    ]);
    expect(taskBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("backfills deal custom fields once even when a delta cursor exists", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const customFieldBootstrapMarks: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 1,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 48,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async (timestamp: string) => {
        customFieldBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1747682957") {
          return { "5844": "ClubFirst One" };
        }

        if (fieldName === "UF_CRM_1669784114991") {
          return { "3868": "Мероприятие" };
        }

        if (fieldName === "UF_CRM_1647422744") {
          return {};
        }

        if (
          fieldName === "UF_CRM_1776949411825" ||
          fieldName === "UF_CRM_1772109151192"
        ) {
          return {};
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        expect(cursor.categoryIds).toEqual(["11"]);
        expect(cursor.customFieldNames).toEqual(expect.arrayContaining([
          "UF_CRM_1730380390",
          "UF_CRM_1747682957",
          "UF_CRM_1669784114991",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890",
          "UF_CRM_1776949411825",
          "UF_CRM_1772109151192"
        ]));

        return [
          {
            ID: "D_OLD",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-01T00:00:00.000Z",
            DATE_MODIFY: "2026-03-15T00:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "11",
            STAGE_ID: "C11:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1747682957: "5844",
            UF_CRM_1669784114991: "3868",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      businessClubFieldName: "UF_CRM_1747682957",
      meetingTypeFieldName: "UF_CRM_1669784114991",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(dealSyncCursors).toEqual([null]);
    expect(customFieldBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("backfills the meeting date deal field even after generic custom fields were bootstrapped", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const meetingDateBootstrapMarks: string[] = [];
    const storedDeals: unknown[][] = [];
    const storedMeetingDateChanges: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getDealMeetingDateFieldBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => [],
      getDealsByIds: async () => [
        {
          id: "D_MEETING_DATE",
          leadId: null,
          categoryId: "11",
          stageId: "C11:NEW",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          meetingDateValue: "2026-03-11T13:00:00+03:00",
          meetingSlots: [
            {
              index: 1 as const,
              dateValue: "2026-03-11T13:00:00+03:00",
              typeValue: null,
              placeValue: null,
              calendarValue: null,
              eventId: null,
              source: "deal_fields" as const
            },
            {
              index: 2 as const,
              dateValue: "2026-03-12T13:00:00+03:00",
              typeValue: "Zoom",
              placeValue: null,
              calendarValue: null,
              eventId: null,
              source: "deal_fields" as const
            }
          ],
          dateCreate: "2026-03-01T00:00:00.000Z",
          dateModify: "2026-03-14T00:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertDealMeetingDateChanges: async (rows: unknown[]) => {
        storedMeetingDateChanges.push(rows);
        return rows.length;
      },
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 49,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      markDealMeetingDateFieldBootstrapped: async (timestamp: string) => {
        meetingDateBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (
          fieldName === "UF_CRM_1647422744" ||
          fieldName === "UF_CRM_1776949411825" ||
          fieldName === "UF_CRM_1772109151192"
        ) {
          return {};
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        expect(cursor.categoryIds).toEqual(["11"]);
        expect(cursor.customFieldNames).toEqual(expect.arrayContaining([
          "UF_CRM_1730380390",
          "UF_CRM_MEETING_DATE",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890",
          "UF_CRM_1776949411825",
          "UF_CRM_1772109151192"
        ]));

        return [
          {
            ID: "D_MEETING_DATE",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-01T00:00:00.000Z",
            DATE_MODIFY: "2026-03-15T00:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "11",
            STAGE_ID: "C11:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_MEETING_DATE: "2026-03-13T13:00:00+03:00",
            UF_CRM_MEET2_DT: "2026-03-16T13:00:00+03:00",
            UF_CRM_DEAL_MEET2_KIND: "Zoom",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(dealSyncCursors).toEqual([null]);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_MEETING_DATE",
          meetingDateValue: "2026-03-13T13:00:00+03:00",
          meetingSlots: [
            expect.objectContaining({
              index: 1,
              dateValue: "2026-03-13T13:00:00+03:00"
            }),
            expect.objectContaining({
              index: 2,
              dateValue: "2026-03-16T13:00:00+03:00"
            })
          ]
        })
      ]
    ]);
    expect(storedMeetingDateChanges).toEqual([
      [
        expect.objectContaining({
          dealId: "D_MEETING_DATE",
          slotIndex: 1,
          previousMeetingDate: "2026-03-11T13:00:00+03:00",
          nextMeetingDate: "2026-03-13T13:00:00+03:00",
          changedAt: "2026-03-15T00:00:00.000Z"
        }),
        expect.objectContaining({
          dealId: "D_MEETING_DATE",
          slotIndex: 2,
          previousMeetingDate: "2026-03-12T13:00:00+03:00",
          nextMeetingDate: "2026-03-16T13:00:00+03:00",
          changedAt: "2026-03-15T00:00:00.000Z"
        })
      ]
    ]);
    expect(meetingDateBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("reopens deal field backfill when stored field coverage is narrower than the required lookback", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "deal_custom_fields" &&
        input.stream !== "deal_meeting_date_field",
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealMeetingDateFieldBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 50,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      markDealMeetingDateFieldBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        return [];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      businessClubFieldName: "UF_CRM_1747682957",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(dealSyncCursors).toContain("2025-04-25T00:00:00.000Z");
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "deal_custom_fields",
          providerId: "all",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "deal_meeting_date_field",
          providerId: "UF_CRM_MEETING_DATE",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        })
      ])
    );
  });

  it("reopens deal custom-field backfill when meeting-slot fields change coverage version", async () => {
    expect(DEAL_CUSTOM_FIELDS_COVERAGE_VERSION).toBe("deal-custom-fields-v6");

    const dealRequests: Array<{
      modifiedAfter: string | null;
      customFieldNames?: string[];
    }> = [];
    const coverageChecks: Array<{
      stream: string;
      providerId: string | null;
      algorithmVersion: string;
    }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
      algorithmVersion: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        algorithmVersion: string;
      }) => {
        coverageChecks.push(input);
        return input.stream !== "deal_custom_fields";
      },
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
        algorithmVersion: string;
      }) => {
        coverageWrites.push(input);
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealMeetingDateFieldBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 51,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      markDealMeetingDateFieldBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        customFieldNames?: string[];
      }) => {
        dealRequests.push(cursor);
        return [];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      meetingTypeFieldName: "UF_CRM_MEET_KIND",
      meetingDateFieldName: "UF_CRM_MEET_DT",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(coverageChecks).toContainEqual(
      expect.objectContaining({
        stream: "deal_custom_fields",
        providerId: "all",
        algorithmVersion: "deal-custom-fields-v6"
      })
    );
    expect(dealRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modifiedAfter: "2025-04-25T00:00:00.000Z",
          customFieldNames: expect.arrayContaining([
            "UF_CRM_MEET2_DT",
            "UF_CRM_DEAL_MEET2_KIND",
            "UF_CRM_MEET3_DT",
            "UF_CRM_DEAL_MEET3_KIND"
          ])
        })
      ])
    );
    expect(coverageWrites).toContainEqual(
      expect.objectContaining({
        stream: "deal_custom_fields",
        providerId: "all",
        coveredFrom: "2025-04-25T00:00:00.000Z",
        algorithmVersion: "deal-custom-fields-v6"
      })
    );
  });

  it("backfills missing activity history coverage during delta sync", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const activityRequests: Array<{ modifiedAfter: string | null; providerId?: string }> = [];
    const callRequests: Array<{
      activityIds?: string[];
      callStartDateFrom?: string;
      portalUserIds?: string[];
    }> = [];
    const stageHistoryRequests: Array<{ ownerIds?: string[] }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T13:20:59+03:00",
      getSyncCursor: async () => null,
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => false,
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getSnapshotStats: async () => ({
        deals: 3600,
        activities: 3611,
        calls: 1771,
        stageHistory: 12527
      }),
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-17T10:18:05.677Z",
      getCallActivityHistoryBootstrappedAt: async () => null,
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-19T21:29:03.426Z",
      getTaskActivityHistoryBootstrappedAt: async () => null,
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-22T19:23:32.265Z",
      getDealMeetingDateFieldBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 3611,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async () => ["A_OLD_CALL"],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 57,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      markDealMeetingDateFieldBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        return [];
      },
      listStageHistory: async (input: { ownerIds?: string[] }) => {
        stageHistoryRequests.push(input);
        return [];
      },
      listActivities: async (input: {
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.providerId ? { providerId: input.providerId } : {})
        });
        return [];
      },
      listCalls: async (input: {
        activityIds?: string[];
        callStartDateFrom?: string;
        portalUserIds?: string[];
      }) => {
        callRequests.push(input);
        return [];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      businessClubFieldName: "UF_CRM_1747682957",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(dealSyncCursors).toEqual(["2025-04-25T00:00:00.000Z"]);
    expect(activityRequests).toEqual(
      expect.arrayContaining([
        {
          modifiedAfter: "2026-04-24T13:20:59+03:00"
        },
        {
          modifiedAfter: "2025-04-25T00:00:00.000Z",
          providerId: "CRM_TODO"
        },
        {
          modifiedAfter: "2025-04-25T00:00:00.000Z",
          providerId: "CRM_TASKS_TASK"
        },
        {
          modifiedAfter: "2025-04-25T00:00:00.000Z",
          providerId: "VOXIMPLANT_CALL"
        },
        {
          modifiedAfter: "2025-04-25T00:00:00.000Z",
          providerId: "CRM_MEETING"
        }
      ])
    );
    expect(activityRequests).toHaveLength(5);
    expect(callRequests).toEqual([
      {
        callStartDateFrom: "2025-04-25T00:00:00.000Z",
        callStartDateTo: "2026-04-25T00:00:00.000Z",
        portalUserIds: defaultAttractionManagerIds
      }
    ]);
    expect(stageHistoryRequests).toEqual([]);
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "deal_custom_fields",
          providerId: "all",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "activity_history",
          providerId: "VOXIMPLANT_CALL",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "call_stats",
          providerId: "VOXIMPLANT_CALL",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        })
      ])
    );
  });

  it("uses the initial operational activity backfill as provider coverage on an empty snapshot", async () => {
    const activityRequests: Array<{ modifiedAfter: string | null; providerId?: string }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const providerBootstrapMarks: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => null,
      getSyncCursor: async () => null,
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => false,
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () => null,
      getCallActivityHistoryBootstrappedAt: async () => null,
      getMeetingActivityHistoryBootstrappedAt: async () => null,
      getTaskActivityHistoryBootstrappedAt: async () => null,
      getDealCustomFieldsBootstrappedAt: async () => "2026-04-20T00:00:00.000Z",
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 1,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 1,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 58,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async (timestamp: string) => {
        providerBootstrapMarks.push(`call:${timestamp}`);
      },
      markMeetingActivityHistoryBootstrapped: async (timestamp: string) => {
        providerBootstrapMarks.push(`meeting:${timestamp}`);
      },
      markTaskActivityHistoryBootstrapped: async (timestamp: string) => {
        providerBootstrapMarks.push(`task:${timestamp}`);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [
        {
          ID: "D1",
          LEAD_ID: null,
          DATE_CREATE: "2026-03-01T00:00:00.000Z",
          DATE_MODIFY: "2026-04-11T00:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listStageHistory: async () => [],
      listActivities: async (input: {
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.providerId ? { providerId: input.providerId } : {})
        });
        return [
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D1",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "78",
            CREATED: "2026-03-03T10:30:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-03-03T10:32:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-03-03T10:32:00.000Z"
          }
        ];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      {
        modifiedAfter: "2025-04-25T00:00:00.000Z"
      }
    ]);
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "activity_history",
          providerId: "VOXIMPLANT_CALL",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "activity_history",
          providerId: "CRM_MEETING",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "activity_history",
          providerId: "CRM_TODO",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "activity_history",
          providerId: "CRM_TASKS_TASK",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        })
      ])
    );
    expect(providerBootstrapMarks).toEqual([
      "call:2026-04-25T00:00:00.000Z",
      "meeting:2026-04-25T00:00:00.000Z",
      "task:2026-04-25T00:00:00.000Z"
    ]);
  });

  it("uses open deals for refresh but includes changed closed deals in activity delta sync", async () => {
    const activityOwnerRequests: string[][] = [];
    const stageHistoryOwnerRequests: string[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 3,
        activities: 2,
        calls: 1,
        stageHistory: 2
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 2,
      getDealIdsByCategoryIds: async () => [
        "D_STILL_OPEN",
        "D_NOW_CLOSED"
      ],
      getOpenDealIdsByCategoryIds: async () => [
        "D_STILL_OPEN",
        "D_NOW_CLOSED"
      ],
      getDealsByIds: async () => [
        {
          id: "D_NOW_CLOSED",
          title: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:IN_PROGRESS",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-20T00:00:00.000Z",
          dateModify: "2026-04-24T00:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 58,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [
        {
          ID: "D_NOW_CLOSED",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-20T00:00:00.000Z",
          DATE_MODIFY: "2026-04-25T12:00:00.000Z",
          DATE_CLOSED: "2026-04-25T12:00:00.000Z",
          CATEGORY_ID: "10",
          STAGE_ID: "C10:LOSE",
          STAGE_SEMANTIC_ID: "F",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        },
        {
          ID: "D_NEW_OPEN",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-25T10:00:00.000Z",
          DATE_MODIFY: "2026-04-25T12:30:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listStageHistory: async (input: { ownerIds?: string[] }) => {
        stageHistoryOwnerRequests.push(input.ownerIds ?? []);
        return [];
      },
      listActivities: async (input: { ownerIds: string[] }) => {
        activityOwnerRequests.push(input.ownerIds);
        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(activityOwnerRequests).toEqual([
      ["D_STILL_OPEN", "D_NOW_CLOSED", "D_NEW_OPEN"]
    ]);
    expect(stageHistoryOwnerRequests).toEqual([
      ["D_NOW_CLOSED", "D_NEW_OPEN"]
    ]);
  });

  it("refreshes all call statistics in the lookback when call-stat coverage is missing", async () => {
    const requestedCallInputs: Array<{
      activityIds?: string[];
      callStartDateFrom?: string;
      portalUserIds?: string[];
    }> = [];
    const storedCalls: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
	      hasSyncCoverage: async (input: { stream: string }) =>
	        input.stream !== "call_stats",
	      upsertSyncCoverage: async () => undefined,
	      getSnapshotStats: async () => ({
	        deals: 1,
	        activities: 1,
	        calls: 1,
	        stageHistory: 1
	      }),
	      getOperationalHistoryBootstrappedAt: async () =>
	        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => ["D1", "D_CLOSED"],
      getOpenDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async (activityIds: string[]) =>
        [
          ...(activityIds.includes("A_EXISTING_CONTACT_CALL")
            ? [
                {
                  id: "A_EXISTING_CONTACT_CALL",
                  ownerTypeId: "2",
                  ownerId: "D1",
                  typeId: "6",
                  providerId: "VOXIMPLANT_CALL",
                  responsibleId: "78",
                  createdTime: "2026-04-21T12:00:00.000Z",
                  deadline: null,
                  lastUpdated: "2026-04-21T12:00:00.000Z",
                  completed: true,
                  completedTime: "2026-04-21T12:00:00.000Z"
                }
              ]
            : []),
          ...(activityIds.includes("A_CLOSED_CONTACT_CALL")
            ? [
                {
                  id: "A_CLOSED_CONTACT_CALL",
                  ownerTypeId: "2",
                  ownerId: "D_CLOSED",
                  typeId: "6",
                  providerId: "VOXIMPLANT_CALL",
                  responsibleId: "78",
                  createdTime: "2026-04-22T12:00:00.000Z",
                  deadline: null,
                  lastUpdated: "2026-04-22T12:00:00.000Z",
                  completed: true,
                  completedTime: "2026-04-22T12:00:00.000Z"
                }
              ]
            : [])
        ],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async (
        _limit: number,
        _activityCreatedFrom: string | null,
        ownerIds: string[]
      ) => {
        expect(ownerIds).toEqual(["D1", "D_CLOSED"]);
        return ["A_CALL_PARTIAL"];
      },
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 51,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async (input: {
        activityIds?: string[];
        callStartDateFrom?: string;
        portalUserIds?: string[];
      }) => {
        requestedCallInputs.push(input);
        if (input.activityIds) {
          return [
            {
              ID: "CALL_1",
              CRM_ACTIVITY_ID: "A_CALL_PARTIAL",
              PORTAL_USER_ID: "78",
              CALL_TYPE: "1",
              CALL_START_DATE: "2026-04-20T10:00:00.000Z",
              CALL_DURATION: 60,
              CRM_ENTITY_TYPE: "DEAL",
              CRM_ENTITY_ID: "D1",
              CALL_FAILED_CODE: "200"
            },
            {
              ID: "CALL_2",
              CRM_ACTIVITY_ID: "A_CALL_PARTIAL",
              PORTAL_USER_ID: "78",
              CALL_TYPE: "1",
              CALL_START_DATE: "2026-04-20T11:00:00.000Z",
              CALL_DURATION: 45,
              CRM_ENTITY_TYPE: "DEAL",
              CRM_ENTITY_ID: "D1",
              CALL_FAILED_CODE: "200"
            }
          ];
        }

	        return [
	          {
	            ID: "CALL_1",
	            CRM_ACTIVITY_ID: "A_CALL_PARTIAL",
	            PORTAL_USER_ID: "78",
	            CALL_TYPE: "1",
	            CALL_START_DATE: "2026-04-20T10:00:00.000Z",
	            CALL_DURATION: 60,
	            CRM_ENTITY_TYPE: "DEAL",
	            CRM_ENTITY_ID: "D1",
	            CALL_FAILED_CODE: "200"
	          },
	          {
	            ID: "CALL_2",
	            CRM_ACTIVITY_ID: "A_CALL_PARTIAL",
	            PORTAL_USER_ID: "78",
	            CALL_TYPE: "1",
	            CALL_START_DATE: "2026-04-20T11:00:00.000Z",
	            CALL_DURATION: 45,
	            CRM_ENTITY_TYPE: "DEAL",
	            CRM_ENTITY_ID: "D1",
	            CALL_FAILED_CODE: "200"
	          },
	          {
	            ID: "CALL_SUPPLEMENTAL_DIRECT_DEAL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-21T10:00:00.000Z",
            CALL_DURATION: 30,
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CONTACT_LEVEL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-21T11:00:00.000Z",
            CALL_DURATION: 15,
            CRM_ENTITY_TYPE: "CONTACT",
            CRM_ENTITY_ID: "C1",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CONTACT_ACTIVITY",
            CRM_ACTIVITY_ID: "A_EXISTING_CONTACT_CALL",
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-21T12:00:00.000Z",
            CALL_DURATION: 50,
            CRM_ENTITY_TYPE: "CONTACT",
            CRM_ENTITY_ID: "C1",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CLOSED_DIRECT_DEAL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-22T10:00:00.000Z",
            CALL_DURATION: 35,
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D_CLOSED",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CLOSED_CONTACT_ACTIVITY",
            CRM_ACTIVITY_ID: "A_CLOSED_CONTACT_CALL",
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-22T12:00:00.000Z",
            CALL_DURATION: 55,
            CRM_ENTITY_TYPE: "CONTACT",
            CRM_ENTITY_ID: "C2",
            CALL_FAILED_CODE: "200"
          }
        ];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(requestedCallInputs).toEqual([
      expect.objectContaining({
        callStartDateFrom: "2025-04-25T00:00:00.000Z",
        portalUserIds: expect.arrayContaining(defaultAttractionManagerIds)
      })
    ]);
    expect(storedCalls[0]).toEqual([
      expect.objectContaining({ id: "CALL_1", crmActivityId: "A_CALL_PARTIAL" }),
      expect.objectContaining({ id: "CALL_2", crmActivityId: "A_CALL_PARTIAL" }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_DIRECT_DEAL",
        crmActivityId: null,
        crmEntityType: "DEAL",
        crmEntityId: "D1"
      }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_CONTACT_LEVEL",
        crmActivityId: null,
        crmEntityType: "CONTACT",
        crmEntityId: "C1"
      }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_CONTACT_ACTIVITY",
        crmActivityId: "A_EXISTING_CONTACT_CALL",
        crmEntityType: "CONTACT",
        crmEntityId: "C1"
      }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_CLOSED_DIRECT_DEAL",
        crmActivityId: null,
        crmEntityType: "DEAL",
        crmEntityId: "D_CLOSED"
      }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_CLOSED_CONTACT_ACTIVITY",
        crmActivityId: "A_CLOSED_CONTACT_CALL",
        crmEntityType: "CONTACT",
        crmEntityId: "C2"
      })
    ]);
  });

  it("uses an independent activity cursor instead of the latest deal cursor", async () => {
    const dealRequests: Array<string | null> = [];
    const activityRequests: Array<{ modifiedAfter: string | null; providerId?: string }> = [];
    const storedCursors: Array<{ key: string; cursorValue: string }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-25T12:30:00.000Z",
      getSyncCursor: async (key: string) => {
        if (key === `${attractionScopeKey}:deals:date_modify`) {
          return "2026-04-25T12:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:activities:last_updated`) {
          return "2026-04-25T09:00:00.000Z";
        }

        return null;
      },
      setSyncCursor: async (input: { key: string; cursorValue: string }) => {
        storedCursors.push(input);
      },
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 1,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 1,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 55,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        dealRequests.push(cursor.modifiedAfter);
        return [
          {
            ID: "D1",
            LEAD_ID: null,
            DATE_CREATE: "2026-04-20T00:00:00.000Z",
            DATE_MODIFY: "2026-04-25T12:30:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async (input: {
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.providerId ? { providerId: input.providerId } : {})
        });

        return [
          {
            ID: "A_FRESH",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D1",
            TYPE_ID: "6",
            PROVIDER_ID: "CRM_TODO",
            RESPONSIBLE_ID: "78",
            CREATED: "2026-04-25T09:30:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-04-25T10:00:00.000Z",
            COMPLETED: "N"
          }
        ];
      },
      listCalls: async () => [],
      fetchUsers: async () => [
        {
          ID: "78",
          NAME: "Андрей",
          LAST_NAME: "Егоров"
        }
      ]
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(dealRequests).toEqual(["2026-04-25T12:00:00.000Z"]);
    expect(result.modifiedAfter).toBe("2026-04-25T12:00:00.000Z");
    expect(activityRequests).toEqual([
      {
        modifiedAfter: "2026-04-25T09:00:00.000Z"
      }
    ]);
    expect(storedCursors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `${attractionScopeKey}:deals:date_modify`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:activities:last_updated`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:call_stats:call_start_date`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        })
      ])
    );
  });

  it("advances stream cursors through empty delta windows and skips deal field metadata", async () => {
    const storedCursors: Array<{ key: string; cursorValue: string }> = [];
    const callRequests: Array<{
      callStartDateFrom?: string;
      callStartDateTo?: string;
      portalUserIds?: string[];
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-25T12:00:00.000Z",
      getSyncCursor: async (key: string) => {
        if (key === `${attractionScopeKey}:deals:date_modify`) {
          return "2026-04-25T12:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:activities:last_updated`) {
          return "2026-04-25T11:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:call_stats:call_start_date`) {
          return "2026-04-25T10:00:00.000Z";
        }

        return null;
      },
      setSyncCursor: async (input: { key: string; cursorValue: string }) => {
        storedCursors.push(input);
      },
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 1,
        stageHistory: 1
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 59,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => {
        throw new Error("deal field maps should not be fetched for empty delta");
      },
      fetchDealFieldValueMap: async () => {
        throw new Error("deal field maps should not be fetched for empty delta");
      },
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async (input: {
        callStartDateFrom?: string;
        callStartDateTo?: string;
        portalUserIds?: string[];
      }) => {
        callRequests.push(input);
        return [];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(callRequests).toEqual([
      {
        callStartDateFrom: "2026-04-25T10:00:00.000Z",
        callStartDateTo: "2026-04-25T13:00:00.000Z",
        portalUserIds: expect.arrayContaining(["78"])
      }
    ]);
    expect(storedCursors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `${attractionScopeKey}:deals:date_modify`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:activities:last_updated`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:call_stats:call_start_date`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        })
      ])
    );
  });

  it("atomically reconciles the full current attraction scope during a delta sync", async () => {
    const dealRequests: Array<string | null> = [];
    const activityOwnerRequests: string[][] = [];
    const callStatOwnerRequests: string[][] = [];
    const conversionVisitOwnerRequests: string[][] = [];
    const storedDeals: Array<Array<{ id: string; stageId: string }>> = [];
    let replacedScope:
      | { scopeKey: string; dealIds: string[]; reconciledAt: string }
      | null = null;
    let finishedDiagnostics: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-25T12:00:00.000Z",
      getSyncCursor: async (key: string) => {
        if (key === `${attractionScopeKey}:deals:date_modify`) {
          return "2026-04-25T12:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:activities:last_updated`) {
          return "2026-04-25T11:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:call_stats:call_start_date`) {
          return "2026-04-25T10:00:00.000Z";
        }

        return null;
      },
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 2,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => ["D1", "D_MOVED"],
      getOpenDealIdsByCategoryIds: async () => ["D1", "D_MOVED"],
      getDealsByIds: async () => [
        {
          id: "D1",
          title: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-03-01T00:00:00.000Z",
          dateModify: "2026-04-24T00:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getCurrentAttractionScope: async () => ({
        scopeKey: attractionScopeKey,
        reconciledAt: "2026-04-25T11:00:00.000Z",
        dealIds: ["D1", "D_MOVED"]
      }),
      replaceCurrentAttractionScope: async (input: {
        scopeKey: string;
        dealIds: string[];
        reconciledAt: string;
      }) => {
        replacedScope = input;
      },
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async (
        _limit: number,
        _createdFrom: string | null,
        ownerIds: string[]
      ) => {
        callStatOwnerRequests.push(ownerIds);
        return [];
      },
      getCallActivityIdsMissingCallStats: async (
        _limit: number,
        _createdFrom: string | null,
        ownerIds: string[]
      ) => {
        callStatOwnerRequests.push(ownerIds);
        return [];
      },
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: Array<{ id: string; stageId: string }>) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 61,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
      },
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (input: { modifiedAfter: string | null }) => {
        dealRequests.push(input.modifiedAfter);
        if (input.modifiedAfter !== null) {
          return [];
        }

        return [
          {
            ID: "D1",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-25T12:30:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async (input: { ownerIds: string[] }) => {
        activityOwnerRequests.push(input.ownerIds);
        return [];
      },
      listConversionEventVisits: async (input: { dealIds?: string[] }) => {
        conversionVisitOwnerRequests.push(input.dealIds ?? []);
        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(dealRequests).toEqual(
      expect.arrayContaining(["2026-04-25T12:00:00.000Z", null])
    );
    expect(storedDeals.flat()).toEqual([
      expect.objectContaining({ id: "D1", stageId: "C10:NEW" })
    ]);
    expect(replacedScope).toEqual({
      scopeKey: attractionScopeKey,
      dealIds: ["D1"],
      reconciledAt: "2026-04-25T13:00:00.000Z"
    });
    expect(activityOwnerRequests.flat()).not.toContain("D_MOVED");
    expect(callStatOwnerRequests.flat()).not.toContain("D_MOVED");
    expect(conversionVisitOwnerRequests).toEqual([["D1"]]);
    expect(finishedDiagnostics).toEqual(
      expect.arrayContaining([
        "currentScopeDeals=1",
        "currentScopeAdded=0",
        "currentScopeRemoved=1",
        "currentScopeRefreshed=1"
      ])
    );
  });

  it("does not advance the call stats cursor when the optional call fetch fails", async () => {
    const storedCursors: Array<{ key: string; cursorValue: string }> = [];
    let finishedDiagnostics: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-25T12:00:00.000Z",
      getSyncCursor: async (key: string) => {
        if (key === `${attractionScopeKey}:deals:date_modify`) {
          return "2026-04-25T12:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:activities:last_updated`) {
          return "2026-04-25T11:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:call_stats:call_start_date`) {
          return "2026-04-25T10:00:00.000Z";
        }

        return null;
      },
      setSyncCursor: async (input: { key: string; cursorValue: string }) => {
        storedCursors.push(input);
      },
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 1,
        stageHistory: 1
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 60,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
      },
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => {
        throw new Error("voximplant timeout");
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(finishedDiagnostics).toContain("callStatsByDateError=Error");
    expect(finishedDiagnostics).toContain("callStatsCursor=not-updated");
    expect(storedCursors).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          key: `${attractionScopeKey}:call_stats:call_start_date`
        })
      ])
    );
    expect(storedCursors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `${attractionScopeKey}:deals:date_modify`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:activities:last_updated`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        })
      ])
    );
  });

  it("reopens historical provider backfill when stored coverage is narrower than the required lookback", async () => {
    const activityRequests: Array<{ modifiedAfter: string | null; providerId?: string }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        requiredFrom: string;
      }) =>
        !(
          input.stream === "activity_history" &&
          input.providerId === "CRM_TODO" &&
          input.requiredFrom === "2025-04-25T00:00:00.000Z"
        ),
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 1,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 56,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async (input: {
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.providerId ? { providerId: input.providerId } : {})
        });

        return input.providerId === "CRM_TODO"
          ? [
              {
                ID: "A_TODO_HISTORY",
                OWNER_TYPE_ID: "2",
                OWNER_ID: "D1",
                TYPE_ID: "6",
                PROVIDER_ID: "CRM_TODO",
                RESPONSIBLE_ID: "78",
                CREATED: "2025-06-01T10:00:00.000Z",
                DEADLINE: null,
                LAST_UPDATED: "2025-06-01T10:01:00.000Z",
                COMPLETED: "N"
              }
            ]
          : [];
      },
      listCalls: async () => [],
      fetchUsers: async () => [
        {
          ID: "78",
          NAME: "Андрей",
          LAST_NAME: "Егоров"
        }
      ]
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      {
        modifiedAfter: "2025-04-25T00:00:00.000Z",
        providerId: "CRM_TODO"
      },
      {
        modifiedAfter: "2026-04-24T00:00:00.000Z"
      }
    ]);
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "activity_history",
          providerId: "CRM_TODO",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        })
      ])
    );
  });

  it("uses a compatible previous scope cursor and backfills only newly added managers", async () => {
    const dealRequests: Array<{
      modifiedAfter: string | null;
      assignedByIds?: string[];
    }> = [];
    const activityRequests: Array<{
      ownerIds: string[];
      modifiedAfter: string | null;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async (
        _categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        if (assignedByIds?.includes("13020")) {
          return null;
        }

        return "2026-04-26T21:31:21.964Z";
      },
      getLatestSuccessfulScope: async () => ({
        scopeKey: "category:10:assigned:11234,2236,2764,6994,72,78,7814,7824",
        categoryIds: ["10"],
        assignedByIds: [
          "11234",
          "2236",
          "2764",
          "6994",
          "72",
          "78",
          "7814",
          "7824"
        ]
      }),
      getSyncCursor: async () => null,
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 3605,
        activities: 3804,
        calls: 1816,
        stageHistory: 12701
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getActivitySnapshotCount: async () => 3804,
      getDealIdsByCategoryIds: async () => ["D_OPEN"],
      getOpenDealIdsByCategoryIds: async () => ["D_OPEN"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async (input?: { mode: "full" | "delta" }) => {
        expect(input?.mode).toBe("delta");
        return 60;
      },
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        assignedByIds?: string[];
      }) => {
        dealRequests.push({
          modifiedAfter: cursor.modifiedAfter,
          ...(cursor.assignedByIds ? { assignedByIds: cursor.assignedByIds } : {})
        });

        if (
          cursor.modifiedAfter === "2025-04-27T05:00:00.000Z" &&
          cursor.assignedByIds?.includes("13020")
        ) {
          return [
            {
              ID: "D_NEW_MANAGER",
              LEAD_ID: null,
              DATE_CREATE: "2026-04-24T09:00:00+03:00",
              DATE_MODIFY: "2026-04-24T09:00:00+03:00",
              DATE_CLOSED: null,
              CATEGORY_ID: "10",
              STAGE_ID: "C10:NEW",
              STAGE_SEMANTIC_ID: "P",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "13020",
              SOURCE_ID: "WEB",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            }
          ];
        }

        return [
          {
            ID: "D_DELTA",
            LEAD_ID: null,
            DATE_CREATE: "2026-04-27T08:00:00+03:00",
            DATE_MODIFY: "2026-04-27T08:00:00+03:00",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
      }) => {
        activityRequests.push(input);
        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-27T08:00:00+03:00"
    });

    expect(dealRequests).toEqual([
      {
        modifiedAfter: "2026-04-26T21:31:21.964Z",
        assignedByIds: defaultAttractionManagerIds
      },
      {
        modifiedAfter: "2025-04-27T05:00:00.000Z",
        assignedByIds: ["13020", "7538", "118"]
      }
    ]);
    expect(activityRequests).toEqual([
      {
        ownerIds: ["D_OPEN", "D_DELTA", "D_NEW_MANAGER"],
        modifiedAfter: "2026-04-26T21:31:21.964Z"
      },
      {
        ownerIds: ["D_NEW_MANAGER"],
        modifiedAfter: "2025-04-27T05:00:00.000Z"
      }
    ]);
  });

  it("reuses historical coverage when the manager whitelist is narrowed", async () => {
    const previousScopeKey =
      "category:10:assigned:72,78,7824";
    const activityRequests: Array<{
      ownerIds: string[];
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async (
        _categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        return assignedByIds?.includes("72")
          ? "2026-04-26T21:31:21.964Z"
          : null;
      },
      getLatestSuccessfulScope: async () => ({
        scopeKey: previousScopeKey,
        categoryIds: ["10"],
        assignedByIds: ["72", "78", "7824"]
      }),
      getSyncCursor: async (key: string) =>
        key.startsWith(previousScopeKey)
          ? "2026-04-26T21:31:21.964Z"
          : null,
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async (input: { scopeKey: string }) =>
        input.scopeKey === previousScopeKey,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 1200,
        activities: 3000,
        calls: 1500,
        stageHistory: 5000
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getActivitySnapshotCount: async () => 3000,
      getDealIdsByCategoryIds: async () => ["D_OPEN"],
      getOpenDealIdsByCategoryIds: async () => ["D_OPEN"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async (input?: { mode: "full" | "delta" }) => {
        expect(input?.mode).toBe("delta");
        return 61;
      },
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [
        {
          ID: "D_DELTA",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-27T08:00:00+03:00",
          DATE_MODIFY: "2026-04-27T08:00:00+03:00",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push(input);
        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      assignedByIds: ["78"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-27T08:00:00+03:00"
    });

    expect(activityRequests).toEqual([
      {
        ownerIds: ["D_OPEN", "D_DELTA"],
        modifiedAfter: "2026-04-26T21:31:21.964Z"
      }
    ]);
  });

  it("marks a sync run as failed when the Bitrix client throws", async () => {
    const failedRuns: Array<{ syncRunId: number; finishedAt: string; status: "failed" }> = [];
    let currentScopeReplaced = false;
    const repo = {
      getLatestSuccessCursor: async () => null,
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getCurrentAttractionScope: async () => ({
        scopeKey: attractionScopeKey,
        reconciledAt: "2026-04-08T23:00:00.000Z",
        dealIds: ["D_EXISTING"]
      }),
      replaceCurrentAttractionScope: async () => {
        currentScopeReplaced = true;
      },
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 25,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async (input: {
        syncRunId: number;
        finishedAt: string;
        status: "failed";
      }) => {
        failedRuns.push(input);
      }
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => {
        throw new Error("Bitrix24 crm.deal.list failed: OPERATION_TIME_LIMIT");
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await expect(
      performManualSync({
        client,
        repository: repo,
        categoryIds: ["10"],
        qualityFieldName: "UF_CRM_1730380390",
        now: () => "2026-04-09T00:00:00.000Z"
      })
    ).rejects.toThrow("OPERATION_TIME_LIMIT");

    expect(failedRuns).toEqual([
      {
        syncRunId: 25,
        finishedAt: "2026-04-09T00:00:00.000Z",
        status: "failed",
        diagnostics: [
          "SYNC_FAILED",
          "bitrix=Bitrix24 crm.deal.list failed: OPERATION_TIME_LIMIT"
        ]
      }
    ]);
    expect(currentScopeReplaced).toBe(false);
  });

  it("continues when optional deal field metadata is unavailable", async () => {
    const finishedRuns: Array<{ syncRunId: number; diagnostics?: string[] }> = [];
    const failedRuns: Array<{ syncRunId: number; status: "failed" }> = [];
    const repo = {
      getLatestSuccessCursor: async () => null,
      getSnapshotStats: async () => ({
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () => "__legacy__",
      getMeetingActivityHistoryBootstrappedAt: async () => "__legacy__",
      getTaskActivityHistoryBootstrappedAt: async () => "__legacy__",
      getDealCustomFieldsBootstrappedAt: async () => "__legacy__",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 26,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: {
        syncRunId: number;
        diagnostics?: string[];
      }) => {
        finishedRuns.push(input);
      },
      failSyncRun: async (input: { syncRunId: number; status: "failed" }) => {
        failedRuns.push(input);
      }
    };
    const metadataError = new Error("Bitrix24 request timed out");
    metadataError.name = "AbortError";
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => {
        throw metadataError;
      },
      fetchDealFieldValueMap: async () => {
        throw metadataError;
      },
      fetchConversionEventDealFieldName: async () => {
        throw metadataError;
      },
      listDeals: async () => [
        {
          ID: "D_OPTIONAL_METADATA",
          CONTACT_ID: null,
          LEAD_ID: null,
          DATE_CREATE: "2026-04-09T00:00:00.000Z",
          DATE_MODIFY: "2026-04-09T00:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: 0,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: null,
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    const summary = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(summary.syncRunId).toBe(26);
    expect(summary.dealsSynced).toBe(1);
    expect(summary.diagnostics).toContain(
      "conversionEventDealFieldNameError=AbortError"
    );
    expect(summary.diagnostics).toContain(
      "dealFieldValueMapError=UF_CRM_1730380390:AbortError"
    );
    expect(finishedRuns).toHaveLength(1);
    expect(failedRuns).toEqual([]);
  });

  it("resolves optional deal metadata before starting catalog requests", async () => {
    const order: string[] = [];
    let finishedDiagnostics: string[] = [];
    const failedRuns: Array<{ syncRunId: number; status: "failed" }> = [];
    const repo = {
      getLatestSuccessCursor: async () => null,
      getSnapshotStats: async () => ({
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 27,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
      },
      failSyncRun: async (input: { syncRunId: number; status: "failed" }) => {
        failedRuns.push(input);
      }
    };
    const client = {
      fetchConversionEventDealFieldName: async () => {
        order.push("deal-field");
        return null;
      },
      fetchDealStages: async () => {
        order.push("stages");
        throw new Error("stage catalog timeout");
      },
      fetchSourceCatalog: async () => {
        order.push("sources");
        return [];
      },
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await expect(
      performManualSync({
        client,
        repository: repo,
        categoryIds: ["10"],
        qualityFieldName: "UF_CRM_1730380390",
        now: () => "2026-04-09T00:00:00.000Z"
      })
    ).resolves.toEqual(expect.objectContaining({ syncRunId: 27 }));

    expect(order.slice(0, 2)).toEqual(["deal-field", "stages"]);
    expect(finishedDiagnostics).toContain("dealStageCatalogError=Error");
    expect(failedRuns).toEqual([]);
  });

  it("keeps the main sync successful when stage-history fetch fails", async () => {
    const writes: string[] = [];
    let finishedDiagnostics: string[] = [];
    const failedRuns: Array<{ syncRunId: number; status: "failed" }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-08T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-08T00:00:00.000Z",
      setSyncCursor: async () => {
        writes.push("cursor");
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-08T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-08T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => ["D_EXISTING"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => {
        writes.push("stage-catalog");
      },
      upsertDeals: async () => {
        writes.push("deals");
        return 1;
      },
      upsertStageHistory: async () => {
        writes.push("stage-history");
        return 0;
      },
      upsertActivities: async () => {
        writes.push("activities");
        return 0;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 61,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: { diagnostics?: string[] }) => {
        finishedDiagnostics = input.diagnostics ?? [];
        writes.push("finish");
      },
      failSyncRun: async (input: { syncRunId: number; status: "failed" }) => {
        failedRuns.push(input);
      }
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [
        {
          ID: "D_NEW",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-08T00:00:00.000Z",
          DATE_MODIFY: "2026-04-09T00:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listStageHistory: async () => {
        throw new Error("stage history unavailable");
      },
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await expect(
      performManualSync({
        client,
        repository: repo,
        categoryIds: ["10"],
        qualityFieldName: "UF_CRM_1730380390",
        now: () => "2026-04-09T00:00:00.000Z"
      })
    ).resolves.toEqual(expect.objectContaining({ syncRunId: 61 }));

    expect(finishedDiagnostics).toContain("stageHistoryError=Error");
    expect(writes).toEqual(
      expect.arrayContaining([
        "stage-catalog",
        "deals",
        "stage-history",
        "activities",
        "cursor",
        "finish"
      ])
    );
    expect(failedRuns).toEqual([]);
  });
});
