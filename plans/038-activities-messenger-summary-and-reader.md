# Plan 038: Activities messenger summary and reader

## Outcome

Add an attraction-owned messenger section to the Activities screen that uses
the selected date and manager filters to show total non-system messages,
unique Open Lines dialogs, deals with messages, and per-manager coverage. Let
an authorized module leader open a separate transient reader for full message
text without persisting conversation content.

## Scope And Non-Goals

In scope: a manually triggered live summary on the Activities screen, one
batch-safe backend summary request, a leader-only per-manager reader, web API
normalization, responsive drawer UI, tests, and privacy/report documentation.

Out of scope: storing raw text or message metadata, automatic page-load Bitrix
reads, attachments, contact/deal names, provider writes, leadgen, semantic
scoring, and a definitive sent/received split.

## Sources And Authority

- `design.md` owns shared visual and interaction rules.
- `docs/modules/attraction/MODULE_ONTOLOGY.md` owns privacy and role boundaries.
- `docs/modules/attraction/MESSAGE_METRICS_RESEARCH.md` owns Open Lines evidence.
- `docs/modules/attraction/REPORT_REGISTRY.md` owns report disclosure.
- Current manager whitelist and current attraction deal scope own eligibility.
- The selected Activities date and manager filters own the requested window.

## Decisions Already Made

- The UI says `messages`, not `sent messages`: connector direction is not
  reliable in the current Bitrix-only source.
- `unique dialogs` means distinct Open Lines session IDs with at least one
  non-system message in range. `Deals with messages` is shown separately and
  is not presented as unique people.
- Live Bitrix collection starts only after an explicit leader action, so normal
  report rendering remains SQLite-backed and fast.
- Full text is returned only by the explicit reader route, with `no-store`, a
  bounded range, one enabled manager, and a maximum response size.

## Critical Unknowns

- Exact outbound direction and unique real people require provider-level
  identity/direction data from WAZZUP, OLChat, or Umnico.
- Some messages may be attachment-only; V1 identifies them but does not fetch
  or render attachments.

## Boundaries And Contracts

- Maximum range remains 31 days.
- Summary accepts only enabled attraction manager IDs and returns aggregates.
- Reader accepts exactly one enabled manager and returns at most 500 newest
  messages from the selected range.
- Raw text is never written to SQLite, logs, MCP, comments, or report state
  outside the current browser/backend request lifecycle.
- The reader omits chat names, contact data, avatars, phones, email, and raw
  Bitrix payloads; it uses safe IDs, timestamps, channel labels, and text only.

## Work Packets

1. **Collection contracts and service**
   - Owns: messenger collection module and focused API tests.
   - Output: batch summary, unique dialog/deal counts, and bounded detail data.
   - Verification: range, manager scope, deduplication, detail truncation, and
     raw-text exclusion from summary.
2. **Protected HTTP boundary**
   - Owns: messenger routes, app wiring, HTTP tests.
   - Output: leader-only `/summary` and `/read` operations with `no-store`.
   - Stop if authorization cannot be enforced before Bitrix reads.
3. **Activities product surface**
   - Owns: web types, API client, Activities scene, reader drawer, UI tests.
   - Output: explicit load action, aggregate metrics, per-manager table, reader.
   - Verification: selected date/manager query, loading/error/empty states,
     keyboard-close behavior, desktop/mobile rendering.
4. **Contract writeback**
   - Owns: backlog, module ontology, research note, report registry, runtime map.
   - Output: durable reader/privacy and metric semantics.

## Validation

- Watch focused service/HTTP/web tests fail before implementation.
- Run API and web focused tests, typecheck, lint, and ontology validation.
- Run the full API and web suites when focused checks pass.
- Render the Activities scene at desktop and mobile widths; inspect console,
  focus, loading, error, empty, summary, and reader states.
- Inspect CRG change impact, final diff, and repository status.

## Recovery And Rollback

No migration or stored data is introduced. Revert the focused commit to remove
the panel and routes. Existing messenger collection behavior remains the
fallback during rollback.

## Done Criteria

- Activities can load exact-range messenger totals and unique dialog/deal
  coverage without blocking initial report rendering.
- Each manager row has an explicit reader action for full transient text.
- Employees cannot trigger summary or reader collection.
- Summary never contains raw text; reader is bounded and no-store.
- Focused/full tests, typecheck, lint, ontology validation, and rendered review
  pass.

## Completion Evidence

- `pnpm test`: Paperclip/session-preflight checks plus 11 prototype, 185 web,
  and 631 API tests passed.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, and
  `pnpm ontology:validate`: passed across the workspace.
- In-app browser review covered the Activities messenger section at desktop and
  mobile widths, its manual empty/zero-result flow, keyboard focus, and browser
  warning/error logs. The new section stayed within the mobile viewport and no
  warning or error was emitted.
- The full-text drawer states, grouping, truncation notice, Escape handling,
  and HTML-like text escaping are covered by web component tests because the
  local runtime snapshot had no messenger rows to open live.
- CRG change detection mapped the service, HTTP boundary, API client, Activities
  scene, and their dependent flows; source review and tests covered the new
  files that were not present in the pre-change graph build.
