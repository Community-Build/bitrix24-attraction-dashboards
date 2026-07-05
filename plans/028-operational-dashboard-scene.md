# Plan 028: Render the «Операционный» dashboard scene

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cac60e5..HEAD -- apps/web/src packages/contracts/src/index.ts`
> Branch `codex/source-cohort-report-tab` (scene «Конверсия источников») may
> have merged — its additions to `scenes.tsx`, `scene-registry.ts`,
> `proto-app.tsx`, `api-client.ts`, `dashboard-types.ts`, `App.test.tsx` are
> EXPECTED drift and, if present, `SourceCohortsScene` is the best structural
> exemplar for this plan. Any other mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: LOW (new scene; no changes to existing scenes' logic)
- **Depends on**: plans/027-operational-dashboard-report-api.md
- **Category**: direction
- **Planned at**: commit `cac60e5`, 2026-07-05

## Why this matters

This is the screen the product owner opens every morning: one view of the
period's flow (created / meetings by slot / sales by club / lost), what is
planned today and tomorrow, first-touch SLA health, and — the core — a live
risk feed of stuck and neglected deals with links into Bitrix. The layout was
designed and approved interactively; the binding visual reference is
**`plans/assets/operational-dashboard-prototype.html`** (open it in a browser
before writing any JSX). Historical `v2` mockups that show meeting rows by
meeting `typeValue` are superseded for this report: render meetings strictly
as «Встреча 1/2/3». Match the reference structure, not its pixel styling — all
styling must come from the existing design system.

## Current state

- **Approved layout** (from the prototype, top to bottom):
  1. KPI row, 6 `.metric` tiles: «Создано», «Встречи» (total, detail below),
     «Продажи» (total, detail below), «Проиграно», «В работе», «Рисков» —
     the risk tile is the only accented one (red top border / `badge-red`
     styling), subtitle «N критично · M риск».
  2. Two-column grid `xl:grid-cols-[1.2fr_1fr]`:
     - Left, stacked panels: «Встречи за период» (rows «Встреча 1/2/3» with
       counts; never group by `typeValue`) beside «Продажи за период» (rows
       per клуб продажи with count + cycle); «SLA первого касания» (вовремя /
       с опозданием / без касания +
       медиана, threshold from settings shown in the header) beside
       «Запланировано» (сегодня: встречи по слотам + дела; завтра: то же);
       «В работе по этапам» compact list (этап · открытых · «N в риске» badge).
     - Right, one tall panel: «Лента рисков» — filter chips («Все · N»,
       «Критично · N», one per rule: «Застрял на этапе», «Без дел»,
       «Без звонков», «Без активностей»), then risk cards: deal link
       «Сделка #ID ↗» (href = `dealUrl`, `target="_blank" rel="noreferrer"`),
       right-aligned «X дн на этапе · порог Y», a row of flag badges, line
       «Этап · Менеджер», meta line «Источник · Клуб». Card left border red
       for critical, amber for risk. Client-side pagination: first 50, button
       «Показать ещё».
  3. Full-width panel «Менеджеры за период»: table Менеджер / Создано /
     Встречи (В1/В2/В3) / Продажи / SLA поздно·без касания / В работе / Рисков
     (risk cell tinted). Clicking a manager row filters the risk feed; clicking
     a stage row in «В работе по этапам» does the same (simple client-side
     filter state, a chip in the feed header shows the active filter with a
     clear ×).
- **Scene registration pattern**:
  - `apps/web/src/proto/scene-registry.ts` — `sceneMetadata` array (entries
    like `{ id: 'sales', label: 'Отчет по продажам', description, focus, kpis }`,
    see the `cohorts` entry at ~line 143). The new scene goes FIRST in the
    array: id `operations`, label «Операционный», description
    «Сводка дня: поток, встречи, продажи, SLA и риски по зависшим сделкам.»,
    focus «Поток / риски / SLA», `kpis: []`.
  - `apps/web/src/proto/proto-app.tsx` — lazy scene map (`'source-cohorts': LazySourceCohortsScene`-style
    entries around line 129); add `'operations'` the same way.
  - `apps/web/src/proto/scenes.tsx` — scene components live here and are
    exported through the registry map at the bottom of the file
    (`'source-cohorts': SourceCohortsScene`-style). Add `OperationsScene`.
- **Data access pattern**: scenes fetch via `apiClient` in a `useEffect` keyed
  by a serialized query built with
  `buildDashboardQueryFromProtoFilters(filters)` from
  `apps/web/src/proto/live-reporting.ts`; see any live report scene. Add
  `getOperationalDashboardReport(query)` to `apps/web/src/lib/api-client.ts`
  (copy an existing report method) and mirror the contract types in
  `apps/web/src/lib/dashboard-types.ts` (this file re-declares
  `packages/contracts` shapes — follow how other report types are declared).
- **Design constraints** (`design.md` — binding): quiet white/slate, reuse
  `.panel`, `.metric`, `.badge-chip`/`.badge-green`/`.badge-amber`/`.badge-red`,
  `.subtle-label`, `.tab-chip`, existing table styles; `grid gap-6` rhythm;
  max width shell already provided; NO new color palette — risk colors are the
  existing rose/amber status tokens; no nested cards for layout.
- **Commentable blocks** (`design.md`): every major section needs stable
  `data-comment-block-id` + `data-comment-block-label`. Use:
  `attraction-operations-summary`, `attraction-operations-flow`,
  `attraction-operations-sla-planned`, `attraction-operations-stage-wip`,
  `attraction-operations-risks`, `attraction-operations-managers`.
- **Report payload**: `OperationalDashboardReport` from plan 027 — fields:
  `createdDeals`, `meetingsHeld{total,bySlot}`, `sales{total,byClub}`,
  `lostDeals`, `openDeals`, `riskSummary{total,critical,risk,byRule,byStage}`,
  `stageWip[]`, `sla[]`, `planned{meetingsToday,meetingsTomorrow,tasksToday,tasksTomorrow}`,
  `managers[]`, `risks[]` (sorted, ≤500), `thresholdsUpdatedAt`.
- **Test pattern**: `apps/web/src/App.test.tsx` mocks `apiClient` methods with
  `vi.fn(async () => ({...}))` at the top-level mock block, then clicks the tab
  button by role/name and asserts rendered text (see the source-cohort test
  `renders the source cohort conversion tab...` if present, otherwise the
  revenue-velocity test in the same file).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Preflight | `pnpm session:preflight` | exit 0 |
| Web tests | `pnpm --filter @bitrix24-reporting/web exec vitest run` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Dev server | `pnpm --filter @bitrix24-reporting/web dev` (API per repo README/ops) | serves on :5173 |

## Scope

**In scope**:
- `apps/web/src/proto/scenes.tsx` (new `OperationsScene` + registry entry)
- `apps/web/src/proto/scene-registry.ts` (metadata entry, FIRST position)
- `apps/web/src/proto/proto-app.tsx` (lazy scene wiring)
- `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/dashboard-types.ts`
- `apps/web/src/App.test.tsx` (scene test)
- `plans/README.md` (status row)

**Out of scope**:
- API/domain changes (plan 027) and settings UI (plan 026).
- Any modification of existing scenes, filters panel, shell, or `proto.css`
  beyond ADDING a shared primitive only if genuinely required (prefer existing
  classes; if you must add CSS, document it in `design.md` per its rules — but
  the prototype is achievable with existing primitives + Tailwind utilities).
- Notifications, drill-down deal cards, risk history charts.

## Git workflow

- Start from updated `main` (027 merged); branch `codex/operational-dashboard-scene`.
- Focused commits; draft PR per `AGENTS.md`.

## Steps

### Step 1: API client + types

Add `OperationalDashboardReport` (and nested types) to
`apps/web/src/lib/dashboard-types.ts`; add
`getOperationalDashboardReport(query)` to `apps/web/src/lib/api-client.ts`
calling `/api/reports/operational-dashboard` (copy the fetch/query-string
handling of an existing report method verbatim).

**Verify**: `pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts` → pass (add a route-mapping case if that suite enumerates methods).

### Step 2: Scene skeleton + registration

Create `OperationsScene({ filters }: SceneComponentProps)` in `scenes.tsx`:
query via `buildDashboardQueryFromProtoFilters`, `useEffect` fetch keyed by
`JSON.stringify(query)` with cancel flag, states for report/error; loading =
spinner row (`role="status"`), error = `role="alert"` rose box — copy the
exact state pattern from the newest live scene in the file. Register in
`scene-registry.ts` (first element) and `proto-app.tsx` lazy map.

**Verify**: `pnpm --filter @bitrix24-reporting/web exec vitest run` → existing tests still pass (tab order assertions may need updating — see Step 5).

### Step 3: Render summary + left column

Implement layout blocks 1-2 from "Current state" with existing primitives.
Notes: slot labels come from the payload (`slotLabel`), do not derive labels
from meeting `typeValue`; meetings/sales panels show an em-dash row when empty; SLA panel
header shows «порог N ч» from the payload's `thresholdBusinessHours` of sla2;
«В работе по этапам» rows render «N в риске» as `badge-chip badge-red`
(critical>0) / `badge-amber` — omit the badge when 0.

**Verify**: `pnpm --filter @bitrix24-reporting/web exec vitest run` → pass.

### Step 4: Risk feed + managers table + cross-filtering

- Feed state: `ruleFilter: 'all' | 'critical' | OperationalRiskRuleKey`,
  `stageFilter: string | null`, `managerFilter: string | null`,
  `visibleCount` (start 50, «Показать ещё» +50). Chips show counts from
  `riskSummary`; active chip styled like the slice-toggle buttons used
  elsewhere in `scenes.tsx` (`rounded-full bg-slate-900 ... text-white`).
- Risk card per «Current state»; flag badges: critical flags `badge-chip badge-red`,
  others `badge-amber`; card left border via Tailwind `border-l-2` + rose/amber.
- Managers table full-width below; row click sets `managerFilter` (row gets an
  active style + the feed header shows a clearable chip «Менеджер: Имя ×»).
  Stage row click in «В работе по этапам» sets `stageFilter` the same way.
- All three filters compose (AND).

**Verify**: `pnpm --filter @bitrix24-reporting/web exec vitest run` → pass.

### Step 5: Tests

In `apps/web/src/App.test.tsx`:
- Add `getOperationalDashboardReport` to the apiClient mock with a fixture
  containing: 2 managers, meetings bySlot (28/17/9), 2 clubs in sales, sla2
  threshold 5, 3 risks (one critical stage_aging with `dealUrl`, one
  no_open_activity, one no_recent_calls), stageWip with risk counts.
- Test «renders the operational dashboard tab»: click tab «Операционный»
  (first tab), assert: KPI values render; «Встреча 1» and its count; a club
  label from sales; risk chip «Критично · 1»; a deal link with
  `href` containing `/crm/deal/details/`; clicking chip «Без дел» hides the
  stage_aging card (query by deal id text).
- Update any existing test that asserts the first tab / tab order if it breaks.

**Verify**: `pnpm --filter @bitrix24-reporting/web exec vitest run` → all pass.

### Step 6: Browser verification (mandatory)

Run API + web dev servers (see repo README / `ops/` for local run; local admin
credentials are in your local environment/ops notes — do not commit them).
Check against the prototype `plans/assets/operational-dashboard-prototype.html`:

1. Tab «Операционный» is first and opens by default layout at 1280×720.
2. No page horizontal overflow at 1280×720 and 1024×768
   (`document.documentElement.scrollWidth === clientWidth`).
3. Risk chips filter the feed; manager row click filters + clears.
4. Deal link opens the Bitrix URL in a new tab (href check is enough locally).
5. Empty period (pick a range with no data) shows quiet empty states, not
   crashes.

Capture one screenshot at 1280 width for the PR description.

## Done criteria

- [x] `pnpm typecheck`, `pnpm lint` exit 0
- [x] `pnpm --filter @bitrix24-reporting/web exec vitest run` exits 0 incl. the new scene test
- [x] Tab «Операционный» is the FIRST analytics tab
- [x] All six `data-comment-block-id` attributes from "Current state" exist in the rendered scene
- [x] No horizontal page overflow at 1280×720 and 1024×768 (browser-verified)
- [x] Risk cards show deal IDs + Bitrix links, never deal titles/names/phones
- [x] No unintended files outside the active 026-028 implementation sequence modified (`git status`)
- [x] `plans/README.md` status row updated

## STOP conditions

- `/api/reports/operational-dashboard` is absent or returns a different shape
  than the contract in this plan — plan 027 not landed or drifted; stop.
- Registering the scene first breaks a default-scene assumption hardwired
  somewhere other than the registry order (e.g. a hardcoded `'sales'` initial
  scene id) — report the location instead of patching around it.
- The prototype requires a primitive that genuinely does not exist and cannot
  be composed from existing classes + utilities — stop and propose the
  `design.md` addition instead of inventing one-off styles.

## Maintenance notes

- The risk feed intentionally paginates client-side over a ≤500-item payload;
  if the risk count grows past that, move pagination server-side (plan 027's
  cap) before tuning the UI.
- Reviewer should scrutinize: filter composition (rule × stage × manager),
  that the scene stays on cached local API data (no direct Bitrix calls), and
  comment-block ids stability.
- Deferred: per-risk actions (snooze/assign), risk history trends, Telegram
  digest of critical risks (rules were kept exported in the domain for this).
