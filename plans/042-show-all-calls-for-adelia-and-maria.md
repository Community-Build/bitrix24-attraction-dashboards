# Plan 042: Show all telephony calls for Adelia and Maria

> Tracked by GitHub issue #147.

## Outcome

Use the full synchronized Bitrix telephony population for the primary call
metrics and outgoing-call heatmap of Maria Salicheva (`7538`) and Adelia
Kosmasova (`118`), while keeping deal-linked and funnel metrics restricted to
Attraction deals.

## Scope And Non-goals

In scope: decouple workload display from deal attribution, give the two managers
an explicit `all_calls` display policy while retaining `direct_only` deal
attribution, preserve the existing `allCalls` / `linkedDealCalls` split, update
regression tests and the Attraction reporting contract, and deploy the policy
change.

Not in scope: expanding the manager whitelist, attributing non-deal calls to an
Attraction stage, changing deal funnel or SLA calculations, expanding call
recording/analysis authorization, changing employee access, rewriting the
telephony sync, or importing phone numbers and other personal data.

## Sources And Authority

- Product-owner decision recorded on 2026-08-09.
- GitHub issue #147.
- Current manager catalog, call workload builder, report service, sync source,
  and Activities web adapter.
- Sanitized production call snapshots and `/api/reports/calls-workload` output.
- Historical rationale in plans 006 and 014, superseded only for the display
  population of managers `118` and `7538`.

## Decisions Already Made

- The primary Activities call metrics for both managers use all synchronized
  telephony calls in the selected range, matching the existing standard policy.
- `linkedDealCalls`, deal count, calls-per-deal, and stage breakdown remain a
  separate Attraction-deal population and are not inflated by unrelated calls.
- Keep `direct_only` on the two catalog rows so contact fallback cannot enter
  their deal count, calls-per-deal, or stage breakdown. Add a separate
  `callDisplayPolicy: all_calls` for the requested workload counters/heatmap.
- Do not run a backfill or database migration. Production already contains 858
  call rows for Adelia and 725 for Maria, with coverage from June 2025 through
  2026-08-07. The existing supplemental call-statistics sync is authoritative.

## Critical Unknowns

- A standalone call can have no attributable Attraction deal or stage. It must
  count in workload but remain absent from deal/stage breakdowns.
- Historical call coverage before June 2025 is not claimed. This change uses the
  available synchronized period and does not redefine retention.

## Boundaries And Contracts

- `call_snapshots` remains populated by the one-way Bitrix telephony sync using
  the enabled Attraction manager IDs. Page rendering continues to read SQLite.
- The API keeps `allCalls` as the complete manager workload and
  `linkedDealCalls` as the deal-attributable subset.
- The report builder uses `callAttributionPolicy` only for deal linkage and
  `callDisplayPolicy` for heatmaps. The web adapter uses `callDisplayPolicy` for
  primary counters, retaining the legacy `direct_only` fallback when no display
  policy is supplied.
- Attraction whitelist, team filters, role-based visibility, privacy exclusions,
  aggregate-only responses, and call-analysis deal authorization are unchanged.

## Work Packets

1. Product and report contract
   - Owns: issue #147, this plan, report registry, ontology guardrails, backlog.
   - Inputs: owner decision, production counts, plans 006 and 014.
   - Output: explicit population split and preserved security/data boundaries.
   - Dependency: production coverage audit.
   - Verification: documentation review and ontology validation.
   - Stop: if the requested scope includes recordings, transcripts, or
     non-whitelisted managers, create a separate authorization decision.
2. Manager policy change
   - Owns: `apps/api/src/domain/attraction-managers.ts` and its catalog test.
   - Input: manager IDs `118` and `7538`.
   - Output: both rows retain direct-only deal attribution and explicitly use
     the all-calls display policy.
   - Dependency: work packet 1.
   - Verification: focused catalog and service tests.
   - Stop: if either ID no longer resolves to the named manager in production.
3. Report regression coverage
   - Owns: API call-workload/service tests and web live-reporting tests.
   - Input: existing generic `direct_only` test fixtures.
   - Output: prove the two real catalog managers display all calls while generic
     direct-only behavior and linked-deal diagnostics remain supported.
   - Dependency: work packet 2.
   - Verification: focused API/web suites and contract assertions.
   - Stop: if all-call display requires widening deal or call-analysis scope.
4. Release and production proof
   - Owns: final diff, independent review, PR/CI, deployment, sanitized API/UI
     checks, issue closure evidence.
   - Input: verified implementation.
   - Output: production rows with standard policy and display values equal to
     `allCalls` for both managers.
   - Dependency: work packets 1-3.
   - Verification: full workspace checks, VPS revision/health, API before/after,
     and Activities UI inspection.
   - Stop: on CI failure, deploy failure, missing call coverage, or any widening
     of raw recording/message access.

## Validation

- API: manager catalog, call workload domain, reporting service, and HTTP tests.
- Web: live-reporting mapping and Activities scene regression tests.
- Workspace: `pnpm ontology:validate`, `pnpm test`, `pnpm typecheck`, and
  `pnpm lint` when feasible.
- Review: final source/diff inspection plus independent correctness and security
  review.
- Production: for the same range, verify the two API rows have
  `callAttributionPolicy: direct_only` and `callDisplayPolicy: all_calls`,
  primary display values equal `allCalls`, `linkedDealCalls` remains unchanged,
  and the Activities UI renders the expanded totals and heatmaps without
  console/accessibility regressions.

## Recovery And Rollback

This is a contract/catalog runtime policy change with no schema or data
mutation. Rollback removes `callDisplayPolicy: all_calls` from manager IDs `118`
and `7538`, leaving their `direct_only` deal attribution intact, and redeploys.
No SQLite restore is needed. If production coverage is unexpectedly incomplete,
revert the display policy before considering a separate, backed-up sync/backfill
task.

## Done Criteria

- Maria and Adelia use all synchronized calls in primary call metrics and the
  outgoing-call heatmap for every valid dashboard range.
- Deal counts, calls-per-deal, stage breakdown, funnel/SLA facts, whitelist,
  access, and call-analysis scope remain unchanged.
- Focused and workspace checks pass; independent findings are resolved or
  explicitly deferred.
- PR is green and merged, production deploy succeeds, VPS/API/UI evidence is
  recorded, and issue #147 is closed with the verified outcome.
