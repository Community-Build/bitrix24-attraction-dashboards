# Plan 014: Make workload heatmaps use the same metric contract as their table rows

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan
> in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 55c2005..HEAD -- packages/contracts/src/index.ts apps/api/src/domain/operational-reports.ts apps/api/test/calls-workload.test.ts apps/api/test/activities-workload.test.ts apps/web/src/lib/dashboard-types.ts apps/web/src/lib/api-client.ts apps/web/src/lib/api-client.test.ts apps/web/src/proto/live-reporting.ts apps/web/src/proto/live-reporting.test.ts apps/web/src/proto/types.ts apps/web/src/proto/scenes.tsx apps/web/src/proto/activities-scene.test.tsx`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `55c2005`, 2026-06-26

## Why this matters

The activity dashboard now shows expandable hourly heatmaps for calls, tasks,
and meetings, but the heatmap totals do not consistently mean the same thing as
the numbers in the expanded manager row. Users see rows like "16 calls" while
the heatmap badge says "30/41 total" because the row uses display-scoped call
metrics and the heatmap uses all manager call timestamps. Meetings and tasks
have related ambiguity: the grid only renders hours 09-21, while the row totals
include all events; the task heatmap is labeled generically as "Дела" even
though it currently tracks only closed tasks. This must be fixed at the API
contract level so future frontend changes cannot silently reintroduce the same
metric mismatch.

## Current state

Relevant files:

- `packages/contracts/src/index.ts` - shared DTOs for reports and heatmaps.
- `apps/api/src/domain/operational-reports.ts` - builds calls and activities
  workload report rows.
- `apps/web/src/lib/api-client.ts` and `apps/web/src/lib/dashboard-types.ts` -
  normalize and type the API response for the React app.
- `apps/web/src/proto/live-reporting.ts` - merges activities and calls reports
  into the activity scene summary rows.
- `apps/web/src/proto/scenes.tsx` - renders the expanded manager heatmaps.
- Existing tests in `apps/api/test/calls-workload.test.ts`,
  `apps/api/test/activities-workload.test.ts`,
  `apps/web/src/lib/api-client.test.ts`,
  `apps/web/src/proto/live-reporting.test.ts`, and
  `apps/web/src/proto/activities-scene.test.tsx` must be updated.

Current excerpts and evidence:

- `apps/api/src/domain/operational-reports.ts:196-211` builds a heatmap from
  `timestamps`, but `total` is incremented only when the timestamp fits the
  displayed 09-21 grid:

  ```ts
  function buildHourlyWeekdayWorkloadHeatmap(
    timestamps: Array<string | null | undefined>
  ): HourlyWeekdayWorkloadHeatmap {
    const counts = new Map<string, number>();
    let total = 0;

    for (const timestamp of timestamps) {
      const slot = parseWorkloadHeatmapSlot(timestamp);
      if (!slot || !WORKLOAD_HEATMAP_HOURS.includes(slot.hour)) {
        continue;
      }

      const key = `${slot.weekday}:${slot.hour}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
  ```

- `apps/api/src/domain/operational-reports.ts:3525` stores only one
  `callTimes` array per calls accumulator, and
  `apps/api/src/domain/operational-reports.ts:3565` pushes every call timestamp
  into it:

  ```ts
  callTimes: string[];
  ...
  accumulator.callTimes.push(call.callStartDate);
  ```

- `apps/api/src/domain/operational-reports.ts:3799` exposes the call heatmap
  from `summary.callTimes`:

  ```ts
  callsHourlyHeatmap: buildHourlyWeekdayWorkloadHeatmap(summary.callTimes),
  ```

  But `apps/web/src/proto/live-reporting.ts:531-537` uses a different display
  basis for some managers:

  ```ts
  function resolveDisplayCallSummary(
    callRow: CallsWorkloadReportSnapshot['managerRows'][number] | null,
  ) {
    return callRow?.callAttributionPolicy === 'direct_only'
      ? (callRow.linkedDealCalls ?? null)
      : callRow
  }
  ```

  This is the direct cause of the user-visible mismatch for direct-only
  managers such as `Аделия Космасова` and `Мария Саличева`.

- `apps/api/src/domain/operational-reports.ts:2180-2188` records closed task
  timestamps but not created task timestamps:

  ```ts
  if (metric === "created") {
    current.createdCount += 1;
  } else if (metric === "rescheduled") {
    current.rescheduledCount += 1;
  } else {
    current.closedCount += 1;
    if (occurredAt) {
      current.closedTaskTimes.push(occurredAt);
    }
  }
  ```

  The UI label at `apps/web/src/proto/scenes.tsx:5536-5539` says
  `Дела по часам`, which is ambiguous because the visible summary row also
  contains `Создано задач`.

- `apps/api/src/domain/operational-reports.ts:2235-2237` increments
  `meetingCount` for all meeting events but the heatmap at
  `apps/api/src/domain/operational-reports.ts:2317` counts only events in
  hours 09-21 because of the generic builder.

Observed local API evidence after a successful delta sync on 2026-06-26:

| Manager | Calls display outgoing | Calls heatmap total | Created tasks | Closed tasks | Tasks heatmap total | Meetings count | Meetings heatmap total |
|---------|------------------------|---------------------|---------------|--------------|---------------------|----------------|------------------------|
| Аделия Космасова | 16 | 41 | 28 | 7 | 7 | 0 | 0 |
| Мария Саличева | 28 | 62 | 28 | 10 | 10 | 1 | 1 |
| Какулия Илья | 268 | 292 | 401 | 368 | 368 | 16 | 12 |
| Потапова Мария | 80 | 107 | 67 | 80 | 75 | 14 | 6 |
| Кузнецова Анастасия | 197 | 253 | 239 | 226 | 217 | 36 | 35 |

Repo conventions to honor:

- `AGENTS.md` requires reports to stay scoped to the attraction manager
  whitelist, use local API and SQLite snapshot, and avoid raw Bitrix personal
  data in UI or persistence.
- `design.md` defines this as an operational dashboard. Use existing panel,
  badge, table, and dense report primitives; do not invent a new visual system.
- ADR `docs/adr/0001-separate-attraction-and-leadgen-products.md` keeps module
  report logic module-owned. Scope this fix to attraction workload reports; do
  not make shared platform behavior changes unless the DTO needs a generic
  field for the heatmap contract.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight --allow-dirty` | exits 0; dirty files are only this active task |
| API focused tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts test/activities-workload.test.ts` | exits 0; targeted tests pass |
| Web focused tests | `pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts src/proto/live-reporting.test.ts src/proto/activities-scene.test.tsx` | exits 0; targeted tests pass |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| Web typecheck | `pnpm --filter @bitrix24-reporting/web typecheck` | exits 0 |
| Workspace lint | `pnpm lint` | exits 0 |

The local environment may warn that Node `v20.17.0` is below the repo engine
`>=24 <25`; do not ignore actual failures, but the warning alone is not a plan
blocker in this local branch.

## Scope

**In scope**:

- `packages/contracts/src/index.ts`
- `apps/api/src/domain/operational-reports.ts`
- `apps/api/test/calls-workload.test.ts`
- `apps/api/test/activities-workload.test.ts`
- `apps/api/test/service.test.ts` if expected DTO snapshots need updates
- `apps/api/test/telegram-activity-report.test.ts` if test fixtures require
  new heatmap fields
- `apps/web/src/lib/dashboard-types.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/api-client.test.ts`
- `apps/web/src/proto/types.ts`
- `apps/web/src/proto/live-reporting.ts`
- `apps/web/src/proto/live-reporting.test.ts`
- `apps/web/src/proto/scenes.tsx`
- `apps/web/src/proto/activities-scene.test.tsx`

**Out of scope**:

- Sync/import logic, Bitrix REST client, SQLite schema migrations, and
  production data changes.
- Leadgen reports.
- Manager whitelist policy changes.
- Raw Bitrix payload persistence or any contact/deal personal data changes.
- Changing the requested heatmap axes: keep weekdays as columns and hours
  09:00-21:00 as rows.

## Git workflow

- Work on the existing feature branch `codex/calls-meetings-heatmap` unless the
  operator explicitly asks for a fresh branch.
- Do not commit, push, or open a PR unless instructed.
- Do not delete or overwrite local SQLite files.

## Steps

### Step 1: Make the heatmap DTO explicit about basis and off-grid events

Update `HourlyWeekdayWorkloadHeatmap` in `packages/contracts/src/index.ts` and
mirrored web types in `apps/web/src/lib/dashboard-types.ts` to distinguish:

- the metric basis label, for example `basis: "outgoing_calls" |
  "created_tasks" | "closed_tasks" | "meetings"` or a small object with
  `key` and `label`;
- `total`: total events in the selected metric basis, including events outside
  the visible 09-21 grid;
- `gridTotal`: total events represented by visible cells;
- `outsideGridTotal`: events excluded from visible cells because their hour is
  outside 09-21 or timestamp parsing failed.

Keep `cells`, `hours`, `weekdays`, and `peak` for UI rendering. If preserving
backward compatibility is needed, default missing `gridTotal` to the sum of
cells and missing `outsideGridTotal` to `max(total - gridTotal, 0)` in the web
normalizer.

**Verify**:
`pnpm --filter @bitrix24-reporting/web typecheck` and
`pnpm --filter @bitrix24-reporting/api typecheck` may fail until later steps,
but the new fields should be syntactically valid and imported consistently.

### Step 2: Change the API heatmap builder to count all selected metric events

In `apps/api/src/domain/operational-reports.ts`, change
`buildHourlyWeekdayWorkloadHeatmap` so it accepts a metric basis and counts
all provided timestamps in `total`, while only visible 09-21 timestamps affect
`cells`, `gridTotal`, and `peak`.

Target behavior:

- `total === timestamps.length` after filtering out only null/blank/invalid
  timestamps according to an explicit rule;
- `gridTotal === sum(cells.count)`;
- `outsideGridTotal === total - gridTotal`;
- `peak` is still selected from visible cells only.

Add a focused API unit test proving an event at 22:00 is counted in `total` and
`outsideGridTotal` while not producing a visible 22:00 row.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts test/activities-workload.test.ts`
should reach the expected failing state if later steps are not yet implemented,
then pass after all API changes are complete.

### Step 3: Build call heatmaps from the same call population as the visible row

In calls workload accumulators, stop using one ambiguous `callTimes` array.
Track timestamp arrays by metric population:

- all calls;
- outgoing calls;
- linked deal calls;
- linked outgoing calls;
- excluded-by-policy calls if needed for diagnostics only.

For the activity summary heatmap, use the same display population as the row:

- for `callAttributionPolicy !== "direct_only"`, the primary visible call
  column is outgoing calls, so the heatmap should use outgoing call timestamps;
- for `callAttributionPolicy === "direct_only"`, the heatmap should use linked
  outgoing call timestamps, matching the visible direct-only row basis.

Set the heatmap basis label to `Исходящие звонки` or equivalent. Do not use all
incoming+outgoing calls unless the UI also adds a visible "Всего звонков" row
metric with the same basis.

Add regression tests:

- direct-only manager with linked outgoing calls, excluded fallback calls, and
  incoming calls; visible outgoing count and heatmap `total` must match;
- standard manager with outgoing and incoming calls; heatmap `total` must match
  outgoing calls, not all calls;
- one outgoing call outside 09-21; heatmap `total` must include it and
  `outsideGridTotal` must report it.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts`
passes.

### Step 4: Split task heatmaps into created and closed task bases

In activities workload accumulators, add `createdTaskTimes` alongside
`closedTaskTimes`. When `recordEvent(..., "created")` is called, pass and store
the created timestamp. Keep `closedTaskTimes` for completed tasks.

Expose two heatmaps:

- `createdTasksHourlyHeatmap` with basis `Созданные задачи`;
- `closedTasksHourlyHeatmap` with basis `Закрытые задачи`.

If the UI must remain compact, render both cards, or render one segmented pair
inside the expanded row. Do not keep the generic title `Дела по часам` unless it
visibly states which metric it means.

Add tests:

- created count differs from closed count; each heatmap total matches its own
  count;
- off-grid created/closed task timestamps are reflected in `outsideGridTotal`.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/activities-workload.test.ts`
passes.

### Step 5: Make meeting heatmap totals honest for the 09-21 grid

Keep the visible grid hours 09-21. Change meeting heatmap semantics so
`meetingsHourlyHeatmap.total` equals `meetingCount` for the selected report
range, and `gridTotal`/`outsideGridTotal` explain how many are visible inside
the grid.

The UI card must not show a badge that can be read as "total meetings in the
row" while silently dropping off-hour meetings. Use copy such as:

- `всего 14`;
- `в сетке 6`;
- `вне 09-21: 8` when `outsideGridTotal > 0`.

Add a test with a meeting at 22:00: `meetingCount === heatmap.total`,
`gridTotal` excludes it, and `outsideGridTotal === 1`.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/activities-workload.test.ts`
passes.

### Step 6: Normalize the new DTO fields in the web client

Update `apps/web/src/lib/api-client.ts` so missing heatmap fields from older
responses are normalized safely:

- `basis` defaults to a neutral label if missing;
- `gridTotal` defaults to the sum of cells;
- `outsideGridTotal` defaults to `Math.max(total - gridTotal, 0)`.

Update `apps/web/src/lib/api-client.test.ts` to assert preservation of:

- basis labels;
- `total`;
- `gridTotal`;
- `outsideGridTotal`;
- created and closed task heatmaps separately.

**Verify**:
`pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts`
passes.

### Step 7: Render the cards with precise labels and mismatch-safe badges

Update `apps/web/src/proto/scenes.tsx` and `apps/web/src/proto/types.ts`:

- Rename the calls card to `Исходящие звонки по часам` if it uses outgoing
  calls.
- Replace `Дела по часам` with separate `Созданные задачи по часам` and
  `Закрытые задачи по часам`, or an equally explicit compact control.
- Meeting card should show total/grid/outside-grid counts clearly.
- `HourlyWeekdayHeatmap` should render:
  - `всего X` from `heatmap.total`;
  - `в сетке Y` when `gridTotal !== total`;
  - `вне 09-21: Z` when `outsideGridTotal > 0`.

Keep the dashboard design system: panels, badges, restrained colors, and dense
tables. Do not introduce a new visual language.

**Verify**:
`pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/activities-scene.test.tsx src/proto/live-reporting.test.ts`
passes.

### Step 8: Add end-to-end regression coverage around the summary mapper

Update `apps/web/src/proto/live-reporting.test.ts` so the mapper carries the
correct heatmap basis into `ActivitySummaryRow`. Cover at least:

- direct-only calls use linked/outgoing basis;
- task rows carry both created and closed task heatmaps;
- meetings preserve `outsideGridTotal`.

Update `apps/web/src/proto/activities-scene.test.tsx` to click an expanded row
and assert the visible labels do not say generic "Звонки" or "Дела" when the
metric basis is narrower.

**Verify**:
`pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/live-reporting.test.ts src/proto/activities-scene.test.tsx`
passes.

### Step 9: Run final checks and inspect the live local report

Run the focused checks first, then broader checks if the focused checks pass:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts test/activities-workload.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts src/proto/live-reporting.test.ts src/proto/activities-scene.test.tsx
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/web typecheck
pnpm lint
```

If a local server is available, open `http://127.0.0.1:5173/`, expand at least
one manager with direct-only call attribution and one manager with off-hour
meetings. Confirm visually:

- call card total matches the call metric named in the row/card;
- created and closed task cards are not conflated;
- meeting card explains off-grid counts instead of making the row and card
look contradictory.

**Verify**:
All commands exit 0. Manual browser QA confirms the mismatch no longer appears
for `Аделия Космасова`, `Мария Саличева`, `Какулия Илья`, and `Потапова Мария`
on the restored local snapshot.

## Test plan

New or updated tests:

- `apps/api/test/calls-workload.test.ts`
  - direct-only call heatmap uses linked outgoing calls, not all calls;
  - standard call heatmap uses outgoing calls if the UI label says outgoing;
  - off-grid calls are included in `total` and `outsideGridTotal`.
- `apps/api/test/activities-workload.test.ts`
  - created task heatmap total matches `createdCount`;
  - closed task heatmap total matches `closedCount`;
  - meeting heatmap total matches `meetingCount`, with off-grid events reported
    separately.
- `apps/web/src/lib/api-client.test.ts`
  - normalizes and preserves new heatmap metadata.
- `apps/web/src/proto/live-reporting.test.ts`
  - carries correct heatmap bases to scene rows.
- `apps/web/src/proto/activities-scene.test.tsx`
  - expanded manager row renders explicit labels and total/grid/outside badges.

Use the existing tests in these files as the structural pattern. Keep tests
small and data-driven; do not hit live Bitrix.

## Done criteria

All must hold:

- [x] `callsHourlyHeatmap.total` no longer counts all calls when the visible
      card/row is about outgoing or linked outgoing calls.
- [x] Direct-only managers use linked call timestamps for the visible call
      heatmap basis.
- [x] Task heatmaps distinguish created tasks from closed tasks, or the UI
      renders only a closed-task heatmap with a label that cannot be confused
      with created tasks. Preferred: render both.
- [x] Meeting heatmap `total` equals `meetingCount`; off-grid meetings are
      reported via `outsideGridTotal`.
- [x] Heatmap badges make clear when visible cells cover only 09-21.
- [x] Focused API and web tests pass.
- [x] API and web typechecks pass.
- [x] `pnpm lint` exits 0.
- [x] No files outside the in-scope list are modified except `plans/README.md`
      status update if the executor updates it.

## STOP conditions

Stop and report back if:

- Product ownership rejects the chosen calls basis. If the desired calls
  heatmap is "all calls", the table must also expose an "all calls" metric; do
  not mix all-call heatmaps with outgoing-call row numbers.
- Fixing the mismatch appears to require changing sync/import semantics or
  SQLite schema. This plan is report DTO and presentation only.
- You discover a manager row where the display metric cannot be derived from
  the report accumulators without raw Bitrix payloads. Do not add raw payload
  persistence.
- The in-scope code has drifted enough that the excerpts above no longer match.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Future workload cards must declare their metric basis in the DTO. Do not add
  another heatmap from raw timestamp arrays without a named basis and
  total/grid/off-grid semantics.
- Reviewers should compare every heatmap badge against the visible row metric
  it claims to explain. If the two are intentionally different, the UI must say
  so explicitly.
- The 09-21 grid is a display decision from the user request. It should not
  silently change report totals; use `gridTotal` and `outsideGridTotal` to keep
  both truths visible.
