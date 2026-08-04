import { describe, expect, it, vi } from "vitest";

import type { ReplaceMessengerSessionInput } from "../src/server/sqlite-repository";
import { synchronizeMessengerMessages } from "../src/server/messenger-message-sync";

function createRepository(input?: { cursor?: string | null }) {
  const stored: ReplaceMessengerSessionInput[] = [];
  const setSyncCursor = vi.fn(async () => undefined);
  return {
    stored,
    setSyncCursor,
    repository: {
      getManagerWhitelistSettings: async () => [
        { managerId: "78", managerName: "Егоров Андрей", enabled: true },
        { managerId: "11234", managerName: "Ромашова Ольга", enabled: true }
      ],
      getCurrentAttractionScope: async () => ({
        scopeKey: "scope",
        dealIds: ["1001", "1002"]
      }),
      getDealsByIds: async () => [
        { id: "1001", assignedById: "78" },
        { id: "1002", assignedById: "11234" }
      ],
      getSyncCursor: async () => input?.cursor ?? null,
      setSyncCursor,
      replaceMessengerSessions: async (rows: ReplaceMessengerSessionInput[]) => {
        stored.push(...rows);
        return {
          sessions: rows.length,
          messages: rows.reduce(
            (total, session) => total + session.messages.length,
            0
          )
        };
      },
      reconcileMessengerDealManagers: async () => ({
        sessions: 0,
        messages: 0
      })
    }
  };
}

describe("messenger message synchronization", () => {
  it("stores full and cleaned text and resolves the real outgoing author", async () => {
    const state = createRepository();
    const listOpenLineActivities = vi.fn(async () => [
      {
        ID: "301",
        OWNER_ID: "1001",
        LAST_UPDATED: "2026-08-03T11:00:00+03:00",
        ORIGIN_ID: "IMOL_441"
      }
    ]);
    const result = await synchronizeMessengerMessages({
      repository: state.repository,
      client: {
        listOpenLineActivities,
        getOpenLineSessionHistory: async () => ({
          sessionId: "441",
          chat: {
            id: "701",
            entityId: "wz_max_connector",
            entityType: "LINES"
          },
          users: [
            { id: "connector", connector: true },
            { id: "78", connector: false }
          ],
          messages: [
            {
              id: "501",
              chatId: "701",
              senderId: "connector",
              date: "2026-08-03T10:15:00+03:00",
              text:
                "=== Исходящее сообщение, автор: Битрикс24 (Ромашова Ольга Ивановна) ===\nЗдравствуйте",
              attachmentFileIds: ["900"],
              hasAttachment: true
            },
            {
              id: "502",
              chatId: "701",
              senderId: "connector",
              date: "2026-08-03T10:16:00+03:00",
              text:
                "=== Исходящее сообщение, автор: Телефон ===\nАвтор неизвестен",
              hasAttachment: false
            },
            {
              id: "503",
              chatId: "701",
              senderId: "78",
              date: "2026-08-03T10:17:00+03:00",
              text: "Ответ оператора",
              hasAttachment: false
            },
            {
              id: "504",
              chatId: "701",
              senderId: "0",
              date: "2026-08-03T10:18:00+03:00",
              text: "Системное событие",
              hasAttachment: false
            }
          ]
        })
      },
      now: () => "2026-08-04T00:00:00.000Z",
      bootstrapLookbackDays: 365
    });

    expect(listOpenLineActivities).toHaveBeenCalledWith({
      ownerIds: ["1001", "1002"],
      modifiedAfter: "2025-08-04T00:00:00.000Z"
    });
    expect(result).toMatchObject({
      sessionsStored: 1,
      messagesStored: 4,
      failedSessions: 0,
      cursorAdvanced: true
    });
    const messages = state.stored[0]?.messages ?? [];
    expect(messages[0]).toMatchObject({
      direction: "outgoing",
      authorManagerId: "11234",
      text: "Здравствуйте",
      rawText:
        "=== Исходящее сообщение, автор: Битрикс24 (Ромашова Ольга Ивановна) ===\nЗдравствуйте",
      attachmentFileIds: ["900"]
    });
    expect(messages[1]).toMatchObject({
      direction: "outgoing",
      authorLabel: "Телефон",
      authorManagerId: null
    });
    expect(messages[2]).toMatchObject({
      direction: "outgoing",
      authorManagerId: "78"
    });
    expect(messages[3]).toMatchObject({ system: true });
    expect(state.setSyncCursor).toHaveBeenCalledOnce();
  });

  it("keeps successful sessions but does not advance the cursor after a partial failure", async () => {
    const state = createRepository({ cursor: "2026-08-03T00:00:00.000Z" });
    const result = await synchronizeMessengerMessages({
      repository: state.repository,
      client: {
        listOpenLineActivities: async () => [
          {
            ID: "301",
            OWNER_ID: "1001",
            LAST_UPDATED: "2026-08-03T11:00:00+03:00",
            ORIGIN_ID: "IMOL_441"
          },
          {
            ID: "302",
            OWNER_ID: "1002",
            LAST_UPDATED: "2026-08-03T11:00:00+03:00",
            ORIGIN_ID: "IMOL_442"
          }
        ],
        getOpenLineSessionHistory: async (sessionId) => {
          if (sessionId === "442") throw new Error("temporary failure");
          return {
            sessionId,
            chat: { id: null, entityId: "olchat_wa", entityType: null },
            users: [],
            messages: []
          };
        }
      },
      now: () => "2026-08-04T00:00:00.000Z"
    });

    expect(result).toMatchObject({
      sessionsSeen: 2,
      sessionsStored: 1,
      failedSessions: 1,
      cursorAdvanced: false
    });
    expect(state.setSyncCursor).not.toHaveBeenCalled();
  });
});
