# 046 — Build the read-only deal analysis intervention queue

Status: DONE on `codex/deal-analysis-v1` (local implementation; no push or
deployment requested).

Completion evidence:

- Real local summary returned 655 open current deals from the reconciled scope:
  402 critical, 233 risk, 18 watch and 2 healthy in the inspected snapshot.
- Real lazy detail opened deal `133430`, returned five explained risks, 23 safe
  timeline items, stage history and a Bitrix URL without deal/contact identity.
- Browser verification at 1440x900 and 390x844 covered open and won views, row
  click, risk drawer, CRM link, responsive table containment and no
  document-level horizontal overflow.
- Full API suite: 65 files / 643 tests passed before the final focused additions;
  focused route, messenger deal-scope and scoring tests passed afterward.
- Full web suite: 15 files / 193 tests passed; focused scene test passed after
  the final loading-state adjustment.
- Workspace typecheck, lint, production build, ontology validation,
  `git diff --check` and session preflight passed.
- The local current-scope projection was stale (`2026-08-04`); the UI now shows
  this state explicitly and keeps the last atomically reconciled population.

## Outcome

Add a local `Анализ сделок` scene for the attraction leader that answers which
current deals need intervention now, why, and what deterministic next action to
check. The scene must use real SQLite-backed data, explain every health penalty,
and open a lazy right-side deal drawer without writing to Bitrix.

## Scope and non-goals

- In scope: a summary API, a lazy per-deal detail API, deterministic health and
  risk calculations, manager/team and activity-period filtering, open/won/lost
  scopes, a dense deal table, a right drawer, safe lifecycle/activity evidence,
  report registration, tests and local browser verification.
- Non-goal: deal-field completeness; it was explicitly deferred.
- Non-goal: MEDDICC, contacts, deal titles, names, phones, emails, raw upstream
  payloads, predictive win probability or LLM-generated advice.
- Non-goal: task/stage writes, any other Bitrix mutation, production deploy,
  push, PR or merge.

## Sources and authority

- `docs/modules/attraction/MODULE_ONTOLOGY.md` owns deal, stage, meeting, event
  and next-step semantics.
- `docs/modules/attraction/REPORT_REGISTRY.md` owns report bindings and privacy.
- `docs/adr/0006-persist-messenger-messages-for-analysis.md` owns leader-only
  messenger text access.
- `design.md` and `apps/web/src/proto/proto.css` own the visual system.
- Existing domain owners are `operational-dashboard.ts` for thresholds/risks,
  `deal-lifecycle-card.ts` for per-deal lifecycle, and canonical stage and
  touchpoint facts for event chronology.
- Current source, deterministic tests and rendered local behavior outrank this
  plan if drift is discovered.

## Decisions and contracts

- Primary user: attraction leader. Primary job: daily intervention triage.
- Default population: current open deals from the reconciled
  `attraction_current_deal_ids` scope. Won/lost are separate scopes and have no
  health band.
- `Период активности` limits activity evidence and the compact timeline; it
  never removes an old but currently open deal.
- Summary rows expose only deal ID/URL, current manager, stage, source, allowed
  business attributes, amount, score/band, risks, next action and compact event
  markers. They never include message bodies or call-analysis narrative.
- Open-deal score starts at 100 and is clamped to 0..100:
  - no open next action: -30;
  - overdue next action: -25 instead of the missing-action penalty;
  - stage past configured threshold: -15, or -25 at two thresholds;
  - no recent activity past configured threshold: -15;
  - no recent call past configured threshold: -10;
  - no stage movement seven days after a completed meeting/attended event: -20.
- Bands: `healthy` 80..100, `watch` 60..79, `risk` 30..59,
  `critical` 0..29. Unavailable evidence is reported as unavailable and does
  not become a penalty.
- Default sort: score ascending, then next-action overdue age descending,
  stage-overdue age descending, amount descending.
- The detail route is lazy. Message text and call-analysis narrative are
  included only for a leader (or local auth-disabled runtime); employee detail
  remains usable with those fields omitted.
- New report code reads local repository inputs only. No browser or report
  request may read Bitrix directly.
- The report capability exposes the privacy-safe summary route only. Sensitive
  per-deal detail is not agent-readable.

## Critical unknowns

- The exact percentage of open deals with a dated open activity must not change
  the agreed meaning of `missing` versus `overdue`; tests own the boundary.
- Messenger attribution is manager-scoped in current storage. Per-deal detail
  must additionally filter by exact deal ID before returning any body text.
- Some call analysis output can contain narrative personal context. It must be
  returned only through the same leader-sensitive detail boundary and must not
  include transcript or evidence quotes.

## Boundaries

- API ownership: attraction report routes and `ReportingService`.
- Domain ownership: a new `apps/api/src/domain/deal-analysis.ts`; the browser
  must not recalculate health or risk penalties.
- Contracts: `packages/contracts/src/index.ts`, mirrored by the existing web
  type boundary and normalized by `apps/web/src/lib/api-client.ts`.
- UI ownership: a new focused deal-analysis scene component, registered in the
  existing analytics scene registry and lazy scene map.
- Privacy: message bodies remain stored/rendered as plain text and leader-only;
  no content enters aggregate state, logs, comments, notifications or MCP.

## Work packets

1. **Domain and contract**
   - Owned artifacts: `packages/contracts/src/index.ts`,
     `apps/api/src/domain/deal-analysis.ts`, focused domain tests.
   - Inputs: current deal IDs, deals, stages/history, activities, calls,
     canonical touchpoints, thresholds and manager directory.
   - Output: summary rows, health bands, flags, deterministic recommendations,
     compact activity markers and detail assembly helpers.
   - Verification: edge-case tests for every penalty, no double missing/overdue
     penalty, score bands, terminal scopes, sorting and missing data.
   - Stop: if an agreed signal cannot be derived without direct Bitrix reads or
     personal entities, omit it and report the gap rather than widening access.

2. **Read-only API and report registration**
   - Owned artifacts: reporting repository role, service, attraction handlers
     and routes, module capability descriptor, report registry, HTTP/service
     tests.
   - Output: `GET /api/reports/deal-analysis` and
     `GET /api/reports/deal-analysis/:dealId`.
   - Summary route uses normal attraction scoping. Detail determines whether
     leader-sensitive narrative may be included and always scopes by exact deal.
   - Verification: range/manager scoping, current-scope enforcement, 404 for an
     inaccessible deal, no sensitive fields in summary, employee detail omits
     bodies/narrative, leader detail may include cleaned text.
   - Stop: if access role cannot be proven at the route boundary, omit sensitive
     content from all responses.

3. **API client and scene**
   - Owned artifacts: web types/client/tests, scene registry, lazy scene map,
     product surface descriptor if needed, new scene component and focused UI
     tests.
   - Output: top state switch, health cards, agreed filters, sortable/paged
     table, clickable row, drawer tabs `Риски`, `Активность`, `Путь сделки`,
     `Детали`, and separate CRM action.
   - Dependencies: packets 1-2 complete and API fixtures stable.
   - Verification: loading/error/empty states, keyboard-accessible row action,
     drawer close/focus behavior, filters/sorting, safe plain-text rendering,
     responsive table/drawer.
   - Stop: do not introduce a new visual theme or generic shared abstraction;
     reuse current analytics primitives.

4. **Integrated validation and handoff**
   - Run focused API/web tests, contract/API/web typecheck, lint, ontology
     validation and `git diff --check`.
   - Start local API/web through the repository launcher, inspect at desktop and
     narrow viewports, verify no horizontal page overflow, open a real local
     deal drawer, test filters/sorting/tabs/CRM href, and inspect console errors.
   - Run final CRG change review and inspect status/diff before committing.

## Validation

- Deterministic tests prove the exact agreed score and recommendation mapping.
- Summary response contains no message text, call narrative, deal title,
  contact/company personal data or raw payload.
- Detail response scopes one current attraction deal and separates safe metadata
  from leader-sensitive narrative.
- The UI renders actual local data and performs no direct Bitrix call.
- `Период активности` changes the visible marker window while leaving current
  open population intact.
- At 1280x720 and a narrow mobile viewport, the page and drawer remain usable,
  focusable and free of document-level horizontal overflow.

## Recovery and rollback

- Code rollback is a normal revert of the focused commit.
- No data migration or external mutation is planned, so rollback has no data
  restore step.
- If the detail endpoint proves too expensive, keep the summary route and
  disable lazy detail registration; do not move detail computation to the
  browser or add direct Bitrix reads.

## Done criteria

- Summary/domain/API/UI behavior matches all accepted decisions above.
- Focused and workspace checks pass or any unrelated baseline failure is named
  with evidence.
- Local browser verification covers representative open, healthy/risky,
  empty-filter and drawer states with no console error.
- `REPORT_REGISTRY.md`, module capability descriptor, backlog and plan status
  agree with the implemented contract.
- The final diff contains no unrelated user work, secrets, SQLite files,
  screenshots or runtime state.
- A focused local commit exists on `codex/deal-analysis-v1`; no push/deploy is
  performed without separate authorization.

## Stop conditions

- Session preflight stops passing or unrelated work appears in the worktree.
- Current-scope status is uninitialized or mismatched and the implementation
  would need to guess current deal membership.
- Sensitive message/call narrative cannot be kept behind proven leader access.
- Existing canonical facts contradict the agreed risk meaning and a product
  decision is required.
