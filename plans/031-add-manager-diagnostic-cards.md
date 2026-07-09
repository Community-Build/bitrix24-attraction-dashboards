# Plan 031: Add manager diagnostic cards for conversion trajectory gaps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat cf0fd90..HEAD -- packages/contracts/src/index.ts apps/api/src/domain/source-cohort-trajectory.ts apps/api/test/source-cohort-trajectory.test.ts apps/web/src/lib/api-client.ts apps/web/src/lib/dashboard-types.ts apps/web/src/proto/source-cohort-trajectory-section.tsx apps/web/src/App.test.tsx docs/modules/attraction/REPORT_REGISTRY.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" section against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/029-add-fact-conversion-diagnostics.md, plans/030-add-speed-sla-buckets.md
- **Category**: direction
- **Planned at**: commit `cf0fd90`, 2026-07-08

## Why this matters

The report should help a ROP decide what to ask each manager, not only rank a
table. A useful manager card says, for example, "fast successful calls, but CRM
meeting stage is not confirmed by meeting fact" or "meeting fact exists, but
deals stall before contract". This plan adds deterministic manager diagnostics
from the same domain facts and SLA buckets, while keeping the current caveat:
manager attribution is by current deal responsible in the snapshot, not by
historical owner of every action.

## Current state

- Plan 029 provides named fact conversion gaps on breakdown rows.
- Plan 030 provides slow/stale counts on breakdown rows.
- `SourceCohortTrajectoryReport` currently has `managerRows`, but no
  `managerDiagnostics` collection.
- `apps/web/src/proto/source-cohort-trajectory-section.tsx` already has a
  manager/source/customer tab set and a selected-row explanation card. Keep the
  existing structure and add a management layer below it instead of replacing
  the report.
- Existing row status `dataQualityStatus` is sample-size style metadata. This
  plan must not expand the deferred data quality layer.
- Rows with `totalDeals < 10` must not be used for hard ranking. They can show
  descriptive facts with a low-sample warning.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `PATH="/Users/vladislavbogdan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" corepack pnpm@10.9.0 session:preflight --allow-dirty` | exit 0 on current task branch |
| API tests | `PATH="/Users/vladislavbogdan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" corepack pnpm@10.9.0 --filter @bitrix24-reporting/api exec vitest run test/source-cohort-trajectory.test.ts` | all tests pass |
| Web tests | `PATH="/Users/vladislavbogdan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" corepack pnpm@10.9.0 --filter @bitrix24-reporting/web exec vitest run src/App.test.tsx` | all tests pass |
| Typecheck | `PATH="/Users/vladislavbogdan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" corepack pnpm@10.9.0 typecheck` | exit 0 |
| Lint | `PATH="/Users/vladislavbogdan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" corepack pnpm@10.9.0 lint` | exit 0 |

## Scope

**In scope**:
- `packages/contracts/src/index.ts`
- `apps/web/src/lib/dashboard-types.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/api/src/domain/source-cohort-trajectory.ts`
- `apps/api/test/source-cohort-trajectory.test.ts`
- `apps/web/src/proto/source-cohort-trajectory-section.tsx`
- `apps/web/src/App.test.tsx`
- `docs/modules/attraction/REPORT_REGISTRY.md`

**Out of scope**:
- Historical action-owner attribution.
- AI call quality or transcript-based scoring.
- Data quality coverage layer.
- New navigation structure or renamed report tabs.
- Source/customer diagnostics. Plan 032 handles those.

## Git workflow

- Work on a `codex/<task-name>` branch. Do not work directly on `main`.
- Do not push, open a PR, or deploy unless the operator asks.
- Preserve unrelated dirty files. Do not reset or clean user work.

## Steps

### Step 1: Add manager diagnostic contract types

In `packages/contracts/src/index.ts`, add:

- `SourceCohortTrajectoryDiagnosticStatus`:
  `strength`, `bottleneck`, `mixed`, `low_sample`.
- `SourceCohortTrajectoryDiagnosticSignal`:
  `signalKey`, `label`, `value`, `benchmarkValue`, `delta`, `unit`,
  `severity`.
- `SourceCohortTrajectoryManagerDiagnostic`:
  `managerId`, `managerName`, `totalDeals`, `status`, `headline`,
  `strengths`, `bottlenecks`, `recommendedFocus`, `sampleWarning`.

Add `managerDiagnostics: SourceCohortTrajectoryManagerDiagnostic[]` to
`SourceCohortTrajectoryReport`.

Mirror the same types in `apps/web/src/lib/dashboard-types.ts`.

**Verify**: contracts typecheck or expected downstream errors only.

### Step 2: Implement deterministic manager diagnosis in the domain module

In `apps/api/src/domain/source-cohort-trajectory.ts`, add a helper that derives
diagnostics from:

- `overallSignals`
- full-cohort rates/medians
- `managerRows`
- gap counts from Plan 029
- speed/stale counts from Plan 030

Use these V1 rules:

- `totalDeals < 10`: status `low_sample`, no hard ranking, show only
  descriptive facts.
- Strong first call: manager first-successful-call rate is at least 10
  percentage points above cohort and median days to first successful call is
  less than or equal to cohort median.
- Slow first call bottleneck: manager slow-first-call rate is at least 10
  percentage points above cohort, or median days to first successful call is at
  least 2 days slower than cohort.
- Meeting-stage-without-fact bottleneck: row
  `meetingStageWithoutFactDeals / meetingStageDeals` is at least 10 percentage
  points above cohort and count is at least 3.
- After-meeting-stall bottleneck: row
  `completedMeetingWithoutNextStageDeals / completedMeetingDeals` or
  `staleAfterCompletedMeetingDeals / completedMeetingDeals` is at least 10
  percentage points above cohort and count is at least 3.
- Contract bottleneck: row `contractWithoutWinDeals / contractStageDeals` or
  stale contract rate is at least 10 percentage points above cohort and count
  is at least 2.

Recommended focus text must be deterministic and short. Examples:

- "Проверить дозвон: мало успешных звонков или они поздние."
- "Проверить назначение встреч: этап встречи есть, факта встречи нет."
- "Проверить следующий шаг после встречи: факт есть, движения дальше нет."
- "Проверить контрактный блок: дошли до контракта, но не закрылись."

Do not use generative/LLM text at runtime.

**Verify**: API tests after Step 3 pass.

### Step 3: Add API tests for manager diagnosis

In `apps/api/test/source-cohort-trajectory.test.ts`, add focused fixtures:

- One manager with strong call performance and weak post-meeting movement.
- One manager with slow/low successful-call performance.
- One low-sample manager with `totalDeals < 10`.
- One manager with contract-stage bottleneck.

Assert:

- `managerDiagnostics` exists and is sorted by management priority:
  bottlenecks first, then mixed, then strengths, then low-sample rows.
- The low-sample row does not get hard ranking language.
- The diagnosis references row-level canonical fields, not UI-derived values.

**Verify**: API test command -> all tests pass.

### Step 4: Normalize and render manager diagnostics

In `apps/web/src/lib/api-client.ts`, normalize `managerDiagnostics` and nested
signals.

In `apps/web/src/proto/source-cohort-trajectory-section.tsx`:

- Add a "Диагностика менеджеров" section below the breakdown table.
- Render compact cards with:
  - manager name and sample size.
  - headline.
  - strongest metric.
  - main bottleneck.
  - recommended focus.
- Preserve the existing manager/source/customer table. Do not replace the table
  with cards.
- Add helper text: "Оценка по текущему ответственному сделки в snapshot; для
  исторической атрибуции действий нужен отдельный owner-layer."
- Keep Russian product language. Do not render enum keys such as
  `meeting_stage_without_fact`.

**Verify**: Web test command -> all tests pass.

### Step 5: Document the management method

Update `docs/modules/attraction/REPORT_REGISTRY.md`:

- Explain the manager diagnostic rules.
- State the low-sample threshold (`N < 10`).
- State the 10 percentage point comparison rule and 2-day call median rule.
- Repeat the current-responsible attribution limitation.
- State that diagnostics are deterministic, not LLM-generated.

**Verify**: `rg -n "Диагностика менеджеров|N < 10|10 percentage|текущему ответственному" docs/modules/attraction/REPORT_REGISTRY.md` -> expected method notes are present.

## Test plan

- API tests prove each diagnostic rule and priority sorting.
- Web tests prove manager cards render in the existing "Конверсии" report.
- Typecheck proves contract and normalizer consistency.

## Done criteria

- [ ] `managerDiagnostics` exists in the report contract and response.
- [ ] Diagnostics are computed in the domain module, not in ad hoc UI text.
- [ ] Low-sample rows are explicitly marked and not hard-ranked.
- [ ] UI keeps the existing report structure and adds cards below the table.
- [ ] API test command passes.
- [ ] Web test command passes.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report if:

- Plan 029 or 030 fields are missing or named differently.
- The diagnosis would require historical action-owner attribution.
- The only way to implement a finding is to generate natural-language advice
  dynamically with an LLM.
- The UI requires deleting or restructuring existing report sections.
- A verification command fails twice after a focused fix attempt.

## Maintenance notes

- Treat diagnostic rule thresholds as V1 product assumptions. If users reject
  them, adjust the deterministic rules and tests together.
- Future historical owner attribution should add a new action-owner facts layer
  rather than changing the meaning of current manager rows.
