import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  MessengerMessageSnapshot,
  MessengerSessionSnapshot
} from "../src/domain/messenger-messages";
import { createSqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("messenger message SQLite cache", () => {
  it("stores full text, queries the current scope by time, and replaces a session authoritatively", async () => {
    const directory = mkdtempSync(join(tmpdir(), "messenger-cache-"));
    tempDirs.push(directory);
    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C10:WON"]
    });
    await repository.upsertDeals([
      {
        id: "1001",
        title: null,
        contactId: null,
        leadId: null,
        categoryId: "10",
        stageId: "C10:NEW",
        stageSemanticId: "P",
        opportunity: null,
        assignedById: "11234",
        sourceId: null,
        qualityValue: null,
        businessClubValue: null,
        targetGroupValue: null,
        meetingTypeValue: null,
        meetingDateValue: null,
        tariffValue: null,
        conversionEventValue: null,
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2026-07-01T00:00:00.000Z",
        dateModify: "2026-08-03T00:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);
    await repository.replaceCurrentAttractionScope({
      scopeKey: "scope",
      dealIds: ["1001"],
      reconciledAt: "2026-08-04T00:00:00.000Z"
    });
    const session: MessengerSessionSnapshot = {
      sessionId: "441",
      activityId: "301",
      dealId: "1001",
      dealManagerId: "11234",
      channelKey: "wz_telegram",
      channelLabel: "WAZZUP: Telegram",
      activityUpdatedAt: "2026-08-03T11:00:00+03:00",
      syncedAt: "2026-08-04T00:00:00.000Z"
    };
    const createMessage = (
      id: string,
      text: string
    ): MessengerMessageSnapshot => ({
      id,
      sessionId: "441",
      activityId: "301",
      dealId: "1001",
      dealManagerId: "11234",
      occurredAt: "2026-08-03T10:15:00+03:00",
      occurredAtMs: Date.parse("2026-08-03T10:15:00+03:00"),
      channelKey: "wz_telegram",
      channelLabel: "WAZZUP: Telegram",
      senderId: "connector",
      senderKind: "connector",
      direction: "outgoing",
      authorLabel: "Битрикс24 (Ольга Ромашова)",
      authorManagerId: "11234",
      text,
      rawText: `=== Исходящее сообщение ===\n${text}`,
      attachmentFileIds: ["900"],
      hasAttachment: true,
      system: false,
      syncedAt: "2026-08-04T00:00:00.000Z"
    });

    await repository.replaceMessengerSessions([
      { session, messages: [createMessage("501", "Первый"), createMessage("502", "Второй")] }
    ]);
    await repository.replaceMessengerSessions([
      { session, messages: [createMessage("501", "Обновлённый текст")] }
    ]);

    await expect(
      repository.listMessengerMessages({
        managerIds: ["11234"],
        from: "2026-08-03T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "501",
        text: "Обновлённый текст",
        rawText: "=== Исходящее сообщение ===\nОбновлённый текст",
        attachmentFileIds: ["900"]
      })
    ]);
    await expect(
      repository.getMessengerMessage({ sessionId: "441", messageId: "502" })
    ).resolves.toBeNull();
    await expect(
      repository.getMessengerMessage({ sessionId: "441", messageId: "501" })
    ).resolves.toMatchObject({ id: "501", attachmentFileIds: ["900"] });

    await repository.replaceCurrentAttractionScope({
      scopeKey: "scope",
      dealIds: [],
      reconciledAt: "2026-08-04T01:00:00.000Z"
    });
    await expect(
      repository.getMessengerMessage({ sessionId: "441", messageId: "501" })
    ).resolves.toBeNull();
    repository.close();
  });
});
