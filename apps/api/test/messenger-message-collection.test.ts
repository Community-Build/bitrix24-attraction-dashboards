import { describe, expect, it } from "vitest";

import { createMessengerMessageCollectionService } from "../src/server/messenger-message-collection";

describe("messenger message collection", () => {
  it("collects a safe summary without returning raw messages", async () => {
    const service = createMessengerMessageCollectionService({
      repository: {
        getManagerWhitelistSettings: async () => [
          {
            managerId: "78",
            managerName: "Егоров Андрей",
            enabled: true
          }
        ],
        getCurrentAttractionScope: async () => ({ dealIds: ["1001"] }),
        getDealsByIds: async () => [{ id: "1001", assignedById: "78" }]
      },
      client: {
        listOpenLineActivities: async () => [
          { ID: "301", OWNER_ID: "1001", ORIGIN_ID: "IMOL_441" }
        ],
        getOpenLineSessionHistory: async () => ({
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
              text: "Сырой текст не должен выйти",
              hasAttachment: false
            }
          ],
          users: [{ id: "9001", connector: true }]
        })
      }
    });

    const summary = await service.getManagerMessageSummary({
      managerId: "78",
      from: "2026-08-01T00:00:00+03:00",
      to: "2026-08-03T23:59:59+03:00"
    });

    expect(summary.messages).toBe(1);
    expect(summary.messagesWithText).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("Сырой текст не должен выйти");
  });

  it("builds one range summary with unique dialogs and deals for enabled managers", async () => {
    const activityRequests: Array<{ ownerIds: string[]; modifiedAfter: string | null }> = [];
    const histories = new Map([
      [
        "441",
        {
          sessionId: "441",
          chat: { id: "701", entityId: "wz_telegram_42", entityType: "LINES" },
          messages: [
            {
              id: "501",
              chatId: "701",
              senderId: "9001",
              date: "2026-08-03T10:15:00+03:00",
              text: "Первый текст",
              hasAttachment: false
            }
          ],
          users: [{ id: "9001", connector: true }]
        }
      ],
      [
        "442",
        {
          sessionId: "442",
          chat: { id: "702", entityId: "wz_telegram_42", entityType: "LINES" },
          messages: [
            {
              id: "502",
              chatId: "702",
              senderId: "0",
              date: "2026-08-03T10:16:00+03:00",
              text: "Системное событие",
              hasAttachment: false
            }
          ],
          users: []
        }
      ],
      [
        "443",
        {
          sessionId: "443",
          chat: { id: "703", entityId: "olchat_wa_connector_2", entityType: "LINES" },
          messages: [
            {
              id: "503",
              chatId: "703",
              senderId: "9002",
              date: "2026-08-03T10:17:00+03:00",
              text: "Второй текст",
              hasAttachment: false
            },
            {
              id: "504",
              chatId: "703",
              senderId: "9002",
              date: "2026-08-03T10:18:00+03:00",
              text: null,
              hasAttachment: true
            }
          ],
          users: [{ id: "9002", connector: true }]
        }
      ],
      [
        "444",
        {
          sessionId: "444",
          chat: { id: "704", entityId: "olchat_tg_connector", entityType: "LINES" },
          messages: [
            {
              id: "505",
              chatId: "704",
              senderId: "9003",
              date: "2026-08-03T10:19:00+03:00",
              text: "Третий текст",
              hasAttachment: false
            }
          ],
          users: [{ id: "9003", connector: true }]
        }
      ]
    ]);
    const service = createMessengerMessageCollectionService({
      repository: {
        getManagerWhitelistSettings: async () => [
          { managerId: "78", managerName: "Егоров Андрей", enabled: true },
          { managerId: "11234", managerName: "Ромашова Ольга", enabled: true }
        ],
        getCurrentAttractionScope: async () => ({
          dealIds: ["1001", "1002", "1003"]
        }),
        getDealsByIds: async () => [
          { id: "1001", assignedById: "78" },
          { id: "1002", assignedById: "78" },
          { id: "1003", assignedById: "11234" }
        ]
      },
      client: {
        listOpenLineActivities: async (request) => {
          activityRequests.push(request);
          return [
            { ID: "301", OWNER_ID: "1001", ORIGIN_ID: "IMOL_441" },
            { ID: "302", OWNER_ID: "1001", ORIGIN_ID: "IMOL_442" },
            { ID: "303", OWNER_ID: "1002", ORIGIN_ID: "IMOL_443" },
            { ID: "304", OWNER_ID: "1003", ORIGIN_ID: "IMOL_444" }
          ];
        },
        getOpenLineSessionHistory: async (sessionId) => {
          const history = histories.get(sessionId);
          if (!history) throw new Error(`Missing history ${sessionId}`);
          return history;
        }
      }
    });

    const report = await service.getMessengerReportSummary({
      managerIds: [],
      from: "2026-08-01T00:00:00+03:00",
      to: "2026-08-03T23:59:59+03:00"
    });

    expect(activityRequests).toEqual([
      {
        ownerIds: ["1001", "1002", "1003"],
        modifiedAfter: "2026-08-01T00:00:00+03:00"
      }
    ]);
    expect(report).toMatchObject({
      totalMessages: 4,
      messagesWithText: 3,
      attachmentOnlyMessages: 1,
      uniqueDialogs: 3,
      dealsWithMessages: 3,
      systemMessagesExcluded: 1,
      managerRows: [
        {
          managerId: "78",
          messages: 3,
          uniqueDialogs: 2,
          dealsWithMessages: 2
        },
        {
          managerId: "11234",
          messages: 1,
          uniqueDialogs: 1,
          dealsWithMessages: 1
        }
      ]
    });
    expect(JSON.stringify(report)).not.toContain("Первый текст");
  });

  it("returns only the newest bounded message details and reports truncation", async () => {
    const service = createMessengerMessageCollectionService({
      repository: {
        getManagerWhitelistSettings: async () => [
          { managerId: "78", managerName: "Егоров Андрей", enabled: true }
        ],
        getCurrentAttractionScope: async () => ({ dealIds: ["1001"] }),
        getDealsByIds: async () => [{ id: "1001", assignedById: "78" }]
      },
      client: {
        listOpenLineActivities: async () => [
          { ID: "301", OWNER_ID: "1001", ORIGIN_ID: "IMOL_441" }
        ],
        getOpenLineSessionHistory: async () => ({
          sessionId: "441",
          chat: { id: "701", entityId: "wz_telegram_42", entityType: "LINES" },
          messages: [
            {
              id: "501",
              chatId: "701",
              senderId: "9001",
              date: "2026-08-03T10:15:00+03:00",
              text: "Первое",
              hasAttachment: false
            },
            {
              id: "502",
              chatId: "701",
              senderId: "9001",
              date: "2026-08-03T10:16:00+03:00",
              text: "Второе",
              hasAttachment: false
            },
            {
              id: "503",
              chatId: "701",
              senderId: "9001",
              date: "2026-08-03T10:17:00+03:00",
              text: "Третье",
              hasAttachment: false
            }
          ],
          users: [{ id: "9001", connector: true }]
        })
      }
    });

    const result = await service.getManagerMessageDetails({
      managerId: "78",
      from: "2026-08-01T00:00:00+03:00",
      to: "2026-08-03T23:59:59+03:00",
      limit: 2
    });

    expect(result).toMatchObject({
      totalMessages: 3,
      returnedMessages: 2,
      truncated: true,
      messages: [
        { id: "502", dealId: "1001", text: "Второе" },
        { id: "503", dealId: "1001", text: "Третье" }
      ]
    });
  });

  it("does not expose an unknown connector entity identifier as a channel", async () => {
    const privateEntityId = "custom_+79991234567_customer@example.com";
    const service = createMessengerMessageCollectionService({
      repository: {
        getManagerWhitelistSettings: async () => [
          { managerId: "78", managerName: "Егоров Андрей", enabled: true }
        ],
        getCurrentAttractionScope: async () => ({ dealIds: ["1001"] }),
        getDealsByIds: async () => [{ id: "1001", assignedById: "78" }]
      },
      client: {
        listOpenLineActivities: async () => [
          { ID: "301", OWNER_ID: "1001", ORIGIN_ID: "IMOL_441" }
        ],
        getOpenLineSessionHistory: async () => ({
          sessionId: "441",
          chat: { id: "701", entityId: privateEntityId, entityType: "LINES" },
          messages: [
            {
              id: "501",
              chatId: "701",
              senderId: "9001",
              date: "2026-08-03T10:15:00+03:00",
              text: "Текст",
              hasAttachment: false
            }
          ],
          users: [{ id: "9001", connector: true }]
        })
      }
    });

    const details = await service.getManagerMessageDetails({
      managerId: "78",
      from: "2026-08-01T00:00:00+03:00",
      to: "2026-08-03T23:59:59+03:00"
    });

    expect(details.messages[0]?.channel).toEqual({
      key: "unknown",
      label: "Неизвестный канал"
    });
    expect(JSON.stringify(details)).not.toContain(privateEntityId);
  });

  it("rejects an invalid or longer-than-31-day range before repository reads", async () => {
    let repositoryReads = 0;
    const service = createMessengerMessageCollectionService({
      repository: {
        getManagerWhitelistSettings: async () => {
          repositoryReads += 1;
          return [];
        },
        getCurrentAttractionScope: async () => ({ dealIds: [] }),
        getDealsByIds: async () => []
      },
      client: {
        listOpenLineActivities: async () => [],
        getOpenLineSessionHistory: async () => {
          throw new Error("must not be called");
        }
      }
    });

    await expect(
      service.analyzeManagerMessages(
        {
          managerId: "78",
          from: "2026-07-01T00:00:00+03:00",
          to: "2026-08-02T00:00:00+03:00"
        },
        async () => null
      )
    ).rejects.toMatchObject({
      code: "INVALID_RANGE"
    });
    expect(repositoryReads).toBe(0);
  });

  it("rejects a manager outside the enabled attraction whitelist before Bitrix reads", async () => {
    let bitrixReads = 0;
    const service = createMessengerMessageCollectionService({
      repository: {
        getManagerWhitelistSettings: async () => [
          {
            managerId: "78",
            managerName: "Егоров Андрей",
            enabled: false
          }
        ],
        getCurrentAttractionScope: async () => ({ dealIds: [] }),
        getDealsByIds: async () => []
      },
      client: {
        listOpenLineActivities: async () => {
          bitrixReads += 1;
          return [];
        },
        getOpenLineSessionHistory: async () => {
          bitrixReads += 1;
          throw new Error("must not be called");
        }
      }
    });

    await expect(
      service.analyzeManagerMessages(
        {
          managerId: "78",
          from: "2026-08-01T00:00:00+03:00",
          to: "2026-08-03T23:59:59+03:00"
        },
        async () => null
      )
    ).rejects.toMatchObject({
      code: "MANAGER_NOT_ENABLED"
    });
    expect(bitrixReads).toBe(0);
  });

  it("passes complete message text to an in-process analyzer and returns a safe summary", async () => {
    let analyzedText: string | null | undefined;
    const service = createMessengerMessageCollectionService({
      repository: {
        getManagerWhitelistSettings: async () => [
          {
            managerId: "78",
            managerName: "Егоров Андрей",
            enabled: true
          }
        ],
        getCurrentAttractionScope: async () => ({
          dealIds: ["1001", "1002"]
        }),
        getDealsByIds: async () => [
          { id: "1001", assignedById: "78" },
          { id: "1002", assignedById: "11234" }
        ]
      },
      client: {
        listOpenLineActivities: async () => [
          {
            ID: "301",
            OWNER_ID: "1001",
            ORIGIN_ID: "IMOL_441"
          }
        ],
        getOpenLineSessionHistory: async () => ({
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
              text: "Полный текст сообщения клиента",
              hasAttachment: false
            },
            {
              id: "502",
              chatId: "701",
              senderId: "9001",
              date: "2026-08-03T10:16:00+03:00",
              text: null,
              hasAttachment: true
            },
            {
              id: "503",
              chatId: "701",
              senderId: "0",
              date: "2026-08-03T10:17:00+03:00",
              text: "Системное событие",
              hasAttachment: false
            },
            {
              id: "501",
              chatId: "701",
              senderId: "9001",
              date: "2026-08-03T10:15:00+03:00",
              text: "Полный текст сообщения клиента",
              hasAttachment: false
            },
            {
              id: "503",
              chatId: "701",
              senderId: "0",
              date: "2026-08-03T10:17:00+03:00",
              text: "Системное событие",
              hasAttachment: false
            },
            {
              id: "504",
              chatId: "701",
              senderId: "9001",
              date: "2026-07-01T10:15:00+03:00",
              text: "Вне периода",
              hasAttachment: false
            }
          ],
          users: [{ id: "9001", connector: true }]
        })
      }
    });

    const result = await service.analyzeManagerMessages(
      {
        managerId: "78",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      },
      async (batch) => {
        analyzedText = batch.messages[0]?.text;
        return {
          analyzedMessages: batch.messages.length
        };
      }
    );

    expect(analyzedText).toBe("Полный текст сообщения клиента");
    expect(result).toEqual({
      summary: {
        managerId: "78",
        managerName: "Егоров Андрей",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00",
        currentDeals: 1,
        sessions: 1,
        uniqueDialogs: 1,
        dealsWithMessages: 1,
        messages: 2,
        messagesWithText: 1,
        attachmentOnlyMessages: 1,
        systemMessagesExcluded: 1,
        senderKinds: {
          connector: 2,
          operator: 0,
          unknown: 0
        },
        channels: [
          {
            key: "wz_telegram",
            label: "WAZZUP: Telegram",
            messages: 2
          }
        ],
        directionAvailable: false,
        personalAuthorAvailable: false
      },
      analysis: {
        analyzedMessages: 2
      }
    });
    expect(JSON.stringify(result.summary)).not.toContain(
      "Полный текст сообщения клиента"
    );
  });
});
