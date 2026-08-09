import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import type {
  MessengerMessageSnapshot,
  MessengerSessionSnapshot
} from "../src/domain/messenger-messages";
import { createSqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

interface NormalizedMessengerRow {
  direction: string;
  authorLabel: string | null;
  authorManagerId: string | null;
  text: string | null;
  rawText: string | null;
  system: number;
  normalizationVersion: number;
}

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
      repository.listMessengerMessages({
        dealIds: ["another-deal"],
        from: "2026-08-03T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
    ).resolves.toEqual([]);
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

  it("normalizes stale cached Umnico rows once while preserving raw text", async () => {
    const directory = mkdtempSync(join(tmpdir(), "messenger-normalization-"));
    tempDirs.push(directory);
    const databasePath = join(directory, "reporting.db");
    const rawText =
      "photo.jpg\n\n" +
      "===Outcoming message. Source: Phone/[b]Андрей Егоров[/b]===\n" +
      "Сообщение[B] [/B][B] [/B]";
    let repository = createSqliteRepository({
      databaseUrl: `file:${databasePath}`,
      defaultWonStageIds: ["C10:WON"]
    });
    await repository.replaceMessengerSessions([
      {
        session: {
          sessionId: "442",
          activityId: "302",
          dealId: "1001",
          dealManagerId: "11234",
          channelKey: "umnico_telegram",
          channelLabel: "Umnico: Telegram",
          activityUpdatedAt: "2026-08-03T11:00:00+03:00",
          syncedAt: "2026-08-04T00:00:00.000Z"
        },
        messages: [
          {
            id: "601",
            sessionId: "442",
            activityId: "302",
            dealId: "1001",
            dealManagerId: "11234",
            occurredAt: "2026-08-03T10:15:00+03:00",
            occurredAtMs: Date.parse("2026-08-03T10:15:00+03:00"),
            channelKey: "umnico_telegram",
            channelLabel: "Umnico: Telegram",
            senderId: "connector",
            senderKind: "connector",
            direction: "unknown",
            authorLabel: null,
            authorManagerId: null,
            text: rawText,
            rawText,
            attachmentFileIds: [],
            hasAttachment: false,
            system: false,
            syncedAt: "2026-08-04T00:00:00.000Z"
          }
        ]
      }
    ]);
    repository.close();

    const staleDatabase = new Database(databasePath);
    const normalizationColumn = (
      staleDatabase
        .prepare("PRAGMA table_info(messenger_message_snapshots)")
        .all() as Array<{ name: string; dflt_value: string | null }>
    ).find((column) => column.name === "normalization_version");
    expect(normalizationColumn?.dflt_value).toBe("0");
    staleDatabase
      .prepare(
        `UPDATE messenger_message_snapshots
        SET normalization_version = 0
        WHERE session_id = '442' AND message_id = '601'`
      )
      .run();
    staleDatabase.close();

    repository = createSqliteRepository({
      databaseUrl: `file:${databasePath}`,
      defaultWonStageIds: ["C10:WON"]
    });
    repository.close();

    const normalizedDatabase = new Database(databasePath, { readonly: true });
    const normalized = normalizedDatabase
      .prepare(
        `SELECT
          direction,
          author_label AS authorLabel,
          author_manager_id AS authorManagerId,
          message_text AS text,
          raw_text AS rawText,
          is_system AS system,
          normalization_version AS normalizationVersion
        FROM messenger_message_snapshots
        WHERE session_id = '442' AND message_id = '601'`
      )
      .get() as NormalizedMessengerRow;
    normalizedDatabase.close();
    expect(normalized).toEqual({
      direction: "outgoing",
      authorLabel: "Phone/Андрей Егоров",
      authorManagerId: "78",
      text: "photo.jpg\n\nСообщение",
      rawText,
      system: 0,
      normalizationVersion: 2
    });

    const disabledManagerDatabase = new Database(databasePath);
    disabledManagerDatabase
      .prepare(
        `UPDATE module_manager_whitelist_settings
        SET enabled = 0
        WHERE module_key = 'attraction' AND manager_id = '78'`
      )
      .run();
    disabledManagerDatabase
      .prepare(
        `UPDATE messenger_message_snapshots
        SET normalization_version = 0,
            direction = 'unknown',
            author_label = NULL,
            author_manager_id = '78',
            message_text = raw_text
        WHERE session_id = '442' AND message_id = '601'`
      )
      .run();
    disabledManagerDatabase.close();

    repository = createSqliteRepository({
      databaseUrl: `file:${databasePath}`,
      defaultWonStageIds: ["C10:WON"]
    });
    repository.close();
    const reopenedDatabase = new Database(databasePath, { readonly: true });
    const reopened = reopenedDatabase
      .prepare(
        `SELECT
          direction,
          author_label AS authorLabel,
          author_manager_id AS authorManagerId,
          message_text AS text,
          raw_text AS rawText,
          is_system AS system,
          normalization_version AS normalizationVersion
        FROM messenger_message_snapshots
        WHERE session_id = '442' AND message_id = '601'`
      )
      .get() as NormalizedMessengerRow;
    reopenedDatabase.close();
    expect(reopened).toEqual({
      ...normalized,
      authorManagerId: null
    });

    repository = createSqliteRepository({
      databaseUrl: `file:${databasePath}`,
      defaultWonStageIds: ["C10:WON"]
    });
    repository.close();
    const idempotentDatabase = new Database(databasePath, { readonly: true });
    const idempotent = idempotentDatabase
      .prepare(
        `SELECT
          direction,
          author_label AS authorLabel,
          author_manager_id AS authorManagerId,
          message_text AS text,
          raw_text AS rawText,
          is_system AS system,
          normalization_version AS normalizationVersion
        FROM messenger_message_snapshots
        WHERE session_id = '442' AND message_id = '601'`
      )
      .get() as NormalizedMessengerRow;
    idempotentDatabase.close();
    expect(idempotent).toEqual(reopened);
  });

  it("reclassifies stale OLChat Telegram outgoing rows and preserves real system events", async () => {
    const directory = mkdtempSync(join(tmpdir(), "messenger-olchat-normalization-"));
    tempDirs.push(directory);
    const databasePath = join(directory, "reporting.db");
    const outgoingRawText =
      "[OLChat] Telegram:\n[B][Исходящее][/B]\nОтвет менеджера";
    let repository = createSqliteRepository({
      databaseUrl: `file:${databasePath}`,
      defaultWonStageIds: ["C10:WON"]
    });
    const baseMessage: Omit<MessengerMessageSnapshot, "id" | "senderId" | "senderKind" | "direction" | "text" | "rawText" | "system"> = {
      sessionId: "443",
      activityId: "303",
      dealId: "1001",
      dealManagerId: "6994",
      occurredAt: "2026-07-01T20:17:58+03:00",
      occurredAtMs: Date.parse("2026-07-01T20:17:58+03:00"),
      channelKey: "olchat_telegram",
      channelLabel: "OLChat: Telegram",
      authorLabel: null,
      authorManagerId: null,
      attachmentFileIds: [],
      hasAttachment: false,
      syncedAt: "2026-08-04T00:00:00.000Z"
    };
    await repository.replaceMessengerSessions([
      {
        session: {
          sessionId: "443",
          activityId: "303",
          dealId: "1001",
          dealManagerId: "6994",
          channelKey: "olchat_telegram",
          channelLabel: "OLChat: Telegram",
          activityUpdatedAt: "2026-08-03T11:00:00+03:00",
          syncedAt: "2026-08-04T00:00:00.000Z"
        },
        messages: [
          {
            ...baseMessage,
            id: "701",
            senderId: "0",
            senderKind: "unknown",
            direction: "unknown",
            text: outgoingRawText,
            rawText: outgoingRawText,
            system: true
          },
          {
            ...baseMessage,
            id: "702",
            senderId: "connector",
            senderKind: "connector",
            direction: "unknown",
            text: "Ответ клиента",
            rawText: "Ответ клиента",
            system: false
          },
          {
            ...baseMessage,
            id: "703",
            senderId: "0",
            senderKind: "unknown",
            direction: "unknown",
            text: "Служебное событие",
            rawText: "Служебное событие",
            system: true
          }
        ]
      }
    ]);
    repository.close();

    const staleDatabase = new Database(databasePath);
    staleDatabase
      .prepare(
        `UPDATE messenger_message_snapshots
         SET normalization_version = 1
         WHERE session_id = '443'`
      )
      .run();
    staleDatabase.close();

    repository = createSqliteRepository({
      databaseUrl: `file:${databasePath}`,
      defaultWonStageIds: ["C10:WON"]
    });
    repository.close();

    const normalizedDatabase = new Database(databasePath, { readonly: true });
    const rows = normalizedDatabase
      .prepare(
        `SELECT
          message_id AS id,
          direction,
          message_text AS text,
          raw_text AS rawText,
          is_system AS system,
          normalization_version AS normalizationVersion
         FROM messenger_message_snapshots
         WHERE session_id = '443'
         ORDER BY message_id`
      )
      .all() as Array<{
        id: string;
        direction: string;
        text: string | null;
        rawText: string | null;
        system: number;
        normalizationVersion: number;
      }>;
    normalizedDatabase.close();

    expect(rows).toEqual([
      {
        id: "701",
        direction: "outgoing",
        text: "Ответ менеджера",
        rawText: outgoingRawText,
        system: 0,
        normalizationVersion: 2
      },
      {
        id: "702",
        direction: "incoming",
        text: "Ответ клиента",
        rawText: "Ответ клиента",
        system: 0,
        normalizationVersion: 2
      },
      {
        id: "703",
        direction: "unknown",
        text: null,
        rawText: "Служебное событие",
        system: 1,
        normalizationVersion: 2
      }
    ]);
  });
});
