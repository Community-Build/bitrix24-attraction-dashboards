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
      attachmentFileIds?: string[];
      hasAttachment: boolean;
    }>;
    users: Array<{
      id: string;
      connector: boolean | null;
    }>;
  }>;
  downloadDiskFile?(
    fileId: string,
    options: { maxBytes: number }
  ): Promise<{
    fileId: string;
    fileName: string;
    bytes: Buffer;
  } | null>;
};

export type MessengerSenderKind = "connector" | "operator" | "unknown";
export type MessengerMessageDirection = "outgoing" | "incoming" | "unknown";

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
  direction: MessengerMessageDirection;
  authorLabel: string | null;
  text: string | null;
  attachmentFileIds: string[];
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
  uniqueDialogs: number;
  dealsWithMessages: number;
  messages: number;
  outgoingMessages: number;
  incomingMessages: number;
  unknownDirectionMessages: number;
  uniqueOutgoingDialogs: number;
  dealsWithOutgoingMessages: number;
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
  personalAuthorAvailable: boolean;
}

export interface MessengerMessageCollectionInput {
  managerId: string;
  from: string;
  to: string;
}

export interface MessengerReportSummaryInput {
  managerIds?: string[];
  from: string;
  to: string;
}

export interface MessengerReportSummary {
  from: string;
  to: string;
  totalMessages: number;
  outgoingMessages: number;
  incomingMessages: number;
  unknownDirectionMessages: number;
  uniqueOutgoingDialogs: number;
  dealsWithOutgoingMessages: number;
  messagesWithText: number;
  attachmentOnlyMessages: number;
  uniqueDialogs: number;
  dealsWithMessages: number;
  systemMessagesExcluded: number;
  managerRows: MessengerMessageSummary[];
  directionAvailable: false;
  personalAuthorAvailable: boolean;
}

export interface MessengerMessageDetailsInput
  extends MessengerMessageCollectionInput {
  limit?: number;
}

export interface MessengerMessageAttachmentInput
  extends MessengerMessageCollectionInput {
  sessionId: string;
  messageId: string;
  fileId: string;
}

export interface MessengerMessageAttachment {
  fileId: string;
  fileName: string;
  bytes: Buffer;
}

export interface MessengerMessageDetails {
  managerId: string;
  managerName: string;
  from: string;
  to: string;
  totalMessages: number;
  returnedMessages: number;
  truncated: boolean;
  directionAvailable: false;
  personalAuthorAvailable: boolean;
  messages: Array<{
    id: string;
    sessionId: string;
    dealId: string;
    occurredAt: string;
    channel: {
      key: string;
      label: string;
    };
    senderKind: MessengerSenderKind;
    direction: MessengerMessageDirection;
    authorLabel: string | null;
    text: string | null;
    dealUrl: string | null;
    attachments: Array<{ id: string }>;
    hasAttachment: boolean;
  }>;
}

export class MessengerMessageCollectionError extends Error {
  constructor(
    readonly code:
      | "INVALID_RANGE"
      | "INVALID_LIMIT"
      | "MANAGER_NOT_ENABLED"
      | "ATTACHMENT_NOT_FOUND"
      | "ATTACHMENT_UNAVAILABLE"
      | "ATTACHMENT_TOO_LARGE",
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "MessengerMessageCollectionError";
  }
}

const MAX_COLLECTION_RANGE_MS = 31 * 24 * 60 * 60 * 1_000;
const MAX_DETAIL_MESSAGES = 500;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const WAZZUP_OUTGOING_MARKER =
  /^\s*===\s*Исходящее сообщение(?:,\s*автор:\s*(.+?))?\s*===\s*(?:\r?\n)?/iu;
const WAZZUP_SYSTEM_MARKER = /^\s*===\s*SYSTEM\s+WZ\s*===/iu;

function parseCollectionRange(input: { from: string; to: string }) {
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

  return {
    key: "unknown",
    label: "Неизвестный канал"
  };
}

function isInsideRange(value: string, from: number, to: number) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
}

function normalizeAttachmentFileIds(fileIds: string[] | undefined) {
  return [
    ...new Set(
      (fileIds ?? []).flatMap((fileId) => {
        const normalized = String(fileId).trim();
        return normalized ? [normalized] : [];
      })
    )
  ];
}

function classifyMessage(input: {
  channelKey: string;
  senderKind: MessengerSenderKind;
  text: string | null;
}) {
  const text = input.text;
  if (text && WAZZUP_SYSTEM_MARKER.test(text)) {
    return {
      system: true,
      direction: "unknown" as const,
      authorLabel: null,
      text: null
    };
  }

  if (text) {
    const outgoingMatch = WAZZUP_OUTGOING_MARKER.exec(text);
    if (outgoingMatch) {
      const authorLabel = outgoingMatch[1]?.trim() || null;
      const messageText = text.slice(outgoingMatch[0].length).trim() || null;
      return {
        system: false,
        direction: "outgoing" as const,
        authorLabel,
        text: messageText
      };
    }
  }

  if (input.senderKind === "operator") {
    return {
      system: false,
      direction: "outgoing" as const,
      authorLabel: null,
      text
    };
  }

  if (input.channelKey.startsWith("wz_")) {
    return {
      system: false,
      direction: "incoming" as const,
      authorLabel: null,
      text
    };
  }

  return {
    system: false,
    direction: "unknown" as const,
    authorLabel: null,
    text
  };
}

function buildDealUrl(portalHost: string | undefined, dealId: string) {
  const normalizedHost = portalHost?.trim();
  if (!normalizedHost) {
    return null;
  }

  try {
    const portalUrl = new URL(`https://${normalizedHost}`);
    if (portalUrl.protocol !== "https:" || portalUrl.hostname !== normalizedHost) {
      return null;
    }
    return `${portalUrl.origin}/crm/deal/details/${encodeURIComponent(dealId)}/`;
  } catch {
    return null;
  }
}

function readErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

export function createMessengerMessageCollectionService(input: {
  repository: MessengerMessageRepository;
  client: MessengerMessageClient;
  portalHost?: string;
}) {
  type EnabledManager = {
    managerId: string;
    managerName: string;
  };

  type CollectedScope = {
    managers: EnabledManager[];
    currentDealsByManager: Map<string, number>;
    sessionsByManager: Map<string, number>;
    systemMessagesExcludedByManager: Map<string, number>;
    messages: MessengerAnalysisMessage[];
  };

  function buildManagerSummary(
    manager: EnabledManager,
    request: { from: string; to: string },
    collected: CollectedScope
  ): MessengerMessageSummary {
    const messages = collected.messages.filter(
      (message) => message.managerId === manager.managerId
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
    const outgoingMessages = messages.filter(
      (message) => message.direction === "outgoing"
    );

    return {
      managerId: manager.managerId,
      managerName: manager.managerName,
      from: request.from,
      to: request.to,
      currentDeals:
        collected.currentDealsByManager.get(manager.managerId) ?? 0,
      sessions: collected.sessionsByManager.get(manager.managerId) ?? 0,
      uniqueDialogs: new Set(messages.map((message) => message.sessionId)).size,
      dealsWithMessages: new Set(messages.map((message) => message.dealId)).size,
      messages: messages.length,
      outgoingMessages: outgoingMessages.length,
      incomingMessages: messages.filter(
        (message) => message.direction === "incoming"
      ).length,
      unknownDirectionMessages: messages.filter(
        (message) => message.direction === "unknown"
      ).length,
      uniqueOutgoingDialogs: new Set(
        outgoingMessages.map((message) => message.sessionId)
      ).size,
      dealsWithOutgoingMessages: new Set(
        outgoingMessages.map((message) => message.dealId)
      ).size,
      messagesWithText: messages.filter(
        (message) => Boolean(message.text?.trim())
      ).length,
      attachmentOnlyMessages: messages.filter(
        (message) => !message.text?.trim() && message.hasAttachment
      ).length,
      systemMessagesExcluded:
        collected.systemMessagesExcludedByManager.get(manager.managerId) ?? 0,
      senderKinds,
      channels: [...channelCounts.values()].sort(
        (left, right) =>
          right.messages - left.messages || left.label.localeCompare(right.label)
      ),
      directionAvailable: false,
      personalAuthorAvailable: messages.some((message) => message.authorLabel)
    };
  }

  async function collectScope(
    request: MessengerReportSummaryInput
  ): Promise<CollectedScope> {
    const range = parseCollectionRange(request);
    const settings = await input.repository.getManagerWhitelistSettings(
      "attraction"
    );
    const enabledManagers = settings.filter((setting) => setting.enabled);
    const requestedManagerIds = [
      ...new Set((request.managerIds ?? []).map((managerId) => managerId.trim()))
    ];
    const requestedManagerIdSet = new Set(requestedManagerIds);
    const managers = (
      requestedManagerIds.length > 0
        ? enabledManagers.filter((manager) =>
            requestedManagerIdSet.has(manager.managerId)
          )
        : enabledManagers
    ).map(({ managerId, managerName }) => ({ managerId, managerName }));
    const enabledManagerIdSet = new Set(
      enabledManagers.map((manager) => manager.managerId)
    );
    if (
      requestedManagerIds.some(
        (managerId) => !managerId || !enabledManagerIdSet.has(managerId)
      )
    ) {
      throw new MessengerMessageCollectionError(
        "MANAGER_NOT_ENABLED",
        "At least one manager is not enabled for attraction message analysis."
      );
    }

    const scope = await input.repository.getCurrentAttractionScope();
    const scopedDeals = await input.repository.getDealsByIds(scope.dealIds);
    const managerIdSet = new Set(managers.map((manager) => manager.managerId));
    const selectedDeals = scopedDeals.filter(
      (deal) => deal.assignedById && managerIdSet.has(deal.assignedById)
    );
    const dealManagerIds = new Map(
      selectedDeals.map((deal) => [deal.id, deal.assignedById as string])
    );
    const currentDealsByManager = new Map<string, number>();
    for (const deal of selectedDeals) {
      const managerId = deal.assignedById as string;
      currentDealsByManager.set(
        managerId,
        (currentDealsByManager.get(managerId) ?? 0) + 1
      );
    }

    const ownerIds = selectedDeals.map((deal) => deal.id);
    const activities =
      ownerIds.length > 0
        ? await input.client.listOpenLineActivities({
            ownerIds,
            modifiedAfter: request.from
          })
        : [];
    const sessions = new Map<
      string,
      { activityId: string; dealId: string; managerId: string }
    >();
    for (const activity of activities) {
      const sessionId = extractSessionId(activity.ORIGIN_ID);
      const managerId = dealManagerIds.get(activity.OWNER_ID);
      if (sessionId && managerId) {
        sessions.set(sessionId, {
          activityId: activity.ID,
          dealId: activity.OWNER_ID,
          managerId
        });
      }
    }

    const messages: MessengerAnalysisMessage[] = [];
    const seenMessageIds = new Set<string>();
    const sessionsByManager = new Map<string, number>();
    const systemMessagesExcludedByManager = new Map<string, number>();

    for (const [sessionId, activity] of sessions) {
      sessionsByManager.set(
        activity.managerId,
        (sessionsByManager.get(activity.managerId) ?? 0) + 1
      );
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
          systemMessagesExcludedByManager.set(
            activity.managerId,
            (systemMessagesExcludedByManager.get(activity.managerId) ?? 0) + 1
          );
          continue;
        }

        const connector = users.get(message.senderId)?.connector;
        const senderKind: MessengerSenderKind =
          connector === true
            ? "connector"
            : connector === false
              ? "operator"
              : "unknown";
        const classification = classifyMessage({
          channelKey: channel.key,
          senderKind,
          text: message.text
        });
        if (classification.system) {
          systemMessagesExcludedByManager.set(
            activity.managerId,
            (systemMessagesExcludedByManager.get(activity.managerId) ?? 0) + 1
          );
          continue;
        }
        const attachmentFileIds = normalizeAttachmentFileIds(
          message.attachmentFileIds
        );
        messages.push({
          id: message.id,
          sessionId,
          activityId: activity.activityId,
          dealId: activity.dealId,
          managerId: activity.managerId,
          occurredAt: message.date,
          channel,
          senderKind,
          direction: classification.direction,
          authorLabel: classification.authorLabel,
          text: classification.text,
          attachmentFileIds,
          hasAttachment: message.hasAttachment || attachmentFileIds.length > 0
        });
      }
    }

    messages.sort((left, right) => {
      const timestampDelta =
        Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
      return timestampDelta || left.id.localeCompare(right.id);
    });
    return {
      managers,
      currentDealsByManager,
      sessionsByManager,
      systemMessagesExcludedByManager,
      messages
    };
  }

  async function collectBatch(
    request: MessengerMessageCollectionInput
  ): Promise<{
    batch: MessengerAnalysisBatch;
    summary: MessengerMessageSummary;
  }> {
    const collected = await collectScope({
      managerIds: [request.managerId],
      from: request.from,
      to: request.to
    });
    const manager = collected.managers[0];
    if (!manager) {
      throw new MessengerMessageCollectionError(
        "MANAGER_NOT_ENABLED",
        "Manager is not enabled for attraction message analysis."
      );
    }
    const messages = collected.messages.filter(
      (message) => message.managerId === manager.managerId
    );

    return {
      batch: {
        managerId: manager.managerId,
        managerName: manager.managerName,
        from: request.from,
        to: request.to,
        messages
      },
      summary: buildManagerSummary(manager, request, collected)
    };
  }

  return {
    async getManagerMessageSummary(request: MessengerMessageCollectionInput) {
      return (await collectBatch(request)).summary;
    },
    async getMessengerReportSummary(
      request: MessengerReportSummaryInput
    ): Promise<MessengerReportSummary> {
      const collected = await collectScope(request);
      const outgoingMessages = collected.messages.filter(
        (message) => message.direction === "outgoing"
      );
      return {
        from: request.from,
        to: request.to,
        totalMessages: collected.messages.length,
        outgoingMessages: outgoingMessages.length,
        incomingMessages: collected.messages.filter(
          (message) => message.direction === "incoming"
        ).length,
        unknownDirectionMessages: collected.messages.filter(
          (message) => message.direction === "unknown"
        ).length,
        uniqueOutgoingDialogs: new Set(
          outgoingMessages.map((message) => message.sessionId)
        ).size,
        dealsWithOutgoingMessages: new Set(
          outgoingMessages.map((message) => message.dealId)
        ).size,
        messagesWithText: collected.messages.filter((message) =>
          Boolean(message.text?.trim())
        ).length,
        attachmentOnlyMessages: collected.messages.filter(
          (message) => !message.text?.trim() && message.hasAttachment
        ).length,
        uniqueDialogs: new Set(
          collected.messages.map((message) => message.sessionId)
        ).size,
        dealsWithMessages: new Set(
          collected.messages.map((message) => message.dealId)
        ).size,
        systemMessagesExcluded: [
          ...collected.systemMessagesExcludedByManager.values()
        ].reduce((total, count) => total + count, 0),
        managerRows: collected.managers.map((manager) =>
          buildManagerSummary(manager, request, collected)
        ),
        directionAvailable: false,
        personalAuthorAvailable: collected.messages.some(
          (message) => message.authorLabel
        )
      };
    },
    async getManagerMessageDetails(
      request: MessengerMessageDetailsInput
    ): Promise<MessengerMessageDetails> {
      const limit = request.limit ?? MAX_DETAIL_MESSAGES;
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > MAX_DETAIL_MESSAGES
      ) {
        throw new MessengerMessageCollectionError(
          "INVALID_LIMIT",
          `Messenger message detail limit must be between 1 and ${MAX_DETAIL_MESSAGES}.`
        );
      }

      const { batch } = await collectBatch(request);
      const selectedMessages = batch.messages.slice(-limit);
      return {
        managerId: batch.managerId,
        managerName: batch.managerName,
        from: batch.from,
        to: batch.to,
        totalMessages: batch.messages.length,
        returnedMessages: selectedMessages.length,
        truncated: selectedMessages.length < batch.messages.length,
        directionAvailable: false,
        personalAuthorAvailable: batch.messages.some(
          (message) => message.authorLabel
        ),
        messages: selectedMessages.map((message) => ({
          id: message.id,
          sessionId: message.sessionId,
          dealId: message.dealId,
          occurredAt: message.occurredAt,
          channel: message.channel,
          senderKind: message.senderKind,
          direction: message.direction,
          authorLabel: message.authorLabel,
          text: message.text,
          dealUrl: buildDealUrl(input.portalHost, message.dealId),
          attachments: message.attachmentFileIds.map((id) => ({ id })),
          hasAttachment: message.hasAttachment
        }))
      };
    },
    async getManagerMessageAttachment(
      request: MessengerMessageAttachmentInput
    ): Promise<MessengerMessageAttachment> {
      const { batch } = await collectBatch(request);
      const message = batch.messages.find(
        (candidate) =>
          candidate.sessionId === request.sessionId &&
          candidate.id === request.messageId
      );
      if (!message?.attachmentFileIds.includes(request.fileId)) {
        throw new MessengerMessageCollectionError(
          "ATTACHMENT_NOT_FOUND",
          "Messenger attachment was not found in the requested message.",
          404
        );
      }
      if (!input.client.downloadDiskFile) {
        throw new MessengerMessageCollectionError(
          "ATTACHMENT_UNAVAILABLE",
          "Messenger attachment download is unavailable.",
          503
        );
      }

      try {
        const attachment = await input.client.downloadDiskFile(request.fileId, {
          maxBytes: MAX_ATTACHMENT_BYTES
        });
        if (!attachment) {
          throw new MessengerMessageCollectionError(
            "ATTACHMENT_NOT_FOUND",
            "Messenger attachment was not found.",
            404
          );
        }
        return attachment;
      } catch (error) {
        if (error instanceof MessengerMessageCollectionError) {
          throw error;
        }
        if (readErrorCode(error) === "DISK_FILE_TOO_LARGE") {
          throw new MessengerMessageCollectionError(
            "ATTACHMENT_TOO_LARGE",
            "Messenger attachment exceeds the download limit.",
            413
          );
        }
        throw new MessengerMessageCollectionError(
          "ATTACHMENT_UNAVAILABLE",
          "Messenger attachment download failed.",
          502
        );
      }
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
