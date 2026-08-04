export type MessengerSenderKind = "connector" | "operator" | "unknown";
export type MessengerMessageDirection = "outgoing" | "incoming" | "unknown";

export interface MessengerManagerIdentity {
  managerId: string;
  managerName: string;
}

export interface MessengerSessionSnapshot {
  sessionId: string;
  activityId: string;
  dealId: string;
  dealManagerId: string | null;
  channelKey: string;
  channelLabel: string;
  activityUpdatedAt: string;
  syncedAt: string;
}

export interface MessengerMessageSnapshot {
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
  senderKind: MessengerSenderKind;
  direction: MessengerMessageDirection;
  authorLabel: string | null;
  authorManagerId: string | null;
  text: string | null;
  rawText: string | null;
  attachmentFileIds: string[];
  hasAttachment: boolean;
  system: boolean;
  syncedAt: string;
}

export interface OpenLineSessionHistoryInput {
  sessionId: string;
  chat: {
    id: string | null;
    entityId: string | null;
    entityType: string | null;
  };
  messages: Array<{
    id: string;
    chatId: string | null;
    senderId: string;
    date: string;
    text: string | null;
    attachmentFileIds?: string[];
    hasAttachment: boolean;
  }>;
  users: Array<{
    id: string;
    connector: boolean | null;
  }>;
}

const WAZZUP_OUTGOING_MARKER =
  /^\s*===\s*Исходящее сообщение(?:,\s*автор:\s*(.+?))?\s*===\s*(?:\r?\n)?/iu;
const WAZZUP_SYSTEM_MARKER = /^\s*===\s*SYSTEM\s+WZ\s*===/iu;
const GENERIC_AUTHOR_TOKENS = new Set([
  "битрикс",
  "битрикс24",
  "телефон"
]);

export function extractOpenLineSessionId(originId: string | null) {
  return /^IMOL_(\d+)$/u.exec(originId ?? "")?.[1] ?? null;
}

export function resolveMessengerChannel(entityId: string | null) {
  const normalized = entityId?.trim().toLowerCase() ?? "";

  if (normalized.startsWith("wz_telegram")) {
    return { key: "wz_telegram", label: "WAZZUP: Telegram" };
  }
  if (normalized.startsWith("wz_max")) {
    return { key: "wz_max", label: "WAZZUP: Max" };
  }
  if (
    normalized.startsWith("wz_") &&
    (normalized.includes("whatsapp") || normalized.includes("_wa"))
  ) {
    return { key: "wz_whatsapp", label: "WAZZUP: WhatsApp" };
  }
  if (normalized.includes("olchat_tg")) {
    return { key: "olchat_telegram", label: "OLChat: Telegram" };
  }
  if (normalized.includes("olchat_wa")) {
    return { key: "olchat_whatsapp", label: "OLChat: WhatsApp" };
  }
  if (normalized.includes("umnico") && normalized.includes("telegram")) {
    return { key: "umnico_telegram", label: "Umnico: Telegram" };
  }
  if (normalized.includes("umnico")) {
    return { key: "umnico", label: "Umnico" };
  }

  return { key: "unknown", label: "Неизвестный канал" };
}

export function normalizeMessengerAttachmentFileIds(
  fileIds: string[] | undefined
) {
  return [
    ...new Set(
      (fileIds ?? []).flatMap((fileId) => {
        const normalized = String(fileId).trim();
        return normalized ? [normalized] : [];
      })
    )
  ];
}

function normalizeNameTokens(value: string) {
  const parenthesized = /\(([^)]+)\)/u.exec(value)?.[1] ?? value;
  return parenthesized
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !GENERIC_AUTHOR_TOKENS.has(token));
}

export function resolveMessengerAuthorManagerId(input: {
  authorLabel: string | null;
  senderId: string;
  senderKind: MessengerSenderKind;
  managers: MessengerManagerIdentity[];
}) {
  if (input.senderKind === "operator") {
    const senderManager = input.managers.find(
      (manager) => manager.managerId === input.senderId
    );
    if (senderManager) {
      return senderManager.managerId;
    }
  }

  if (!input.authorLabel) {
    return null;
  }

  const authorTokens = new Set(normalizeNameTokens(input.authorLabel));
  if (authorTokens.size === 0) {
    return null;
  }

  const matches = input.managers
    .map((manager) => {
      const managerTokens = normalizeNameTokens(manager.managerName);
      const score = managerTokens.filter((token) => authorTokens.has(token)).length;
      const requiredScore = Math.min(2, managerTokens.length);
      return { managerId: manager.managerId, score, requiredScore };
    })
    .filter((match) => match.requiredScore > 0 && match.score >= match.requiredScore)
    .sort((left, right) => right.score - left.score);

  if (matches.length === 0 || matches[0]?.score === matches[1]?.score) {
    return null;
  }

  return matches[0]?.managerId ?? null;
}

export function classifyMessengerMessage(input: {
  channelKey: string;
  senderKind: MessengerSenderKind;
  text: string | null;
}) {
  const rawText = input.text;
  if (rawText && WAZZUP_SYSTEM_MARKER.test(rawText)) {
    return {
      system: true,
      direction: "unknown" as const,
      authorLabel: null,
      text: null,
      rawText
    };
  }

  if (rawText) {
    const outgoingMatch = WAZZUP_OUTGOING_MARKER.exec(rawText);
    if (outgoingMatch) {
      return {
        system: false,
        direction: "outgoing" as const,
        authorLabel: outgoingMatch[1]?.trim() || null,
        text: rawText.slice(outgoingMatch[0].length).trim() || null,
        rawText
      };
    }
  }

  if (input.senderKind === "operator") {
    return {
      system: false,
      direction: "outgoing" as const,
      authorLabel: null,
      text: rawText,
      rawText
    };
  }

  if (input.channelKey.startsWith("wz_")) {
    return {
      system: false,
      direction: "incoming" as const,
      authorLabel: null,
      text: rawText,
      rawText
    };
  }

  return {
    system: false,
    direction: "unknown" as const,
    authorLabel: null,
    text: rawText,
    rawText
  };
}

export function buildMessengerSessionSnapshot(input: {
  activity: {
    id: string;
    dealId: string;
    dealManagerId: string | null;
    updatedAt: string;
  };
  history: OpenLineSessionHistoryInput;
  managers: MessengerManagerIdentity[];
  syncedAt: string;
}) {
  const channel = resolveMessengerChannel(input.history.chat.entityId);
  const users = new Map(input.history.users.map((user) => [user.id, user]));
  const seenMessageIds = new Set<string>();
  const messages: MessengerMessageSnapshot[] = [];

  for (const message of input.history.messages) {
    if (seenMessageIds.has(message.id)) {
      continue;
    }
    seenMessageIds.add(message.id);

    const occurredAtMs = Date.parse(message.date);
    if (!Number.isFinite(occurredAtMs)) {
      continue;
    }

    const connector = users.get(message.senderId)?.connector;
    const senderKind: MessengerSenderKind =
      connector === true
        ? "connector"
        : connector === false
          ? "operator"
          : "unknown";
    const classification = classifyMessengerMessage({
      channelKey: channel.key,
      senderKind,
      text: message.text
    });
    const system = message.senderId === "0" || classification.system;
    const attachmentFileIds = normalizeMessengerAttachmentFileIds(
      message.attachmentFileIds
    );
    const authorManagerId =
      !system && classification.direction === "outgoing"
        ? resolveMessengerAuthorManagerId({
            authorLabel: classification.authorLabel,
            senderId: message.senderId,
            senderKind,
            managers: input.managers
          })
        : null;

    messages.push({
      id: message.id,
      sessionId: input.history.sessionId,
      activityId: input.activity.id,
      dealId: input.activity.dealId,
      dealManagerId: input.activity.dealManagerId,
      occurredAt: message.date,
      occurredAtMs,
      channelKey: channel.key,
      channelLabel: channel.label,
      senderId: message.senderId,
      senderKind,
      direction: classification.direction,
      authorLabel: classification.authorLabel,
      authorManagerId,
      text: classification.text,
      rawText: classification.rawText,
      attachmentFileIds,
      hasAttachment: message.hasAttachment || attachmentFileIds.length > 0,
      system,
      syncedAt: input.syncedAt
    });
  }

  messages.sort(
    (left, right) =>
      left.occurredAtMs - right.occurredAtMs || left.id.localeCompare(right.id)
  );

  return {
    session: {
      sessionId: input.history.sessionId,
      activityId: input.activity.id,
      dealId: input.activity.dealId,
      dealManagerId: input.activity.dealManagerId,
      channelKey: channel.key,
      channelLabel: channel.label,
      activityUpdatedAt: input.activity.updatedAt,
      syncedAt: input.syncedAt
    } satisfies MessengerSessionSnapshot,
    messages
  };
}
