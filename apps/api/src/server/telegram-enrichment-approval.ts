import { randomUUID } from "node:crypto";

import type {
  CreateEnrichmentProposalInput,
  EnrichmentProposalEventInput,
  SqliteRepository,
  TelegramEnrichmentAction,
  TelegramEnrichmentActionTokenRecord
} from "./sqlite-repository.js";
import type { TelegramInteractiveSender } from "./telegram-client.js";
import type {
  CallEnrichmentWritebackResult,
  CallEnrichmentWritebackService
} from "./call-enrichment-writeback.js";
import type { CallEnrichmentFollowUpNote } from "./call-enrichment-follow-up-note.js";

export interface TelegramEnrichmentBatchInput {
  id: string;
  callId: string;
  dealId: string;
  contactId: string | null;
  managerId: string;
  expiresAt: string;
}

export interface TelegramEnrichmentCallbackInput {
  callbackQueryId: string;
  chatId: string | null;
  data: string;
}

export interface TelegramEnrichmentApprovalRepository
  extends Pick<
    SqliteRepository,
    | "createTelegramEnrichmentActionToken"
    | "getTelegramEnrichmentActionToken"
    | "markTelegramEnrichmentActionTokenUsed"
    | "releaseTelegramEnrichmentActionToken"
    | "updateEnrichmentProposalBatchTelegramMessage"
    | "appendEnrichmentProposalEvent"
  > {}

export interface TelegramEnrichmentApprovalServiceInput {
  repository: TelegramEnrichmentApprovalRepository;
  sender: TelegramInteractiveSender;
  decisionService: CallEnrichmentWritebackService;
  managerChatIds: Record<string, string[]>;
  idGenerator?: () => string;
  now?: () => Date;
}

export interface TelegramEnrichmentApprovalService {
  sendProposalBatch(input: {
    batch: TelegramEnrichmentBatchInput;
    proposals: CreateEnrichmentProposalInput[];
  }): Promise<void>;
  sendFollowUpNote(input: {
    batch: TelegramEnrichmentBatchInput;
    note: CallEnrichmentFollowUpNote;
  }): Promise<void>;
  handleCallback(input: TelegramEnrichmentCallbackInput): Promise<void>;
}

type ProposalActionTokens = Map<string, Record<TelegramEnrichmentAction, string>>;

const CALLBACK_PREFIX = "ce:";
const MAX_CALLBACK_DATA_BYTES = 64;
const MAX_MESSAGE_VALUE_LENGTH = 220;
const MAX_EVIDENCE_LENGTH = 180;

export function createTelegramEnrichmentApprovalService(
  input: TelegramEnrichmentApprovalServiceInput
): TelegramEnrichmentApprovalService {
  const idGenerator = input.idGenerator ?? randomUUID;
  const now = input.now ?? (() => new Date());

  async function sendProposalBatch(sendInput: {
    batch: TelegramEnrichmentBatchInput;
    proposals: CreateEnrichmentProposalInput[];
  }) {
    if (sendInput.proposals.length === 0) {
      return;
    }

    const chatIds = input.managerChatIds[sendInput.batch.managerId] ?? [];
    if (chatIds.length === 0) {
      await appendBatchEvent(sendInput.batch, {
        action: "batch.telegram_skipped",
        reason: "TELEGRAM_CHAT_NOT_CONFIGURED",
        metadata: null
      });
      return;
    }

    let primaryDeliveryStored = false;
    for (const chatId of chatIds) {
      try {
        const tokens = await createActionTokens(sendInput, chatId);
        const message = buildTelegramEnrichmentApprovalMessage({
          batch: sendInput.batch,
          proposals: sendInput.proposals,
          tokens
        });
        const sentMessage = await input.sender.sendMessage({
          chatId,
          text: message.text,
          replyMarkup: message.replyMarkup
        });
        if (!primaryDeliveryStored) {
          await input.repository.updateEnrichmentProposalBatchTelegramMessage({
            batchId: sendInput.batch.id,
            telegramChatId: chatId,
            telegramMessageId: sentMessage.messageId,
            updatedAt: now().toISOString()
          });
          primaryDeliveryStored = true;
        }
        await appendBatchEvent(sendInput.batch, {
          action: "batch.telegram_sent",
          reason: null,
          metadata: {
            telegramChatId: chatId,
            telegramMessageId: sentMessage.messageId,
            proposalCount: sendInput.proposals.length
          }
        });
      } catch (error) {
        await appendBatchEvent(sendInput.batch, {
          action: "batch.telegram_failed",
          reason: "TELEGRAM_SEND_FAILED",
          metadata: {
            telegramChatId: chatId,
            error: error instanceof Error ? error.message : "unknown"
          }
        });
      }
    }
  }

  async function sendFollowUpNote(sendInput: {
    batch: TelegramEnrichmentBatchInput;
    note: CallEnrichmentFollowUpNote;
  }) {
    const chatIds = input.managerChatIds[sendInput.batch.managerId] ?? [];
    if (chatIds.length === 0) {
      await appendBatchEvent(sendInput.batch, {
        action: "batch.followup_note_skipped",
        reason: "TELEGRAM_CHAT_NOT_CONFIGURED",
        metadata: null
      });
      return;
    }

    const message = buildTelegramFollowUpNoteMessage(sendInput);
    let primaryDeliveryStored = false;
    for (const chatId of chatIds) {
      try {
        const sentMessage = await input.sender.sendMessage({
          chatId,
          text: message.text,
          replyMarkup: undefined
        });
        if (!primaryDeliveryStored) {
          await input.repository.updateEnrichmentProposalBatchTelegramMessage({
            batchId: sendInput.batch.id,
            telegramChatId: chatId,
            telegramMessageId: sentMessage.messageId,
            updatedAt: now().toISOString()
          });
          primaryDeliveryStored = true;
        }
        await appendBatchEvent(sendInput.batch, {
          action: "batch.followup_note_sent",
          reason: null,
          metadata: {
            telegramChatId: chatId,
            telegramMessageId: sentMessage.messageId,
            classificationType: sendInput.note.classificationType,
            hasSummary: Boolean(sendInput.note.summary),
            hasNextStep: Boolean(sendInput.note.nextStep)
          }
        });
      } catch (error) {
        await appendBatchEvent(sendInput.batch, {
          action: "batch.followup_note_failed",
          reason: "TELEGRAM_SEND_FAILED",
          metadata: {
            telegramChatId: chatId,
            error: error instanceof Error ? error.message : "unknown"
          }
        });
      }
    }
  }

  async function handleCallback(callback: TelegramEnrichmentCallbackInput) {
    const tokenValue = parseCallbackToken(callback.data);
    if (!tokenValue) {
      await answer(callback.callbackQueryId, "Кнопка устарела.");
      return;
    }

    const token = await input.repository.getTelegramEnrichmentActionToken(
      tokenValue
    );
    if (!token) {
      await answer(callback.callbackQueryId, "Кнопка устарела.");
      return;
    }

    const nowIso = now().toISOString();
    if (token.usedAt) {
      await answer(callback.callbackQueryId, "Решение уже записано.");
      return;
    }

    if (Date.parse(token.expiresAt) <= Date.parse(nowIso)) {
      await answer(callback.callbackQueryId, "Срок действия предложения истек.");
      return;
    }

    if (!callback.chatId || callback.chatId !== token.telegramChatId) {
      await answer(callback.callbackQueryId, "Нет доступа к этому предложению.");
      return;
    }

    const tokenWasMarked =
      await input.repository.markTelegramEnrichmentActionTokenUsed({
        token: token.token,
        usedAt: nowIso
      });
    if (!tokenWasMarked) {
      await answer(callback.callbackQueryId, "Решение уже записано.");
      return;
    }

    let result: CallEnrichmentWritebackResult;
    try {
      result = await input.decisionService.applyManagerEnrichmentDecision({
        proposalId: token.proposalId,
        managerId: token.managerId,
        action: token.action,
        decidedAt: nowIso,
        allowApprovedResume: false
      });
    } catch (error) {
      await input.repository.releaseTelegramEnrichmentActionToken({
        token: token.token,
        usedAt: nowIso
      });
      throw error;
    }

    await answer(callback.callbackQueryId, formatDecisionResultText(result));
  }

  async function createActionTokens(
    sendInput: {
      batch: TelegramEnrichmentBatchInput;
      proposals: CreateEnrichmentProposalInput[];
    },
    chatId: string
  ): Promise<ProposalActionTokens> {
    const tokens: ProposalActionTokens = new Map();
    const createdAt = now().toISOString();

    for (const proposal of sendInput.proposals) {
      const approveToken = await createToken({
        action: "approve",
        proposal,
        batch: sendInput.batch,
        chatId,
        createdAt
      });
      const declineToken = await createToken({
        action: "decline",
        proposal,
        batch: sendInput.batch,
        chatId,
        createdAt
      });
      tokens.set(proposal.id, {
        approve: toCallbackData(approveToken.token),
        decline: toCallbackData(declineToken.token)
      });
    }

    return tokens;
  }

  async function createToken(inputData: {
    action: TelegramEnrichmentAction;
    proposal: CreateEnrichmentProposalInput;
    batch: TelegramEnrichmentBatchInput;
    chatId: string;
    createdAt: string;
  }): Promise<TelegramEnrichmentActionTokenRecord> {
    const token = idGenerator();
    const record = {
      token,
      batchId: inputData.batch.id,
      proposalId: inputData.proposal.id,
      action: inputData.action,
      managerId: inputData.batch.managerId,
      telegramChatId: inputData.chatId,
      expiresAt: inputData.batch.expiresAt,
      usedAt: null,
      createdAt: inputData.createdAt
    } satisfies TelegramEnrichmentActionTokenRecord;
    const callbackData = toCallbackData(record.token);

    if (Buffer.byteLength(callbackData, "utf8") > MAX_CALLBACK_DATA_BYTES) {
      throw new Error("Telegram callback_data exceeds 64 bytes.");
    }

    await input.repository.createTelegramEnrichmentActionToken(record);
    return record;
  }

  async function appendBatchEvent(
    batch: TelegramEnrichmentBatchInput,
    event: Pick<
      EnrichmentProposalEventInput,
      "action" | "reason" | "metadata"
    >
  ) {
    await input.repository.appendEnrichmentProposalEvent({
      id: idGenerator(),
      batchId: batch.id,
      proposalId: null,
      actorType: "system",
      actorId: null,
      action: event.action,
      beforeStatus: null,
      afterStatus: null,
      reason: event.reason,
      metadata: event.metadata ?? null,
      createdAt: now().toISOString()
    });
  }

  async function answer(callbackQueryId: string, text: string) {
    await input.sender.answerCallbackQuery({
      callbackQueryId,
      text
    });
  }

  return {
    sendProposalBatch,
    sendFollowUpNote,
    handleCallback
  };
}

export function buildTelegramEnrichmentApprovalMessage(input: {
  batch: TelegramEnrichmentBatchInput;
  proposals: CreateEnrichmentProposalInput[];
  tokens: ProposalActionTokens;
}) {
  const lines = [
    "После звонка есть предложения для CRM.",
    `Сделка: ${input.batch.dealId}`,
    `Контакт: ${input.batch.contactId ?? "не определен"}`,
    ""
  ];

  const inlineKeyboard = input.proposals.map((proposal, index) => {
    const tokens = input.tokens.get(proposal.id);
    if (!tokens) {
      throw new Error(`Telegram tokens missing for proposal ${proposal.id}`);
    }

    lines.push(
      `${index + 1}. ${proposal.fieldTitle}`,
      `Текущее: ${formatTelegramValue(proposal.currentValue)}`,
      `Предложение: ${formatTelegramValue(proposal.proposedValue)}`,
      `Фрагмент: ${formatEvidence(proposal.evidenceSnippet)}`,
      `Уверенность: ${Math.round(proposal.confidence * 100)}%`,
      ""
    );

    return [
      {
        text: proposal.actionType === "fill_empty" ? "Записать" : "Перезаписать",
        callback_data: tokens.approve
      },
      {
        text: "Не заполнять",
        callback_data: tokens.decline
      }
    ];
  });

  return {
    text: lines.join("\n").trim(),
    replyMarkup: {
      inline_keyboard: inlineKeyboard
    }
  };
}

export function buildTelegramFollowUpNoteMessage(input: {
  batch: TelegramEnrichmentBatchInput;
  note: CallEnrichmentFollowUpNote;
}) {
  const lines = [
    "После звонка есть следующий шаг.",
    `Сделка: ${input.batch.dealId}`,
    `Контакт: ${input.batch.contactId ?? "не определен"}`,
    ...(input.note.classificationType
      ? [`Тип: ${formatFollowUpText(input.note.classificationType)}`]
      : []),
    "",
    ...(input.note.summary
      ? ["Заметка:", formatFollowUpText(input.note.summary), ""]
      : []),
    ...(input.note.nextStep
      ? ["Следующий шаг:", formatFollowUpText(input.note.nextStep)]
      : [])
  ];

  return {
    text: lines.join("\n").trim()
  };
}

export function parseCallbackToken(callbackData: string) {
  return callbackData.startsWith(CALLBACK_PREFIX)
    ? callbackData.slice(CALLBACK_PREFIX.length)
    : null;
}

function toCallbackData(token: string) {
  return `${CALLBACK_PREFIX}${token}`;
}

function formatTelegramValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "не заполнено";
  }

  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : JSON.stringify(value);
  return truncate(redactSensitiveText(text), MAX_MESSAGE_VALUE_LENGTH);
}

function formatEvidence(value: string | null) {
  return value
    ? truncate(redactSensitiveText(value), MAX_EVIDENCE_LENGTH)
    : "нет фрагмента";
}

function formatFollowUpText(value: string) {
  return truncate(redactSensitiveText(value), MAX_MESSAGE_VALUE_LENGTH);
}

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`;
}

function redactSensitiveText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/gu, "[phone]");
}

function formatDecisionResultText(result: CallEnrichmentWritebackResult) {
  if (result.status === "applied") {
    return "Записано в CRM.";
  }

  if (result.status === "recorded") {
    return "Решение записано, CRM не обновляю.";
  }

  if (result.status === "declined") {
    return "Не заполняем.";
  }

  if (result.status === "conflict") {
    return "CRM уже изменилась, не перезаписываю.";
  }

  if (result.status === "expired") {
    return "Срок действия предложения истек.";
  }

  if (result.status === "failed") {
    return "Не удалось записать в CRM.";
  }

  if (result.status === "rejected") {
    return "Нет доступа к этому предложению.";
  }

  return "Решение уже записано.";
}
