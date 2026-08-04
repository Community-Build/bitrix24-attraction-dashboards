import type Database from "better-sqlite3";

import type { MessengerMessageSnapshot } from "../../domain/messenger-messages.js";
import type { SqliteRepository } from "../sqlite-repository.js";

type MessengerMessageRepositoryMethods = Pick<
  SqliteRepository,
  | "replaceMessengerSessions"
  | "reconcileMessengerDealManagers"
  | "listMessengerMessages"
  | "getMessengerMessage"
>;

interface StoredMessengerMessageRow {
  id: string;
  sessionId: string;
  activityId: string;
  dealId: string;
  dealManagerId: string | null;
  occurredAt: string;
  occurredAtMs: number;
  channelKey: string;
  channelLabel: string;
  senderId: string;
  senderKind: MessengerMessageSnapshot["senderKind"];
  direction: MessengerMessageSnapshot["direction"];
  authorLabel: string | null;
  authorManagerId: string | null;
  text: string | null;
  rawText: string | null;
  attachmentFileIdsJson: string;
  hasAttachment: number;
  system: number;
  syncedAt: string;
}

function parseAttachmentFileIds(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.flatMap((item) =>
          typeof item === "string" && item.trim() ? [item.trim()] : []
        )
      : [];
  } catch {
    return [];
  }
}

function mapStoredMessage(row: StoredMessengerMessageRow): MessengerMessageSnapshot {
  return {
    id: row.id,
    sessionId: row.sessionId,
    activityId: row.activityId,
    dealId: row.dealId,
    dealManagerId: row.dealManagerId,
    occurredAt: row.occurredAt,
    occurredAtMs: row.occurredAtMs,
    channelKey: row.channelKey,
    channelLabel: row.channelLabel,
    senderId: row.senderId,
    senderKind: row.senderKind,
    direction: row.direction,
    authorLabel: row.authorLabel,
    authorManagerId: row.authorManagerId,
    text: row.text,
    rawText: row.rawText,
    attachmentFileIds: parseAttachmentFileIds(row.attachmentFileIdsJson),
    hasAttachment: row.hasAttachment === 1,
    system: row.system === 1,
    syncedAt: row.syncedAt
  };
}

const MESSAGE_SELECT = `
  SELECT
    m.message_id AS id,
    m.session_id AS sessionId,
    m.activity_id AS activityId,
    m.deal_id AS dealId,
    m.deal_manager_id AS dealManagerId,
    m.occurred_at AS occurredAt,
    m.occurred_at_ms AS occurredAtMs,
    m.channel_key AS channelKey,
    m.channel_label AS channelLabel,
    m.sender_id AS senderId,
    m.sender_kind AS senderKind,
    m.direction,
    m.author_label AS authorLabel,
    m.author_manager_id AS authorManagerId,
    m.message_text AS text,
    m.raw_text AS rawText,
    m.attachment_file_ids_json AS attachmentFileIdsJson,
    m.has_attachment AS hasAttachment,
    m.is_system AS system,
    m.synced_at AS syncedAt
  FROM messenger_message_snapshots m`;

export function createMessengerMessageRepositoryMethods(
  database: Database.Database
): MessengerMessageRepositoryMethods {
  const upsertSessionStatement = database.prepare(`
    INSERT INTO messenger_session_snapshots (
      session_id,
      activity_id,
      deal_id,
      deal_manager_id,
      channel_key,
      channel_label,
      activity_updated_at,
      synced_at
    ) VALUES (
      @sessionId,
      @activityId,
      @dealId,
      @dealManagerId,
      @channelKey,
      @channelLabel,
      @activityUpdatedAt,
      @syncedAt
    )
    ON CONFLICT(session_id) DO UPDATE SET
      activity_id = excluded.activity_id,
      deal_id = excluded.deal_id,
      deal_manager_id = excluded.deal_manager_id,
      channel_key = excluded.channel_key,
      channel_label = excluded.channel_label,
      activity_updated_at = excluded.activity_updated_at,
      synced_at = excluded.synced_at
  `);
  const deleteSessionMessagesStatement = database.prepare(`
    DELETE FROM messenger_message_snapshots WHERE session_id = ?
  `);
  const insertMessageStatement = database.prepare(`
    INSERT INTO messenger_message_snapshots (
      session_id,
      message_id,
      activity_id,
      deal_id,
      deal_manager_id,
      occurred_at,
      occurred_at_ms,
      channel_key,
      channel_label,
      sender_id,
      sender_kind,
      direction,
      author_label,
      author_manager_id,
      message_text,
      raw_text,
      attachment_file_ids_json,
      has_attachment,
      is_system,
      synced_at
    ) VALUES (
      @sessionId,
      @id,
      @activityId,
      @dealId,
      @dealManagerId,
      @occurredAt,
      @occurredAtMs,
      @channelKey,
      @channelLabel,
      @senderId,
      @senderKind,
      @direction,
      @authorLabel,
      @authorManagerId,
      @text,
      @rawText,
      @attachmentFileIdsJson,
      @hasAttachment,
      @system,
      @syncedAt
    )
  `);
  const replaceSessionsTransaction = database.transaction(
    (items: Parameters<SqliteRepository["replaceMessengerSessions"]>[0]) => {
      let messageCount = 0;
      for (const item of items) {
        upsertSessionStatement.run(item.session);
        deleteSessionMessagesStatement.run(item.session.sessionId);
        for (const message of item.messages) {
          insertMessageStatement.run({
            ...message,
            attachmentFileIdsJson: JSON.stringify(message.attachmentFileIds),
            hasAttachment: message.hasAttachment ? 1 : 0,
            system: message.system ? 1 : 0
          });
          messageCount += 1;
        }
      }
      return { sessions: items.length, messages: messageCount };
    }
  );
  const updateSessionDealManagerStatement = database.prepare(`
    UPDATE messenger_session_snapshots
    SET deal_manager_id = @managerId
    WHERE deal_id = @dealId
  `);
  const updateMessageDealManagerStatement = database.prepare(`
    UPDATE messenger_message_snapshots
    SET deal_manager_id = @managerId
    WHERE deal_id = @dealId
  `);
  const reconcileDealManagersTransaction = database.transaction(
    (rows: Parameters<SqliteRepository["reconcileMessengerDealManagers"]>[0]) => {
      let sessions = 0;
      let messages = 0;
      for (const row of rows) {
        sessions += updateSessionDealManagerStatement.run(row).changes;
        messages += updateMessageDealManagerStatement.run(row).changes;
      }
      return { sessions, messages };
    }
  );

  return {
    replaceMessengerSessions(items) {
      return Promise.resolve(replaceSessionsTransaction(items));
    },

    reconcileMessengerDealManagers(rows) {
      return Promise.resolve(reconcileDealManagersTransaction(rows));
    },

    async listMessengerMessages(query) {
      const fromMs = Date.parse(query.from);
      const toMs = Date.parse(query.to);
      const managerIds = [...new Set(query.managerIds ?? [])];
      const managerClause =
        managerIds.length > 0
          ? `AND (
              CASE
                WHEN m.direction = 'outgoing' AND m.author_manager_id IS NOT NULL
                  THEN m.author_manager_id
                ELSE m.deal_manager_id
              END
            ) IN (${managerIds.map(() => "?").join(", ")})`
          : "";
      const rows = database
        .prepare(
          `${MESSAGE_SELECT}
          INNER JOIN attraction_current_deal_ids scope
            ON scope.deal_id = m.deal_id
          WHERE m.occurred_at_ms >= ? AND m.occurred_at_ms <= ?
          ${managerClause}
          ORDER BY m.occurred_at_ms ASC, m.session_id ASC, m.message_id ASC`
        )
        .all(fromMs, toMs, ...managerIds) as StoredMessengerMessageRow[];

      return rows.map(mapStoredMessage);
    },

    async getMessengerMessage(input) {
      const row = database
        .prepare(
          `${MESSAGE_SELECT}
          INNER JOIN attraction_current_deal_ids scope
            ON scope.deal_id = m.deal_id
          WHERE m.session_id = ? AND m.message_id = ?
          LIMIT 1`
        )
        .get(input.sessionId, input.messageId) as
        | StoredMessengerMessageRow
        | undefined;

      return row ? mapStoredMessage(row) : null;
    }
  };
}
