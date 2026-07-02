import { describe, expect, it, vi } from "vitest";

import {
  buildTelegramEnrichmentApprovalMessage,
  createTelegramEnrichmentApprovalService,
  parseCallbackToken,
  type TelegramEnrichmentApprovalRepository
} from "../src/server/telegram-enrichment-approval";
import {
  createCallEnrichmentWritebackService,
  type CallEnrichmentWritebackService
} from "../src/server/call-enrichment-writeback";
import type {
  CreateEnrichmentProposalInput,
  EnrichmentProposalBatchRecord,
  EnrichmentProposalRecord,
  TelegramEnrichmentActionTokenRecord
} from "../src/server/sqlite-repository";
import type { TelegramInteractiveSender } from "../src/server/telegram-client";

const batch = {
  id: "batch-1",
  callId: "call-1",
  dealId: "deal-1",
  contactId: "contact-1",
  managerId: "78",
  expiresAt: "2026-06-30T10:00:00.000Z"
};

const proposal = {
  id: "proposal-1",
  entityType: "contact",
  entityId: "contact-1",
  fieldCode: "UF_CRM_1647946359",
  fieldTitle: "Оборот бизнеса",
  actionType: "fill_empty",
  currentValue: null,
  proposedValue: "500-1000 млн. рублей",
  normalizedValue: "602",
  confidence: 0.86,
  evidenceSnippet:
    "Телефон +7 999 111-22-33, email test@example.com, сказал оборот 500-1000 млн",
  status: "pending",
  createdAt: "2026-06-28T10:00:00.000Z",
  updatedAt: "2026-06-28T10:00:00.000Z"
} satisfies CreateEnrichmentProposalInput;

const writebackBatch = {
  ...batch,
  activityId: "A1",
  callAnalysisRunId: "run-1",
  status: "pending",
  telegramChatId: "chat-78",
  telegramMessageId: "42",
  createdAt: "2026-06-28T10:00:00.000Z",
  updatedAt: "2026-06-28T10:00:00.000Z"
} satisfies EnrichmentProposalBatchRecord;

const writebackProposal = {
  ...proposal,
  batchId: "batch-1"
} satisfies EnrichmentProposalRecord;

function createRepository(
  token?: TelegramEnrichmentActionTokenRecord | null
): TelegramEnrichmentApprovalRepository {
  return {
    createTelegramEnrichmentActionToken: vi.fn().mockResolvedValue(undefined),
    getTelegramEnrichmentActionToken: vi.fn().mockResolvedValue(token ?? null),
    markTelegramEnrichmentActionTokenUsed: vi.fn().mockResolvedValue(true),
    releaseTelegramEnrichmentActionToken: vi.fn().mockResolvedValue(undefined),
    updateEnrichmentProposalBatchTelegramMessage: vi.fn().mockResolvedValue(undefined),
    appendEnrichmentProposalEvent: vi.fn().mockResolvedValue(undefined)
  };
}

function createSender(): TelegramInteractiveSender {
  return {
    sendMessage: vi.fn().mockResolvedValue({ messageId: "42" }),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined)
  };
}

function createDecisionService(
  result: Awaited<
    ReturnType<CallEnrichmentWritebackService["applyManagerEnrichmentDecision"]>
  > = {
    status: "applied",
    proposalId: "proposal-1"
  }
): CallEnrichmentWritebackService {
  return {
    applyManagerEnrichmentDecision: vi.fn().mockResolvedValue(result)
  };
}

describe("telegram enrichment approval", () => {
  it("formats a safe single batch message with short callback tokens", () => {
    const message = buildTelegramEnrichmentApprovalMessage({
      batch,
      proposals: [proposal],
      tokens: new Map([
        [
          "proposal-1",
          {
            approve: "ce:approve-token",
            decline: "ce:decline-token"
          }
        ]
      ])
    });

    expect(message.text).toContain("Сделка: deal-1");
    expect(message.text).toContain("Контакт: contact-1");
    expect(message.text).toContain("Оборот бизнеса");
    expect(message.text).not.toMatch(/\+7 999|test@example\.com/);
    expect(message.replyMarkup.inline_keyboard).toHaveLength(1);
    const row = message.replyMarkup.inline_keyboard[0];
    if (!row) {
      throw new Error("Expected one Telegram inline keyboard row.");
    }
    expect(row.map((button) => button.text)).toEqual([
      "Записать",
      "Не заполнять"
    ]);
    for (const button of row) {
      expect(Buffer.byteLength(button.callback_data, "utf8")).toBeLessThanOrEqual(
        64
      );
    }
    expect(parseCallbackToken("ce:approve-token")).toBe("approve-token");
  });

  it("sends one message per proposal batch and stores telegram delivery ids", async () => {
    const repository = createRepository();
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService: createDecisionService(),
      managerChatIds: {
        "78": ["chat-78"]
      },
      idGenerator: vi
        .fn()
        .mockReturnValueOnce("approve-token")
        .mockReturnValueOnce("decline-token")
        .mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-28T10:00:00.000Z")
    });

    await service.sendProposalBatch({
      batch,
      proposals: [proposal]
    });

    expect(repository.createTelegramEnrichmentActionToken).toHaveBeenCalledTimes(2);
    expect(sender.sendMessage).toHaveBeenCalledTimes(1);
    expect(repository.updateEnrichmentProposalBatchTelegramMessage).toHaveBeenCalledWith({
      batchId: "batch-1",
      telegramChatId: "chat-78",
      telegramMessageId: "42",
      updatedAt: "2026-06-28T10:00:00.000Z"
    });
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        batchId: "batch-1",
        action: "batch.telegram_sent"
      })
    );
  });

  it("sends identical approval messages to every configured chat for one manager", async () => {
    const repository = createRepository();
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService: createDecisionService(),
      managerChatIds: {
        "78": ["chat-78", "chat-owner"]
      },
      idGenerator: vi
        .fn()
        .mockReturnValueOnce("approve-token-1")
        .mockReturnValueOnce("decline-token-1")
        .mockReturnValueOnce("event-1")
        .mockReturnValueOnce("approve-token-2")
        .mockReturnValueOnce("decline-token-2")
        .mockReturnValueOnce("event-2"),
      now: () => new Date("2026-06-28T10:00:00.000Z")
    });

    await service.sendProposalBatch({
      batch,
      proposals: [proposal]
    });

    expect(repository.createTelegramEnrichmentActionToken).toHaveBeenCalledTimes(4);
    expect(sender.sendMessage).toHaveBeenCalledTimes(2);
    expect(sender.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ chatId: "chat-78" })
    );
    expect(sender.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ chatId: "chat-owner" })
    );

    const [firstMessage] = vi.mocked(sender.sendMessage).mock.calls[0] ?? [];
    const [secondMessage] = vi.mocked(sender.sendMessage).mock.calls[1] ?? [];
    const firstReplyMarkup = firstMessage?.replyMarkup as
      | { inline_keyboard?: Array<Array<{ text: string }>> }
      | undefined;
    const secondReplyMarkup = secondMessage?.replyMarkup as
      | { inline_keyboard?: Array<Array<{ text: string }>> }
      | undefined;
    expect(firstMessage?.text).toEqual(secondMessage?.text);
    expect(
      firstReplyMarkup?.inline_keyboard?.[0]?.map((button) => button.text)
    ).toEqual(
      secondReplyMarkup?.inline_keyboard?.[0]?.map((button) => button.text)
    );
    expect(repository.updateEnrichmentProposalBatchTelegramMessage).toHaveBeenCalledTimes(
      1
    );
    expect(repository.updateEnrichmentProposalBatchTelegramMessage).toHaveBeenCalledWith({
      batchId: "batch-1",
      telegramChatId: "chat-78",
      telegramMessageId: "42",
      updatedAt: "2026-06-28T10:00:00.000Z"
    });
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        action: "batch.telegram_sent",
        metadata: expect.objectContaining({ telegramChatId: "chat-78" })
      })
    );
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-2",
        action: "batch.telegram_sent",
        metadata: expect.objectContaining({ telegramChatId: "chat-owner" })
      })
    );
  });

  it("sends informational follow-up notes without approval buttons to every configured chat", async () => {
    const repository = createRepository();
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService: createDecisionService(),
      managerChatIds: {
        "78": ["chat-78", "chat-owner"]
      },
      idGenerator: vi.fn().mockReturnValueOnce("event-1").mockReturnValueOnce("event-2"),
      now: () => new Date("2026-06-28T10:00:00.000Z")
    });

    await service.sendFollowUpNote({
      batch,
      note: {
        classificationType: "scheduling",
        summary:
          "Клиент согласовал созвон. Телефон +7 999 111-22-33, email test@example.com.",
        nextStep: "Перезвонить завтра в обед и отправить Zoom."
      }
    });

    expect(repository.createTelegramEnrichmentActionToken).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledTimes(2);
    expect(sender.sendMessage).toHaveBeenNthCalledWith(1, {
      chatId: "chat-78",
      text: expect.stringContaining("После звонка есть следующий шаг."),
      replyMarkup: undefined
    });
    expect(sender.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ chatId: "chat-owner", replyMarkup: undefined })
    );
    const [message] = vi.mocked(sender.sendMessage).mock.calls[0] ?? [];
    expect(message?.text).toContain("Тип: scheduling");
    expect(message?.text).toContain("Перезвонить завтра в обед");
    expect(message?.text).not.toMatch(/\+7 999|test@example\.com/);
    expect(repository.updateEnrichmentProposalBatchTelegramMessage).toHaveBeenCalledTimes(
      1
    );
    expect(repository.updateEnrichmentProposalBatchTelegramMessage).toHaveBeenCalledWith({
      batchId: "batch-1",
      telegramChatId: "chat-78",
      telegramMessageId: "42",
      updatedAt: "2026-06-28T10:00:00.000Z"
    });
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        action: "batch.followup_note_sent",
        metadata: expect.objectContaining({ telegramChatId: "chat-78" })
      })
    );
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-2",
        action: "batch.followup_note_sent",
        metadata: expect.objectContaining({ telegramChatId: "chat-owner" })
      })
    );
  });

  it("records an audit event instead of sending when manager chat is missing", async () => {
    const repository = createRepository();
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService: createDecisionService(),
      managerChatIds: {},
      idGenerator: () => "event-1",
      now: () => new Date("2026-06-28T10:00:00.000Z")
    });

    await service.sendProposalBatch({
      batch,
      proposals: [proposal]
    });

    expect(sender.sendMessage).not.toHaveBeenCalled();
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "batch.telegram_skipped",
        reason: "TELEGRAM_CHAT_NOT_CONFIGURED"
      })
    );
  });

  it("records a failed audit event when callback tokens cannot fit Telegram limits", async () => {
    const repository = createRepository();
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService: createDecisionService(),
      managerChatIds: {
        "78": ["chat-78"]
      },
      idGenerator: vi
        .fn()
        .mockReturnValueOnce("x".repeat(80))
        .mockReturnValueOnce("event-1"),
      now: () => new Date("2026-06-28T10:00:00.000Z")
    });

    await service.sendProposalBatch({
      batch,
      proposals: [proposal]
    });

    expect(sender.sendMessage).not.toHaveBeenCalled();
    expect(repository.appendEnrichmentProposalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        action: "batch.telegram_failed",
        reason: "TELEGRAM_SEND_FAILED"
      })
    );
  });

  it("handles approve callbacks through repository decisions and answers Telegram", async () => {
    const token = {
      token: "approve-token",
      batchId: "batch-1",
      proposalId: "proposal-1",
      action: "approve",
      managerId: "78",
      telegramChatId: "chat-78",
      expiresAt: "2026-06-30T10:00:00.000Z",
      usedAt: null,
      createdAt: "2026-06-28T10:00:00.000Z"
    } satisfies TelegramEnrichmentActionTokenRecord;
    const repository = createRepository(token);
    const sender = createSender();
    const decisionService = createDecisionService();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService,
      managerChatIds: {
        "78": ["chat-78"]
      },
      idGenerator: () => "event-1",
      now: () => new Date("2026-06-28T11:00:00.000Z")
    });

    await service.handleCallback({
      callbackQueryId: "callback-1",
      chatId: "chat-78",
      data: "ce:approve-token"
    });

    expect(repository.markTelegramEnrichmentActionTokenUsed).toHaveBeenCalledWith({
      token: "approve-token",
      usedAt: "2026-06-28T11:00:00.000Z"
    });
    const claimOrder = vi.mocked(repository.markTelegramEnrichmentActionTokenUsed)
      .mock.invocationCallOrder[0];
    const writebackOrder = vi.mocked(decisionService.applyManagerEnrichmentDecision)
      .mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(writebackOrder ?? 0);
    expect(decisionService.applyManagerEnrichmentDecision).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      managerId: "78",
      action: "approve",
      decidedAt: "2026-06-28T11:00:00.000Z",
      allowApprovedResume: false
    });
    expect(sender.answerCallbackQuery).toHaveBeenCalledWith({
      callbackQueryId: "callback-1",
      text: "Записано в CRM."
    });
  });

  it("does not run writeback twice for concurrent callbacks with the same token", async () => {
    const token = {
      token: "approve-token",
      batchId: "batch-1",
      proposalId: "proposal-1",
      action: "approve",
      managerId: "78",
      telegramChatId: "chat-78",
      expiresAt: "2026-06-30T10:00:00.000Z",
      usedAt: null,
      createdAt: "2026-06-28T10:00:00.000Z"
    } satisfies TelegramEnrichmentActionTokenRecord;
    const repository = createRepository(token);
    let claimed = false;
    vi.mocked(repository.markTelegramEnrichmentActionTokenUsed).mockImplementation(
      async () => {
        if (claimed) {
          return false;
        }
        claimed = true;
        return true;
      }
    );
    let finishDecision = (_value: {
      status: "applied";
      proposalId: string;
    }) => {};
    const decisionService = {
      applyManagerEnrichmentDecision: vi.fn(
        () =>
          new Promise<{ status: "applied"; proposalId: string }>((resolve) => {
            finishDecision = resolve;
          })
      )
    } satisfies CallEnrichmentWritebackService;
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService,
      managerChatIds: {
        "78": ["chat-78"]
      },
      now: () => new Date("2026-06-28T11:00:00.000Z")
    });

    const first = service.handleCallback({
      callbackQueryId: "callback-1",
      chatId: "chat-78",
      data: "ce:approve-token"
    });
    const second = service.handleCallback({
      callbackQueryId: "callback-2",
      chatId: "chat-78",
      data: "ce:approve-token"
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(decisionService.applyManagerEnrichmentDecision).toHaveBeenCalledTimes(1);
    expect(sender.answerCallbackQuery).toHaveBeenCalledWith({
      callbackQueryId: "callback-2",
      text: "Решение уже записано."
    });

    finishDecision({ status: "applied", proposalId: "proposal-1" });
    await Promise.all([first, second]);
  });

  it("answers already recorded when another proposal action already decided the proposal", async () => {
    const token = {
      token: "decline-token",
      batchId: "batch-1",
      proposalId: "proposal-1",
      action: "decline",
      managerId: "78",
      telegramChatId: "chat-78",
      expiresAt: "2026-06-30T10:00:00.000Z",
      usedAt: null,
      createdAt: "2026-06-28T10:00:00.000Z"
    } satisfies TelegramEnrichmentActionTokenRecord;
    const repository = createRepository(token);
    const decisionService = createDecisionService({
      status: "already_decided",
      proposalId: "proposal-1"
    });
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService,
      managerChatIds: {
        "78": ["chat-78"]
      },
      idGenerator: () => "event-1",
      now: () => new Date("2026-06-28T11:00:00.000Z")
    });

    await service.handleCallback({
      callbackQueryId: "callback-1",
      chatId: "chat-78",
      data: "ce:decline-token"
    });

    expect(sender.answerCallbackQuery).toHaveBeenCalledWith({
      callbackQueryId: "callback-1",
      text: "Решение уже записано."
    });
  });

  it("passes approved callbacks through the writeback service to Bitrix", async () => {
    const token = {
      token: "approve-token",
      batchId: "batch-1",
      proposalId: "proposal-1",
      action: "approve",
      managerId: "78",
      telegramChatId: "chat-78",
      expiresAt: "2026-06-30T10:00:00.000Z",
      usedAt: null,
      createdAt: "2026-06-28T10:00:00.000Z"
    } satisfies TelegramEnrichmentActionTokenRecord;
    const repository = {
      ...createRepository(token),
      getEnrichmentProposal: vi.fn().mockResolvedValue(writebackProposal),
      getEnrichmentProposalBatch: vi.fn().mockResolvedValue(writebackBatch),
      markEnrichmentProposalDecision: vi.fn().mockResolvedValue(true),
      markEnrichmentProposalApplied: vi.fn().mockResolvedValue(undefined),
      markEnrichmentProposalFailed: vi.fn().mockResolvedValue(undefined)
    };
    const bitrix = {
      getContactEnrichmentValues: vi
        .fn()
        .mockResolvedValue({ UF_CRM_1647946359: null }),
      getDealEnrichmentValues: vi.fn().mockResolvedValue({}),
      updateContactEnrichmentField: vi.fn().mockResolvedValue(undefined),
      updateDealEnrichmentField: vi.fn().mockResolvedValue(undefined)
    };
    const sender = createSender();
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService: createCallEnrichmentWritebackService({
        repository,
        bitrix,
        idGenerator: vi
          .fn()
          .mockReturnValueOnce("event-approved")
          .mockReturnValueOnce("event-applied")
      }),
      managerChatIds: {
        "78": ["chat-78"]
      },
      now: () => new Date("2026-06-28T11:00:00.000Z")
    });

    await service.handleCallback({
      callbackQueryId: "callback-1",
      chatId: "chat-78",
      data: "ce:approve-token"
    });

    expect(bitrix.updateContactEnrichmentField).toHaveBeenCalledWith({
      entityId: "contact-1",
      fieldCode: "UF_CRM_1647946359",
      value: "602"
    });
    expect(sender.answerCallbackQuery).toHaveBeenCalledWith({
      callbackQueryId: "callback-1",
      text: "Записано в CRM."
    });
  });

  it("releases claimed callback tokens when writeback throws", async () => {
    const token = {
      token: "approve-token",
      batchId: "batch-1",
      proposalId: "proposal-1",
      action: "approve",
      managerId: "78",
      telegramChatId: "chat-78",
      expiresAt: "2026-06-30T10:00:00.000Z",
      usedAt: null,
      createdAt: "2026-06-28T10:00:00.000Z"
    } satisfies TelegramEnrichmentActionTokenRecord;
    const repository = createRepository(token);
    const sender = createSender();
    const decisionService = {
      applyManagerEnrichmentDecision: vi
        .fn()
        .mockRejectedValue(new Error("writeback interrupted"))
    } satisfies CallEnrichmentWritebackService;
    const service = createTelegramEnrichmentApprovalService({
      repository,
      sender,
      decisionService,
      managerChatIds: {
        "78": ["chat-78"]
      },
      now: () => new Date("2026-06-28T11:00:00.000Z")
    });

    await expect(
      service.handleCallback({
        callbackQueryId: "callback-1",
        chatId: "chat-78",
        data: "ce:approve-token"
      })
    ).rejects.toThrow("writeback interrupted");

    expect(repository.markTelegramEnrichmentActionTokenUsed).toHaveBeenCalledWith({
      token: "approve-token",
      usedAt: "2026-06-28T11:00:00.000Z"
    });
    expect(repository.releaseTelegramEnrichmentActionToken).toHaveBeenCalledWith({
      token: "approve-token",
      usedAt: "2026-06-28T11:00:00.000Z"
    });
    expect(sender.answerCallbackQuery).not.toHaveBeenCalled();
  });
});
