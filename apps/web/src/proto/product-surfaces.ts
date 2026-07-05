export type ProductSurfaceId =
  | "analytics"
  | "call-analysis"
  | "ontology"
  | "ki-playbook"
  | "comments-paperclip"
  | "account-settings"
  | "agent-mcp";

export type ProductSurfaceOwner = "attraction" | "platform";

export type ProductSurfaceKind =
  | "dashboard"
  | "workflow"
  | "knowledge"
  | "operations"
  | "agent";

export interface ProductSurfaceDescriptor {
  id: ProductSurfaceId;
  label: string;
  owner: ProductSurfaceOwner;
  kind: ProductSurfaceKind;
  currentEntrypoints: readonly string[];
  sourceOfTruth: readonly string[];
  notes: string;
}

export const attractionProductSurfaces = [
  {
    id: "analytics",
    label: "Аналитика",
    owner: "attraction",
    kind: "dashboard",
    currentEntrypoints: [
      "apps/web/src/proto/proto-app.tsx",
      "apps/web/src/proto/scene-registry.ts",
      "apps/web/src/proto/scenes.tsx",
      "/api/reports/*"
    ],
    sourceOfTruth: [
      "docs/modules/attraction/MODULE_ONTOLOGY.md",
      "docs/modules/attraction/REPORT_REGISTRY.md"
    ],
    notes:
      "Attraction-owned report workspace over cached SQLite data. Browser rendering must not read Bitrix directly."
  },
  {
    id: "call-analysis",
    label: "Анализ звонков",
    owner: "attraction",
    kind: "workflow",
    currentEntrypoints: [
      "apps/web/src/proto/call-analysis-workspace.tsx",
      "/api/calls/*",
      "/api/calls/events/bitrix"
    ],
    sourceOfTruth: ["docs/adr/0002-manager-approved-call-enrichment-writeback.md"],
    notes:
      "Manual queue analysis and automatic Bitrix webhook intake share call intelligence storage but have different trigger modes."
  },
  {
    id: "ontology",
    label: "Онтология",
    owner: "attraction",
    kind: "knowledge",
    currentEntrypoints: [
      "apps/web/src/proto/ontology-hub.tsx",
      "docs/modules/attraction/ontology/registry/attraction-ontology.json"
    ],
    sourceOfTruth: [
      "docs/modules/attraction/MODULE_ONTOLOGY.md",
      "docs/modules/attraction/ontology/README.md"
    ],
    notes:
      "Business vocabulary, module state model, drift tracking, and report bindings."
  },
  {
    id: "ki-playbook",
    label: "Плейбук КИ",
    owner: "attraction",
    kind: "knowledge",
    currentEntrypoints: [
      "apps/web/src/proto/playbook-scene.tsx",
      "apps/api/src/agent/playbook-reader.ts"
    ],
    sourceOfTruth: ["docs/modules/attraction/playbook/playbook-ki.html"],
    notes:
      "Operational knowledge surface for KI work. It is not an analytics report."
  },
  {
    id: "comments-paperclip",
    label: "Комментарии и Paperclip",
    owner: "platform",
    kind: "operations",
    currentEntrypoints: [
      "apps/web/src/proto/proto-app.tsx",
      "/api/proto-comments",
      "ops/paperclip"
    ],
    sourceOfTruth: ["AGENTS.md", "ops/paperclip"],
    notes:
      "Dashboard feedback and implementation workflow. Not part of the attraction business ontology."
  },
  {
    id: "account-settings",
    label: "Аккаунт и настройки",
    owner: "platform",
    kind: "operations",
    currentEntrypoints: [
      "apps/web/src/proto/proto-app.tsx",
      "/api/auth/*",
      "/api/settings/*"
    ],
    sourceOfTruth: ["AGENTS.md"],
    notes:
      "Auth, users, module access, report settings, and operational configuration around attraction."
  },
  {
    id: "agent-mcp",
    label: "Agent MCP",
    owner: "platform",
    kind: "agent",
    currentEntrypoints: ["/api/mcp", "apps/api/src/tools/agent-mcp.ts"],
    sourceOfTruth: ["docs/architecture/agent-mcp.md"],
    notes:
      "Read-only agent gateway for report catalog, approved reports, ontology, and KI playbook."
  }
] as const satisfies readonly ProductSurfaceDescriptor[];

export const activeProductSurfaceIds = attractionProductSurfaces.map(
  (surface) => surface.id
);
