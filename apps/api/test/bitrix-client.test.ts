import { afterEach, describe, expect, it, vi } from "vitest";

import { BitrixClient } from "../src/bitrix/client";
import { ALLOWED_DEAL_FIELDS } from "../src/bitrix/selectors";
import {
  CALL_ENRICHMENT_CONTACT_FIELD_CODES,
  CALL_ENRICHMENT_DEAL_FIELD_CODES
} from "../src/server/call-enrichment-fields";

function createResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BitrixClient pagination", () => {
  it("prefixes unprefixed category deal stage ids from the status catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: [
          {
            STATUS_ID: "UC_Z8RAZJ",
            NAME: "Передана",
            SORT: 50,
            EXTRA: {
              SEMANTICS: "P"
            }
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.fetchDealStages(["10"])).resolves.toEqual([
      {
        entityType: "deal",
        categoryId: "10",
        statusId: "C10:UC_Z8RAZJ",
        name: "Передана",
        semanticId: "P",
        sortOrder: 50
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      filter: {
        ENTITY_ID: "DEAL_STAGE_10"
      }
    });
  });

  it("uses ID-based backfill pagination for a full deal sync", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: Array.from({ length: 50 }, (_, index) => ({
            ID: String(index + 1)
          }))
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "51" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    const rows = await client.listDeals({ modifiedAfter: null });

    expect(rows).toHaveLength(51);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">ID": "0",
        CATEGORY_ID: "10"
      },
      order: {
        ID: "ASC"
      },
      start: -1
    });

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">ID": "50",
        CATEGORY_ID: "10"
      },
      order: {
        ID: "ASC"
      },
      start: -1
    });
  });

  it("uses ID-based pagination for modified deal syncs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: Array.from({ length: 50 }, (_, index) => ({
            ID: String(index + 1)
          }))
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "51" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    const rows = await client.listDeals({
      modifiedAfter: "2026-04-08T10:00:00.000Z",
      assignedByIds: ["78", "11234"]
    });

    expect(rows).toHaveLength(51);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">ID": "0",
        ">=DATE_MODIFY": "2026-04-08T10:00:00.000Z",
        CATEGORY_ID: "10",
        "@ASSIGNED_BY_ID": ["78", "11234"]
      },
      order: {
        ID: "ASC"
      },
      start: -1
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      select: ALLOWED_DEAL_FIELDS,
      filter: {
        ">ID": "50",
        ">=DATE_MODIFY": "2026-04-08T10:00:00.000Z",
        CATEGORY_ID: "10",
        "@ASSIGNED_BY_ID": ["78", "11234"]
      },
      order: {
        ID: "ASC"
      },
      start: -1
    });
  });

  it("retries transient network failures from Bitrix", async () => {
    const timeoutError = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect timeout"), {
        code: "UND_ERR_CONNECT_TIMEOUT"
      })
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "1" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listDeals({ modifiedAfter: null })).resolves.toEqual([
      {
        ID: "1"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries fetch promises that ignore abort signals after the hard timeout", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "1" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 5,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listDeals({ modifiedAfter: null })).resolves.toEqual([
      {
        ID: "1"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient non-json responses from Bitrix", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        }
      })
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "1" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listDeals({ modifiedAfter: null })).resolves.toEqual([
      {
        ID: "1"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not request unscoped call statistics", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listCalls({})).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters call statistics by CRM activity id without the array-operator prefix", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "477324"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listCalls({ activityIds: ["477324"] })
    ).resolves.toEqual([
      {
        ID: "CALL1",
        CRM_ACTIVITY_ID: "477324"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      FILTER: {
        CRM_ACTIVITY_ID: ["477324"]
      },
      start: 0
    });
  });

  it("paginates scoped call statistics by CRM activity id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "CALL1", CRM_ACTIVITY_ID: "477324" }],
          next: 50
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "CALL2", CRM_ACTIVITY_ID: "477325" }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listCalls({ activityIds: ["477324", "477325"] })
    ).resolves.toEqual([
      { ID: "CALL1", CRM_ACTIVITY_ID: "477324" },
      { ID: "CALL2", CRM_ACTIVITY_ID: "477325" }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      FILTER: {
        CRM_ACTIVITY_ID: ["477324", "477325"]
      },
      start: 0
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      FILTER: {
        CRM_ACTIVITY_ID: ["477324", "477325"]
      },
      start: 50
    });
  });

  it("fetches supplemental call statistics by date and portal users", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "CALL_SUPPLEMENTAL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-20T10:00:00.000Z",
            CALL_DURATION: "45",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: "200"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listCalls({
        callStartDateFrom: "2026-04-01T00:00:00.000Z",
        callStartDateTo: "2026-04-30T23:59:59.999Z",
        portalUserIds: ["78", "11234"]
      })
    ).resolves.toHaveLength(1);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      FILTER: {
        ">=CALL_START_DATE": "2026-04-01T00:00:00.000Z",
        "<=CALL_START_DATE": "2026-04-30T23:59:59.999Z",
        PORTAL_USER_ID: ["78", "11234"]
      },
      start: 0
    });
  });

  it("fetches deal-owned CRM activities by id without selecting PII fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "477324",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "101"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listActivitiesByIds(["477324"])).resolves.toEqual([
      {
        ID: "477324",
        OWNER_TYPE_ID: "2",
        OWNER_ID: "101"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        OWNER_TYPE_ID: 2,
        "@ID": ["477324"]
      },
      select: [
        "ID",
        "OWNER_TYPE_ID",
        "OWNER_ID",
        "TYPE_ID",
        "PROVIDER_ID",
        "RESPONSIBLE_ID",
        "CREATED",
        "DEADLINE",
        "LAST_UPDATED",
        "COMPLETED",
        "COMPLETED_DATE"
      ],
      start: 0
    });
  });

  it("fetches CRM activity bindings for call attribution", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: [
            { entityTypeId: 2, entityId: 155566 },
            { entityTypeId: 2, entityId: 155616 },
            { entityTypeId: 3, entityId: 37454 }
          ]
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [{ entityTypeId: 2, entityId: 155804 }]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listActivityBindings(["482408", "483950"])).resolves.toEqual([
      { activityId: "482408", ownerTypeId: "2", ownerId: "155566" },
      { activityId: "482408", ownerTypeId: "2", ownerId: "155616" },
      { activityId: "482408", ownerTypeId: "3", ownerId: "37454" },
      { activityId: "483950", ownerTypeId: "2", ownerId: "155804" }
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      activityId: "482408"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      activityId: "483950"
    });
  });

  it("fetches call recording activity files without constraining activity owner type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: [
          {
            ID: "508492",
            OWNER_TYPE_ID: "3",
            OWNER_ID: "36536",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            FILES: [
              {
                id: 338028,
                name: "record.mp3"
              }
            ],
            STORAGE_ELEMENT_IDS: ["338028"]
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listCallRecordingActivitiesByIds(["508492"])
    ).resolves.toEqual([
      {
        ID: "508492",
        OWNER_TYPE_ID: "3",
        OWNER_ID: "36536",
        PROVIDER_ID: "VOXIMPLANT_CALL",
        FILES: [
          {
            id: 338028,
            name: "record.mp3"
          }
        ],
        STORAGE_ELEMENT_IDS: ["338028"]
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        "@ID": ["508492"]
      },
      select: [
        "ID",
        "OWNER_TYPE_ID",
        "OWNER_ID",
        "PROVIDER_ID",
        "FILES",
        "STORAGE_ELEMENT_IDS"
      ],
      start: 0
    });
  });

  it("fetches Bitrix Disk file download URLs for call recordings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: {
          ID: "338028",
          DOWNLOAD_URL: "https://download.example/record.mp3",
          NAME: "record.mp3",
          SIZE: 884736
        }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.getDiskFile("338028")).resolves.toEqual({
      ID: "338028",
      DOWNLOAD_URL: "https://download.example/record.mp3",
      NAME: "record.mp3",
      SIZE: 884736
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      id: "338028"
    });
  });

  it("discovers and loads conversion event smart-process visits without returning raw titles", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              ufCrmEventName: {
                title: "Мероприятие"
              },
              ufCrmEventDate: {
                title: "Дата мероприятия",
                type: "date"
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [
              {
                id: 33,
                stages: [
                  {
                    id: "DT177_33:ATTENDED",
                    name: "На мероприятии"
                  }
                ]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 1,
                title:
                  "Посещение Омаров Омар Магомедович в Знакомство с клубом 29.04.",
                stageId: "DT177_33:ATTENDED",
                categoryId: 33,
                parentId2: 146166,
                contactId: 9001,
                assignedById: 78,
                sourceId: "WEB",
                createdTime: "2026-04-20T10:00:00.000Z",
                updatedTime: "2026-04-29T13:56:00.000Z",
                ufCrmEventName: null,
                ufCrmEventDate: null
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listConversionEventVisits({
        modifiedAfter: "2026-04-01T00:00:00.000Z",
        reportYear: 2026
      })
    ).resolves.toEqual([
      {
        id: "1",
        eventId: null,
        eventName: "Знакомство с клубом 29.04.",
        eventDate: "2026-04-29T00:00:00.000Z",
        status: "attended",
        stageId: "DT177_33:ATTENDED",
        stageName: "На мероприятии",
        dealId: "146166",
        contactId: "9001",
        managerId: "78",
        sourceId: "WEB",
        createdTime: "2026-04-20T10:00:00.000Z",
        updatedTime: "2026-04-29T13:56:00.000Z"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      entityTypeId: 162,
      select: expect.arrayContaining([
        "id",
        "title",
        "stageId",
        "parentId2",
        "contactId",
        "ufCrmEventName",
        "ufCrmEventDate"
      ]),
      filter: {
        ">=updatedTime": "2026-04-01T00:00:00.000Z"
      }
    });
  });

  it("uses known visit smart-process metadata and parentId event links", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              parentId137: {
                title: "Мероприятия",
                type: "crm_entity",
                settings: {
                  parentEntityTypeId: 137
                }
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [
              {
                id: 14,
                stages: [
                  {
                    id: "DT162_14:NEW",
                    name: "Приглашен"
                  }
                ]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 455358,
                title:
                  "Посещение участника в МСК Networking-сессия CF EXPERIENCE 21.05.26 оффлайн",
                stageId: "DT162_14:NEW",
                categoryId: 14,
                parentId137: 29402,
                parentId2: 156562,
                contactId: 9001,
                assignedById: 78,
                sourceId: "WEB",
                createdTime: "2026-05-18T15:41:58.000Z",
                updatedTime: "2026-05-18T15:41:58.000Z"
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listConversionEventVisits({
        modifiedAfter: null,
        reportYear: 2026
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "455358",
        eventId: "29402",
        eventName: "МСК Networking-сессия CF EXPERIENCE 21.05.26 оффлайн",
        eventDate: "2026-05-21T00:00:00.000Z",
        status: "invited",
        dealId: "156562",
        contactId: "9001"
      })
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      entityTypeId: 162
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      entityTypeId: 162,
      select: expect.arrayContaining(["parentId137", "parentId2", "contactId"])
    });
  });

  it("loads smart-process visit stage names through crm.status.list when categories omit stages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              parentId137: {
                title: "Мероприятия",
                settings: {
                  parentEntityTypeId: 137
                }
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [{ id: 14, stages: [] }]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [
            {
              STATUS_ID: "DT162_14:SUCCESS",
              NAME: "На мероприятии"
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 455358,
                title: "Посещение участника в Гостевая встреча 21.05.",
                stageId: "DT162_14:SUCCESS",
                categoryId: 14,
                parentId137: 29402,
                parentId2: 156562,
                contactId: 9001,
                createdTime: "2026-05-18T15:41:58.000Z",
                updatedTime: "2026-05-21T19:00:00.000Z"
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listConversionEventVisits({
        modifiedAfter: null,
        reportYear: 2026
      })
    ).resolves.toEqual([
      expect.objectContaining({
        stageName: "На мероприятии",
        status: "attended"
      })
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      filter: {
        ENTITY_ID: "DYNAMIC_162_STAGE_14"
      }
    });
  });

  it("scopes conversion event visits by deal and contact ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              parentId137: {
                title: "Мероприятия",
                settings: {
                  parentEntityTypeId: 137
                }
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [
              {
                id: 14,
                stages: [{ id: "DT162_14:NEW", name: "Приглашен" }]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 1,
                title: "Посещение участника в Событие 01.06.",
                stageId: "DT162_14:NEW",
                parentId137: 100,
                parentId2: 156562,
                contactId: 9001,
                createdTime: "2026-05-18T15:41:58.000Z",
                updatedTime: "2026-05-18T15:41:58.000Z"
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 1,
                title: "Посещение участника в Событие 01.06.",
                stageId: "DT162_14:NEW",
                parentId137: 100,
                parentId2: 156562,
                contactId: 9001,
                createdTime: "2026-05-18T15:41:58.000Z",
                updatedTime: "2026-05-18T15:41:58.000Z"
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listConversionEventVisits({
        modifiedAfter: null,
        reportYear: 2026,
        dealIds: ["156562"],
        contactIds: ["9001"]
      })
    ).resolves.toHaveLength(1);
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      filter: {
        parentId2: "156562"
      }
    });
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toMatchObject({
      filter: {
        contactId: "9001"
      }
    });
  });

  it("discovers linked conversion event items for planned inventory", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              ufCrmEvent: {
                title: "Мероприятие",
                settings: {
                  DYNAMIC_137: "Y"
                }
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [
              {
                id: 14,
                stages: [{ id: "DT162_14:NEW", name: "Приглашен" }]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              ufCrmEventDate: {
                title: "Дата мероприятия",
                type: "date"
              },
              ufCrmEventType: {
                title: "Тип мероприятия",
                items: [{ ID: "128", VALUE: "Мероприятие привлечения" }]
              },
              ufCrmFormat: {
                title: "Формат",
                items: [{ ID: "2788", VALUE: "Оффлайн" }]
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [
              {
                id: 12,
                stages: [
                  {
                    id: "DT137_12:PLANNED",
                    name: "Планируется"
                  }
                ]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 31394,
                title: "Гостевая встреча 28.05.",
                stageId: "DT137_12:PLANNED",
                categoryId: 12,
                createdTime: "2026-05-14T08:18:44.000Z",
                updatedTime: "2026-05-19T20:57:57.000Z",
                ufCrmEventDate: "2026-05-28",
                ufCrmEventType: "128",
                ufCrmFormat: "2788"
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listConversionEvents({
        modifiedAfter: null
      })
    ).resolves.toEqual([
      {
        eventId: "31394",
        entityTypeId: 137,
        categoryId: 12,
        title: "Гостевая встреча 28.05.",
        eventDate: "2026-05-28T00:00:00.000Z",
        startAt: "2026-05-28T00:00:00.000Z",
        endAt: null,
        stageId: "DT137_12:PLANNED",
        stageName: "Планируется",
        status: "planned",
        eventTypeId: "128",
        eventTypeLabel: "Мероприятие привлечения",
        formatId: "2788",
        createdTime: "2026-05-14T08:18:44.000Z",
        updatedTime: "2026-05-19T20:57:57.000Z"
      }
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body))).toMatchObject({
      entityTypeId: 137,
      select: expect.arrayContaining([
        "id",
        "title",
        "stageId",
        "ufCrmEventDate",
        "ufCrmEventType",
        "ufCrmFormat"
      ])
    });
  });

  it("loads planned event type labels from linked parentId156 items", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              parentId137: {
                title: "Мероприятия",
                settings: {
                  parentEntityTypeId: 137
                }
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [
              {
                id: 14,
                stages: [{ id: "DT162_14:NEW", name: "Приглашен" }]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            fields: {
              ufCrmEventDate: {
                title: "Дата мероприятия",
                type: "date"
              },
              parentId156: {
                title: "Виды мероприятий",
                type: "crm_entity",
                settings: {
                  parentEntityTypeId: 156
                }
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            categories: [
              {
                id: 12,
                stages: [
                  {
                    id: "DT137_12:PLANNED",
                    name: "Планируется"
                  }
                ]
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 128,
                title: "Мероприятие Привлечения"
              }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 31394,
                title: "Гостевая встреча 28.05.",
                stageId: "DT137_12:PLANNED",
                categoryId: 12,
                createdTime: "2026-05-14T08:18:44.000Z",
                updatedTime: "2026-05-19T20:57:57.000Z",
                ufCrmEventDate: "2026-05-28",
                parentId156: 128
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listConversionEvents({
        modifiedAfter: null
      })
    ).resolves.toEqual([
      expect.objectContaining({
        eventId: "31394",
        eventTypeId: "128",
        eventTypeLabel: "Мероприятие Привлечения"
      })
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body))).toMatchObject({
      entityTypeId: 156,
      select: ["id", "title"]
    });
    expect(JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body))).toMatchObject({
      entityTypeId: 137,
      select: expect.arrayContaining(["parentId156"])
    });
  });

  it("chunks activity owner filters to avoid one huge Bitrix binding filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: []
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });
    const ownerIds = Array.from({ length: 51 }, (_, index) => String(index + 1));

    await expect(
      client.listActivities({
        ownerIds,
        modifiedAfter: "2026-01-01T00:00:00.000Z",
        providerId: "CRM_TODO"
      })
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).filter).toEqual({
      BINDINGS: ownerIds.slice(0, 10).map((ownerId) => ({
        OWNER_TYPE_ID: 2,
        OWNER_ID: ownerId
      })),
      ">ID": "0",
      PROVIDER_ID: "CRM_TODO",
      ">=LAST_UPDATED": "2026-01-01T00:00:00.000Z"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).filter).toEqual({
      BINDINGS: ownerIds.slice(10, 20).map((ownerId) => ({
        OWNER_TYPE_ID: 2,
        OWNER_ID: ownerId
      })),
      ">ID": "0",
      PROVIDER_ID: "CRM_TODO",
      ">=LAST_UPDATED": "2026-01-01T00:00:00.000Z"
    });
    expect(JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body)).filter).toEqual({
      OWNER_TYPE_ID: 2,
      OWNER_ID: "51",
      ">ID": "0",
      PROVIDER_ID: "CRM_TODO",
      ">=LAST_UPDATED": "2026-01-01T00:00:00.000Z"
    });
  });

  it("uses ID-based pagination for deal-owned activity scans", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: Array.from({ length: 50 }, (_, index) => ({
            ID: String(index + 1),
            OWNER_ID: "D1",
            OWNER_TYPE_ID: "2"
          }))
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [{ ID: "51", OWNER_ID: "D1", OWNER_TYPE_ID: "2" }]
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listActivities({
        ownerIds: ["D1"],
        modifiedAfter: "2026-01-01T00:00:00.000Z"
      })
    ).resolves.toHaveLength(51);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      filter: {
        OWNER_TYPE_ID: 2,
        OWNER_ID: "D1",
        ">ID": "0",
        ">=LAST_UPDATED": "2026-01-01T00:00:00.000Z"
      },
      start: -1
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      filter: {
        OWNER_TYPE_ID: 2,
        OWNER_ID: "D1",
        ">ID": "50",
        ">=LAST_UPDATED": "2026-01-01T00:00:00.000Z"
      },
      start: -1
    });
  });

  it("lists contacts by id using only explicitly allowed custom fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "4964",
            UF_CRM_1712252375: "140488",
            UF_CRM_1691070302: "4734"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listContacts({
        ids: ["4964"],
        customFieldNames: ["UF_CRM_1712252375", "UF_CRM_1691070302"]
      })
    ).resolves.toEqual([
      {
        ID: "4964",
        UF_CRM_1712252375: "140488",
        UF_CRM_1691070302: "4734"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        "@ID": ["4964"]
      },
      select: ["ID", "UF_CRM_1712252375", "UF_CRM_1691070302"],
      start: 0
    });
  });

  it("resolves quality labels through crm.deal.fields and crm.item.list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            UF_CRM_1730380390: {
              settings: {
                DYNAMIC_1078: "Y"
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: {
            items: [
              {
                id: 6,
                title: "3.1 Готов ко встрече"
              }
            ]
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.fetchDealQualityMap("UF_CRM_1730380390")
    ).resolves.toEqual({
      "6": "3.1 Готов ко встрече"
    });

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      entityTypeId: 1078,
      select: ["id", "title"],
      order: {
        id: "ASC"
      },
      start: 0
    });
  });

  it("reuses deal field metadata across concurrent field map requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: {
          UF_CRM_ALPHA: {
            items: [{ ID: 1, VALUE: "Alpha" }]
          },
          UF_CRM_BETA: {
            items: [{ ID: 2, VALUE: "Beta" }]
          }
        }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      Promise.all([
        client.fetchDealFieldValueMap("UF_CRM_ALPHA"),
        client.fetchDealFieldValueMap("UF_CRM_BETA")
      ])
    ).resolves.toEqual([{ "1": "Alpha" }, { "2": "Beta" }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({});
  });

  it("resolves iblock_element deal field maps through list elements", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            UF_CRM_DEAL_MEET2_KIND: {
              type: "iblock_element",
              settings: {
                IBLOCK_ID: 222
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          result: [
            { ID: "558388", NAME: "Очная" },
            { ID: "558390", NAME: "Zoom" },
            { ID: "558392", NAME: "Мероприятие" }
          ]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.fetchDealFieldValueMap("UF_CRM_DEAL_MEET2_KIND")
    ).resolves.toEqual({
      "558388": "Очная",
      "558390": "Zoom",
      "558392": "Мероприятие"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      IBLOCK_TYPE_ID: "lists",
      IBLOCK_ID: 222,
      SELECT: ["ID", "NAME"],
      ELEMENT_ORDER: {
        ID: "ASC"
      },
      start: 0
    });
  });

  it("reads stage history rows from nested result.items payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        result: {
          items: [
            {
              ID: 1,
              OWNER_ID: 10,
              CATEGORY_ID: 28,
              STAGE_ID: "C28:NEW",
              STAGE_SEMANTIC_ID: "P",
              TYPE_ID: 1,
              CREATED_TIME: "2026-04-10T09:59:03+03:00"
            }
          ]
        },
        total: 1
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listStageHistory({ ownerIds: ["10"] })).resolves.toEqual([
      {
        ID: 1,
        OWNER_ID: 10,
        CATEGORY_ID: 28,
        STAGE_ID: "C28:NEW",
        STAGE_SEMANTIC_ID: "P",
        TYPE_ID: 1,
        CREATED_TIME: "2026-04-10T09:59:03+03:00"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      entityTypeId: 2,
      filter: {
        "@OWNER_ID": ["10"]
      },
      select: [
        "ID",
        "OWNER_ID",
        "CATEGORY_ID",
        "STAGE_ID",
        "STAGE_SEMANTIC_ID",
        "TYPE_ID",
        "CREATED_TIME"
      ],
      order: {
        ID: "ASC"
      },
      start: 0
    });
  });

  it("does not paginate contact lookups when the chunk already matches the exact requested ids", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => String(index + 1));
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: ids.map((id) => ({
          ID: id
        }))
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listContacts({ ids })).resolves.toEqual(
      ids.map((id) => ({
        ID: id
      }))
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not paginate activity lookups when the chunk already matches the exact requested ids", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => String(index + 1));
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: ids.map((id) => ({
          ID: id,
          OWNER_TYPE_ID: "2",
          OWNER_ID: "101"
        }))
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.listActivitiesByIds(ids)).resolves.toEqual(
      ids.map((id) => ({
        ID: id,
        OWNER_TYPE_ID: "2",
        OWNER_ID: "101"
      }))
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads only approved contact enrichment fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "901",
            NAME: "Не должно выйти наружу",
            UF_CRM_1647946359: "602"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.getContactEnrichmentValues("901")).resolves.toEqual({
      UF_CRM_1647946359: "602"
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/crm.contact.list");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        ID: "901"
      },
      select: ["ID", ...CALL_ENRICHMENT_CONTACT_FIELD_CODES],
      start: 0
    });
  });

  it("reads only approved deal enrichment fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "23841",
            TITLE: "Не должно выйти наружу",
            CONTACT_ID: "901",
            UF_CRM_1766147164481: "Старый проект"
          }
        ]
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.getDealEnrichmentValues("23841")).resolves.toEqual({
      UF_CRM_1766147164481: "Старый проект"
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/crm.deal.list");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        ID: "23841"
      },
      select: [
        "ID",
        "CONTACT_ID",
        "ASSIGNED_BY_ID",
        ...CALL_ENRICHMENT_DEAL_FIELD_CODES
      ],
      start: 0
    });
  });

  it("updates one approved contact enrichment field through crm.contact.update", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createResponse({ result: true }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.updateContactEnrichmentField({
        entityId: "901",
        fieldCode: "UF_CRM_1647946359",
        value: "602"
      })
    ).resolves.toBeUndefined();

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/crm.contact.update");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      id: "901",
      fields: {
        UF_CRM_1647946359: "602"
      }
    });
  });

  it("updates one approved deal enrichment field through crm.deal.update", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(createResponse({ result: true }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.updateDealEnrichmentField({
        entityId: "23841",
        fieldCode: "UF_CRM_1766147164481",
        value: "Ключевой проект"
      })
    ).resolves.toBeUndefined();

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/crm.deal.update");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      id: "23841",
      fields: {
        UF_CRM_1766147164481: "Ключевой проект"
      }
    });
  });

  it("rejects wrong-entity enrichment fields before calling Bitrix update", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.updateContactEnrichmentField({
        entityId: "901",
        fieldCode: "UF_CRM_1766147164481",
        value: "Ключевой проект"
      })
    ).rejects.toThrow(/belongs to deal/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("BitrixClient Open Lines", () => {
  it("lists Open Lines activities with the session origin for scoped deals", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: [
          {
            ID: "301",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "1001",
            PROVIDER_ID: "IMOPENLINES_SESSION",
            RESPONSIBLE_ID: "78",
            LAST_UPDATED: "2026-08-03T10:20:00+03:00",
            ORIGIN_ID: "IMOL_441"
          }
        ]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.listOpenLineActivities({
        ownerIds: ["1001"],
        modifiedAfter: "2026-08-01T00:00:00+03:00"
      })
    ).resolves.toEqual([
      {
        ID: "301",
        OWNER_TYPE_ID: "2",
        OWNER_ID: "1001",
        PROVIDER_ID: "IMOPENLINES_SESSION",
        RESPONSIBLE_ID: "78",
        LAST_UPDATED: "2026-08-03T10:20:00+03:00",
        ORIGIN_ID: "IMOL_441"
      }
    ]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      order: {
        ID: "ASC"
      },
      filter: {
        OWNER_TYPE_ID: 2,
        OWNER_ID: "1001",
        ">ID": "0",
        PROVIDER_ID: "IMOPENLINES_SESSION",
        ">=LAST_UPDATED": "2026-08-01T00:00:00+03:00"
      },
      select: [
        "ID",
        "OWNER_TYPE_ID",
        "OWNER_ID",
        "PROVIDER_ID",
        "RESPONSIBLE_ID",
        "LAST_UPDATED",
        "ORIGIN_ID"
      ],
      start: -1
    });
  });

  it("normalizes complete message text from an Open Lines session history", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: {
          chat: {
            "701": {
              id: 701,
              name: "Открытая линия",
              entityId: "wz_telegram_42",
              entityType: "LINES"
            }
          },
          message: {
            "501": {
              id: 501,
              chatid: 701,
              senderid: 9001,
              date: "2026-08-03T10:15:00+03:00",
              text: "Полный текст сообщения",
              textlegacy: "Полный текст сообщения",
              params: {
                FILE_ID: ["77"]
              }
            }
          },
          users: {
            "9001": {
              id: 9001,
              name: "WAZZUP",
              connector: true
            }
          }
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(client.getOpenLineSessionHistory("441")).resolves.toEqual({
      sessionId: "441",
      chat: {
        id: "701",
        entityId: "wz_telegram_42",
        entityType: "LINES"
      },
      messages: [
        {
          id: "501",
          chatId: "701",
          senderId: "9001",
          date: "2026-08-03T10:15:00+03:00",
          text: "Полный текст сообщения",
          attachmentFileIds: ["77"],
          hasAttachment: true
        }
      ],
      users: [
        {
          id: "9001",
          connector: true
        }
      ]
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/imopenlines.session.history.get"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      SESSION_ID: "441"
    });
  });

  it("downloads a bounded Bitrix disk file without returning its credentialed URL", async () => {
    const fileBytes = new TextEncoder().encode("safe file");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          result: {
            ID: "77",
            NAME: "Договор.docx",
            SIZE: String(fileBytes.byteLength),
            DOWNLOAD_URL:
              "https://example.bitrix24.ru/rest/1/token/download/?token=signed"
          }
        })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-length": String(fileBytes.byteLength)
        }),
        body: null,
        arrayBuffer: async () => fileBytes.buffer
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    const download = await client.downloadDiskFile("77", {
      maxBytes: 1_024
    });

    expect(download).toEqual({
      fileId: "77",
      fileName: "Договор.docx",
      bytes: Buffer.from(fileBytes)
    });
    expect(JSON.stringify(download)).not.toContain("download/?token=");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://example.bitrix24.ru/rest/1/token/download/?token=signed"
    );
  });

  it("rejects a disk download URL outside the configured Bitrix portal", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: {
          ID: "77",
          NAME: "Договор.docx",
          SIZE: "9",
          DOWNLOAD_URL: "https://files.example.test/download/77"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.downloadDiskFile("77", { maxBytes: 1_024 })
    ).rejects.toMatchObject({ code: "DISK_FILE_UNSAFE_URL", status: 502 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a declared disk file larger than the attachment limit", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        result: {
          ID: "77",
          NAME: "Большой файл.bin",
          SIZE: "2048",
          DOWNLOAD_URL:
            "https://example.bitrix24.ru/rest/1/token/download/?token=signed"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new BitrixClient({
      portalHost: "example.bitrix24.ru",
      userId: "1",
      webhookToken: "token",
      timeoutMs: 1_000,
      requestIntervalMs: 0,
      dealCategoryIds: ["10"]
    });

    await expect(
      client.downloadDiskFile("77", { maxBytes: 1_024 })
    ).rejects.toMatchObject({ code: "DISK_FILE_TOO_LARGE", status: 413 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
