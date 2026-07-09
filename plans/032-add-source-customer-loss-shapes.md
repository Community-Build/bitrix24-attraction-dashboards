# Plan 032: Add source and customer loss-shape analysis

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

Source and customer evaluation should not stop at "sold / lost / in work".
Two sources can have the same win rate but opposite problems: one fails before
successful call, another reaches meetings but stalls after factual meeting, and
a third reaches contract but does not close. This plan adds a loss-shape layer
for source and customer rows using the same canonical gaps and timing rules as
manager diagnostics.

## Current state

- Plan 029 provides canonical conversion gaps.
- Plan 030 provides speed/stale counts.
- `SourceCohortTrajectoryReport` already has `sourceRows` and `customerRows`,
  but rows do not identify a dominant loss shape or recommended management
  question.
- `apps/web/src/proto/source-cohort-trajectory-section.tsx` already has
  breakdown tabs for managers, sources, and customers. Keep those tabs; add
  loss-shape columns/cards inside the existing conversion report.
- Local data includes source/customer fields on deal snapshots and canonical
  trajectory facts. Do not fetch from Bitrix during rendering.
- Basket, return, non-qualified, and other loss stages are terminal outcomes.
  They are loss shape evidence, not active "on stage" workload.

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
- Manager diagnostic cards. Plan 031 handles those.
- Source spend, CAC, ROI, or marketing cost attribution.
- Data quality coverage layer.
- Direct Bitrix reads.
- Any display of deal/contact personal data.

## Git workflow

- Work on a `codex/<task-name>` branch. Do not work directly on `main`.
- Do not push, open a PR, or deploy unless the operator asks.
- Preserve unrelated dirty files. Do not reset or clean user work.

## Steps

### Step 1: Add loss-shape contract types

In `packages/contracts/src/index.ts`, add:

- `SourceCohortTrajectoryLossShapeKey`:
  `not_reached_successful_call`, `call_without_meeting_stage`,
  `meeting_stage_without_fact`, `meeting_fact_without_next_stage`,
  `event_without_contract`, `contract_without_win`, `terminal_loss`,
  `open_wip`.
- `SourceCohortTrajectoryLossShapeReason`:
  `shapeKey`, `label`, `deals`, `rate`, `evidence`, `recommendedQuestion`.
- `SourceCohortTrajectoryLossShape`:
  `dominantShapeKey`, `dominantShapeLabel`, `dominantDeals`,
  `dominantRate`, `terminalLossDeals`, `openWipDeals`, `reasons`.

Add `lossShape: SourceCohortTrajectoryLossShape` to
`SourceCohortTrajectoryBreakdownRow`. This makes the shape available on
manager, source, and customer rows, but Plan 032 will render it only for source
and customer views.

Mirror the same types in `apps/web/src/lib/dashboard-types.ts`.

**Verify**: contracts typecheck or expected downstream errors only.

### Step 2: Calculate loss shapes from canonical row signals

In `apps/api/src/domain/source-cohort-trajectory.ts`, add a helper that converts
each `SourceCohortTrajectoryBreakdownRow` into a `lossShape`.

Reason counts:

- `not_reached_successful_call`: `noSuccessfulCallDeals` from Plan 029.
- `call_without_meeting_stage`:
  `successfulCallWithoutMeetingStageDeals` from Plan 029.
- `meeting_stage_without_fact`: `meetingStageWithoutFactDeals`.
- `meeting_fact_without_next_stage`:
  `completedMeetingWithoutNextStageDeals` plus stale-after-meeting evidence
  from Plan 030 when available. Avoid double counting the same deal if the
  domain already stores a deal-level flag; if only aggregate fields exist, use
  `max(completedMeetingWithoutNextStageDeals, staleAfterCompletedMeetingDeals)`
  and document this as aggregate de-duplication.
- `event_without_contract`: `attendedEventWithoutContractDeals`.
- `contract_without_win`: `contractWithoutWinDeals`.
- `terminal_loss`: final lost deals, including basket/return/loss stages.
- `open_wip`: open deals that are not terminal loss and not won.

Dominant shape selection:

1. Exclude reasons with `deals = 0`.
2. Prefer the highest `deals`.
3. Tie-break by later-funnel severity in this order:
   `contract_without_win`, `event_without_contract`,
   `meeting_fact_without_next_stage`, `meeting_stage_without_fact`,
   `call_without_meeting_stage`, `not_reached_successful_call`,
   `terminal_loss`, `open_wip`.

Recommended questions:

- No successful call: "Почему не довели до успешного дозвона?"
- Call without meeting stage: "Почему после дозвона не назначили встречу?"
- Meeting stage without fact: "Почему этап встречи не подтвержден фактом?"
- Meeting fact without next stage: "Почему после встречи нет следующего шага?"
- Event without contract: "Почему после события не дошли до контракта?"
- Contract without win: "Что блокирует закрытие контракта?"
- Terminal loss: "Какая причина проигрыша повторяется?"
- Open WIP: "Где нужен следующий управленческий шаг?"

**Verify**: API tests after Step 3 pass.

### Step 3: Add API tests for source/customer shapes

In `apps/api/test/source-cohort-trajectory.test.ts`, add fixtures with at least
two sources and two customers:

- Source A has most losses before successful call.
- Source B reaches meeting fact but stalls before next stage.
- Customer A reaches contract but does not win.
- Customer B mostly ends in basket/return terminal loss.

Assert:

- `sourceRows[].lossShape.dominantShapeKey` matches the intended shape.
- `customerRows[].lossShape.dominantShapeKey` matches the intended shape.
- Basket/return rows contribute to `terminal_loss`, not `open_wip`.
- Reasons are sorted by management priority and nonzero count.

**Verify**: API test command -> all tests pass.

### Step 4: Normalize and render source/customer loss profiles

In `apps/web/src/lib/api-client.ts`, normalize `lossShape` and nested reasons.

In `apps/web/src/proto/source-cohort-trajectory-section.tsx`:

- In the existing "Источники" and "Заказчики" tabs, add visible columns:
  - "Профиль потерь"
  - "Сделок"
  - "Доля"
  - "Вопрос РОП"
- For selected source/customer row, render a small reason list under the table:
  top 3 nonzero reasons, each with count/rate and recommended question.
- Do not render loss-shape columns in the manager tab unless the layout already
  has room; Plan 031 owns manager cards.
- Use Russian labels, not enum keys.
- Keep the cohort selector and top report structure unchanged.

**Verify**: Web test command -> all tests pass.

### Step 5: Document source/customer method

Update `docs/modules/attraction/REPORT_REGISTRY.md`:

- Define each loss-shape key and source field.
- State that source/customer shapes reuse Plan 029 gap counts and Plan 030
  stale timing.
- State that basket/return are terminal losses, not current-stage workload.
- State that loss-shape ranking is descriptive and should not be used for hard
  ranking when `N < 10`.

**Verify**: `rg -n "Профиль потерь|terminal_loss|Источник|Заказчик|N < 10" docs/modules/attraction/REPORT_REGISTRY.md` -> expected method notes are present.

## Test plan

- API tests prove source and customer dominant-shape selection.
- API tests prove terminal loss is not open WIP.
- Web tests prove source/customer loss columns render.
- Typecheck proves contract and normalizer consistency.

## Done criteria

- [ ] `lossShape` exists on trajectory breakdown rows.
- [ ] Source and customer tabs show dominant loss shape and ROP question.
- [ ] Terminal loss stages are not shown as active "on stage" workload.
- [ ] No personal deal/contact data is exposed.
- [ ] API test command passes.
- [ ] Web test command passes.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report if:

- Plan 029 or 030 fields are missing or named differently.
- Source/customer grouping is unavailable from local SQLite snapshots.
- Calculating the loss shape would require Bitrix reads during rendering.
- The UI change requires replacing the current report structure.
- A verification command fails twice after a focused fix attempt.

## Maintenance notes

- This is a descriptive management layer, not a financial source-quality model.
  Add CAC/ROI only after cost data is available and governed.
- Future refusal-reason analysis can extend `lossShape.reasons`; do not mix it
  into this plan unless the existing snapshot field is already cleanly exposed
  in the domain model.
