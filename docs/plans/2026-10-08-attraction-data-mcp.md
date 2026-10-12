# Attraction data MCP

Owner request: expose existing attraction data for arbitrary analytical queries,
joins and report recalculation instead of requiring a predefined report ID.
First stage excludes loading lead names from Bitrix, as confirmed on 2026-10-08.
Individual deal IDs and links to Bitrix are included by the owner's follow-up.

## Scope and proof

1. Done: expose schema, relationships and parameterized read-only SQL over
   the existing attraction snapshot. Preserve the configured category/manager
   scope and exclude operational secrets, message/task/transcript text and raw
   payloads. Keep HTTP/stdio and existing report tools compatible.
2. Done: verify actual SQLite joins, quality filtering, individual deal IDs,
   window functions, scope isolation, prohibited writes, payload limits and
   cancellation. Run only focused API tests and package typecheck.
3. Done: independent security/correctness, complexity and interface reviews found
   no material actionable defects. Prepare the verified local candidate for commit.

## Verification and delivery

- Branch: `codex/attraction-data-mcp`, based on `a037ca5` from fresh `origin/main`;
  original checkout and its untracked runtime artifacts are preserved.
- `pnpm session:preflight` passed initially; `--allow-dirty` passed for this same
  active task's explicitly staged paths after fetching the base.
- 33 tests passed in `attraction-data.test.ts`, `agent-mcp-server.test.ts`,
  `agent-mcp-http.test.ts` and `attraction-agent-gateway.test.ts`. A parameterized
  query failed before the worker was implemented, then passed with the full path.
- API typecheck and lint of the nine owned TS source/test files passed.
- Contracts/API compiled builds passed. A real SDK client against the compiled
  stdio bootstrap discovered eight tools/32 tables and queried ID/Bitrix URL and
  a window count on a disposable local database.
- Security/correctness, Ponytail and boundary reviews used immutable patch
  `9af5cd01e8424a9e6e66a41e9f14e170b28f8f7fc6f62eae58b337b9a95f95b0`.
- CRG: `get_minimal_context_tool`, `detect_changes_tool`; the exact worktree graph
  is empty, so source and focused diff checks supplied the evidence.
- At the initial handoff, full suites, CI, production rollout and live
  data/load/concurrent-sync checks had not run. The live acceptance below
  subsequently verified the runtime and representative projection volume.

## Live read-only acceptance (2026-10-09)

- Production remains at `a037ca5`; its public endpoint exposes the original six
  tools. Node v24.21.0 and the mounted attraction SQLite database were verified.
  The compiled candidate ran through the MCP SDK in-memory transport inside an
  ephemeral server process. Only the worker loading location was adapted; query,
  scope and resource limits were retained. No deployed files or business data
  changed. This proves candidate execution, not public SQL-tool availability.
- Ten business questions passed without errors or truncation, covering freshness,
  population, current manager/quality, deal IDs/URLs, sources, stages, activity
  coverage, calls and identifier completeness. Schema took 44 ms; SQL took
  667–991 ms. Independent read-only source counts and cohort totals agreed.
- Six live guard checks confirmed write/private-text/source-CTE rejection, scope
  isolation, cancellation at the five-second deadline and recovery afterwards.
- Исправление конкретного случая: source binding copying exhausted the deadline
  because SQLite probed the cross product of two IN lists through its composite
  index. `NOT INDEXED` on this copy alone preserves both scope predicates and
  reduced total projection preparation from 18.23 s to 0.67 s. Also include the
  existing shared SOURCE dictionary while retaining category scope for CRM stages.
- Предотвращение повторения: two regression cases failed before the fixes and
  passed afterwards. The load fixture uses 65,000 activities, 3,800 deals and
  12,000 bindings under the unchanged reader deadline; the dictionary case also
  denies another category. All 28 cases in `attraction-data.test.ts` and
  `agent-mcp-server.test.ts`, API compiled build and owned-file lint passed.
- Two fresh independent reviews found no material delta defects in patch
  `e2326ee4f3e2cc80fe7f5fb32bb21f07477d5d38fb1412f868df5514d94b3652`.
- `pnpm session:preflight --allow-dirty` passed after inspecting this task's diff.
  CRG: `get_minimal_context_tool`, `detect_changes_tool`; graph stale relative to
  the candidate, so exact source/diff and execution supplied the evidence.
- Public rollout, CI/full suites and concurrent-sync acceptance remain unchecked.
  Scan cost at larger future volumes or different SQLite versions is unmeasured;
  preparation still shares the five-second deadline and 128 MiB SQLite heap cap.
  Raw acceptance responses remain outside Git; no snapshots or identifiers are
  committed as evidence.

Source isolation: copy explicitly selected analytical columns and scoped rows
from a read-only source transaction into a disposable in-memory database in a
child process. Detach the source before any caller SQL runs. SQLite authorization,
row/byte limits, native heap limit, a deadline and bounded concurrency protect the
query process and the API. No SQL regex is an access-control boundary.

The owner authorized public SQL publication on 2026-10-12. Deploy is now in
scope; credential changes and business-data writes remain outside scope.
Rollback is removing the two new data tools; existing report and knowledge tools
remain available. No production schema migration or data backfill is needed.

## Data limits

`date_create`, current `assigned_by_id` and current `quality_value` do not prove
the initial delivery timestamp, recipient or quality. Absent historical facts or
lead names must stay absent rather than be reconstructed as confirmed data.

## Bug tracks

- Исправление конкретного случая: remove the fixed-report dependency for custom
  analytical questions through schema and SQL tools; prove manager/source/quality
  aggregation and individual IDs on a fixture database.
- Предотвращение повторения: deny unprojected tables/columns by construction and
  test scope bypasses, writes, CTE shadowing, unknown columns, limits and timeout.
  Existing predefined-report handler/filter defects are not repaired by this task.

## Public publication (2026-10-12, in progress)

- Outcome: existing recipient token discovers schema and executes scoped SQL
  on the public MCP endpoint; update the private combined Codex instruction
  only after real public queries pass.
- Fresh session preflight passed, branch is based on current `origin/main`.
  All 35 focused API cases passed again. Existing feature reviews are reused.
- Restrict this exact MCP file packet to four API test files and focused release
  script tests in CI; preserve the default checks for unrelated changes.
- Build one Docker release image on the existing VPS deployment path, activate
  it by immutable image ID and run public SQL acceptance on those same bytes.
  Retain and restore the prior image without rebuilding; no DB migration.
- Paired platform record: reconcile the current source-runtime observation and
  document the read-only analytical MCP contract; no migration or ingress change.
- Исправление конкретного случая: publish the missing SQL tools through PR,
  green checks, main and Deploy Production; verify schema, joins and deal URLs.
- Предотвращение повторения: recipient readiness depends on an actual public
  schema/query call; CI scope and immutable rollback get focused regressions.
- Remaining steps: independent release delta review; commit/push/PR; green CI and
  deploy; live auth/scope/query checks and private prompt update.
