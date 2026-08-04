import { describe, expect, it, vi } from "vitest";

import type { MessengerMessageSnapshot } from "../src/domain/messenger-messages";
import {
  MessengerMessageCollectionError,
  createMessengerMessageCollectionService
} from "../src/server/messenger-message-collection";

const managers = [
  { managerId: "78", managerName: "Егоров Андрей", enabled: true },
  { managerId: "11234", managerName: "Ромашова Ольга", enabled: true }
];

function message(
  input: Partial<MessengerMessageSnapshot> &
    Pick<MessengerMessageSnapshot, "id" | "dealId" | "dealManagerId">
): MessengerMessageSnapshot {
  const occurredAt = input.occurredAt ?? "2026-08-03T10:15:00+03:00";
  return {
    id: input.id,
    sessionId: input.sessionId ?? `session-${input.id}`,
    activityId: input.activityId ?? `activity-${input.id}`,
    dealId: input.dealId,
    dealManagerId: input.dealManagerId,
    occurredAt,
    occurredAtMs: input.occurredAtMs ?? Date.parse(occurredAt),
    channelKey: input.channelKey ?? "wz_telegram",
    channelLabel: input.channelLabel ?? "WAZZUP: Telegram",
    senderId: input.senderId ?? "connector",
    senderKind: input.senderKind ?? "connector",
    direction: input.direction ?? "incoming",
    authorLabel: input.authorLabel ?? null,
    authorManagerId: input.authorManagerId ?? null,
    text: input.text ?? "Текст сообщения",
    rawText: input.rawText ?? input.text ?? "Текст сообщения",
    attachmentFileIds: input.attachmentFileIds ?? [],
    hasAttachment: input.hasAttachment ?? false,
    system: input.system ?? false,
    syncedAt: input.syncedAt ?? "2026-08-04T00:00:00.000Z"
  };
}

function createRepository(rows: MessengerMessageSnapshot[]) {
  return {
    getManagerWhitelistSettings: async () => managers,
    getCurrentAttractionScope: async () => ({ dealIds: ["1001", "1002"] }),
    getDealsByIds: async () => [
      { id: "1001", assignedById: "78" },
      { id: "1002", assignedById: "11234" }
    ],
    listMessengerMessages: async (input: {
      managerIds?: string[];
      from: string;
      to: string;
    }) => {
      const selected = new Set(input.managerIds ?? []);
      const from = Date.parse(input.from);
      const to = Date.parse(input.to);
      return rows.filter((row) => {
        const managerId =
          row.direction === "outgoing" && row.authorManagerId
            ? row.authorManagerId
            : row.dealManagerId;
        return (
          row.occurredAtMs >= from &&
          row.occurredAtMs <= to &&
          (selected.size === 0 || (managerId ? selected.has(managerId) : false))
        );
      });
    },
    getMessengerMessage: async (input: {
      sessionId: string;
      messageId: string;
    }) =>
      rows.find(
        (row) =>
          row.sessionId === input.sessionId && row.id === input.messageId
      ) ?? null
  };
}

describe("cached messenger message reporting", () => {
  it("attributes confirmed outgoing messages to their author and keeps unknown authors separate", async () => {
    const rows = [
      message({
        id: "out-confirmed",
        sessionId: "dialog-1",
        dealId: "1001",
        dealManagerId: "78",
        direction: "outgoing",
        authorLabel: "Битрикс24 (Ольга Ромашова)",
        authorManagerId: "11234",
        text: "Подтверждённое исходящее",
        rawText:
          "=== Исходящее сообщение, автор: Битрикс24 (Ольга Ромашова) ===\nПодтверждённое исходящее"
      }),
      message({
        id: "out-unknown",
        sessionId: "dialog-2",
        dealId: "1002",
        dealManagerId: "11234",
        direction: "outgoing",
        authorLabel: "Телефон",
        text: "Автор не определён"
      }),
      message({
        id: "incoming",
        sessionId: "dialog-3",
        dealId: "1001",
        dealManagerId: "78",
        direction: "incoming"
      }),
      message({
        id: "unknown-direction",
        sessionId: "dialog-4",
        dealId: "1001",
        dealManagerId: "78",
        direction: "unknown"
      }),
      message({
        id: "system",
        dealId: "1001",
        dealManagerId: "78",
        system: true,
        text: null,
        rawText: "Системное событие"
      })
    ];
    const service = createMessengerMessageCollectionService({
      repository: createRepository(rows),
      client: {}
    });

    const report = await service.getMessengerReportSummary({
      managerIds: [],
      from: "2026-08-01T00:00:00+03:00",
      to: "2026-08-03T23:59:59+03:00"
    });

    expect(report).toMatchObject({
      totalMessages: 4,
      outgoingMessages: 1,
      outgoingUnknownAuthorMessages: 1,
      incomingMessages: 1,
      unknownDirectionMessages: 1,
      uniqueOutgoingDialogs: 2,
      dealsWithOutgoingMessages: 2,
      systemMessagesExcluded: 1
    });
    expect(report.managerRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          managerId: "78",
          outgoingMessages: 0,
          incomingMessages: 1,
          unknownDirectionMessages: 1,
          systemMessagesExcluded: 1
        }),
        expect.objectContaining({
          managerId: "11234",
          outgoingMessages: 1,
          outgoingUnknownAuthorMessages: 1
        })
      ])
    );
    expect(JSON.stringify(report)).not.toContain("Подтверждённое исходящее");
    expect(JSON.stringify(report)).not.toContain("Системное событие");
  });

  it("reads stored text only inside the exact selected range", async () => {
    const rows = [
      message({
        id: "inside",
        dealId: "1001",
        dealManagerId: "78",
        text: "Внутри периода"
      }),
      message({
        id: "outside",
        dealId: "1001",
        dealManagerId: "78",
        occurredAt: "2026-07-31T23:59:59+03:00",
        text: "Вне периода"
      })
    ];
    const service = createMessengerMessageCollectionService({
      repository: createRepository(rows),
      client: {},
      portalHost: "example.bitrix24.ru"
    });

    const details = await service.getManagerMessageDetails({
      managerId: "78",
      from: "2026-08-01T00:00:00+03:00",
      to: "2026-08-03T23:59:59+03:00",
      limit: 500
    });

    expect(details.totalMessages).toBe(1);
    expect(details.messages[0]).toMatchObject({
      id: "inside",
      text: "Внутри периода",
      dealUrl: "https://example.bitrix24.ru/crm/deal/details/1001/"
    });
  });

  it("validates manager access, ranges, and reader limits", async () => {
    const service = createMessengerMessageCollectionService({
      repository: createRepository([]),
      client: {}
    });

    await expect(
      service.getMessengerReportSummary({
        managerIds: ["disabled"],
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
    ).rejects.toMatchObject({ code: "MANAGER_NOT_ENABLED" });
    await expect(
      service.getMessengerReportSummary({
        managerIds: [],
        from: "2026-08-04T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
    ).rejects.toMatchObject({ code: "INVALID_RANGE" });
    await expect(
      service.getManagerMessageDetails({
        managerId: "78",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00",
        limit: 501
      })
    ).rejects.toMatchObject({ code: "INVALID_LIMIT" });
  });

  it("downloads only an attachment linked to the cached message and range", async () => {
    const storedMessage = message({
      id: "with-file",
      sessionId: "dialog-file",
      dealId: "1001",
      dealManagerId: "78",
      attachmentFileIds: ["900"],
      hasAttachment: true
    });
    const downloadDiskFile = vi.fn(async () => ({
      fileId: "900",
      fileName: "document.pdf",
      bytes: Buffer.from("file")
    }));
    const service = createMessengerMessageCollectionService({
      repository: createRepository([storedMessage]),
      client: { downloadDiskFile }
    });

    const attachment = await service.getManagerMessageAttachment({
      managerId: "78",
      from: "2026-08-01T00:00:00+03:00",
      to: "2026-08-03T23:59:59+03:00",
      sessionId: "dialog-file",
      messageId: "with-file",
      fileId: "900"
    });

    expect(attachment.fileName).toBe("document.pdf");
    expect(downloadDiskFile).toHaveBeenCalledWith("900", {
      maxBytes: 20 * 1024 * 1024
    });
    await expect(
      service.getManagerMessageAttachment({
        managerId: "78",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00",
        sessionId: "dialog-file",
        messageId: "with-file",
        fileId: "901"
      })
    ).rejects.toBeInstanceOf(MessengerMessageCollectionError);
  });
});
