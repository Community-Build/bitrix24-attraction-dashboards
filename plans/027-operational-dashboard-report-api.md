# Plan 027: Build the operational dashboard report (domain + API)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cac60e5..HEAD -- packages/contracts/src/index.ts apps/api/src`
> Branch `codex/source-cohort-report-tab` (report «Конверсия источников», new
> domain file `apps/api/src/domain/source-cohort-conversion.ts`) may have
> merged — its additions are EXPECTED drift and are also the best structural
> exemplar for this plan if present. Any other mismatch with "Current state"
> excerpts is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (new report only; no changes to existing reports)
- **Depends on**: plans/026-operational-threshold-settings.md
- **Category**: direction
- **Planned at**: commit `cac60e5`, 2026-07-05

## Why this matters

The approved operational dashboard (prototype:
`plans/assets/operational-dashboard-prototype.html`) needs one API response
that answers "what happened this period, what is planned, and which deals are
at risk right now". Risk detection (deal stuck on a stage beyond its
threshold, deal without open activities, without recent calls, without recent
activity) does not exist anywhere in the product today. This plan builds the
domain logic and HTTP endpoint; plan 028 renders it.

## Current state

- **Report pipeline pattern** (follow it exactly): domain builder in
  `apps/api/src/domain/` → service method in `apps/api/src/server/service.ts`
  (e.g. `getTargetGroupConversionReport` ~line 2373, `getActivitiesWorkloadReport`
  ~line 2167) → handler in `apps/api/src/server/routes/attraction-report-handlers.ts`
  → route in `apps/api/src/server/routes/attraction-routes.ts` (pattern at
  lines 109-127, e.g. `app.get("/api/reports/target-group-conversion", ...)`).
  Reports read the local SQLite snapshot only — never Bitrix directly
  (`AGENTS.md` "Reporting Rules").
- **Report catalog**: every attraction report has a descriptor in
  `apps/api/src/server/module-capabilities.ts` (agent-readable catalog, plans
  011-013). A new report must add its descriptor there following the existing
  entries.
- **Input data** (all in `packages/contracts/src/index.ts`):
  - `DealSnapshot` (line ~28): `id`, `categoryId`, `stageId`, `stageSemanticId`
    (`"S"` won / `"F"` lost / other open), `assignedById`, `sourceId`,
    `qualityValue`, `businessClubValue`, `targetGroupValue`,
    `meetingSlots?: DealMeetingSlot[]`, `dateCreate`, `dateModify`, `dateClosed`.
  - `DealMeetingSlot` (line ~16): `{ index: 1|2|3; dateValue: string|null; typeValue; placeValue; calendarValue; eventId; source: "deal_fields" }` —
    canonical «Встреча 1/2/3» model (plans 008-010, DONE).
  - `ActivitySnapshot` (line ~258): `{ id, ownerTypeId, ownerId, typeId, providerId, responsibleId, createdTime, deadline, lastUpdated, completed, completedTime }` —
    Bitrix «дела»; `ownerId` binds to the deal.
  - `CallSnapshot` (line ~321): `{ id, crmActivityId, portalUserId, callType, callStartDate, callDurationSeconds, crmEntityType, crmEntityId, callFailedCode, ... }` —
    calls bound to deals via `crmEntityType`/`crmEntityId` (see how
    `buildCallsWorkloadReport` in `apps/api/src/domain/operational-reports.ts`
    ~line 3667 resolves deal bindings — reuse the same resolution helper).
  - `StageHistorySnapshot` — stage transitions per deal (`ownerId`, `stageId`,
    `stageSemanticId`, `createdTime`); used the same way in
    `buildCohortConversionReport` (~line 4317 of operational-reports.ts).
  - `StageCatalogEntry` — stage names by `statusId`; manager directory gives
    manager names (see `buildManagerDirectoryMap` in
    `apps/api/src/domain/report-dimensions.ts`).
- **Stage transitions семантика** (from `docs/modules/attraction/MODULE_ONTOLOGY.md`
  ~line 250): «Передано в клуб» = `C10:WON` (a sale); lost = `C10:LOSE`
  («Корзина») and `C10:UC_EA3R76` («Возврат в Лидген(неквал)»); `C10:UC_XEEP0A`
  («Отклонено потребителем») is a non-final negative stage.
- **Bitrix deal URL**: `buildBitrixDealUrl(portalHost, dealId)` already exists
  in `apps/api/src/server/service.ts` (~line 499):

  ```ts
  return `https://${portalHost}/crm/deal/details/${encodeURIComponent(dealId)}/`;
  ```

  Find how `portalHost` is resolved next to it and reuse both.
- **Thresholds** come from plan 026:
  `service.getOperationalThresholdSettings()` returns
  `{ stageAging: [{stageId, stageName, maxDaysOnStage}], noCallsMaxDays, noActivityMaxDays, slaBusinessHours, updatedAt }`.
- **SLA aggregation**: `buildActivitiesWorkloadReport` already computes
  per-manager `slaMetrics: SlaMetric[]` (`{ slaKey, label, onTimeCount, lateCount, noTouchCount, medianHours }`,
  contracts line ~1301). Reuse its helpers rather than re-deriving SLA rules.
- **Timezone convention**: business dates use Moscow time; web builds ranges
  like `2026-06-01T00:00:00.000+03:00`. Compute «сегодня»/«завтра» windows in
  `+03:00`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Preflight | `pnpm session:preflight` | exit 0 |
| API tests (targeted) | `pnpm --filter @bitrix24-reporting/api exec vitest run test/operational-dashboard.test.ts test/http.test.ts` | all pass |
| API full suite | `pnpm --filter @bitrix24-reporting/api test` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `packages/contracts/src/index.ts` (report types)
- `apps/api/src/domain/operational-dashboard.ts` (create — domain builder)
- `apps/api/src/server/service.ts` (service method)
- `apps/api/src/server/routes/attraction-report-handlers.ts` (handler)
- `apps/api/src/server/routes/attraction-routes.ts` (route)
- `apps/api/src/server/module-capabilities.ts` (report descriptor)
- `apps/api/test/operational-dashboard.test.ts` (create), `apps/api/test/http.test.ts`, `apps/api/test/security.test.ts` (auth coverage for the new route, following how other report routes are asserted)
- `plans/README.md` (status row)

**Out of scope**:
- Web UI (plan 028).
- Any change to existing report builders' outputs.
- Bitrix sync, agent gateway write paths, notifications/Telegram.
- Storing computed risks — the report is computed on read, nothing persisted.

## Git workflow

- Start from updated `main` (plan 026 merged); branch `codex/operational-dashboard-report`.
- Focused commits; short imperative messages as in `git log --oneline`.
- Draft PR when done per `AGENTS.md`.

## Report contract (add to `packages/contracts/src/index.ts`)

```ts
export type OperationalRiskRuleKey =
  | "stage_aging"      // «застрял на этапе»
  | "no_open_activity" // «без запланированных дел»
  | "no_recent_calls"  // «без звонков N дней»
  | "no_recent_activity"; // «без активностей N дней»

export interface OperationalRiskFlag {
  rule: OperationalRiskRuleKey;
  label: string;              // ready-to-render, e.g. "застрял: 21 дн · порог 3"
  severity: "risk" | "critical";
}

export interface OperationalRiskDeal {
  dealId: string;
  dealUrl: string | null;      // Bitrix link; null when portal host unknown
  managerId: string;
  managerName: string;
  stageId: string;
  stageName: string;
  daysOnStage: number;
  stageMaxDays: number | null; // null when the stage has no aging rule
  sourceLabel: string;
  customerClubLabel: string;   // «Без бизнес-клуба заказчика» fallback
  flags: OperationalRiskFlag[];
  severity: "risk" | "critical"; // max of flags
  overdueRatio: number;          // daysOnStage / stageMaxDays, 0 when no rule
}

export interface OperationalMeetingSlotCount {
  slotIndex: 1 | 2 | 3;
  slotLabel: string;             // "Встреча 1" | "Встреча 2" | "Встреча 3"
  count: number;
}

export interface OperationalSaleByClub {
  targetGroupKey: string;
  targetGroupLabel: string;
  wonDeals: number;
  averageDaysToWin: number;
}

export interface OperationalStageWip {
  stageId: string;
  stageName: string;
  openDeals: number;
  riskDeals: number;             // deals on this stage with any flag
}

export interface OperationalPlannedBlock {
  meetingsToday: OperationalMeetingSlotCount[];
  meetingsTomorrow: OperationalMeetingSlotCount[];
  tasksToday: number;            // open activities with deadline today
  tasksTomorrow: number;
}

export interface OperationalSlaSummary {
  slaKey: "sla1" | "sla2" | "sla3";
  label: string;
  thresholdBusinessHours: number;
  onTimeCount: number;
  lateCount: number;
  noTouchCount: number;
  medianHours: number;
}

export interface OperationalManagerRow {
  managerId: string;
  managerName: string;
  createdDeals: number;
  meetingsBySlot: OperationalMeetingSlotCount[];
  wonDeals: number;
  slaLateCount: number;
  slaNoTouchCount: number;
  openDeals: number;
  riskDeals: number;
}

export interface OperationalDashboardReport {
  range: ReportRange;
  generatedAt: string;
  createdDeals: number;
  meetingsHeld: { total: number; bySlot: OperationalMeetingSlotCount[] };
  sales: { total: number; byClub: OperationalSaleByClub[] };
  lostDeals: number;
  openDeals: number;
  riskSummary: { total: number; critical: number; risk: number;
    byRule: Array<{ rule: OperationalRiskRuleKey; label: string; count: number }>;
    byStage: Array<{ stageId: string; stageName: string; count: number }> };
  stageWip: OperationalStageWip[];
  sla: OperationalSlaSummary[];
  planned: OperationalPlannedBlock;
  managers: OperationalManagerRow[];
  risks: OperationalRiskDeal[];  // sorted, capped at 500
  thresholdsUpdatedAt: string | null;
}
```

No deal titles, contact names, phones or emails anywhere — deal IDs only
(`AGENTS.md` privacy rule).

## Steps

### Step 1: Domain builder `apps/api/src/domain/operational-dashboard.ts`

Export `buildOperationalDashboardReport(input)` with input
`{ range, now, deals, stageCatalog, stageHistory, activities, calls, managerDirectory, thresholds, wonStageIds, dealUrlBuilder }`
(follow the input style of `buildCohortConversionReport`). Semantics:

- **Scoping**: only deals in attraction funnel categories (reuse
  `getAllowedCategoryIds`-style filtering from existing builders in
  `operational-reports.ts`); manager whitelist and manager/source query
  filters are applied by the service exactly as for other reports — the
  builder just consumes the already-filtered deal list if that is how
  neighboring reports do it (check `getTargetGroupConversionReport` in
  `service.ts` and mirror it).
- **Flow metrics over `range`**: `createdDeals` = deals with `dateCreate` in
  range. `meetingsHeld.bySlot` = meeting slots (`deal.meetingSlots[]`) whose
  `dateValue` falls in range AND is `<= now` (held, not planned); label slots
  «Встреча 1/2/3». `sales` = deals whose FIRST transition to `C10:WON` (from
  stage history; fallback: current stage is WON and `dateClosed` in range)
  happened in range, grouped by `targetGroupValue` (label fallback
  «Без таргет-группы»), with `averageDaysToWin` = mean of
  (wonAt − dateCreate) in days, 2 decimals. `lostDeals` = deals whose
  transition to `C10:LOSE` or `C10:UC_EA3R76` happened in range.
- **Open deals & days on stage**: open = deal whose `stageSemanticId` is
  neither `"S"` nor `"F"`. `daysOnStage` = (now − entry time of the CURRENT
  stage), where entry time = `createdTime` of the LATEST stage-history row
  with `stageId === deal.stageId`; fallback `deal.dateCreate`. Round down to
  whole days.
- **Risk rules** (open deals only):
  - `stage_aging`: `daysOnStage >= maxDaysOnStage` for the deal's stage (rule
    exists only for stages present in `thresholds.stageAging`). Severity
    `critical` when `daysOnStage >= 2 * maxDaysOnStage`, else `risk`.
  - `no_open_activity`: the deal has zero activities with `completed === false`.
    Severity `risk`.
  - `no_recent_calls`: `now − max(lastCallAt, deal.dateCreate) >= noCallsMaxDays`
    days, where `lastCallAt` = latest `callStartDate` of calls bound to the
    deal with `callDurationSeconds > 0` (binding resolution copied from
    `buildCallsWorkloadReport`). Using `dateCreate` in the `max` prevents
    flagging deals younger than the window. Severity `risk`.
  - `no_recent_activity`: same formula with the latest of
    `activity.createdTime`/`completedTime`/`lastUpdated` over the deal's
    activities and `noActivityMaxDays`. Severity `risk`.
  - Deal `severity` = `critical` if any flag is critical, else `risk`.
    Sort: critical first → `overdueRatio` desc → flag count desc → `dealId`
    asc. Cap `risks` at 500 items (keep counts exact in `riskSummary`).
- **stageWip**: open deals per stage (catalog order), with `riskDeals` counts.
- **sla**: aggregate over the range's new deals using the SLA helpers from
  `operational-reports.ts` with `thresholds.slaBusinessHours` (plan 026 made
  them injectable). Emit one `OperationalSlaSummary` per slaKey.
- **planned**: `meetingsToday/Tomorrow` from `meetingSlots.dateValue` falling
  in the Moscow-time day windows of `now` / `now + 1 day`; `tasksToday/Tomorrow`
  from open activities (`completed === false`) with `deadline` in those windows.
- **managers**: one row per whitelist manager with any data; counts as defined
  in the contract; `slaLateCount`/`slaNoTouchCount` from the same SLA pass.
- Pure function, no I/O, no `Date.now()` inside — `now` comes from input.

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` → exit 0.

### Step 2: Service, handler, route, catalog

- `service.ts`: `getOperationalDashboardReport(query)` — resolve range/filters
  the same way `getTargetGroupConversionReport` does; load deals, stage
  catalog, stage history, activities, calls, manager directory, thresholds
  (`getOperationalThresholdSettings()`); pass `now = new Date().toISOString()`
  and a `dealUrlBuilder` closure over the resolved portal host +
  `buildBitrixDealUrl`.
- `attraction-report-handlers.ts`: `getOperationalDashboardReport` handler
  copied from the neighboring report handler (same query parsing + error
  handling).
- `attraction-routes.ts`: `app.get("/api/reports/operational-dashboard", handlers.getOperationalDashboardReport);`
- `module-capabilities.ts`: add the report descriptor (id
  `operational-dashboard`, title «Операционный дашборд», agentReadable
  consistent with other aggregate reports — copy the shape of an existing
  descriptor).

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` → pass.

### Step 3: Tests

Create `apps/api/test/operational-dashboard.test.ts` (model the fixture style
on `apps/api/test/activities-workload.test.ts` — in-memory snapshots, no DB).
Cover at minimum:

1. stage_aging: deal 4 days on `C10:PREPARATION` with threshold 3 → flagged
   `risk`; 6 days → `critical` (2×3); deal 2 days → not flagged.
2. `daysOnStage` uses the LATEST transition into the current stage (deal that
   bounced A→B→A counts from the second A entry).
3. no_open_activity: open deal with only completed activities → flagged; deal
   with one open activity → not flagged.
4. no_recent_calls honors `max(lastCallAt, dateCreate)` (a deal created 2 days
   ago with zero calls and `noCallsMaxDays 7` → NOT flagged).
5. Flow: meetingsHeld bySlot counts only `dateValue` in range and `<= now`;
   sales grouped by club with cycle; lost counts `C10:LOSE` + `C10:UC_EA3R76`.
6. planned: slot date today / tomorrow / yesterday → today counts 1, tomorrow 1.
7. risks sorted critical-first and capped at 500 (fixture with 501+ not
   needed — assert the cap constant is applied via a small cap override if the
   builder exposes it, otherwise skip the cap assertion and leave the constant).
8. Won/lost deals never appear in `risks`.

Add to `test/http.test.ts`: authenticated GET
`/api/reports/operational-dashboard` returns 200 with `riskSummary` and
`managers`; add the route to the unauthenticated-401 sweep in
`test/security.test.ts` (follow how other `/api/reports/*` routes are listed).

**Verify**: `pnpm --filter @bitrix24-reporting/api test` → all pass.

## Done criteria

- [ ] `pnpm typecheck` and `pnpm lint` exit 0
- [ ] `pnpm --filter @bitrix24-reporting/api test` exits 0, including ≥8 new domain tests
- [ ] GET `/api/reports/operational-dashboard` (authed) returns the contract shape; unauthenticated → 401
- [ ] Report responses contain deal IDs but no deal titles/phones/emails (grep the new domain file for `title` — no deal title field is read)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 026's `getOperationalThresholdSettings` does not exist on the service —
  026 has not landed; stop.
- Call→deal binding helper in `buildCallsWorkloadReport` does not exist or
  resolves through a repository method unavailable to the service — report
  back with what you found instead of inventing a binding.
- `meetingSlots` is absent from deal snapshots in the local DB (plans 008-010
  regressed) — stop.
- The activities/calls tables lack the fields used above (`deadline`,
  `completed`, `callStartDate`, `callDurationSeconds`) — stop.

## Maintenance notes

- The risk rules are pure functions of (deal, activities, calls, thresholds,
  now) — keep them exported individually so future notification jobs (e.g.
  Telegram digests) can reuse them without the report envelope.
- Reviewer should scrutinize: timezone handling of the today/tomorrow windows
  (+03:00), the `max(lastCallAt, dateCreate)` guard, and that stage entry time
  uses the latest transition (not the first).
- Deferred deliberately: persisting risk history/trends; per-manager
  thresholds; agent-gateway exposure beyond the standard catalog descriptor.
