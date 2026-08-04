import { BitrixClient } from "./bitrix/client.js";
import { createMessengerMessageCollectionService } from "./server/messenger-message-collection.js";
import { readEnv } from "./config/env.js";
import { createAttractionAgentGateway } from "./agent/attraction-agent-gateway.js";
import { createPlaybookReader } from "./agent/playbook-reader.js";
import { createPasswordAuthService, createSqliteAuthStore } from "./server/auth.js";
import { createApp } from "./server/app.js";
import { createCallAnalysisService } from "./server/call-analysis-service.js";
import { buildCallEnrichmentDiff } from "./server/call-enrichment-diff.js";
import { buildCallEnrichmentFollowUpNote } from "./server/call-enrichment-follow-up-note.js";
import { createCallEnrichmentLiveIntakeQueue } from "./server/call-enrichment-live-intake.js";
import { createCallEnrichmentOrchestrator } from "./server/call-enrichment-orchestrator.js";
import { createCallEnrichmentWritebackService } from "./server/call-enrichment-writeback.js";
import { createLeadgenService } from "./server/leadgen-service.js";
import { OpenRouterDialogueGateProvider } from "./server/openrouter-dialogue-gate.js";
import { OpenRouterEnrichmentExtractionProvider } from "./server/openrouter-enrichment-extraction.js";
import { OpenRouterCallAnalysisProvider } from "./server/openrouter-call-analysis.js";
import { PaperclipClient } from "./server/paperclip-client.js";
import { createTelegramEnrichmentApprovalService } from "./server/telegram-enrichment-approval.js";
import type {
  PlatformCommentRepository,
  ProtoCommentRepository,
  SyncRunRepository
} from "./server/repository-roles.js";
import { createSqliteRepository } from "./server/sqlite-repository.js";
import { createReportingService } from "./server/service.js";
import { TelegramBotClient } from "./server/telegram-client.js";
import { createTelegramManagerRegistrationService } from "./server/telegram-manager-registration.js";
import { createAttractionCapabilityManifest } from "./server/module-capabilities.js";

const env = readEnv();
const platformRepository = createSqliteRepository({
  databaseUrl: env.platformDatabaseUrl,
  defaultWonStageIds: env.reportWonStageIds
});
const attractionRepository =
  env.attractionDatabaseUrl === env.platformDatabaseUrl
    ? platformRepository
    : createSqliteRepository({
        databaseUrl: env.attractionDatabaseUrl,
        defaultWonStageIds: env.reportWonStageIds
      });
const leadgenRepository = createSqliteRepository({
  databaseUrl: env.leadgenDatabaseUrl,
  defaultWonStageIds: env.reportWonStageIds
});
const repositories = new Set([
  platformRepository,
  attractionRepository,
  leadgenRepository
]);
const platformComments: PlatformCommentRepository = platformRepository;
const protoComments: ProtoCommentRepository = platformRepository;
const attractionSyncRuns: SyncRunRepository = attractionRepository;
const leadgenSyncRuns: SyncRunRepository = leadgenRepository;
const startupRecoveredAt = new Date().toISOString();
for (const repository of [attractionSyncRuns, leadgenSyncRuns]) {
  await repository
    .recoverStaleSyncRuns({
      staleBefore: startupRecoveredAt,
      failedAt: startupRecoveredAt,
      diagnostics: ["SYNC_FAILED", "error=API_RESTART_RECOVERED_RUNNING_SYNC"]
    })
    .then((count) => {
      if (count > 0) {
        console.warn(
          "sync.recovered_orphaned_runs",
          JSON.stringify({ count, failedAt: startupRecoveredAt })
        );
      }
    });
}
const clientConfig = {
  timeoutMs: env.BITRIX24_TIMEOUT_MS,
  requestIntervalMs: env.BITRIX24_REQUEST_INTERVAL_MS,
  qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD
};

const client = new BitrixClient({
  ...clientConfig,
  dealCategoryIds: env.bitrixDealCategoryIds,
  ...(env.BITRIX24_PORTAL_HOST
    ? { portalHost: env.BITRIX24_PORTAL_HOST }
    : {}),
  ...(env.BITRIX24_WEBHOOK_USER_ID
    ? { userId: env.BITRIX24_WEBHOOK_USER_ID }
    : {}),
  ...(env.BITRIX24_WEBHOOK_TOKEN
    ? { webhookToken: env.BITRIX24_WEBHOOK_TOKEN }
    : {})
});
const leadgenClient = new BitrixClient({
  ...clientConfig,
  dealCategoryIds: [env.leadgenCategoryId],
  ...(env.BITRIX24_PORTAL_HOST
    ? { portalHost: env.BITRIX24_PORTAL_HOST }
    : {}),
  ...(env.BITRIX24_WEBHOOK_USER_ID
    ? { userId: env.BITRIX24_WEBHOOK_USER_ID }
    : {}),
  ...(env.BITRIX24_WEBHOOK_TOKEN
    ? { webhookToken: env.BITRIX24_WEBHOOK_TOKEN }
    : {})
});
const messengerMessages = createMessengerMessageCollectionService({
  repository: attractionRepository,
  client,
  ...(env.BITRIX24_PORTAL_HOST
    ? { portalHost: env.BITRIX24_PORTAL_HOST }
    : {})
});
const service = createReportingService({
  dealCategoryIds: env.bitrixDealCategoryIds,
  leadgenCategoryId: env.leadgenCategoryId,
  leadgenManagerIds: env.leadgenManagerIds,
  qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD,
  tariffFieldName: env.BITRIX24_DEAL_TARIFF_FIELD,
  businessClubFieldName: env.BITRIX24_DEAL_BUSINESS_CLUB_FIELD,
  ...(env.BITRIX24_DEAL_TARGET_GROUP_FIELD
    ? { targetGroupFieldName: env.BITRIX24_DEAL_TARGET_GROUP_FIELD }
    : {}),
  ...(env.BITRIX24_DEAL_MEETING_TYPE_FIELD
    ? { meetingTypeFieldName: env.BITRIX24_DEAL_MEETING_TYPE_FIELD }
    : {}),
  ...(env.BITRIX24_DEAL_MEETING_DATE_FIELD
    ? { meetingDateFieldName: env.BITRIX24_DEAL_MEETING_DATE_FIELD }
    : {}),
  ...(env.BITRIX24_CONTACT_TARGET_GROUP_FIELD
    ? { contactTargetGroupFieldName: env.BITRIX24_CONTACT_TARGET_GROUP_FIELD }
    : {}),
  ...(env.BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD
    ? {
        legacyContactTargetGroupFieldName:
          env.BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD
      }
    : {}),
  repository: attractionRepository,
  client,
  defaultPeriodDays: env.REPORT_DEFAULT_PERIOD_DAYS,
  bootstrapLookbackDays: env.BITRIX24_BOOTSTRAP_LOOKBACK_DAYS,
  ...(env.BITRIX24_PORTAL_HOST
    ? { bitrixPortalHost: env.BITRIX24_PORTAL_HOST }
    : {})
});
const leadgenService = createLeadgenService({
  categoryId: env.leadgenCategoryId,
  managerIds: env.leadgenManagerIds,
  qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD,
  client: leadgenClient,
  repository: leadgenRepository,
  defaultPeriodDays: env.REPORT_DEFAULT_PERIOD_DAYS
});
const callAnalysis = env.OPENROUTER_API_KEY
  ? createCallAnalysisService({
      repository: attractionRepository,
      client,
      recordingDownloadTimeoutMs: env.CALL_ANALYSIS_DOWNLOAD_TIMEOUT_MS,
      maxRecordingBytes: env.CALL_ANALYSIS_MAX_AUDIO_BYTES,
      ...(env.callAnalysisDialogueGateEnabled
        ? {
            dialogueGate: new OpenRouterDialogueGateProvider({
              apiKey: env.OPENROUTER_API_KEY,
              model: env.OPENROUTER_DIALOGUE_GATE_MODEL,
              promptVersion: env.OPENROUTER_DIALOGUE_GATE_PROMPT_VERSION,
              ...(env.OPENROUTER_APP_REFERER
                ? { appReferer: env.OPENROUTER_APP_REFERER }
                : {}),
              ...(env.OPENROUTER_APP_TITLE
                ? { appTitle: env.OPENROUTER_APP_TITLE }
                : {})
            })
          }
        : {}),
      provider: new OpenRouterCallAnalysisProvider({
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        promptVersion: env.OPENROUTER_PROMPT_VERSION,
        ...(env.OPENROUTER_APP_REFERER
          ? { appReferer: env.OPENROUTER_APP_REFERER }
          : {}),
        ...(env.OPENROUTER_APP_TITLE ? { appTitle: env.OPENROUTER_APP_TITLE } : {})
      })
    })
  : undefined;
const callEnrichmentExtractionProvider = env.OPENROUTER_API_KEY
  ? new OpenRouterEnrichmentExtractionProvider({
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      ...(env.OPENROUTER_APP_REFERER
        ? { appReferer: env.OPENROUTER_APP_REFERER }
        : {}),
      ...(env.OPENROUTER_APP_TITLE ? { appTitle: env.OPENROUTER_APP_TITLE } : {})
    })
  : undefined;
const telegramBotSender =
  (env.telegramEnrichmentEnabled || env.telegramManagerRegistrationEnabled) &&
  env.TELEGRAM_ENRICHMENT_BOT_TOKEN
    ? new TelegramBotClient({
        botToken: env.TELEGRAM_ENRICHMENT_BOT_TOKEN
      })
    : undefined;
const callEnrichmentWriteback = env.telegramEnrichmentEnabled
  ? createCallEnrichmentWritebackService({
      repository: attractionRepository,
      ...(env.bitrixEnabled ? { bitrix: client } : {}),
      writebackMode: env.callEnrichmentWritebackEnabled
        ? env.callEnrichmentMode === "limited_write"
          ? "limited"
          : "enabled"
        : "disabled",
      pilotManagerIds: env.callEnrichmentPilotManagerIds
    })
  : undefined;
const telegramEnrichmentApproval =
  telegramBotSender &&
  callEnrichmentWriteback &&
  env.telegramEnrichmentEnabled
    ? createTelegramEnrichmentApprovalService({
        repository: attractionRepository,
        sender: telegramBotSender,
        decisionService: callEnrichmentWriteback,
        managerChatIds: env.telegramEnrichmentManagerChatIds
      })
    : undefined;
const telegramManagerRegistration =
  telegramBotSender &&
  env.telegramManagerRegistrationEnabled
    ? createTelegramManagerRegistrationService({
        repository: attractionRepository,
        sender: telegramBotSender
      })
    : undefined;
const callEnrichmentOrchestrator =
  callAnalysis &&
  callEnrichmentExtractionProvider &&
  env.callEnrichmentAnalysisEnabled &&
  env.bitrixEnabled
    ? createCallEnrichmentOrchestrator({
        analysis: callAnalysis,
        repository: attractionRepository,
        pilotManagerIds: env.callEnrichmentIntakePilotManagerIds,
        ...(telegramEnrichmentApproval
          ? { proposalNotifier: telegramEnrichmentApproval }
          : {}),
        enrichmentPipeline: {
          async runAfterCallAnalysis({ context, analysis }) {
            const dealId = normalizeRuntimeEntityId(
              context.attributes.dealId ?? analysis.attributes.dealId
            );
            const contactId = normalizeRuntimeEntityId(
              context.attributes.contactId ?? analysis.attributes.contactId
            );

            if (!dealId) {
              return {
                proposals: [],
                skipped: [],
                metadata: {
                  reason: "DEAL_NOT_RESOLVED"
                }
              };
            }

            const extraction =
              await callEnrichmentExtractionProvider.extractCallEnrichment({
                callId: analysis.callId,
                fullTranscriptText: analysis.fullTranscriptText,
                transcriptByRoles: analysis.transcriptByRoles,
                analysisSummary: extractCallAnalysisSummary(analysis.aiEvaluation),
                dealId,
                contactId: contactId ?? "not_resolved"
              });
            const [contactValues, dealValues] = await Promise.all([
              contactId
                ? client.getContactEnrichmentValues(contactId)
                : Promise.resolve(null),
              client.getDealEnrichmentValues(dealId)
            ]);
            const diff = buildCallEnrichmentDiff({
              dealId,
              contactId,
              candidates: extraction.candidates,
              currentValues: {
                contact: contactValues,
                deal: dealValues
              }
            });
            const followUpNote =
              diff.proposals.length === 0
                ? buildCallEnrichmentFollowUpNote(analysis)
                : null;

            return {
              ...diff,
              followUpNote,
              metadata: {
                extraction: {
                  model: extraction.model,
                  promptVersion: extraction.promptVersion,
                  analyzedAt: extraction.analyzedAt,
                  candidateCount: extraction.candidates.length,
                  totalTokens: extraction.usage.totalTokens
                }
              }
            };
          }
        }
      })
    : undefined;
const callEnrichmentLiveIntakeQueue =
  callEnrichmentOrchestrator && env.bitrixEnabled
    ? createCallEnrichmentLiveIntakeQueue({
        client,
        repository: attractionRepository,
        queueAutomaticCallAnalysis:
          callEnrichmentOrchestrator.queueAutomaticCallAnalysis
      })
    : undefined;
const authStore =
  env.AUTH_MODE === "password"
    ? createSqliteAuthStore({
        databaseUrl: env.platformDatabaseUrl
      })
    : null;
if (authStore) {
  await authStore.ensureModule({
    id: "attraction",
    slug: "attraction",
    name: "Привлечение",
    bitrixCategoryId: env.bitrixDealCategoryIds[0] ?? "10",
    paperclipCompanyId: env.PAPERCLIP_ATTRACTION_COMPANY_ID ?? null,
    paperclipProjectId: env.PAPERCLIP_ATTRACTION_PROJECT_ID ?? null,
    paperclipGoalId: env.PAPERCLIP_ATTRACTION_GOAL_ID ?? null,
    paperclipTriageAgentId: env.PAPERCLIP_ATTRACTION_TRIAGE_AGENT_ID ?? null
  });
  await authStore.ensureModule({
    id: "leadgen",
    slug: "leadgen",
    name: "Лидогенерация",
    bitrixCategoryId: env.leadgenCategoryId,
    paperclipCompanyId: env.PAPERCLIP_LEADGEN_COMPANY_ID ?? null,
    paperclipProjectId: env.PAPERCLIP_LEADGEN_PROJECT_ID ?? null,
    paperclipGoalId: env.PAPERCLIP_LEADGEN_GOAL_ID ?? null,
    paperclipTriageAgentId: env.PAPERCLIP_LEADGEN_TRIAGE_AGENT_ID ?? null
  });
  await authStore.ensureDefaultSuperAdmin();
  await authStore.ensureDefaultModuleLeader("attraction");
}
const auth =
  authStore && env.SESSION_SECRET
    ? createPasswordAuthService({
        store: authStore,
        sessionSecret: env.SESSION_SECRET,
        cookieName: env.SESSION_COOKIE_NAME,
        ttlHours: env.SESSION_TTL_HOURS,
        secureCookie: Boolean(
          env.NODE_ENV === "production" ||
            env.APP_PUBLIC_URL?.startsWith("https://")
        )
      })
    : undefined;
const paperclip =
  env.PAPERCLIP_API_URL && env.PAPERCLIP_API_TOKEN
    ? new PaperclipClient({
        apiUrl: env.PAPERCLIP_API_URL,
        apiToken: env.PAPERCLIP_API_TOKEN,
        ...(env.PAPERCLIP_BOARD_API_TOKEN
          ? { boardApiToken: env.PAPERCLIP_BOARD_API_TOKEN }
          : {}),
        reworkCommentMode: env.PAPERCLIP_REWORK_COMMENT_MODE
      })
    : undefined;
const telegramActivityReportSender =
  env.telegramActivityReportEnabled && env.TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN
    ? new TelegramBotClient({
        botToken: env.TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN
      })
    : undefined;
const attractionAgentGateway = env.MCP_ACCESS_TOKEN
  ? createAttractionAgentGateway({
      manifest: createAttractionCapabilityManifest(),
      service,
      ontology: {
        getOverview: () => service.getAttractionOntology(),
        readSource: ({ sourceId }) =>
          service.getAttractionOntologySourceDocument(sourceId)
      },
      playbook: createPlaybookReader()
    })
  : undefined;
const app = createApp(service, {
  webOrigin: env.WEB_ORIGIN,
  ...(env.API_AUTH_TOKEN ? { apiAuthToken: env.API_AUTH_TOKEN } : {}),
  ...(auth ? { auth } : {}),
  ...(authStore ? { authStore } : {}),
  comments: platformComments,
  ...(paperclip ? { paperclip } : {}),
  protoComments,
  ...(callAnalysis
    ? {
        callAnalysis: {
          ...callAnalysis,
          ...(callEnrichmentOrchestrator
            ? {
                queueAutomaticCallAnalysis:
                  callEnrichmentLiveIntakeQueue?.queueAutomaticCallAnalysis ??
                  callEnrichmentOrchestrator.queueAutomaticCallAnalysis
              }
            : {})
        }
      }
    : {}),
  modules: {
    attraction: service,
    leadgen: leadgenService
  },
  ...(env.MCP_ACCESS_TOKEN && attractionAgentGateway
    ? {
        agentMcp: {
          accessToken: env.MCP_ACCESS_TOKEN,
          gateway: attractionAgentGateway
        }
      }
    : {}),
  jsonBodyLimit: env.JSON_BODY_LIMIT,
  trustProxy:
    env.TRUST_PROXY === "true"
      ? true
      : env.TRUST_PROXY === "false"
        ? false
        : env.TRUST_PROXY,
  attractionAutoSync: {
    enabled: env.attractionAutoSyncEnabled && env.bitrixEnabled,
    intervalMs: env.attractionAutoSyncIntervalMs
  },
  messengerMessages: {
    enabled: true,
    service: messengerMessages
  },
  callEnrichmentIntake: {
    enabled: env.callEnrichmentAnalysisEnabled,
    ...(env.bitrixCallEventWebhookSecret
      ? { secret: env.bitrixCallEventWebhookSecret }
      : {})
  },
  callEnrichmentExpiry: {
    enabled: env.callEnrichmentAnalysisEnabled,
    intervalMs: env.callEnrichmentExpiryIntervalMs,
    repository: attractionRepository
  },
  telegramActivityReport: {
    enabled: env.telegramActivityReportEnabled,
    time: env.telegramActivityReportTime,
    timezone: env.APP_TIMEZONE,
    chatIds: env.telegramActivityReportChatIds,
    teamChatIds: env.telegramActivityReportTeamChatIds,
    ...(telegramActivityReportSender
      ? { sender: telegramActivityReportSender }
      : {})
  },
  telegramEnrichment: {
    enabled: env.telegramEnrichmentEnabled,
    ...(env.telegramEnrichmentCallbackSecret
      ? { secret: env.telegramEnrichmentCallbackSecret }
      : {}),
    ...(telegramEnrichmentApproval
      ? { approvalService: telegramEnrichmentApproval }
      : {})
  },
  telegramManagerRegistration: {
    enabled: env.telegramManagerRegistrationEnabled,
    ...(env.telegramManagerRegistrationExportSecret
      ? { exportSecret: env.telegramManagerRegistrationExportSecret }
      : {}),
    ...(telegramManagerRegistration
      ? { service: telegramManagerRegistration }
      : {}),
    repository: attractionRepository
  },
  ...(env.WEB_STATIC_DIR ? { webStaticDir: env.WEB_STATIC_DIR } : {})
});

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
});

process.on("SIGINT", () => {
  app.locals.stopAttractionAutoSync?.();
  app.locals.stopTelegramActivityReport?.();
  app.locals.stopCallEnrichmentExpiry?.();
  for (const repository of repositories) {
    repository.close();
  }
  authStore?.close();
  server.close(() => process.exit(0));
});

function normalizeRuntimeEntityId(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 && normalized !== "0" ? normalized : null;
}

function extractCallAnalysisSummary(aiEvaluation: Record<string, unknown>) {
  const summary = aiEvaluation.summary;
  return typeof summary === "string" && summary.trim().length > 0
    ? summary.trim()
    : null;
}
