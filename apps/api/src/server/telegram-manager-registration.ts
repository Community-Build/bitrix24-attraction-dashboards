import type {
  SqliteRepository,
  TelegramManagerRegistrationInput
} from "./sqlite-repository.js";
import type { TelegramMessageSender } from "./telegram-client.js";

const START_COMMAND_PATTERN = /^\/start(?:@[A-Za-z0-9_]+)?(?:\s+\S+)?\s*$/i;

export interface TelegramManagerRegistrationMessage {
  chatId: string;
  chatType: string;
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  text: string;
}

export interface TelegramManagerRegistrationService {
  handleMessage(input: TelegramManagerRegistrationMessage): Promise<
    "ignored" | "saved"
  >;
}

export function createTelegramManagerRegistrationService(input: {
  repository: Pick<
    SqliteRepository,
    "upsertTelegramManagerRegistration"
  >;
  sender: TelegramMessageSender;
  now?: () => Date;
}): TelegramManagerRegistrationService {
  const now = input.now ?? (() => new Date());

  return {
    async handleMessage(message) {
      if (message.chatType !== "private" || message.chatId !== message.userId) {
        return "ignored";
      }
      if (!START_COMMAND_PATTERN.test(message.text.trim())) {
        return "ignored";
      }

      const timestamp = now().toISOString();
      const registration: TelegramManagerRegistrationInput = {
        telegramChatId: message.chatId,
        telegramUserId: message.userId,
        bitrixUserId: null,
        telegramUsername: normalizeOptionalText(message.username),
        telegramFirstName: normalizeOptionalText(message.firstName),
        telegramLastName: normalizeOptionalText(message.lastName),
        registeredAt: timestamp,
        lastSeenAt: timestamp
      };
      await input.repository.upsertTelegramManagerRegistration(registration);
      await input.sender.sendMessage({
        chatId: message.chatId,
        text:
          "Готово. Аккаунт сохранён. Руководитель один раз привяжет его к вашему профилю в Bitrix24."
      });
      return "saved";
    }
  };
}

function normalizeOptionalText(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized.slice(0, 256) : null;
}
