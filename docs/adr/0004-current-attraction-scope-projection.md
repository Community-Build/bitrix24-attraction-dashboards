# ADR 0004: Reconciled current attraction scope

## Status

Accepted

## Context

Attraction reporting needs two different views of the same Bitrix deal:

- historical evidence that the deal entered and progressed through attraction;
- current membership in the attraction category and manager whitelist.

The Bitrix delta sync applies the current category and manager filters before
returning changed deals. A deal that moves to another category, is reassigned
outside the whitelist, or is deleted therefore disappears from later delta
responses. The local SQLite snapshot only upserts returned deals, so its last
attraction category can be mistaken for current Bitrix state.

Deleting or rewriting the retained deal snapshot would repair current reports
at the cost of changing historical cohort denominators and facts. Treating
warm-up as another attraction category would broaden the product boundary and
still would not detect deleted deals.

## Options

1. Delete local snapshots absent from the normal delta.
2. Expand the attraction sync to warm-up or to portal-wide deal changes.
3. Add a generic membership lifecycle with intervals and exit reasons.
4. Keep retained attraction snapshots and materialize one reconciled projection
   of the IDs currently in attraction scope.

## Decision

Use option 4.

`deal_snapshots` remains the retained last-known attraction snapshot used by
historical reports and fact builders. A dedicated
`attraction_current_deal_ids` projection records which deal IDs are currently
inside the configured attraction categories and manager whitelist.

The projection is replaced only after a complete, paginated, non-delta Bitrix
scope inventory succeeds. Replacement, snapshot upserts, and the scope
freshness marker commit atomically. A partial or failed inventory leaves the
previous projection and reconciliation cursor unchanged.

Current-state consumers must intersect retained snapshots with the reconciled
ID set. Historical consumers must continue to select retained snapshots and
facts by their period and cohort contracts. Mixed reports receive both views
and classify each metric explicitly.

The inventory may return only non-personal operational fields needed to verify
freshness (`ID`, `CATEGORY_ID`, `ASSIGNED_BY_ID`, `STAGE_ID`, and
`DATE_MODIFY`). If a current ID has a newer or different operational projection
than SQLite, the normal allowlisted detail read refreshes it before the current
scope is published.

The existing sync-state storage owns the last successful reconciliation time.
An empty initialized scope is distinct from an uninitialized scope.

## Consequences

- Category moves, manager-scope exits, deletions, and re-entry can be reflected
  without deleting historical evidence.
- Operational risks, open WIP, planned work, and current-manager diagnostics
  use the current projection.
- Attraction creation cohorts, completed outcomes, conversion facts, revenue,
  and historical touchpoints retain their existing historical inputs.
- The operational dashboard must stop using one prefiltered deal list for both
  current and historical metrics.
- Audit must compare both set directions and report Bitrix-only and local-only
  IDs.
- Sync diagnostics must expose reconciliation freshness and counts. A failed
  inventory must be visible rather than represented as a successful current
  snapshot.
- This decision adds one attraction-specific projection, not a generic
  multi-module or multi-scope framework.

## Rollout And Rollback

The schema change is additive. Production rollout requires:

1. a SQLite backup;
2. a successful shadow inventory and bidirectional comparison;
3. initial projection population;
4. current-reader activation;
5. verification that known stale IDs are absent and historical report
   denominators are unchanged.

Rollback disables the current-projection reader and leaves retained snapshots
and the additive table intact.

## Revisit Conditions

Reconsider a full membership lifecycle only when the product requires one of:

- overlapping or multiple approved reporting scopes;
- exact entry/exit intervals;
- classified cross-funnel handoff reporting;
- historical ownership as-of arbitrary dates;
- an audited business requirement for exit reasons.
