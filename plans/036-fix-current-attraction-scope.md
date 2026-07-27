# Plan 036: Fix current attraction scope reconciliation

## Status

- **Priority**: P0
- **State**: DONE
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 027
- **Issue**: https://github.com/Community-Build/bitrix24-attraction-dashboards/issues/139
- **Category**: correctness

## Goal

Make current operational reporting follow the complete live Bitrix attraction
scope while retaining historical attraction snapshots and facts.

## Scope

- Bitrix current-scope inventory using non-personal operational fields.
- Additive SQLite current-ID projection and freshness state.
- Atomic sync reconciliation independent of the modified-after delta.
- Explicit current versus historical inputs in the operational report.
- Current owner/activity/call refresh scopes based on reconciled membership.
- Bidirectional attraction-scope audit and diagnostics.
- Migration, repository, sync, service, operational, audit, and HTTP tests.
- Production backup, one-time reconciliation, deploy, and live verification.

## Non-Goals

- Changing Bitrix automation that currently moves a deal ID to warm-up.
- Importing or reporting warm-up as an attraction category.
- A generic membership interval, tombstone, or exit-reason framework.
- Deleting retained snapshots, history, activities, calls, or analytics facts.
- Direct Bitrix reads during dashboard rendering.

## Contracts

- Live Bitrix category plus configured manager whitelist is authoritative for
  current membership.
- SQLite snapshots and facts are authoritative for retained attraction history.
- A complete inventory may replace `attraction_current_deal_ids`; a partial or
  failed inventory may not mutate it or advance reconciliation state.
- Current metrics use current IDs; historical metrics use retained facts.
- The first successful inventory initializes the projection atomically. Before
  initialization, current endpoints expose unavailable/stale state rather than
  interpreting an empty table as zero deals.
- No deal names, contact data, phones, email, or other PII enter the inventory.

## Work Packets

1. **Storage**
   - Owns SQLite schema, repository interfaces, replace/read methods, and
     freshness state.
   - Verify additive migration, empty initialized scope, atomic rollback, and
     retained snapshot behavior.
2. **Sync**
   - Owns complete inventory, freshness mismatch refresh, reconciliation order,
     and current owner IDs.
   - Verify move, reassignment, deletion, re-entry, empty delta, and partial
     failure.
3. **Reporting**
   - Owns current/historical metric classification and explicit current ID
     input.
   - Verify stale IDs cannot produce risk/WIP/planned work while retained rows
     still contribute to historical period metrics.
4. **Audit and diagnostics**
   - Owns both set directions, freshness/count output, and HTTP exposure.
   - Verify `missing_local_deal`, `extra_local_deal`, and mismatch summaries.
5. **Release**
   - Owns full checks, diff review, commit, PR/CI, production backup, deploy,
     reconciliation, and rollback evidence.

## Validation

- `pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts test/sync.test.ts test/service.test.ts test/operational-dashboard.test.ts test/audit-attraction-scope.test.ts test/http.test.ts`
- `pnpm --filter @bitrix24-reporting/api test`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm ontology:validate`
- `git diff --check`

## Stop Conditions

- The inventory cannot prove complete pagination.
- Current/historical classification changes a historical denominator without an
  accepted report-contract decision.
- Production reconciliation would require replacing the SQLite database.
- Existing user changes appear in an owned file and cannot be separated.
- Bitrix inventory requires new PII or broader webhook permissions.

## Release Evidence

- PR [#140](https://github.com/Community-Build/bitrix24-attraction-dashboards/pull/140)
  merged as `6eb834bbb9c8c5b1a47b5ee38056c62cd0e0fbc2`.
- GitHub Actions
  [Deploy Production run 30251188774](https://github.com/Community-Build/bitrix24-attraction-dashboards/actions/runs/30251188774)
  completed successfully.
- A consistent pre-migration SQLite backup was created at
  `/opt/bitrix24-reporting/data/backups/production-ops/bitrix24-attraction-pre-current-scope-20260727T084542Z.db`;
  its `integrity_check` returned `ok`.
- Production sync run `1305` completed successfully at
  `2026-07-27T08:52:46.749Z`. It reconciled `3,619` current IDs and refreshed
  `13` changed snapshots.
- A fresh paginated Bitrix inventory and the SQLite projection both contained
  `3,619` IDs. Bitrix-only and projection-only differences were both `0`.
- In the Olga Romashova slice, current risks changed from `89` to `45` and
  `Без дел` from `14` to `0`; none of the screenshot deal IDs remained in the
  current risk feed.
- The seven investigated rows remain in retained snapshots but not in the
  current projection. Database counts remained `4,228` deals, `68,835`
  activities, and `17,917` calls, with `integrity_check=ok`.

## Done Criteria

- Known moved/deleted IDs cannot enter current risks.
- Current-scope set difference is zero after production reconciliation.
- Historical cohort and fact regression tests retain their expected counts.
- Failed reconciliation is visible and non-destructive.
- Issue 139 is linked to a merged, deployed, production-verified change.
