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
- Full suites, CI, production rollout and live data/load/concurrent-sync checks
  were not run. Before rollout verify Node >=24.10 inside the actual image and
  measure projection preparation on a representative snapshot: copying all
  projected tables shares the five-second deadline and 128 MiB SQLite heap cap.

Source isolation: copy explicitly selected analytical columns and scoped rows
from a read-only source transaction into a disposable in-memory database in a
child process. Detach the source before any caller SQL runs. SQLite authorization,
row/byte limits, native heap limit, a deadline and bounded concurrency protect the
query process and the API. No SQL regex is an access-control boundary.

Deploy, credential changes and production writes are outside this local task.
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
