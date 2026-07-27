export type RuntimeModuleId =
  | "sync-snapshot"
  | "analytics-reports"
  | "call-analysis"
  | "call-enrichment"
  | "telegram-manager-registration"
  | "telegram-activity-summary"
  | "knowledge-mcp"
  | "comments-paperclip"
  | "auth-access"
  | "integration-adapters";

export type RuntimeModuleOwner = "attraction" | "platform";

export type RuntimeModuleKind =
  | "http"
  | "background-job"
  | "webhook"
  | "agent-gateway"
  | "adapter"
  | "platform";

export interface RuntimeModuleDescriptor {
  id: RuntimeModuleId;
  label: string;
  owner: RuntimeModuleOwner;
  kind: RuntimeModuleKind;
  currentEntrypoints: readonly string[];
  reads: readonly string[];
  writes: readonly string[];
  externalSystems: readonly string[];
  sourceOfTruth: readonly string[];
  notes: string;
}

export const attractionRuntimeModules = [
  {
    id: "sync-snapshot",
    label: "Sync and SQLite snapshot",
    owner: "attraction",
    kind: "background-job",
    currentEntrypoints: [
      "apps/api/src/domain/sync.ts",
      "apps/api/src/server/routes/attraction-routes.ts",
      "startAttractionAutoSync"
    ],
    reads: ["Bitrix24 attraction category data"],
    writes: ["local SQLite reporting snapshot"],
    externalSystems: ["Bitrix24"],
    sourceOfTruth: ["AGENTS.md", "docs/modules/attraction/MODULE_ONTOLOGY.md"],
    notes:
      "Dashboard rendering reads the cached snapshot. Sync is a separate operation from report rendering."
  },
  {
    id: "analytics-reports",
    label: "Analytics reports",
    owner: "attraction",
    kind: "http",
    currentEntrypoints: [
      "/api/dashboard",
      "/api/reports/*",
      "apps/api/src/domain/operational-reports.ts"
    ],
    reads: ["local SQLite reporting snapshot"],
    writes: [],
    externalSystems: [],
    sourceOfTruth: [
      "docs/modules/attraction/REPORT_REGISTRY.md",
      "docs/modules/attraction/MODULE_ONTOLOGY.md"
    ],
    notes:
      "Attraction-owned aggregate reports. Report execution must not perform direct Bitrix reads."
  },
  {
    id: "call-analysis",
    label: "Call analysis",
    owner: "attraction",
    kind: "webhook",
    currentEntrypoints: [
      "/api/calls/*",
      "/api/calls/events/bitrix",
      "apps/api/src/server/call-analysis-service.ts"
    ],
    reads: ["Bitrix24 call activities", "call recording metadata"],
    writes: ["local call analysis state"],
    externalSystems: ["Bitrix24", "OpenRouter"],
    sourceOfTruth: ["docs/adr/0002-manager-approved-call-enrichment-writeback.md"],
    notes:
      "Covers manual queue analysis and automatic webhook intake. LLM output is advisory."
  },
  {
    id: "call-enrichment",
    label: "Call enrichment and Telegram approval",
    owner: "attraction",
    kind: "background-job",
    currentEntrypoints: [
      "telegram-enrichment-routes",
      "callEnrichmentOrchestrator",
      "callEnrichmentWriteback",
      "callEnrichmentExpiry"
    ],
    reads: ["local call analysis state", "current Bitrix field values"],
    writes: ["local enrichment proposals", "approved allowlisted Bitrix fields"],
    externalSystems: ["Bitrix24", "Telegram", "OpenRouter"],
    sourceOfTruth: ["docs/adr/0002-manager-approved-call-enrichment-writeback.md"],
    notes:
      "The only current destructive CRM path. Approval, allowlist, reread-before-write, and audit behavior are mandatory."
  },
  {
    id: "telegram-manager-registration",
    label: "Telegram manager registration",
    owner: "attraction",
    kind: "webhook",
    currentEntrypoints: [
      "/api/telegram/enrichment/callback",
      "/api/telegram/registrations",
      "apps/api/src/server/telegram-manager-registration.ts"
    ],
    reads: ["private Telegram /start identity", "manual Bitrix manager match"],
    writes: ["local Telegram identity and manager registration mapping"],
    externalSystems: ["Telegram", "n8n deal routing"],
    sourceOfTruth: [
      "docs/adr/0005-durable-telegram-manager-registration.md"
    ],
    notes:
      "The dashboard API remains the single webhook owner. Registration export is secret-protected and excluded from reporting and MCP."
  },
  {
    id: "telegram-activity-summary",
    label: "Telegram activity summary",
    owner: "attraction",
    kind: "background-job",
    currentEntrypoints: [
      "apps/api/src/server/telegram-activity-report.ts",
      "startTelegramActivityReport"
    ],
    reads: ["activities workload report", "calls workload report", "meta report"],
    writes: [],
    externalSystems: ["Telegram"],
    sourceOfTruth: ["docs/product/PROJECT_STRUCTURE.md"],
    notes:
      "Scheduled outbound summary. It shares the Telegram adapter with approval flows but is a separate runtime module."
  },
  {
    id: "knowledge-mcp",
    label: "Knowledge and MCP",
    owner: "platform",
    kind: "agent-gateway",
    currentEntrypoints: [
      "/api/mcp",
      "apps/api/src/agent/attraction-agent-gateway.ts",
      "apps/api/src/agent/mcp-server.ts"
    ],
    reads: ["approved report outputs", "ontology docs", "KI playbook"],
    writes: [],
    externalSystems: ["MCP clients"],
    sourceOfTruth: ["docs/architecture/agent-mcp.md"],
    notes:
      "Read-only gateway. Must not expose sync, writeback, Telegram, Paperclip, raw SQLite, raw Bitrix, or secrets."
  },
  {
    id: "comments-paperclip",
    label: "Comments and Paperclip",
    owner: "platform",
    kind: "platform",
    currentEntrypoints: [
      "/api/proto-comments",
      "PaperclipClient",
      "apps/web/src/proto/proto-app.tsx"
    ],
    reads: ["dashboard comment state", "Paperclip status"],
    writes: ["local comments", "Paperclip task state when configured"],
    externalSystems: ["Paperclip", "GitHub"],
    sourceOfTruth: ["AGENTS.md", "ops/paperclip"],
    notes:
      "Operational product feedback loop. It is not part of the business ontology."
  },
  {
    id: "auth-access",
    label: "Auth and access",
    owner: "platform",
    kind: "platform",
    currentEntrypoints: ["/api/auth/*", "/api/admin/*", "authStore"],
    reads: ["auth/session state", "module access state"],
    writes: ["auth/session state", "module access state"],
    externalSystems: [],
    sourceOfTruth: ["AGENTS.md"],
    notes:
      "Platform access control around attraction. Do not grow new multi-module behavior to preserve legacy leadgen."
  },
  {
    id: "integration-adapters",
    label: "Integration adapters",
    owner: "platform",
    kind: "adapter",
    currentEntrypoints: ["BitrixClient", "TelegramBotClient", "OpenRouter providers"],
    reads: ["external API responses"],
    writes: ["external API calls requested by owning runtime modules"],
    externalSystems: ["Bitrix24", "Telegram", "OpenRouter"],
    sourceOfTruth: ["docs/product/PROJECT_STRUCTURE.md"],
    notes:
      "Adapters do not own product behavior. Writes must be authorized by the owning runtime module contract."
  }
] as const satisfies readonly RuntimeModuleDescriptor[];

export const activeRuntimeModuleIds = attractionRuntimeModules.map(
  (module) => module.id
);
