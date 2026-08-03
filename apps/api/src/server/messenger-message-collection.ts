type MessengerMessageRepository = {
  getManagerWhitelistSettings(moduleKey: string): Promise<
    Array<{
      managerId: string;
      managerName: string;
      enabled: boolean;
    }>
  >;
  getCurrentAttractionScope(): Promise<{
    dealIds: string[];
  }>;
  getDealsByIds(dealIds: string[]): Promise<
    Array<{
      id: string;
      assignedById: string | null;
    }>
  >;
};

type MessengerMessageClient = {
  listOpenLineActivities(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
  }): Promise<
    Array<{
      ID: string;
      OWNER_ID: string;
      ORIGIN_ID: string | null;
    }>
  >;
  getOpenLineSessionHistory(sessionId: string): Promise<{
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
      hasAttachment: boolean;
    }>;
    users: Array<{
      id: string;
      connector: boolean | null;
    }>;
  }>;
};

export type MessengerSenderKind = "connector" | "operator" | "unknown";

export interface MessengerAnalysisMessage {
  id: string;
  sessionId: string;
  activityId: string;
  dealId: string;
  managerId: string;
  occurredAt: string;
  channel: {
    key: string;
    label: string;
  };
  senderKind: MessengerSenderKind;
  direction: "unknown";
  text: string | null;
  hasAttachment: boolean;
}

export interface MessengerAnalysisBatch {
  managerId: string;
  managerName: string;
  from: string;
  to: string;
  messages: MessengerAnalysisMessage[];
}

export interface MessengerMessageSummary {
  managerId: string;
  managerName: string;
  from: string;
  to: string;
  currentDeals: number;
  sessions: number;
  messages: number;
  messagesWithText: number;
  attachmentOnlyMessages: number;
  systemMessagesExcluded: number;
  senderKinds: Record<MessengerSenderKind, number>;
  channels: Array<{
    key: string;
    label: string;
    messages: number;
  }>;
  directionAvailable: false;
  personalAuthorAvailable: false;
}

export interface MessengerMessageCollectionInput {
  managerId: string;
  from: string;
  to: string;
}

export class MessengerMessageCollectionError extends Error {
  constructor(
    readonly code: "INVALID_RANGE" | "MANAGER_NOT_ENABLED",
    message: string
  ) {
    super(message);
    this.name = "MessengerMessageCollectionError";
  }
}

const MAX_COLLECTION_RANGE_MS = 31 * 24 * 60 * 60 * 1_000;

function parseCollectionRange(input: MessengerMessageCollectionInput) {
  const from = Date.parse(input.from);
  const to = Date.parse(input.to);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from > to ||
    to - from > MAX_COLLECTION_RANGE_MS
  ) {
    throw new MessengerMessageCollectionError(
      "INVALID_RANGE",
      "Messenger message collection requires a valid range of at most 31 days."
    );
  }

  return { from, to };
}

function extractSessionId(originId: string | null) {
  return /^IMOL_(\d+)$/u.exec(originId ?? "")?.[1] ?? null;
}

function resolveChannel(entityId: string | null) {
  const normalized = entityId?.trim().toLowerCase() ?? "";

  if (normalized.startsWith("wz_telegram")) {
    return { key: "wz_telegram", label: "WAZZUP: Telegram" };
  }
  if (normalized.startsWith("wz_max")) {
    return { key: "wz_max", label: "WAZZUP: Max" };
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

  return {
    key: normalized || "unknown",
    label: entityId?.trim() || "Неизвестный канал"
  };
}

function isInsideRange(value: string, from: number, to: number) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
}

export function createMessengerMessageCollectionService(input: {
  repository: MessengerMessageRepository;
  client: MessengerMessageClient;
}) {
  async function collectBatch(
    request: MessengerMessageCollectionInput
  ): Promise<{
    batch: MessengerAnalysisBatch;
    summary: MessengerMessageSummary;
  }> {
    const range = parseCollectionRange(request);
    const settings = await input.repository.getManagerWhitelistSettings(
      "attraction"
    );
    const manager = settings.find(
      (setting) => setting.enabled && setting.managerId === request.managerId
    );
    if (!manager) {
      throw new MessengerMessageCollectionError(
        "MANAGER_NOT_ENABLED",
        "Manager is not enabled for attraction message analysis."
      );
    }

    const scope = await input.repository.getCurrentAttractionScope();
    const scopedDeals = await input.repository.getDealsByIds(scope.dealIds);
    const managerDeals = scopedDeals.filter(
      (deal) => deal.assignedById === request.managerId
    );
    const managerDealIds = new Set(managerDeals.map((deal) => deal.id));
    const activities = await input.client.listOpenLineActivities({
      ownerIds: [...managerDealIds],
      modifiedAfter: request.from
    });
    const sessions = new Map<
      string,
      { activityId: string; dealId: string }
    >();
    for (const activity of activities) {
      const sessionId = extractSessionId(activity.ORIGIN_ID);
      if (sessionId && managerDealIds.has(activity.OWNER_ID)) {
        sessions.set(sessionId, {
          activityId: activity.ID,
          dealId: activity.OWNER_ID
        });
      }
    }

    const messages: MessengerAnalysisMessage[] = [];
    const seenMessageIds = new Set<string>();
    let systemMessagesExcluded = 0;

    for (const [sessionId, activity] of sessions) {
      const history = await input.client.getOpenLineSessionHistory(sessionId);
      const users = new Map(history.users.map((user) => [user.id, user]));
      const channel = resolveChannel(history.chat.entityId);

      for (const message of history.messages) {
        if (!isInsideRange(message.date, range.from, range.to)) {
          continue;
        }

        const messageKey = `${sessionId}:${message.id}`;
        if (seenMessageIds.has(messageKey)) {
          continue;
        }
        seenMessageIds.add(messageKey);

        if (message.senderId === "0") {
          systemMessagesExcluded += 1;
          continue;
        }

        const connector = users.get(message.senderId)?.connector;
        const senderKind: MessengerSenderKind =
          connector === true
            ? "connector"
            : connector === false
              ? "operator"
              : "unknown";
        messages.push({
          id: message.id,
          sessionId,
          activityId: activity.activityId,
          dealId: activity.dealId,
          managerId: request.managerId,
          occurredAt: message.date,
          channel,
          senderKind,
          direction: "unknown",
          text: message.text,
          hasAttachment: message.hasAttachment
        });
      }
    }

    messages.sort((left, right) =>
      left.occurredAt === right.occurredAt
        ? left.id.localeCompare(right.id)
        : left.occurredAt.localeCompare(right.occurredAt)
    );
    const channelCounts = new Map<
      string,
      { key: string; label: string; messages: number }
    >();
    const senderKinds: Record<MessengerSenderKind, number> = {
      connector: 0,
      operator: 0,
      unknown: 0
    };
    for (const message of messages) {
      senderKinds[message.senderKind] += 1;
      const channel = channelCounts.get(message.channel.key) ?? {
        ...message.channel,
        messages: 0
      };
      channel.messages += 1;
      channelCounts.set(channel.key, channel);
    }

    return {
      batch: {
        managerId: request.managerId,
        managerName: manager.managerName,
        from: request.from,
        to: request.to,
        messages
      },
      summary: {
        managerId: request.managerId,
        managerName: manager.managerName,
        from: request.from,
        to: request.to,
        currentDeals: managerDeals.length,
        sessions: sessions.size,
        messages: messages.length,
        messagesWithText: messages.filter(
          (message) => message.text?.trim().length
        ).length,
        attachmentOnlyMessages: messages.filter(
          (message) => !message.text?.trim() && message.hasAttachment
        ).length,
        systemMessagesExcluded,
        senderKinds,
        channels: [...channelCounts.values()].sort(
          (left, right) =>
            right.messages - left.messages || left.label.localeCompare(right.label)
        ),
        directionAvailable: false,
        personalAuthorAvailable: false
      }
    };
  }

  return {
    async getManagerMessageSummary(request: MessengerMessageCollectionInput) {
      return (await collectBatch(request)).summary;
    },
    async analyzeManagerMessages<T>(
      request: MessengerMessageCollectionInput,
      analyzer: (batch: MessengerAnalysisBatch) => Promise<T>
    ) {
      const { batch, summary } = await collectBatch(request);
      return {
        summary,
        analysis: await analyzer(batch)
      };
    }
  };
}
