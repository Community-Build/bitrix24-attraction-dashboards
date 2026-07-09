# Plan 029: Add fact-step conversion diagnostics to the conversion report

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat cf0fd90..HEAD -- packages/contracts/src/index.ts apps/api/src/domain/source-cohort-trajectory.ts apps/api/src/server/service.ts apps/api/test/source-cohort-trajectory.test.ts apps/web/src/lib/api-client.ts apps/web/src/lib/dashboard-types.ts apps/web/src/proto/source-cohort-trajectory-section.tsx apps/web/src/App.test.tsx docs/modules/attraction/REPORT_REGISTRY.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" section against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `cf0fd90`, 2026-07-08

## Why this matters

The current conversion report already separates CRM stages from factual
actions, but the main management question is still hard to answer: where does a
cohort actually break between created deal, successful call, CRM meeting stage,
meeting fact, event, contract stage, and sale. Managers, sources, and customers
need the same named diagnostic gaps so the report can say "stage reached but no
fact", "fact happened but no next move", or "contract reached but not won"
without ambiguous table shorthand. This plan adds that canonical diagnostic
layer to the domain report first, then renders it in the existing "Конверсии"
screen.

## Current state

- `packages/contracts/src/index.ts:1398-1500` defines
  `SourceCohortTrajectoryReport` with `stageNodes`, `stageTransitions`,
  `actionNodes`, `overallSignals`, `managerRows`, `sourceRows`,
  `customerRows`, and `dataQuality`.
- `packages/contracts/src/index.ts:1439-1448` has only these trajectory
  signals: `meetingStageWithoutFactDeals`,
  `completedMeetingWithoutNextStageDeals`, repeat event counts, contract stage
  counts, and contract medians. It does not expose a full step-by-step
  conversion chain or named gap rows.
- `apps/api/src/domain/source-cohort-trajectory.ts` is the domain owner for
  this calculation. It already builds `DealTrajectoryFacts` from canonical
  `deal_stage_facts`, `deal_touchpoint_facts`, and `event_visit_facts`.
- `apps/api/src/server/service.ts:2428-2478` loads local SQLite/canonical
  report inputs and calls `buildSourceCohortConversionReport` with
  `includeTrajectory: true`. Keep using this local API path; do not add direct
  Bitrix reads to rendering.
- `apps/web/src/lib/api-client.ts:2364-2512` normalizes the existing
  trajectory response shape field by field. Any new report fields must be
  normalized here so stale/missing server values do not break the UI.
- `apps/web/src/proto/source-cohort-trajectory-section.tsx` renders the current
  trajectory table and cards. It already uses the report block id
  `attraction-source-cohort-trajectory-conversions`; keep the new UI inside
  this existing block instead of creating another top-level report tab.
- Project rules from `AGENTS.md`: reports must use local API and SQLite
  snapshot, stay scoped to the attraction manager whitelist, avoid deal/contact
  personal data, and keep report calculations out of the browser when they
  affect business truth.

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
- Data quality coverage layer. That is explicitly deferred from this sequence.
- Editable SLA thresholds. Plan 030 adds fixed V1 speed buckets.
- Call transcript/content quality. The local `call_analysis_results` sample is
  too small for ranking managers.
- Historical action-owner attribution. Current manager rows use the deal
  responsible from the snapshot; document this limitation instead of inventing
  ownership.
- New report tabs or endpoint names. Keep the existing "Конверсии" report and
  `/api/reports/source-cohort-conversion` route.

## Git workflow

- Work on a `codex/<task-name>` branch. Do not work directly on `main`.
- Do not push, open a PR, or deploy unless the operator asks.
- Preserve unrelated dirty files. Do not reset or clean user work.

## Steps

### Step 1: Extend the trajectory contract with fact steps and gap rows

In `packages/contracts/src/index.ts`, add explicit types rather than generic
`Record<string, number>` fields:

- `SourceCohortTrajectoryFactStepKey`:
  `created`, `first_successful_call`, `meeting_stage`,
  `completed_meeting`, `attended_event`, `contract_stage`, `won`.
- `SourceCohortTrajectoryFactStepNode`:
  `stepKey`, `label`, `deals`, `rateFromCohort`, `rateFromPrevious`,
  `medianDaysFromCreate`, `evidence`.
- `SourceCohortTrajectoryGapKey`:
  `no_successful_call`, `successful_call_without_meeting_stage`,
  `meeting_stage_without_fact`, `completed_meeting_without_next_stage`,
  `attended_event_without_contract`, `contract_without_win`.
- `SourceCohortTrajectoryGapRow`:
  `gapKey`, `label`, `deals`, `rate`, `denominatorStepKey`, `evidence`,
  `managementQuestion`.

Extend `SourceCohortTrajectorySignals` and
`SourceCohortTrajectoryBreakdownRow` with these counts:

- `noSuccessfulCallDeals`
- `successfulCallWithoutMeetingStageDeals`
- `attendedEventWithoutContractDeals`
- `contractWithoutWinDeals`

Keep the existing `meetingStageWithoutFactDeals` and
`completedMeetingWithoutNextStageDeals` fields; do not rename them in this
plan.

Extend `SourceCohortTrajectoryReport` with:

- `factSteps: SourceCohortTrajectoryFactStepNode[]`
- `conversionGaps: SourceCohortTrajectoryGapRow[]`

Mirror the same type additions in `apps/web/src/lib/dashboard-types.ts`.

**Verify**: `PATH="/Users/vladislavbogdan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" corepack pnpm@10.9.0 --filter @bitrix24-reporting/contracts typecheck` -> exit 0 or only errors caused by API/web not yet updated in later steps.

### Step 2: Calculate canonical fact steps and gaps in the domain module

In `apps/api/src/domain/source-cohort-trajectory.ts`:

- Extend `BreakdownAccumulator` and `toBreakdownRow` with the four new signal
  counts from Step 1.
- In `addTrajectoryToBreakdown`, calculate the new counts from
  `DealTrajectoryFacts`:
  - `noSuccessfulCallDeals`: no `firstSuccessfulCallAt`.
  - `successfulCallWithoutMeetingStageDeals`: `firstSuccessfulCallAt` exists
    and no CRM meeting stage was reached.
  - `attendedEventWithoutContractDeals`: at least one attended event exists and
    no contract stage was reached.
  - `contractWithoutWinDeals`: contract stage was reached and `wonAt` is null.
- Keep `meetingStageWithoutFactDeals` as "CRM meeting stage reached but no
  completed meeting fact".
- Keep `completedMeetingWithoutNextStageDeals` as "meeting fact exists but no
  later forward CRM stage".
- Treat basket/return/loss stages as terminal losses, not "currently on stage"
  workload. Reuse the existing `isLossStage` logic; do not include these stages
  in WIP-style "on stage" diagnostics.
- Add helpers that build `factSteps` and `conversionGaps` for the full cohort.
  Gap denominators must be:
  - no successful call: total cohort deals.
  - call without meeting stage: successful-call deals.
  - meeting stage without fact: meeting-stage deals.
  - meeting fact without next stage: completed-meeting deals.
  - event without contract: attended-event deals.
  - contract without sale: contract-stage deals.

**Verify**: run the API test command after Step 3 tests are added; until then,
`pnpm --filter @bitrix24-reporting/api typecheck` should identify only missing
normalizer/test/UI fields.

### Step 3: Add API characterization tests for each gap

In `apps/api/test/source-cohort-trajectory.test.ts`, extend the existing
trajectory fixtures instead of creating a separate testing style.

Cover at least these cases:

- A deal with no successful call contributes to `noSuccessfulCallDeals`.
- A deal with a successful call but no CRM meeting stage contributes to
  `successfulCallWithoutMeetingStageDeals`.
- A deal in CRM meeting stage without a completed meeting fact contributes to
  `meetingStageWithoutFactDeals`.
- A deal with completed meeting fact but no later forward stage contributes to
  `completedMeetingWithoutNextStageDeals`.
- A deal with attended event but no contract stage contributes to
  `attendedEventWithoutContractDeals`.
- A deal with contract stage but no win contributes to `contractWithoutWinDeals`.
- Basket/return stage deals are counted as lost/terminal and not as active
  stage WIP.

Assert both full-cohort `conversionGaps` and at least one manager/source row
signal so future UI work does not accidentally recompute these in the browser.

**Verify**: API test command -> all tests pass, including the new cases.

### Step 4: Normalize and render diagnostics in the existing conversion UI

In `apps/web/src/lib/api-client.ts`, add normalizers for `factSteps` and
`conversionGaps`, including safe fallbacks for unknown keys.

In `apps/web/src/proto/source-cohort-trajectory-section.tsx`:

- Keep the report tab named "Конверсии".
- Keep the section inside `attraction-source-cohort-trajectory-conversions`.
- Add a compact "Диагностика переходов" layer below the current stage/action
  overview.
- Use human labels, not technical enum names:
  - "Создано"
  - "Первый успешный звонок"
  - "Этап встречи в CRM"
  - "Факт встречи"
  - "Посещение события"
  - "Контракт"
  - "Продажа"
- Add short tooltips or inline helper text for ambiguous metrics:
  - "Первый успешный звонок" means outgoing connected/over-30-second call from
    `deal_touchpoint_facts`.
  - "Этап встречи в CRM" is a CRM stage.
  - "Факт встречи" is an actual completed meeting fact.
  - Gap percentages use the previous factual step denominator, not always the
    full cohort.

Do not move the existing cohort selector or restructure the page tabs.

**Verify**: Web test command -> all tests pass.

### Step 5: Document the method

Update `docs/modules/attraction/REPORT_REGISTRY.md` in the source-cohort
conversion section:

- Define each fact step and its source table.
- Define each gap and denominator.
- State explicitly that basket/return/loss stages are terminal outcomes and
  are not counted as "on stage".
- State that manager rows use current deal responsible from the snapshot, not
  historical owner of every action.

**Verify**: `rg -n "Первый успешный звонок|meeting_stage_without_fact|contract_without_win|Корзина" docs/modules/attraction/REPORT_REGISTRY.md` -> expected entries are present.

## Test plan

- API: `apps/api/test/source-cohort-trajectory.test.ts` covers all new gap
  counts and denominator behavior.
- Web: `apps/web/src/App.test.tsx` asserts the "Конверсии" tab, the
  "Диагностика переходов" heading, and at least two human-readable labels from
  the fact chain.
- Typecheck: contracts, API, and web compile with the new fields.

## Done criteria

- [ ] `factSteps` and `conversionGaps` are produced by
  `buildSourceCohortTrajectoryReport`.
- [ ] The UI renders the diagnostic chain in the existing "Конверсии" report.
- [ ] No browser code computes business-truth gap counts from raw deals.
- [ ] Basket/return/loss stages are not counted as active "on stage" WIP.
- [ ] API test command passes.
- [ ] Web test command passes.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report if:

- The current contract no longer contains `SourceCohortTrajectoryReport` in
  `packages/contracts/src/index.ts`.
- `source-cohort-trajectory.ts` no longer owns the canonical trajectory
  calculation.
- Implementing this requires direct Bitrix reads during page rendering.
- The new gap counts cannot be derived from canonical stage/touchpoint/event
  facts without personal data.
- A verification command fails twice after a focused fix attempt.

## Maintenance notes

- Plan 030 builds on these exact fact step and gap names. Do not rename them
  casually after this lands.
- Plan 031 should use the new row-level gap counts for manager diagnostics.
- Plan 032 should use the same gap names for source/customer loss-shape
  analysis.
