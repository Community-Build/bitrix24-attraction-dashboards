# ADR 0003: Attraction product surfaces and runtime modules

## Status

Accepted

Supersedes ADR 0001 for target architecture. ADR 0001 remains historical
context for why leadgen was separated before this decision.

## Context

The repository no longer contains only a dashboard. The active attraction
product now includes analytics, ontology, KI playbook, call analysis, automatic
Bitrix call webhook intake, manager-approved Telegram enrichment, Telegram
activity summaries, dashboard comments, Paperclip workflow, settings, sync, and
read-only MCP access.

ADR 0001 treated `attraction` and `leadgen` as separate products sharing a
narrow platform. The current product direction is different: `leadgen` should be
ignored for new architecture and removed later in a dedicated migration. Keeping
new abstractions generic for both modules would preserve complexity for a
retired contour.

Large files such as `ProtoApp`, `scenes.tsx`, `api-client.ts`, `index.ts`,
`app.ts`, and `service.ts` mix product navigation, report surfaces, platform
operations, background jobs, integrations, and legacy module behavior. Moving
code into folders before naming the product surfaces would keep that coupling in
new locations.

## Options

1. Keep the ADR 0001 shape and continue treating attraction and leadgen as peer
   products.
2. Physically remove leadgen first, then define the attraction structure.
3. Accept an attraction-only target map now, mark leadgen as legacy, and remove
   leadgen in a later migration.

## Decision

Use option 3.

The active product is `attraction`. `leadgen` is legacy code until a dedicated
removal migration deletes its routes, docs, UI, tests, environment variables,
and production configuration.

Future architecture work must use product surfaces and runtime modules as the
primary map:

- product surfaces: analytics, call analysis, ontology, KI playbook,
  comments/Paperclip, account/settings, agent MCP;
- runtime modules: sync and snapshot, analytics reports, call analysis, call
  enrichment, Telegram activity summary, knowledge/MCP, comments/Paperclip,
  auth/access, integration adapters.

Shared/platform is now scoped around the attraction product. It should provide
auth, settings, safe local snapshot primitives, comments, Paperclip plumbing,
MCP protocol adapters, and external API adapters. It should not grow new
multi-module abstractions to preserve leadgen behavior.

The repository must keep a durable product map in
`docs/product/PROJECT_STRUCTURE.md`. Metadata-only registries may be introduced
before runtime wiring:

- `apps/web/src/proto/product-surfaces.ts` for UI product surfaces;
- `apps/api/src/runtime/runtime-modules.ts` for backend runtime modules.

## Consequences

- New work should not use leadgen as a design constraint.
- Existing leadgen code can remain until removal, but it is not part of the
  target architecture.
- Future agents must read `PROJECT_STRUCTURE.md` before making architecture
  claims or adding product surfaces.
- Refactors should deepen attraction-owned modules before adding generic
  platform seams.
- Destructive call enrichment writeback remains governed by ADR 0002.
- MCP remains read-only and must not inherit Telegram, Paperclip, sync, direct
  Bitrix, arbitrary SQLite, or writeback capabilities.

## Revisit Conditions

Revisit this decision only when one of these conditions becomes true:

- leadgen is reactivated as a product with active users and a roadmap;
- another business module is approved and funded as a first-class product;
- a fork maintainer needs the module capability model for real production use;
- production verification shows that removing leadgen would break current
  users, scheduled jobs, or required data.
