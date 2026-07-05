# Plan 026: Add editable operational threshold settings (stage aging, hygiene, SLA hours)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cac60e5..HEAD -- packages/contracts/src/index.ts apps/api/src/server apps/api/src/domain/operational-reports.ts apps/web/src/proto/module-settings-panel.tsx apps/web/src/lib`
> Branch `codex/source-cohort-report-tab` (report «Конверсия источников») may
> merge before you start — additions from it in `attraction-routes.ts`,
> `attraction-report-handlers.ts`, `service.ts`, `app.ts`, `api-client.ts` are
> EXPECTED drift; re-anchor by pattern, not by line number. Any other mismatch
> with the "Current state" excerpts is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (changes SLA numbers shown in the existing «Отчет активности»)
- **Depends on**: none
- **Category**: direction (feature foundation for plans 027/028)
- **Planned at**: commit `cac60e5`, 2026-07-05

## Why this matters

The approved operational dashboard (see `plans/assets/operational-dashboard-prototype.html`)
highlights deals stuck on a stage longer than a per-stage threshold, deals
without planned activities/calls/any activity, and first-touch SLA health.
Today the only comparable knobs are hardcoded: SLA business-hour limits live in
a constant, and there are no stage-aging or hygiene thresholds at all. The
product owner explicitly wants to tune these without a deploy (e.g. set
«Первый контакт» SLA to 5 business hours instead of 24). This plan creates one
editable settings block that plan 027 (report) and plan 028 (UI) consume, and
rewires the existing activities report SLA to the same source of truth.

## Current state

- `apps/api/src/domain/operational-reports.ts:431-441` — hardcoded SLA config:

  ```ts
  const SLA_LABELS = {
    sla1: "Время в работу",
    sla2: "Первый контакт",
    sla3: "Обработка лида"
  } as const;

  const SLA_THRESHOLDS_BUSINESS_HOURS = {
    sla1: 24,
    sla2: 24,
    sla3: 72
  } as const;
  ```

  `buildActivitiesWorkloadReport` (same file, exported around line 2175) uses
  `SLA_THRESHOLDS_BUSINESS_HOURS` internally (see usages around lines
  1187-1230, `maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla1` etc.).
- Settings exemplar to copy — deal pricing settings:
  - storage: `apps/api/src/server/sqlite-repository.ts` — `CREATE TABLE IF NOT EXISTS pricing_rules` (line ~1383), seed-if-empty (line ~1651), replace-all write (line ~2826), reset in test helper (line ~2976), read query (line ~5082);
  - service: `apps/api/src/server/service.ts` — `async getPricingSettings()` (line ~1888) and `async replacePricingSettings(settingsInput)` (line ~1904);
  - HTTP: `apps/api/src/server/app.ts` — `pricingSettingsBodySchema` (zod, line ~680) and handlers `getPricingSettings` / `replacePricingSettings` (line ~3180-3208; PUT is guarded by `denyIfMissingAttractionAccess(response, { leaderOnly: true })`);
  - routes: `apps/api/src/server/routes/attraction-routes.ts:173-174`:

    ```ts
    app.get("/api/settings/pricing", handlers.getPricingSettings);
    app.put("/api/settings/pricing", handlers.replacePricingSettings);
    ```
  - contracts: `DealPricingSettings` / `DealPricingRuleInput` in `packages/contracts/src/index.ts`;
  - web: settings editor blocks live in `apps/web/src/proto/module-settings-panel.tsx` (props like `pricingSettings`, `onPricingSettingsSave` around lines 21-51 and 382+), wired from `apps/web/src/proto/proto-app.tsx`; API calls in `apps/web/src/lib/api-client.ts`; types re-exported in `apps/web/src/lib/dashboard-types.ts`.
- Attraction funnel stages (canonical, from
  `docs/modules/attraction/MODULE_ONTOLOGY.md`, table around line 250) —
  active stages that need aging thresholds:

  | Stage ID | Canonical name | Default threshold (days) |
  |---|---|---|
  | `C10:NEW` | База входящая | 1 |
  | `C10:PREPARATION` | Звонок-знакомство | 3 |
  | `C10:UC_9E0XYG` | Встреча-знакомство | 14 |
  | `C10:UC_61CBCU` | Активация | 14 |
  | `C10:UC_A249EJ` | Демонстрация | 14 |
  | `C10:UC_CPR91Y` | Проблематизация | 14 |
  | `C10:UC_5KZT6Y` | Адмиссия | 7 |
  | `C10:UC_M1M5WM` | Контракт | 7 |
  | `C10:UC_7CLBFT` | На передаче | 5 |

- Hygiene defaults (approved by the product owner): «без звонков» 7 days,
  «без активностей» 5 days. «Без запланированных дел» has no numeric
  threshold — it fires whenever an open deal has zero open activities.
- SLA defaults to seed: sla1 = 24, **sla2 = 5** (deliberate change from the
  current hardcoded 24 — the owner asked for 5), sla3 = 72 business hours.
- Repo conventions: TypeScript strict, zod validation at the HTTP boundary,
  reports/settings read local SQLite only (`AGENTS.md` "Reporting Rules"), no
  personal data in stored settings. UI follows `design.md` (reuse `.panel`,
  `.field`, `.btn`, table styles; no new palette).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Preflight | `pnpm session:preflight` (use `--allow-dirty` only mid-task) | exit 0 |
| Install | `pnpm install` | exit 0 |
| API tests (targeted) | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | all pass |
| API full suite | `pnpm --filter @bitrix24-reporting/api test` | all pass |
| Web tests | `pnpm --filter @bitrix24-reporting/web exec vitest run` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `packages/contracts/src/index.ts` (add types)
- `apps/api/src/server/sqlite-repository.ts` (new table + accessors)
- `apps/api/src/server/service.ts` (get/replace methods; pass SLA thresholds into activities report)
- `apps/api/src/server/app.ts` (zod schema + handlers)
- `apps/api/src/server/routes/attraction-routes.ts` (GET/PUT routes)
- `apps/api/src/domain/operational-reports.ts` (accept SLA thresholds as input; keep constants as defaults)
- `apps/api/test/http.test.ts`, `apps/api/test/activities-workload.test.ts` (tests)
- `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/dashboard-types.ts`
- `apps/web/src/proto/module-settings-panel.tsx`, `apps/web/src/proto/proto-app.tsx`, `apps/web/src/proto/types.ts`
- `apps/web/src/App.test.tsx` and/or `apps/web/src/proto/proto-app.test.tsx` (tests)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any Bitrix sync code — thresholds are local settings, nothing is read from or written to Bitrix.
- `apps/api/src/agent/*` (agent gateway/MCP) — settings are not agent-readable in this plan.
- The operational dashboard report/scene themselves (plans 027/028).
- Existing pricing / unit-economics / manager-whitelist settings behavior.

## Git workflow

- Start from updated `main`; branch `codex/operational-threshold-settings`.
- Focused commits per logical unit; message style matches `git log --oneline` (short imperative sentence, e.g. "Add operational threshold settings storage").
- Open a draft PR when done per `AGENTS.md`; do not merge without green checks.

## Steps

### Step 1: Contracts

In `packages/contracts/src/index.ts` add (near the pricing settings types):

```ts
export interface StageAgingThreshold {
  stageId: string;        // e.g. "C10:NEW"
  stageName: string;      // canonical name, e.g. "База входящая"
  maxDaysOnStage: number; // > 0
}

export interface OperationalThresholdSettings {
  stageAging: StageAgingThreshold[];
  noCallsMaxDays: number;      // default 7
  noActivityMaxDays: number;   // default 5
  slaBusinessHours: { sla1: number; sla2: number; sla3: number };
  updatedAt: string | null;
}

export interface OperationalThresholdSettingsInput {
  stageAging: Array<{ stageId: string; maxDaysOnStage: number }>;
  noCallsMaxDays: number;
  noActivityMaxDays: number;
  slaBusinessHours: { sla1: number; sla2: number; sla3: number };
}
```

**Verify**: `pnpm --filter @bitrix24-reporting/contracts typecheck` → exit 0.

### Step 2: Storage

In `apps/api/src/server/sqlite-repository.ts`, following the `pricing_rules`
pattern (create table near line ~1383, seed near ~1651, replace near ~2826,
test-reset near ~2976, read near ~5082):

- New table `operational_thresholds` with a single JSON payload row:
  `key TEXT PRIMARY KEY CHECK (key = 'attraction')`, `payload TEXT NOT NULL`,
  `updated_at TEXT`. (A one-row JSON document is enough; per-stage rows are not
  required because the payload is small and always replaced atomically.)
- Seed-if-empty with the defaults from "Current state" (stage table above,
  noCallsMaxDays 7, noActivityMaxDays 5, sla { sla1: 24, sla2: 5, sla3: 72 },
  `updated_at = null` until first manual save).
- Methods `getOperationalThresholdSettings(): OperationalThresholdSettings`
  and `replaceOperationalThresholdSettings(input): OperationalThresholdSettings`
  (writes payload + `updated_at = new Date().toISOString()`).
- Add the table to the same test-reset/delete block that clears `pricing_rules`.

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` → exit 0.

### Step 3: Service + HTTP + route

- `apps/api/src/server/service.ts`: add `getOperationalThresholdSettings()` and
  `replaceOperationalThresholdSettings(input)` mirroring
  `getPricingSettings`/`replacePricingSettings` (lines ~1888/~1904).
- `apps/api/src/server/app.ts`: zod schema (all numbers positive integers;
  `stageAging` non-empty array; unknown `stageId` values are rejected against
  the deal stage catalog — reuse how won-stages settings validate stage ids if
  such validation exists, otherwise accept `C10:`-prefixed non-empty strings)
  + handlers `getOperationalThresholdSettings` / `replaceOperationalThresholdSettings`;
  PUT guarded with `denyIfMissingAttractionAccess(response, { leaderOnly: true })`
  exactly like `replacePricingSettings`.
- `apps/api/src/server/routes/attraction-routes.ts` (next to lines 173-174):

  ```ts
  app.get("/api/settings/operational-thresholds", handlers.getOperationalThresholdSettings);
  app.put("/api/settings/operational-thresholds", handlers.replaceOperationalThresholdSettings);
  ```

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` → existing tests pass (new tests come in Step 6).

### Step 4: Rewire SLA thresholds in the activities report

In `apps/api/src/domain/operational-reports.ts`:

- Extend the input of `buildActivitiesWorkloadReport` (exported ~line 2175)
  with optional `slaBusinessHours?: { sla1: number; sla2: number; sla3: number }`.
- Replace direct uses of `SLA_THRESHOLDS_BUSINESS_HOURS.slaN` (usages around
  lines 1187-1230) with the input value, falling back to the constant when the
  input is absent. Keep the constant exported/defined as the single source of
  fallback defaults.
- In `apps/api/src/server/service.ts`, `getActivitiesWorkloadReport` (~line
  2167): read `getOperationalThresholdSettings()` and pass
  `slaBusinessHours` into the builder.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/activities-workload.test.ts` → pass (update fixtures if a test asserted the 24h sla2 boundary; assert the new threshold flows through instead).

### Step 5: Web — cabinet settings block

- `apps/web/src/lib/api-client.ts`: `getOperationalThresholdSettings()` /
  `saveOperationalThresholdSettings(input)` mirroring the pricing methods.
- `apps/web/src/lib/dashboard-types.ts`: re-export the new contract types
  (this file mirrors `packages/contracts` shapes — follow how
  `DealPricingSettings` is declared there).
- `apps/web/src/proto/module-settings-panel.tsx`: new block
  «Пороги операционного контроля» rendered with existing primitives, modeled
  on the pricing block (props pattern at lines ~21-51, render ~382+):
  - table «Этап → максимум дней на этапе» (one `.field` number input per stage);
  - inputs «Без звонков, дней», «Без активностей, дней»;
  - inputs «SLA, бизнес-часы»: «Время в работу», «Первый контакт», «Обработка лида»;
  - save button (leader-only visibility follows the pricing block's pattern),
    saving/saved/error states identical to the pricing block.
- Wire data + save through `apps/web/src/proto/proto-app.tsx` exactly like
  `pricingSettings`/`onPricingSettingsSave` (search those names for every wiring point).

**Verify**: `pnpm --filter @bitrix24-reporting/web exec vitest run` → existing tests pass.

### Step 6: Tests

- `apps/api/test/http.test.ts`: GET returns seeded defaults (incl. `sla2: 5`,
  `C10:NEW` → 1); PUT with leader session persists and returns the new payload;
  PUT without leader access → 403; PUT with a non-positive number → 400.
- `apps/api/test/activities-workload.test.ts`: `buildActivitiesWorkloadReport`
  honors a passed `slaBusinessHours` (an activity at 6 business hours is late
  when `sla2: 5`, on-time when `sla2: 24`).
- Web: extend the settings-panel coverage in `apps/web/src/proto/proto-app.test.tsx`
  (model on the existing pricing settings test) — renders seeded values, edits
  a stage threshold, saves, asserts `saveOperationalThresholdSettings` called
  with the edited payload.

**Verify**: full commands from the table, all green.

## Done criteria

- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0
- [ ] `pnpm --filter @bitrix24-reporting/api test` exits 0 with the new http + activities tests
- [ ] `pnpm --filter @bitrix24-reporting/web exec vitest run` exits 0 with the new settings test
- [ ] `curl` (or http test) GET `/api/settings/operational-thresholds` returns seeded defaults with `slaBusinessHours.sla2 === 5`
- [ ] «Отчет активности» SLA numbers now change when the setting changes (covered by the Step 6 domain test)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `pricing_rules` storage/service/handler code does not match the excerpts and
  the difference is NOT attributable to the `codex/source-cohort-report-tab`
  merge — the settings pattern may have been refactored; report back.
- The stage catalog in SQLite does not contain the `C10:*` stage ids listed
  above (funnel re-configured in Bitrix) — do not invent ids; report back.
- Changing `buildActivitiesWorkloadReport`'s signature breaks more than 3 call
  sites — there may be an established options object to extend instead; report.

## Maintenance notes

- Plans 027/028 consume `getOperationalThresholdSettings()`; keep the seeded
  defaults in one place (storage seed) so the report and the UI never disagree.
- Reviewer should scrutinize: leader-only guard on PUT, zod bounds (no zero/negative
  days), and that sla2=5 seed is intentional (product decision, changes the
  existing activities report display).
- Deferred: per-manager threshold overrides; agent-gateway exposure of settings.
