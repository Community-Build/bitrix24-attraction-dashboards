import type {
  MessengerMessageDirection,
  MessengerMessageSnapshot,
  MessengerSenderKind
} from "../domain/messenger-messages.js";

type MessengerMessageRepository = {
  getManagerWhitelistSettings(moduleKey: string): Promise<
    Array<{
      managerId: string;
      managerName: string;
      enabled: boolean;
    }>
  >;
  getCurrentAttractionScope(): Promise<{ dealIds: string[] }>;
  getDealsByIds(dealIds: string[]): Promise<
    Array<{
      id: string;
      assignedById: string | null;
    }>
  >;
  listMessengerMessages(input: {
    managerIds?: string[];
    from: string;
    to: string;
  }): Promise<MessengerMessageSnapshot[]>;
  getMessengerMessage(input: {
    sessionId: string;
    messageId: string;
  }): Promise<MessengerMessageSnapshot | null>;
};

type MessengerMessageClient = {
  downloadDiskFile?(
    fileId: string,
    options: { maxBytes: number }
  ): Promise<{
    fileId: string;
    fileName: string;
    bytes: Buffer;
  } | null>;
};

export type { MessengerMessageDirection, MessengerSenderKind };

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
  outgoingUnknownAuthorMessages: number;
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
  outgoingUnknownAuthorMessages: number;
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

const MAX_DETAIL_MESSAGES = 500;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function parseCollectionRange(input: { from: string; to: string }) {
  const from = Date.parse(input.from);
  const to = Date.parse(input.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    throw new MessengerMessageCollectionError(
      "INVALID_RANGE",
      "Messenger messages require a valid date range."
    );
  }

  return { from, to };
}

function attributedManagerId(message: MessengerMessageSnapshot) {
  return message.direction === "outgoing" && message.authorManagerId
    ? message.authorManagerId
    : message.dealManagerId;
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

  type CachedScope = {
    managers: EnabledManager[];
    currentDealsByManager: Map<string, number>;
    messages: MessengerMessageSnapshot[];
  };

  async function loadScope(
    request: MessengerReportSummaryInput
  ): Promise<CachedScope> {
    parseCollectionRange(request);
    const settings = await input.repository.getManagerWhitelistSettings(
      "attraction"
    );
    const enabledManagers = settings.filter((setting) => setting.enabled);
    const requestedManagerIds = [
      ...new Set((request.managerIds ?? []).map((managerId) => managerId.trim()))
    ];
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

    const requestedManagerIdSet = new Set(requestedManagerIds);
    const managers = (
      requestedManagerIds.length > 0
        ? enabledManagers.filter((manager) =>
            requestedManagerIdSet.has(manager.managerId)
          )
        : enabledManagers
    ).map(({ managerId, managerName }) => ({ managerId, managerName }));
    const scope = await input.repository.getCurrentAttractionScope();
    const scopedDeals = await input.repository.getDealsByIds(scope.dealIds);
    const selectedManagerIds = new Set(
      managers.map((manager) => manager.managerId)
    );
    const currentDealsByManager = new Map<string, number>();
    for (const deal of scopedDeals) {
      if (!deal.assignedById || !selectedManagerIds.has(deal.assignedById)) {
        continue;
      }
      currentDealsByManager.set(
        deal.assignedById,
        (currentDealsByManager.get(deal.assignedById) ?? 0) + 1
      );
    }

    return {
      managers,
      currentDealsByManager,
      messages: await input.repository.listMessengerMessages({
        managerIds: managers.map((manager) => manager.managerId),
        from: request.from,
        to: request.to
      })
    };
  }

  function buildManagerSummary(
    manager: EnabledManager,
    request: { from: string; to: string },
    scope: CachedScope
  ): MessengerMessageSummary {
    const attributedMessages = scope.messages.filter(
      (message) => attributedManagerId(message) === manager.managerId
    );
    const systemMessages = attributedMessages.filter((message) => message.system);
    const messages = attributedMessages.filter((message) => !message.system);
    const confirmedOutgoingMessages = messages.filter(
      (message) =>
        message.direction === "outgoing" &&
        message.authorManagerId === manager.managerId
    );
    const outgoingUnknownAuthorMessages = messages.filter(
      (message) =>
        message.direction === "outgoing" && message.authorManagerId === null
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
      const channel = channelCounts.get(message.channelKey) ?? {
        key: message.channelKey,
        label: message.channelLabel,
        messages: 0
      };
      channel.messages += 1;
      channelCounts.set(channel.key, channel);
    }

    return {
      managerId: manager.managerId,
      managerName: manager.managerName,
      from: request.from,
      to: request.to,
      currentDeals: scope.currentDealsByManager.get(manager.managerId) ?? 0,
      sessions: new Set(messages.map((message) => message.sessionId)).size,
      uniqueDialogs: new Set(messages.map((message) => message.sessionId)).size,
      dealsWithMessages: new Set(messages.map((message) => message.dealId)).size,
      messages: messages.length,
      outgoingMessages: confirmedOutgoingMessages.length,
      outgoingUnknownAuthorMessages: outgoingUnknownAuthorMessages.length,
      incomingMessages: messages.filter(
        (message) => message.direction === "incoming"
      ).length,
      unknownDirectionMessages: messages.filter(
        (message) => message.direction === "unknown"
      ).length,
      uniqueOutgoingDialogs: new Set(
        confirmedOutgoingMessages.map((message) => message.sessionId)
      ).size,
      dealsWithOutgoingMessages: new Set(
        confirmedOutgoingMessages.map((message) => message.dealId)
      ).size,
      messagesWithText: messages.filter((message) => Boolean(message.text?.trim()))
        .length,
      attachmentOnlyMessages: messages.filter(
        (message) => !message.text?.trim() && message.hasAttachment
      ).length,
      systemMessagesExcluded: systemMessages.length,
      senderKinds,
      channels: [...channelCounts.values()].sort(
        (left, right) =>
          right.messages - left.messages || left.label.localeCompare(right.label)
      ),
      directionAvailable: false,
      personalAuthorAvailable: messages.some(
        (message) => message.authorManagerId !== null
      )
    };
  }

  async function collectBatch(request: MessengerMessageCollectionInput) {
    const scope = await loadScope({
      managerIds: [request.managerId],
      from: request.from,
      to: request.to
    });
    const manager = scope.managers[0];
    if (!manager) {
      throw new MessengerMessageCollectionError(
        "MANAGER_NOT_ENABLED",
        "Manager is not enabled for attraction message analysis."
      );
    }
    const messages = scope.messages
      .filter(
        (message) =>
          !message.system && attributedManagerId(message) === manager.managerId
      )
      .map(
        (message): MessengerAnalysisMessage => ({
          id: message.id,
          sessionId: message.sessionId,
          activityId: message.activityId,
          dealId: message.dealId,
          managerId: manager.managerId,
          occurredAt: message.occurredAt,
          channel: {
            key: message.channelKey,
            label: message.channelLabel
          },
          senderKind: message.senderKind,
          direction: message.direction,
          authorLabel: message.authorLabel,
          text: message.text,
          attachmentFileIds: message.attachmentFileIds,
          hasAttachment: message.hasAttachment
        })
      );

    return {
      batch: {
        managerId: manager.managerId,
        managerName: manager.managerName,
        from: request.from,
        to: request.to,
        messages
      } satisfies MessengerAnalysisBatch,
      summary: buildManagerSummary(manager, request, scope)
    };
  }

  return {
    async getManagerMessageSummary(request: MessengerMessageCollectionInput) {
      return (await collectBatch(request)).summary;
    },

    async getMessengerReportSummary(
      request: MessengerReportSummaryInput
    ): Promise<MessengerReportSummary> {
      const scope = await loadScope(request);
      const managerRows = scope.managers.map((manager) =>
        buildManagerSummary(manager, request, scope)
      );

      return {
        from: request.from,
        to: request.to,
        totalMessages: managerRows.reduce(
          (total, row) => total + row.messages,
          0
        ),
        outgoingMessages: managerRows.reduce(
          (total, row) => total + row.outgoingMessages,
          0
        ),
        outgoingUnknownAuthorMessages: managerRows.reduce(
          (total, row) => total + row.outgoingUnknownAuthorMessages,
          0
        ),
        incomingMessages: managerRows.reduce(
          (total, row) => total + row.incomingMessages,
          0
        ),
        unknownDirectionMessages: managerRows.reduce(
          (total, row) => total + row.unknownDirectionMessages,
          0
        ),
        uniqueOutgoingDialogs: new Set(
          scope.messages
            .filter(
              (message) =>
                !message.system &&
                message.direction === "outgoing"
            )
            .map((message) => message.sessionId)
        ).size,
        dealsWithOutgoingMessages: new Set(
          scope.messages
            .filter(
              (message) =>
                !message.system &&
                message.direction === "outgoing"
            )
            .map((message) => message.dealId)
        ).size,
        messagesWithText: managerRows.reduce(
          (total, row) => total + row.messagesWithText,
          0
        ),
        attachmentOnlyMessages: managerRows.reduce(
          (total, row) => total + row.attachmentOnlyMessages,
          0
        ),
        uniqueDialogs: new Set(
          scope.messages
            .filter((message) => !message.system)
            .map((message) => message.sessionId)
        ).size,
        dealsWithMessages: new Set(
          scope.messages
            .filter((message) => !message.system)
            .map((message) => message.dealId)
        ).size,
        systemMessagesExcluded: managerRows.reduce(
          (total, row) => total + row.systemMessagesExcluded,
          0
        ),
        managerRows,
        directionAvailable: false,
        personalAuthorAvailable: managerRows.some(
          (row) => row.personalAuthorAvailable
        )
      };
    },

    async getManagerMessageDetails(
      request: MessengerMessageDetailsInput
    ): Promise<MessengerMessageDetails> {
      const limit = request.limit ?? MAX_DETAIL_MESSAGES;
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DETAIL_MESSAGES) {
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
          (message) => message.direction === "outgoing" && message.authorLabel
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
      const range = parseCollectionRange(request);
      const settings = await input.repository.getManagerWhitelistSettings(
        "attraction"
      );
      if (
        !settings.some(
          (manager) =>
            manager.enabled && manager.managerId === request.managerId
        )
      ) {
        throw new MessengerMessageCollectionError(
          "MANAGER_NOT_ENABLED",
          "Manager is not enabled for attraction message analysis."
        );
      }
      const message = await input.repository.getMessengerMessage({
        sessionId: request.sessionId,
        messageId: request.messageId
      });
      if (
        !message ||
        message.system ||
        attributedManagerId(message) !== request.managerId ||
        message.occurredAtMs < range.from ||
        message.occurredAtMs > range.to ||
        !message.attachmentFileIds.includes(request.fileId)
      ) {
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
