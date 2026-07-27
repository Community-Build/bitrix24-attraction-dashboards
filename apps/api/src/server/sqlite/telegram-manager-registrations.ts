import type Database from "better-sqlite3";

import type {
  SqliteRepository,
  TelegramManagerRegistrationInput,
  TelegramManagerRegistrationRecord
} from "../sqlite-repository.js";

type TelegramManagerRegistrationRepositoryMethods = Pick<
  SqliteRepository,
  | "upsertTelegramManagerRegistration"
  | "listActiveTelegramManagerRegistrations"
>;

type TelegramManagerRegistrationRow = Omit<
  TelegramManagerRegistrationRecord,
  "active"
> & {
  active: number;
};

export function createTelegramManagerRegistrationRepositoryMethods(
  database: Database.Database
): TelegramManagerRegistrationRepositoryMethods {
  const upsertStatement = database.prepare(`
    INSERT INTO telegram_manager_registrations (
      telegram_chat_id,
      telegram_user_id,
      bitrix_user_id,
      telegram_username,
      telegram_first_name,
      telegram_last_name,
      active,
      registered_at,
      last_seen_at
    ) VALUES (
      @telegramChatId,
      @telegramUserId,
      @bitrixUserId,
      @telegramUsername,
      @telegramFirstName,
      @telegramLastName,
      1,
      @registeredAt,
      @lastSeenAt
    )
    ON CONFLICT(telegram_chat_id) DO UPDATE SET
      telegram_user_id = excluded.telegram_user_id,
      bitrix_user_id = COALESCE(
        excluded.bitrix_user_id,
        telegram_manager_registrations.bitrix_user_id
      ),
      telegram_username = excluded.telegram_username,
      telegram_first_name = excluded.telegram_first_name,
      telegram_last_name = excluded.telegram_last_name,
      active = 1,
      registered_at = telegram_manager_registrations.registered_at,
      last_seen_at = excluded.last_seen_at
  `);

  const listActiveStatement = database.prepare(`
    SELECT
      telegram_chat_id AS telegramChatId,
      telegram_user_id AS telegramUserId,
      bitrix_user_id AS bitrixUserId,
      telegram_username AS telegramUsername,
      telegram_first_name AS telegramFirstName,
      telegram_last_name AS telegramLastName,
      active,
      registered_at AS registeredAt,
      last_seen_at AS lastSeenAt
    FROM telegram_manager_registrations
    WHERE active = 1
      AND bitrix_user_id IS NOT NULL
      AND TRIM(bitrix_user_id) <> ''
    ORDER BY bitrix_user_id ASC, telegram_chat_id ASC
  `);

  return {
    async upsertTelegramManagerRegistration(
      input: TelegramManagerRegistrationInput
    ) {
      upsertStatement.run(input);
    },

    async listActiveTelegramManagerRegistrations() {
      const rows = listActiveStatement.all() as TelegramManagerRegistrationRow[];
      return rows.map((row) => ({
        ...row,
        active: Boolean(row.active)
      }));
    }
  };
}
