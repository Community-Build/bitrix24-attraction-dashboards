# Plan 035: Fix conversion event correctness

## Status

- **Priority**: P0
- **State**: DONE
- **Effort**: S
- **Risk**: HIGH
- **Depends on**: 034
- **Category**: correctness

## Goal

Fix three verified defects before deployment of the conversion report:

1. Count a post-event contract only for an attendee who had not reached the
   contract stage before that event; contract re-entry is not a new conversion.
2. Treat any forward-stage entry after a completed meeting, including re-entry,
   as post-meeting movement.
3. Mark an incomplete trajectory API payload unavailable instead of rendering
   absent sections as zero data.

## Scope

- Domain calculation, shared contracts, web normalization and conversion UI.
- Focused API/web regression tests and report-registry methodology.
- No period-selector changes and no deployment.

## Done Criteria

- Event rows expose an explicit contract-eligible denominator.
- Pre-event contract holders are excluded from that denominator and numerator.
- Forward-stage re-entry clears the post-meeting no-movement gap.
- Missing required trajectory sections produce `trajectoryStatus = unavailable`.
- Focused tests, typecheck and lint pass; final diff is reviewed and committed.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `git diff --check`
