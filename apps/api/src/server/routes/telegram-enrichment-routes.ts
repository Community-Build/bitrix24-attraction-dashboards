import { timingSafeEqual } from "node:crypto";

import type express from "express";
import { z } from "zod";

import type { TelegramEnrichmentApprovalService } from "../telegram-enrichment-approval.js";
import type { TelegramManagerRegistrationService } from "../telegram-manager-registration.js";
import type { SqliteRepository } from "../sqlite-repository.js";

export interface RegisterTelegramEnrichmentRoutesInput {
  enabled?: boolean;
  secret?: string;
  approvalService?: TelegramEnrichmentApprovalService;
  registration?: {
    enabled?: boolean;
    exportSecret?: string;
    service?: TelegramManagerRegistrationService;
    repository?: Pick<
      SqliteRepository,
      "listActiveTelegramManagerRegistrations"
    >;
  };
}

const callbackBodySchema = z
  .object({
    callback_query: z
      .object({
        id: z.string().trim().min(1).max(200),
        data: z.string().trim().min(1).max(64),
        message: z
          .object({
            chat: z
              .object({
                id: z.union([z.string(), z.number()])
              })
              .passthrough()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional(),
    message: z
      .object({
        chat: z
          .object({
            id: z.union([z.string(), z.number()]),
            type: z.string().trim().min(1).max(50)
          })
          .passthrough(),
        from: z
          .object({
            id: z.union([z.string(), z.number()]),
            username: z.string().trim().max(256).optional(),
            first_name: z.string().trim().max(256).optional(),
            last_name: z.string().trim().max(256).optional()
          })
          .passthrough(),
        text: z.string().max(4096).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough()
  .refine((value) => Boolean(value.callback_query || value.message), {
    message: "callback_query or message is required"
  });

export function registerTelegramEnrichmentRoutes(
  app: express.Express,
  input: RegisterTelegramEnrichmentRoutesInput
) {
  app.post("/api/telegram/enrichment/callback", async (request, response, next) => {
    const registrationEnabled = Boolean(input.registration?.enabled);
    if (!input.enabled && !registrationEnabled) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const configuredSecret = input.secret?.trim();
    if (!configuredSecret) {
      response
        .status(503)
        .json(createErrorResponse("TELEGRAM_WEBHOOK_NOT_CONFIGURED"));
      return;
    }

    const requestSecret = request
      .header("X-Telegram-Bot-Api-Secret-Token")
      ?.trim();
    if (!isSameSecret(requestSecret, configuredSecret)) {
      response.status(401).json(createErrorResponse("UNAUTHORIZED"));
      return;
    }

    try {
      const parsed = callbackBodySchema.parse(request.body);
      if (parsed.callback_query) {
        if (!input.enabled || !input.approvalService) {
          response
            .status(503)
            .json(createErrorResponse("TELEGRAM_ENRICHMENT_NOT_CONFIGURED"));
          return;
        }
        await input.approvalService.handleCallback({
          callbackQueryId: parsed.callback_query.id,
          data: parsed.callback_query.data,
          chatId:
            parsed.callback_query.message?.chat.id === undefined
              ? null
              : String(parsed.callback_query.message.chat.id)
        });
      }
      if (parsed.message) {
        if (!registrationEnabled || !input.registration?.service) {
          response
            .status(503)
            .json(createErrorResponse("TELEGRAM_REGISTRATION_NOT_CONFIGURED"));
          return;
        }
        await input.registration.service.handleMessage({
          chatId: String(parsed.message.chat.id),
          chatType: parsed.message.chat.type,
          userId: String(parsed.message.from.id),
          username: parsed.message.from.username ?? null,
          firstName: parsed.message.from.first_name ?? null,
          lastName: parsed.message.from.last_name ?? null,
          text: parsed.message.text ?? ""
        });
      }
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/telegram/registrations", async (request, response, next) => {
    if (!input.registration?.enabled) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const configuredSecret = input.registration.exportSecret?.trim();
    const requestSecret = request
      .header("X-Telegram-Registration-Secret")
      ?.trim();
    if (
      !configuredSecret ||
      !input.registration.repository ||
      !isSameSecret(requestSecret, configuredSecret)
    ) {
      response.status(401).json(createErrorResponse("UNAUTHORIZED"));
      return;
    }

    try {
      const rows =
        await input.registration.repository.listActiveTelegramManagerRegistrations();
      response.json({
        registrations: rows.map((row) => ({
          bitrix_user_id: row.bitrixUserId,
          telegram_chat_id: row.telegramChatId,
          telegram_username: row.telegramUsername,
          active: row.active,
          last_seen_at: row.lastSeenAt
        }))
      });
    } catch (error) {
      next(error);
    }
  });
}

function createErrorResponse(code: string) {
  return {
    error: code,
    code
  };
}

function isSameSecret(left: string | undefined, right: string) {
  if (!left) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
