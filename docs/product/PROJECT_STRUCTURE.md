# Project Structure

This document is the repository map for future agents and maintainers. Read it
after `AGENTS.md` and before changing architecture, navigation, reporting,
call analysis, Telegram flows, MCP, Paperclip, or sync behavior.

## Active Product

The active product is `attraction` / `Привлечение`.

`leadgen` is legacy code in this repository. It is not part of the target
architecture, should not drive new seams, and should not be used as a reason to
keep generic multi-module abstractions. Physical removal of leadgen code, docs,
routes, tests, and production configuration is a separate migration.

## Reading Order

Use this order when reconstructing how the project is built:

1. `AGENTS.md` - working rules, git flow, verification, deploy discipline.
2. `docs/product/PROJECT_STRUCTURE.md` - product surfaces and runtime modules.
3. `docs/adr/0003-attraction-product-surfaces.md` - accepted architecture
   decision for the attraction-only target shape.
4. `docs/modules/attraction/MODULE_ONTOLOGY.md` - business module contract.
5. `docs/modules/attraction/REPORT_REGISTRY.md` - attraction report bindings.
6. `docs/adr/0002-manager-approved-call-enrichment-writeback.md` - destructive
   writeback exception and Telegram approval flow.
7. `docs/adr/0005-durable-telegram-manager-registration.md` - persistent
   Telegram intake and manual one-time Bitrix matching used by deal routing.
8. `docs/architecture/web-runtime.md` - one supported web shell and browser data
   access rule.
9. `docs/architecture/module-capabilities.md` - manifest and agent-readable
   report policy.
10. `docs/architecture/agent-mcp.md` - read-only agent gateway.
11. `docs/deploy-timeweb-vps.md` - production env and rollout controls.
12. `apps/web/src/proto/product-surfaces.ts` - UI surface registry skeleton.
13. `apps/api/src/runtime/runtime-modules.ts` - backend runtime registry skeleton.

## Product Surfaces

A product surface is something a user, operator, manager, or agent can name and
navigate to. Surfaces are not necessarily folders yet; this table is the target
map that future refactors should preserve.

| Surface | Owner | Current entry points | Source of truth | Notes |
| --- | --- | --- | --- | --- |
| Analytics | attraction | `ProtoApp`, `scene-registry.ts`, `scenes.tsx`, `/api/reports/*` | SQLite snapshot, report builders, `REPORT_REGISTRY.md` | Operational, sales, plan, activities, cohorts, sources, revenue velocity, unit economics, funnel flow. |
| Call analysis | attraction | `CallAnalysisWorkspace`, `/api/calls/*` | Bitrix call activities, local analysis storage, call analysis service | Covers manual queue analysis and automatic webhook intake. |
| Ontology | attraction | `OntologyHubScene`, ontology API routes, MCP resources | `docs/modules/attraction/MODULE_ONTOLOGY.md`, ontology registry JSON | Business vocabulary and report bindings. |
| KI playbook | attraction | `PlaybookScene`, `PlaybookReader`, MCP resources | `docs/modules/attraction/playbook/playbook-ki.html` | Operational knowledge surface, not a report. |
| Comments and Paperclip | platform | dashboard comment mode, `/api/proto-comments`, Paperclip routes | comments SQLite tables, `ops/paperclip/*` | Product feedback and implementation loop. Not part of business ontology. |
| Account and settings | platform | account/admin panels, settings routes | auth store, module users, report settings tables | Platform surface around attraction operations. |
| Agent MCP | platform | `/api/mcp`, stdio MCP tool | `docs/architecture/agent-mcp.md`, capability manifest | Read-only. Must not expose Bitrix clients, SQLite handles, Telegram, Paperclip, sync, or writeback. |

## Runtime Modules

A runtime module is a backend behavior group with its own failure modes,
external systems, data reads, and writes.

| Runtime module | Owner | Current entry points | External systems | Writes |
| --- | --- | --- | --- | --- |
| Sync and snapshot | attraction | sync routes, auto-sync startup, `performManualSync` | Bitrix24 | local SQLite snapshot |
| Analytics reports | attraction | `/api/dashboard`, `/api/reports/*`, report domain builders | none at render time | none |
| Call analysis | attraction | `/api/calls/*`, call analysis service | Bitrix24 recordings, OpenRouter | local call analysis tables |
| Call enrichment | attraction | webhook intake, enrichment orchestrator, approval service, expiry job | Bitrix24, Telegram, OpenRouter | local proposals; approved Bitrix field updates |
| Telegram manager registration | attraction | Telegram webhook, private `/start`, manual match, protected registration export | Telegram, n8n | local Telegram identities and Telegram-to-Bitrix mappings |
| Telegram activity summary | attraction | `startTelegramActivityReport` background job | Telegram | none |
| Knowledge and MCP | platform | `/api/mcp`, stdio MCP, ontology/playbook readers | MCP clients | none |
| Comments and Paperclip | platform | comment routes, Paperclip client | Paperclip API, GitHub when configured | local comments / Paperclip state |
| Auth and access | platform | auth routes, session store, module users | none | local auth/session state |
| Integrations | platform | Bitrix, Telegram, OpenRouter adapters | external APIs | only through owning runtime module |

## Data Flow

```text
Bitrix24 -> sync/import -> SQLite snapshot -> analytics reports -> web dashboard
Bitrix24 -> call webhook -> call analysis -> local analysis -> call enrichment
call enrichment -> Telegram approval -> approved narrow Bitrix writeback
Telegram /start -> SQLite identity -> manual Bitrix match -> n8n notification recipient
SQLite snapshot -> activity/call workload reports -> Telegram activity summary
docs/modules/attraction -> ontology/playbook readers -> web knowledge surfaces
docs/modules/attraction + reports -> MCP read-only agent gateway
dashboard comments -> local comments -> Paperclip workflow
```

## Development Rules

- New UI surfaces must be added to `apps/web/src/proto/product-surfaces.ts`
  before they become part of navigation.
- New backend jobs, webhooks, route groups, or external integrations must be
  added to `apps/api/src/runtime/runtime-modules.ts`.
- New attraction reports must stay attraction-owned and eventually move into a
  unified report catalog. Until that catalog exists, update
  `docs/modules/attraction/REPORT_REGISTRY.md`, module capabilities, API routes,
  API client, and the relevant scene metadata together.
- New destructive write paths require an ADR, field allowlist, audit behavior,
  and approval flow. ADR 0002 is the current example.
- MCP remains read-only. Do not add sync, writeback, Paperclip, Telegram,
  arbitrary SQLite, raw Bitrix, or secret access to the agent gateway.
- Leadgen-related code should be treated as legacy during new work. Do not add
  features to it unless the task is the explicit leadgen removal migration.

## Refactor Sequence

1. Keep this map and ADR 0003 current.
2. Wire product surface and runtime registries only when tests cover the
   registry contracts.
3. Split large files after the registry exists:
   - `apps/web/src/proto/proto-app.tsx`
   - `apps/web/src/proto/scenes.tsx`
   - `apps/web/src/lib/api-client.ts`
   - `apps/api/src/index.ts`
   - `apps/api/src/server/app.ts`
   - `apps/api/src/server/service.ts`
4. Remove leadgen in a dedicated migration after production usage and config are
   checked.

## Leadgen Removal Checklist

The leadgen migration must be explicit because legacy code still exists in the
API, web shell, tests, deploy docs, GitHub templates, and production operations.

Before deletion, verify and update:

- production usage: confirm no active users depend on leadgen routes, sync,
  comments, Paperclip routing, or database files;
- web: remove leadgen module switching, leadgen dashboard state, leadgen API
  client methods, and tests that assert leadgen behavior;
- API: remove leadgen service, routes, sync, repository setup, capability
  descriptors, environment parsing, and tests;
- operations: remove or retire leadgen options from GitHub templates,
  production sync workflows, deploy docs, and Paperclip project routing;
- data: decide whether to archive or delete `bitrix24-leadgen.db` on production;
- docs: archive `docs/modules/leadgen/MODULE_ONTOLOGY.md` and superseded
  leadgen plans after the code path is gone.
