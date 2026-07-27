import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readEnv } from "../src/config/env";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

describe("readEnv", () => {
  it("documents call analysis OpenRouter settings in the example env file", () => {
    const envExample = readFileSync(
      resolve(TEST_DIR, "../../../.env.example"),
      "utf8"
    );

    for (const name of [
      "CALL_ANALYSIS_DOWNLOAD_TIMEOUT_MS",
      "CALL_ANALYSIS_MAX_AUDIO_BYTES",
      "CALL_ENRICHMENT_INTAKE_ENABLED",
      "BITRIX_CALL_EVENT_WEBHOOK_SECRET",
      "OPENROUTER_API_KEY",
      "OPENROUTER_MODEL",
      "OPENROUTER_PROMPT_VERSION",
      "OPENROUTER_DIALOGUE_GATE_MODEL",
      "OPENROUTER_DIALOGUE_GATE_PROMPT_VERSION",
      "CALL_ANALYSIS_DIALOGUE_GATE_ENABLED",
      "OPENROUTER_APP_REFERER",
      "OPENROUTER_APP_TITLE",
      "CALL_ENRICHMENT_MODE",
      "CALL_ENRICHMENT_PILOT_MANAGER_IDS",
      "CALL_ENRICHMENT_EXPIRY_INTERVAL_MINUTES",
      "TELEGRAM_ACTIVITY_REPORT_TEAM_CHAT_IDS",
      "TELEGRAM_ENRICHMENT_ENABLED",
      "TELEGRAM_ENRICHMENT_BOT_TOKEN",
      "TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS",
      "TELEGRAM_ENRICHMENT_CALLBACK_SECRET",
      "TELEGRAM_MANAGER_REGISTRATION_ENABLED",
      "TELEGRAM_MANAGER_REGISTRATION_EXPORT_SECRET"
    ]) {
      expect(envExample).toContain(`${name}=`);
    }
  });

  it("rejects unsafe Bitrix custom field overrides instead of trusting arbitrary UF fields", () => {
    expect(() =>
      readEnv({
        BITRIX24_DEAL_QUALITY_FIELD: "UF_CRM_9999999999"
      })
    ).toThrow(/not allowed/i);
  });

  it("treats an empty optional target-group field as disabled", () => {
    expect(
      readEnv({
        BITRIX24_DEAL_TARGET_GROUP_FIELD: ""
      }).BITRIX24_DEAL_TARGET_GROUP_FIELD
    ).toBeUndefined();
  });

  it("rejects partial Bitrix webhook configuration", () => {
    expect(() =>
      readEnv({
        BITRIX24_PORTAL_HOST: "portal.bitrix24.ru"
      })
    ).toThrow(/configured together|all three/i);

    expect(() =>
      readEnv({
        BITRIX24_PORTAL_HOST: "portal.bitrix24.ru",
        BITRIX24_WEBHOOK_USER_ID: "1"
      })
    ).toThrow(/configured together|all three/i);
  });

  it("enables Bitrix only when all webhook settings are present", () => {
    expect(
      readEnv({
        BITRIX24_PORTAL_HOST: "portal.bitrix24.ru",
        BITRIX24_WEBHOOK_USER_ID: "1",
        BITRIX24_WEBHOOK_TOKEN: "secret"
      }).bitrixEnabled
    ).toBe(true);
  });

  it("keeps Bitrix disabled when webhook settings are absent", () => {
    expect(readEnv({}).bitrixEnabled).toBe(false);
  });

  it("documents and validates the optional remote MCP access token", () => {
    const envExample = readFileSync(
      resolve(TEST_DIR, "../../../.env.example"),
      "utf8"
    );

    expect(envExample).toContain("MCP_ACCESS_TOKEN=");
    expect(readEnv({ MCP_ACCESS_TOKEN: "" }).MCP_ACCESS_TOKEN).toBeUndefined();
    expect(() => readEnv({ MCP_ACCESS_TOKEN: "short-token" })).toThrow(
      /MCP_ACCESS_TOKEN/i
    );
    expect(
      readEnv({
        MCP_ACCESS_TOKEN: "remote-mcp-token-with-at-least-32-characters"
      }).MCP_ACCESS_TOKEN
    ).toBe("remote-mcp-token-with-at-least-32-characters");
  });

  it("exposes safe defaults and overrides for call analysis recording downloads", () => {
    expect(readEnv({})).toMatchObject({
      CALL_ANALYSIS_DOWNLOAD_TIMEOUT_MS: 60_000,
      CALL_ANALYSIS_MAX_AUDIO_BYTES: 50 * 1024 * 1024,
      OPENROUTER_MODEL: "google/gemini-3.5-flash",
      OPENROUTER_DIALOGUE_GATE_MODEL: "google/gemini-2.5-flash-lite",
      OPENROUTER_DIALOGUE_GATE_PROMPT_VERSION: "dialogue-gate-v1",
      callAnalysisDialogueGateEnabled: false
    });

    expect(
      readEnv({
        CALL_ANALYSIS_DOWNLOAD_TIMEOUT_MS: "15000",
        CALL_ANALYSIS_MAX_AUDIO_BYTES: String(12 * 1024 * 1024)
      })
    ).toMatchObject({
      CALL_ANALYSIS_DOWNLOAD_TIMEOUT_MS: 15_000,
      CALL_ANALYSIS_MAX_AUDIO_BYTES: 12 * 1024 * 1024
    });
  });

  it("defaults the dialogue gate on when call enrichment intake is enabled", () => {
    expect(
      readEnv({
        CALL_ENRICHMENT_INTAKE_ENABLED: "true",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters"
      }).callAnalysisDialogueGateEnabled
    ).toBe(true);

    expect(
      readEnv({
        CALL_ENRICHMENT_INTAKE_ENABLED: "true",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters",
        CALL_ANALYSIS_DIALOGUE_GATE_ENABLED: ""
      }).callAnalysisDialogueGateEnabled
    ).toBe(true);

    expect(
      readEnv({
        CALL_ENRICHMENT_INTAKE_ENABLED: "true",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters",
        CALL_ANALYSIS_DIALOGUE_GATE_ENABLED: "false"
      }).callAnalysisDialogueGateEnabled
    ).toBe(false);

    expect(
      readEnv({
        CALL_ANALYSIS_DIALOGUE_GATE_ENABLED: "true",
        OPENROUTER_DIALOGUE_GATE_MODEL: "custom/cheap-audio-model",
        OPENROUTER_DIALOGUE_GATE_PROMPT_VERSION: "dialogue-gate-test"
      })
    ).toMatchObject({
      callAnalysisDialogueGateEnabled: true,
      OPENROUTER_DIALOGUE_GATE_MODEL: "custom/cheap-audio-model",
      OPENROUTER_DIALOGUE_GATE_PROMPT_VERSION: "dialogue-gate-test"
    });
  });

  it("keeps call enrichment intake disabled by default", () => {
    const env = readEnv({});

    expect(env.callEnrichmentIntakeEnabled).toBe(false);
    expect(env.bitrixCallEventWebhookSecret).toBeUndefined();
  });

  it("requires a long Bitrix call event secret when call enrichment intake is enabled", () => {
    expect(() =>
      readEnv({
        CALL_ENRICHMENT_INTAKE_ENABLED: "true"
      })
    ).toThrow(/BITRIX_CALL_EVENT_WEBHOOK_SECRET/i);

    expect(() =>
      readEnv({
        CALL_ENRICHMENT_INTAKE_ENABLED: "true",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET: "short"
      })
    ).toThrow(/BITRIX_CALL_EVENT_WEBHOOK_SECRET/i);
  });

  it("derives call enrichment intake settings from env", () => {
    expect(
      readEnv({
        CALL_ENRICHMENT_INTAKE_ENABLED: "true",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters"
      })
    ).toMatchObject({
      callEnrichmentIntakeEnabled: true,
      bitrixCallEventWebhookSecret:
        "bitrix-call-event-secret-with-32-characters"
      });
  });

  it("derives call enrichment rollout modes and gates", () => {
    expect(readEnv({})).toMatchObject({
      callEnrichmentMode: "off",
      callEnrichmentAnalysisEnabled: false,
      callEnrichmentTelegramEnabled: false,
      callEnrichmentWritebackEnabled: false,
      callEnrichmentPilotManagerIds: [],
      callEnrichmentExpiryIntervalMs: 60 * 60 * 1_000
    });

    expect(
      readEnv({
        CALL_ENRICHMENT_MODE: "dry_run",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters",
        CALL_ENRICHMENT_EXPIRY_INTERVAL_MINUTES: "15"
      })
    ).toMatchObject({
      callEnrichmentMode: "dry_run",
      callEnrichmentIntakeEnabled: true,
      callEnrichmentAnalysisEnabled: true,
      callEnrichmentTelegramEnabled: false,
      callEnrichmentWritebackEnabled: false,
      callEnrichmentExpiryIntervalMs: 15 * 60 * 1_000
    });

    expect(
      readEnv({
        CALL_ENRICHMENT_MODE: "telegram_only",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: "78:123",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-enrichment-secret-with-32-bytes"
      })
    ).toMatchObject({
      callEnrichmentMode: "telegram_only",
      callEnrichmentAnalysisEnabled: true,
      callEnrichmentTelegramEnabled: true,
      callEnrichmentWritebackEnabled: false,
      telegramEnrichmentEnabled: true
    });

    expect(
      readEnv({
        CALL_ENRICHMENT_MODE: "limited_write",
        CALL_ENRICHMENT_PILOT_MANAGER_IDS: "78, 13020",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: "78:123,13020:456",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-enrichment-secret-with-32-bytes"
      })
    ).toMatchObject({
      callEnrichmentMode: "limited_write",
      callEnrichmentPilotManagerIds: ["78", "13020"],
      callEnrichmentIntakePilotManagerIds: ["78", "13020"],
      callEnrichmentWritebackEnabled: true
    });

    expect(
      readEnv({
        CALL_ENRICHMENT_MODE: "full_v1",
        CALL_ENRICHMENT_PILOT_MANAGER_IDS: "78, 13020",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: "78:123",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-enrichment-secret-with-32-bytes"
      })
    ).toMatchObject({
      callEnrichmentMode: "full_v1",
      callEnrichmentPilotManagerIds: ["78", "13020"],
      callEnrichmentIntakePilotManagerIds: [],
      callEnrichmentWritebackEnabled: true
    });
  });

  it("rejects unsafe call enrichment rollout combinations", () => {
    expect(() =>
      readEnv({
        CALL_ENRICHMENT_MODE: "dry_run"
      })
    ).toThrow(/BITRIX_CALL_EVENT_WEBHOOK_SECRET/i);

    expect(() =>
      readEnv({
        CALL_ENRICHMENT_MODE: "telegram_only",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters"
      })
    ).toThrow(/TELEGRAM_ENRICHMENT_BOT_TOKEN/i);

    expect(() =>
      readEnv({
        CALL_ENRICHMENT_MODE: "limited_write",
        BITRIX_CALL_EVENT_WEBHOOK_SECRET:
          "bitrix-call-event-secret-with-32-characters",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: "78:123",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-enrichment-secret-with-32-bytes"
      })
    ).toThrow(/CALL_ENRICHMENT_PILOT_MANAGER_IDS/i);
  });

  it("configures hourly attraction auto sync from production defaults and explicit overrides", () => {
    expect(readEnv({}).attractionAutoSyncEnabled).toBe(false);
    expect(readEnv({}).attractionAutoSyncIntervalMs).toBe(60 * 60 * 1_000);

    expect(
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "password",
        SESSION_SECRET: "production-session-secret-with-at-least-32-bytes",
        APP_PUBLIC_URL: "https://dash.example.com"
      }).attractionAutoSyncEnabled
    ).toBe(true);

    expect(
      readEnv({
        ATTRACTION_AUTO_SYNC_ENABLED: "true",
        ATTRACTION_AUTO_SYNC_INTERVAL_MINUTES: "15"
      })
    ).toMatchObject({
      attractionAutoSyncEnabled: true,
      attractionAutoSyncIntervalMs: 15 * 60 * 1_000
    });

    expect(
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "password",
        SESSION_SECRET: "production-session-secret-with-at-least-32-bytes",
        APP_PUBLIC_URL: "https://dash.example.com",
        ATTRACTION_AUTO_SYNC_ENABLED: "false"
      }).attractionAutoSyncEnabled
    ).toBe(false);
  });

  it("keeps telegram activity reports disabled by default and validates enabled delivery config", () => {
    expect(readEnv({})).toMatchObject({
      telegramActivityReportEnabled: false,
      telegramActivityReportTime: "20:00",
      telegramActivityReportChatIds: [],
      telegramActivityReportTeamChatIds: {}
    });

    expect(() =>
      readEnv({
        TELEGRAM_ACTIVITY_REPORT_ENABLED: "true"
      })
    ).toThrow(/TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN/i);

    expect(() =>
      readEnv({
        TELEGRAM_ACTIVITY_REPORT_ENABLED: "true",
        TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN: "telegram-token"
      })
    ).toThrow(/TELEGRAM_ACTIVITY_REPORT_CHAT_IDS/i);

    expect(
      readEnv({
        TELEGRAM_ACTIVITY_REPORT_ENABLED: "true",
        TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ACTIVITY_REPORT_CHAT_IDS: "111, 222",
        TELEGRAM_ACTIVITY_REPORT_TEAM_CHAT_IDS:
          "team-2:333, team-2:333, team-2:444",
        TELEGRAM_ACTIVITY_REPORT_TIME: "20:30"
      })
    ).toMatchObject({
      telegramActivityReportEnabled: true,
      TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN: "telegram-token",
      telegramActivityReportChatIds: ["111", "222"],
      telegramActivityReportTeamChatIds: {
        "team-2": ["333", "444"]
      },
      telegramActivityReportTime: "20:30"
    });

    expect(
      readEnv({
        TELEGRAM_ACTIVITY_REPORT_ENABLED: "true",
        TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ACTIVITY_REPORT_CHAT_ID: "-10042"
      }).telegramActivityReportChatIds
    ).toEqual(["-10042"]);

    expect(() =>
      readEnv({
        TELEGRAM_ACTIVITY_REPORT_TEAM_CHAT_IDS: "team-2"
      })
    ).toThrow(/TELEGRAM_ACTIVITY_REPORT_TEAM_CHAT_IDS/i);
  });

  it("rejects invalid telegram activity report time", () => {
    expect(() =>
      readEnv({
        TELEGRAM_ACTIVITY_REPORT_TIME: "24:00"
      })
    ).toThrow(/TELEGRAM_ACTIVITY_REPORT_TIME/i);
  });

  it("keeps telegram enrichment disabled by default and validates enabled config", () => {
    expect(readEnv({})).toMatchObject({
      telegramEnrichmentEnabled: false,
      telegramEnrichmentManagerChatIds: {}
    });

    expect(() =>
      readEnv({
        TELEGRAM_ENRICHMENT_ENABLED: "true"
      })
    ).toThrow(/TELEGRAM_ENRICHMENT_BOT_TOKEN/i);

    expect(() =>
      readEnv({
        TELEGRAM_ENRICHMENT_ENABLED: "true",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token"
      })
    ).toThrow(/TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS/i);

    expect(() =>
      readEnv({
        TELEGRAM_ENRICHMENT_ENABLED: "true",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: "78:123"
      })
    ).toThrow(/TELEGRAM_ENRICHMENT_CALLBACK_SECRET/i);

    expect(
      readEnv({
        TELEGRAM_ENRICHMENT_ENABLED: "true",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: "78:123, 13020:-10042",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-enrichment-secret-with-32-bytes"
      })
    ).toMatchObject({
      telegramEnrichmentEnabled: true,
      TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
      telegramEnrichmentManagerChatIds: {
        "78": ["123"],
        "13020": ["-10042"]
      },
      telegramEnrichmentCallbackSecret:
        "telegram-enrichment-secret-with-32-bytes"
    });
  });

  it("keeps multiple telegram enrichment chats for one manager", () => {
    expect(
      readEnv({
        TELEGRAM_ENRICHMENT_ENABLED: "true",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: "13020:839402543,13020:1364600907,13020:839402543",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-enrichment-secret-with-32-bytes"
      })
    ).toMatchObject({
      telegramEnrichmentManagerChatIds: {
        "13020": ["839402543", "1364600907"]
      }
    });
  });

  it("validates and exposes durable Telegram manager registration config", () => {
    expect(readEnv({})).toMatchObject({
      telegramManagerRegistrationEnabled: false
    });

    expect(() =>
      readEnv({
        TELEGRAM_MANAGER_REGISTRATION_ENABLED: "true"
      })
    ).toThrow(/TELEGRAM_ENRICHMENT_BOT_TOKEN/i);

    expect(() =>
      readEnv({
        TELEGRAM_MANAGER_REGISTRATION_ENABLED: "true",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-webhook-secret-with-32-characters",
        TELEGRAM_MANAGER_REGISTRATION_EXPORT_SECRET: "short"
      })
    ).toThrow(/TELEGRAM_MANAGER_REGISTRATION_EXPORT_SECRET/i);

    expect(
      readEnv({
        TELEGRAM_MANAGER_REGISTRATION_ENABLED: "true",
        TELEGRAM_ENRICHMENT_BOT_TOKEN: "telegram-token",
        TELEGRAM_ENRICHMENT_CALLBACK_SECRET:
          "telegram-webhook-secret-with-32-characters",
        TELEGRAM_MANAGER_REGISTRATION_EXPORT_SECRET:
          "telegram-export-secret-with-32-characters"
      })
    ).toMatchObject({
      telegramManagerRegistrationEnabled: true,
      telegramManagerRegistrationExportSecret:
        "telegram-export-secret-with-32-characters"
    });
  });

  it("derives separate platform, attraction, and leadgen database URLs", () => {
    expect(readEnv({}).platformDatabaseUrl).toBe(
      "file:./data/bitrix24-reporting.db"
    );
    expect(readEnv({}).attractionDatabaseUrl).toBe(
      "file:./data/bitrix24-attraction.db"
    );
    expect(readEnv({}).leadgenDatabaseUrl).toBe(
      "file:./data/bitrix24-leadgen.db"
    );

    expect(
      readEnv({
        DATABASE_URL: "file:/app/data/platform.db",
        PLATFORM_DATABASE_URL: "file:/app/data/auth-comments.db",
        ATTRACTION_DATABASE_URL: "file:/app/data/attraction.db",
        LEADGEN_DATABASE_URL: "file:/app/data/leadgen.db"
      })
    ).toMatchObject({
      platformDatabaseUrl: "file:/app/data/auth-comments.db",
      attractionDatabaseUrl: "file:/app/data/attraction.db",
      leadgenDatabaseUrl: "file:/app/data/leadgen.db"
    });
  });

  it("rejects overlapping module database URLs", () => {
    expect(() =>
      readEnv({
        DATABASE_URL: "file:/app/data/platform.db",
        PLATFORM_DATABASE_URL: "file:/app/data/platform.db",
        ATTRACTION_DATABASE_URL: "file:/app/data/platform.db",
        LEADGEN_DATABASE_URL: "file:/app/data/leadgen.db"
      })
    ).toThrow(/database URLs must be distinct/i);
  });

  it("rejects overlapping module database URLs after resolving file paths", () => {
    const sharedPath = resolve(process.cwd(), "data/shared.db");

    expect(() =>
      readEnv({
        DATABASE_URL: "file:/tmp/platform.db",
        PLATFORM_DATABASE_URL: `file:${sharedPath}`,
        ATTRACTION_DATABASE_URL: "file:./data/shared.db",
        LEADGEN_DATABASE_URL: "file:/tmp/leadgen.db"
      })
    ).toThrow(/database URLs must be distinct/i);
  });

  it("requires password auth configuration in production", () => {
    expect(() =>
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "none"
      })
    ).toThrow(/AUTH_MODE=password/i);

    expect(() =>
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "password"
      })
    ).toThrow(/SESSION_SECRET/i);

    expect(
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "password",
        SESSION_SECRET: "production-session-secret-with-at-least-32-bytes",
        APP_PUBLIC_URL: "https://dash.example.com"
      }).AUTH_MODE
    ).toBe("password");
  });

  it("sets NODE_ENV=production in the compiled production start script", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(TEST_DIR, "../package.json"), "utf8")
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["start:prod"]).toMatch(
      /\bNODE_ENV=production\b/
    );
  });
});
