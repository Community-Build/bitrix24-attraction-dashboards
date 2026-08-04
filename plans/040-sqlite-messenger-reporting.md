# Plan 040: SQLite-backed messenger reporting

> Completed locally on 2026-08-04. Production deployment remains out of scope.

## Outcome

Make the Activities messenger block behave like the other reports: it loads
automatically, follows the common manager/date filter, reads the local SQLite
snapshot, and exposes stored full text through a separate leader-only reader.

## Scope And Non-goals

In scope: additive SQLite tables, normal-sync Open Lines ingestion, exact
message-time filtering, actual-author outgoing attribution, cached summary and
reader APIs, validated attachment lookup, automatic UI loading, documentation,
tests, and a recoverable local backfill.

Not in scope: production deploy, provider writeback, new AI scoring, message
retention/deletion automation, exposing text to MCP/comments/notifications,
contact identity persistence, or resolving OLChat/Umnico direction without
provider evidence.

## Sources And Authority

- Product-owner decision in the 2026-08-04 dashboard review.
- [ADR 0006](../docs/adr/0006-persist-messenger-messages-for-analysis.md).
- [Module ontology](../docs/modules/attraction/MODULE_ONTOLOGY.md).
- [Message evidence](../docs/modules/attraction/MESSAGE_METRICS_RESEARCH.md).
- Current Bitrix Open Lines adapter and attraction SQLite repository.

## Decisions Already Made

- Reuse the attraction SQLite database; do not create a second database file.
- Store cleaned and original body text plus stable IDs and parsed metadata.
- Retain system rows for audit but exclude them from business totals.
- Credit outgoing messages only to a resolved message author. Keep ambiguous
  outgoing author and unsupported direction as explicit buckets.
- Summary, reader, and collect compatibility routes read SQLite only.
- Attachment bytes remain transient and require exact cached relation checks.

## Critical Unknowns

- OLChat/Umnico direction is unknown until a provider-specific signal is proven.
- A formal retention period is not yet defined; revisit through ADR 0006.
- The initial local/production backfill duration depends on Open Lines session
  volume and Bitrix response latency.

## Boundaries And Contracts

- `messenger_session_snapshots` owns session/deal/channel sync state.
- `messenger_message_snapshots` owns message body, author, direction, attachment
  IDs, and timestamp. A refreshed session replaces its message set atomically.
- Dedicated cursor advances only after all discovered histories succeed.
- Reporting range uses each message timestamp, inclusive of common filter
  boundaries.
- Leader access remains mandatory for summary, reader, and attachment routes.
- Aggregate HTTP responses never contain body text or raw provider payloads.

## Work Packets

1. Storage and mapping
   - Owns: messenger domain mapping, SQLite schema/repository, repository tests.
   - Output: idempotent schema, indexed date/manager queries, authoritative
     session replacement, raw/clean text persistence.
   - Stop: no structured contact fields or raw payload column is introduced.
2. Sync integration
   - Owns: message sync service and normal reporting sync hook.
   - Output: lookback backfill, delta cursor, bounded history concurrency,
     partial-failure retry behavior, deal-manager reconciliation.
   - Stop: one failed Open Lines session must not destroy prior cached data.
3. Cached API
   - Owns: collection/report service and HTTP contracts.
   - Output: actual-author totals, unknown-author bucket, exact-range reader,
     cached attachment validation.
   - Stop: summary JSON must not contain message text.
4. Activities UI
   - Owns: messenger section, reader copy, web types/normalizers/tests.
   - Output: no calculate button; automatic mount/filter reload; explicit
     selected period; separate unknown-author metric; separate reader.
   - Stop: no direct Bitrix call or client-side attribution logic.
5. Durable contracts and verification
   - Owns: ADR, project map, ontology, report registry, backlog, runtime registry,
     old-plan supersession notes, tests, local backup/backfill, browser proof.

## Validation

- API: collection, sync, SQLite, HTTP, service, and Bitrix adapter tests.
- Web: Activities automatic reload, reader, attachment, and API normalization.
- Workspace: typecheck, lint, ontology validator, relevant/full Vitest suites.
- Runtime: back up local DB, run normal sync, compare SQLite/API counts for a
  day/week/month, verify the selected-period label and reader in the browser.
- Review: CRG changed-file context plus final diff/status inspection.

## Recovery And Rollback

The schema is additive and the implementation is isolated in one commit. Code
rollback stops reading/writing the new tables without changing existing report
tables. Before local or production backfill, copy the SQLite database and its
WAL state through a safe SQLite backup operation. Never replace production DB
with a local file.

## Done Criteria

- No manual calculate button remains.
- A date/manager filter change triggers exactly one cached summary request.
- July/week/day ranges return messages filtered by message timestamp.
- The overall sent and unique-dialog/deal totals include both confirmed and
  unknown-author outgoing rows; per-manager attribution uses only the actual
  resolved author and never credits ambiguity to the deal owner.
- Full text survives SQLite round-trip and only appears in the leader reader.
- Targeted/full checks pass, local backfill is verified, docs match runtime,
  and the branch has one focused completion commit. Browser inspection is
  required when the in-app browser connection is available; automated UI tests
  and production build are the recorded fallback. Push/deploy remain unperformed.

## Completion Evidence

- Consistent pre-backfill SQLite backup:
  `apps/api/data/backups/bitrix24-attraction-pre-messenger-20260804T1917.db`;
  `PRAGMA integrity_check = ok`.
- Local sync run `56` populated `341` sessions and `6,758` stored events; the
  oldest/newest timestamps were `2025-08-04T17:55:22+03:00` and
  `2026-08-04T18:26:00+03:00`.
- Cached range proof: day `39` messages / `25` outgoing, week `181` / `88`,
  July `890` / `344`; July outgoing split is `166` confirmed-author plus `178`
  unknown-author, across `67` unique dialogs and `64` deals.
- Summary requests completed in about `23-25 ms`; reader returned stored text,
  and a scoped real attachment returned `200` with a `7,290,729` byte payload.
- Full API suite: `64` files / `635` tests. Full web suite: `14` files / `187`
  tests. Workspace typecheck, lint, ontology validation, and build passed.
- Ponytail review found optional deletion opportunities only. Architecture
  review found and fixed one current-scope attachment access mismatch; the
  SQLite regression test now proves an out-of-scope message is unavailable.
- CRG review completed with `get_minimal_context_tool`, `detect_changes_tool`,
  and `get_review_context_tool`. The in-app browser connection exposed no tabs,
  so manual rendered inspection remains the sole verification limitation.
