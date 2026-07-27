import { describe, expect, it, vi } from "vitest";

import { createTelegramManagerRegistrationService } from "../src/server/telegram-manager-registration";

describe("Telegram manager registration", () => {
  it("persists a private Telegram account after a regular start command", async () => {
    const repository = {
      upsertTelegramManagerRegistration: vi.fn().mockResolvedValue(undefined)
    };
    const sender = {
      sendMessage: vi.fn().mockResolvedValue(undefined)
    };
    const service = createTelegramManagerRegistrationService({
      repository,
      sender,
      now: () => new Date("2026-07-27T15:00:00.000Z")
    });

    await expect(
      service.handleMessage({
        chatId: "70001",
        chatType: "private",
        userId: "70001",
        username: "olga",
        firstName: "Ольга",
        lastName: "Ромашова",
        text: "/start"
      })
    ).resolves.toBe("saved");

    expect(repository.upsertTelegramManagerRegistration).toHaveBeenCalledWith({
      telegramChatId: "70001",
      telegramUserId: "70001",
      bitrixUserId: null,
      telegramUsername: "olga",
      telegramFirstName: "Ольга",
      telegramLastName: "Ромашова",
      registeredAt: "2026-07-27T15:00:00.000Z",
      lastSeenAt: "2026-07-27T15:00:00.000Z"
    });
    expect(sender.sendMessage).toHaveBeenCalledWith({
      chatId: "70001",
      text: expect.stringContaining("Аккаунт сохранён")
    });
  });

  it("accepts Telegram deep-link payloads without interpreting them", async () => {
    const repository = {
      upsertTelegramManagerRegistration: vi.fn().mockResolvedValue(undefined)
    };
    const service = createTelegramManagerRegistrationService({
      repository,
      sender: {
        sendMessage: vi.fn().mockResolvedValue(undefined)
      }
    });

    await expect(
      service.handleMessage({
        chatId: "70001",
        chatType: "private",
        userId: "70001",
        username: null,
        firstName: "Ольга",
        lastName: null,
        text: "/start anything"
      })
    ).resolves.toBe("saved");
    expect(repository.upsertTelegramManagerRegistration).toHaveBeenCalledTimes(1);
  });

  it("ignores group and non-start messages", async () => {
    const repository = {
      upsertTelegramManagerRegistration: vi.fn().mockResolvedValue(undefined)
    };
    const sender = {
      sendMessage: vi.fn().mockResolvedValue(undefined)
    };
    const service = createTelegramManagerRegistrationService({
      repository,
      sender
    });

    await expect(
      service.handleMessage({
        chatId: "-1001",
        chatType: "group",
        userId: "70001",
        username: null,
        firstName: "Ольга",
        lastName: null,
        text: "/start"
      })
    ).resolves.toBe("ignored");
    await expect(
      service.handleMessage({
        chatId: "70001",
        chatType: "private",
        userId: "70001",
        username: null,
        firstName: "Ольга",
        lastName: null,
        text: "Привет"
      })
    ).resolves.toBe("ignored");

    expect(repository.upsertTelegramManagerRegistration).not.toHaveBeenCalled();
    expect(sender.sendMessage).not.toHaveBeenCalled();
  });
});
