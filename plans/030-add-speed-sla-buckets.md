# Plan 030: Add speed and SLA buckets to the conversion trajectory

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
- **Depends on**: plans/029-add-fact-conversion-diagnostics.md
- **Category**: direction
- **Planned at**: commit `cf0fd90`, 2026-07-08

## Why this matters

Conversion rate alone does not show whether a manager or source is healthy.
The ROP question is also time-based: how quickly the team gets to a successful
call, how quickly it confirms a real meeting, how long deals sit after meeting,
and how long they wait before contract. This plan adds deterministic speed
buckets and stale-WIP counters to the same domain report, so the UI can show
"fast but low conversion", "slow first call", or "meeting happened and then
stalled" without hand-counting in the browser.

## Current state

- Plan 029 must land first. This plan expects canonical fact steps and gap
  counts to exist in `SourceCohortTrajectoryReport`.
- `packages/contracts/src/index.ts:1408-1416` already has
  `medianDaysFromCreate` and `medianDaysOnStage` on stage nodes.
- `packages/contracts/src/index.ts:1468-1476` already exposes median days to
  first successful call, completed meeting, and attended event on breakdown
  rows.
- `packages/contracts/src/index.ts:1446-1447` already exposes median days to
  contract stage and median days on contract stage.
- Current medians do not show distribution or SLA breach counts. A manager with
  a good median can still have many very late deals.
- `apps/api/src/server/service.ts:2479-2484` already has `nowFactory()` for
  resolved range. Reuse a single report `now` value for age/SLA calculations so
  tests are deterministic.
- `source-cohort-trajectory.ts` already avoids median dwell for basket/return
  loss stages through `isLossStage`. Keep this rule.

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
- `apps/api/src/server/service.ts`
- `apps/api/test/source-cohort-trajectory.test.ts`
- `apps/web/src/proto/source-cohort-trajectory-section.tsx`
- `apps/web/src/App.test.tsx`
- `docs/modules/attraction/REPORT_REGISTRY.md`

**Out of scope**:
- Editable thresholds/settings UI.
- Data quality coverage layer.
- Historical point-in-time replay for comparisons. Open-age metrics are based
  on current snapshot age at report build time.
- Counting basket/return/loss stages as active "on stage" time.
- Any direct Bitrix read during rendering.

## Git workflow

- Work on a `codex/<task-name>` branch. Do not work directly on `main`.
- Do not push, open a PR, or deploy unless the operator asks.
- Preserve unrelated dirty files. Do not reset or clean user work.

## Steps

### Step 1: Add speed bucket contract types

In `packages/contracts/src/index.ts`, add:

- `SourceCohortTrajectorySpeedStepKey`:
  `first_successful_call`, `completed_meeting`, `attended_event`,
  `contract_stage`, `post_meeting_next_stage`.
- `SourceCohortTrajectorySpeedBucket`:
  `bucketKey`, `label`, `minDays`, `maxDays`, `deals`, `rate`.
- `SourceCohortTrajectorySpeedStep`:
  `stepKey`, `label`, `totalDeals`, `medianDays`, `slaDays`,
  `slowDeals`, `slowRate`, `buckets`.

Add `speedSteps: SourceCohortTrajectorySpeedStep[]` to
`SourceCohortTrajectoryReport`.

Extend `SourceCohortTrajectorySignals` and breakdown rows with these fields:

- `slowFirstSuccessfulCallDeals`
- `slowCompletedMeetingDeals`
- `slowAttendedEventDeals`
- `slowContractStageDeals`
- `staleAfterCompletedMeetingDeals`
- `staleOpenContractStageDeals`

Mirror the same types in `apps/web/src/lib/dashboard-types.ts`.

**Verify**: contracts typecheck or expected downstream errors only.

### Step 2: Define V1 thresholds in the domain module

In `apps/api/src/domain/source-cohort-trajectory.ts`, define local constants
near the trajectory helpers:

- First successful call SLA: 3 days.
  Buckets: `0-1`, `1-3`, `3-7`, `7+`, `no_fact`.
- Completed meeting SLA: 7 days.
  Buckets: `0-3`, `3-7`, `7-14`, `14+`, `no_fact`.
- Attended event SLA: 14 days.
  Buckets: `0-7`, `7-14`, `14-30`, `30+`, `no_fact`.
- Contract stage SLA: 14 days.
  Buckets: `0-7`, `7-14`, `14-30`, `30+`, `no_fact`.
- Post-meeting next-stage SLA: 7 days after completed meeting.

These are V1 report constants, not product settings. Document that later
threshold editing should move them into settings only after the report shape is
proven.

**Verify**: `rg -n "FIRST_SUCCESSFUL_CALL|POST_MEETING|SLA" apps/api/src/domain/source-cohort-trajectory.ts` -> the threshold constants are in one place.

### Step 3: Pass deterministic report time into the trajectory builder

Extend `SourceCohortTrajectoryInput` in
`apps/api/src/domain/source-cohort-trajectory.ts` with `now?: Date`.

In `apps/api/src/server/service.ts`, capture one `const reportNow = nowFactory()`
inside `getSourceCohortConversionReport` and pass it into
`buildSourceCohortConversionReport` or the trajectory input path. Use that same
`reportNow` for `resolveRange` so tests and current-age calculations do not
depend on multiple clock reads.

Do not use `new Date()` directly inside tests.

**Verify**: API typecheck progresses to missing speed field/test failures only.

### Step 4: Calculate speed buckets and stale counts

In `source-cohort-trajectory.ts`:

- Build `speedSteps` for the full cohort using fact timestamps from
  `DealTrajectoryFacts`.
- Count a deal as slow for a step when the fact exists and the days from create
  exceed that step's SLA.
- Count `no_fact` in bucket distribution, but do not include no-fact values in
  medians.
- Calculate `staleAfterCompletedMeetingDeals` when a completed meeting fact
  exists, there is no later forward stage, the deal is open, and the elapsed
  days from meeting to `now` exceed 7 days.
- Calculate `staleOpenContractStageDeals` when a deal is currently open on the
  contract stage and days since entering that stage exceed 14 days.
- Exclude won deals, lost terminal deals, basket, return, and non-qualified
  loss stages from stale-open WIP counters.

Extend `BreakdownAccumulator` and `toBreakdownRow` with the same slow/stale
counts so manager/source/customer rows can be compared.

**Verify**: API tests after Step 5 pass.

### Step 5: Add deterministic tests for speed and stale WIP

In `apps/api/test/source-cohort-trajectory.test.ts`, add or extend tests with a
fixed `now` date.

Cover:

- First successful call inside SLA and outside SLA.
- Completed meeting inside SLA and outside SLA.
- Attended event and contract stage bucket placement.
- Completed meeting with no later forward stage older than 7 days counts as
  stale.
- Completed meeting followed by basket/return/loss is not stale WIP.
- Open contract stage older than 14 days counts as stale contract WIP.
- Won or lost contract-stage deals do not count as stale open contract WIP.

**Verify**: API test command -> all tests pass.

### Step 6: Render speed/SLA layer without crowding the table

In `apps/web/src/lib/api-client.ts`, normalize `speedSteps` and the new row
signals.

In `apps/web/src/proto/source-cohort-trajectory-section.tsx`:

- Add a compact "Сроки и зависания" section below the fact diagnostics from
  Plan 029.
- Show each step's median, SLA, slow count/rate, and bucket bar.
- In the manager/source/customer table, add short columns only for the most
  actionable counts:
  - slow first successful call.
  - slow meeting fact.
  - stale after meeting.
  - stale on contract.
- Use tooltips/helper text to explain that "slow" means fact exists but was
  later than the V1 threshold; "no fact" is a separate gap from Plan 029.

Do not add a new top-level report tab and do not move the existing cohort
selector.

**Verify**: Web test command -> all tests pass.

### Step 7: Document timing semantics

Update `docs/modules/attraction/REPORT_REGISTRY.md`:

- List the V1 SLA thresholds.
- Explain that medians use completed facts only.
- Explain that `no_fact` bucket is counted for distribution but excluded from
  medians.
- Explain that current open-stage age is separate from historical
  `medianDaysOnStage`.
- Explain that loss stages are terminal outcomes, not active WIP.

**Verify**: `rg -n "SLA|no_fact|medianDaysOnStage|stale" docs/modules/attraction/REPORT_REGISTRY.md` -> expected method notes are present.

## Test plan

- API tests cover exact bucket placement at threshold boundaries.
- API tests cover open-WIP stale logic with deterministic `now`.
- Web tests assert the "Сроки и зависания" section and one bucket label.
- Typecheck catches contract/normalizer drift.

## Done criteria

- [ ] `SourceCohortTrajectoryReport.speedSteps` exists and is populated.
- [ ] Slow/stale counts exist on overall signals and breakdown rows.
- [ ] Stale WIP excludes terminal loss stages.
- [ ] Web UI explains SLA and no-fact semantics in Russian.
- [ ] API test command passes.
- [ ] Web test command passes.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report if:

- Plan 029 is not implemented or the fact-step/gap fields have different names.
- Current-age calculations require a wall-clock read inside pure domain tests.
- A stale counter would need to treat basket/return as active WIP.
- The UI change requires restructuring the report navigation.
- A verification command fails twice after a focused fix attempt.

## Maintenance notes

- These thresholds are intentionally hardcoded V1 report semantics. Move them to
  settings only after users validate the management value.
- Plan 031 should use these slow/stale counts to generate manager diagnostics.
- Plan 032 should use the same slow/stale counts to describe source/customer
  loss shapes.
