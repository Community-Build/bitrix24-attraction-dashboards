# Plan 033: Fix conversion trajectory review findings

> **Executor instructions**: Follow this plan before production deploy of the
> "Конверсии" trajectory layer. Run every verification command and keep fixes
> inside the existing `/api/reports/source-cohort-conversion` report.

## Status

- **Priority**: P0
- **State**: DONE
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 029, 030, 031, 032
- **Category**: correctness
- **Planned at**: branch `codex/conversion-trajectory-prototype`, 2026-07-08

## Goal

Make the conversion trajectory report safe for ROP-level decisions: no
impossible conversion percentages, no silent missing trajectory contract, no
ambiguous call attribution, and no hidden data-quality caveats.

## Files

- Modify: `apps/api/src/domain/source-cohort-trajectory.ts`
- Modify: `apps/api/test/source-cohort-trajectory.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/proto/source-cohort-trajectory-section.tsx`
- Modify: `apps/web/src/proto/source-cohort-trajectory-manager-diagnostics.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `docs/modules/attraction/REPORT_REGISTRY.md`
- Modify: `plans/README.md`

## Acceptance Criteria

- Fact-step "from previous" rates never exceed `100%` and are marked as
  conditional intersections when steps are not nested.
- First successful call primary numerator uses direct/high-confidence deal
  facts. Medium contact fallback is exposed as a data-quality caveat, not mixed
  into the direct numerator.
- `trajectory` is not silently accepted as `{}`. The API contract either
  contains a complete trajectory or the UI receives an explicit unavailable
  state.
- Stage identity for meeting, contract, loss, and won stages is based on stable
  stage IDs/semantics from the stage catalog. Russian name matching is only a
  fallback.
- Initial stage dwell time is counted from `deal.dateCreate` when Bitrix history
  starts after creation.
- `N < 10` rows are marked as low sample and cannot be used for hard ranking.
- Customer/business-club slice carries a coverage warning when the customer
  field is mostly missing.
- UI tooltips and table controls are keyboard/touch readable, and the wide
  table keeps the subject column visible while scrolling.

## Tasks

1. Add failing API tests for the five methodology regressions:
   impossible previous-step rates, medium fallback calls, sample threshold,
   missing initial dwell, and stable stage identity.
2. Implement the domain fixes in `source-cohort-trajectory.ts`.
3. Tighten contract and web normalizer so incomplete trajectory payloads are
   explicit, not silently rendered.
4. Fix the conversion trajectory UI copy, tooltip semantics, focus-visible
   states, and wide-table readability.
5. Update report registry and plan index.
6. Run:
   - `corepack pnpm@10.9.0 --filter @bitrix24-reporting/api exec vitest run test/source-cohort-trajectory.test.ts`
   - `corepack pnpm@10.9.0 --filter @bitrix24-reporting/web exec vitest run src/App.test.tsx`
   - `corepack pnpm@10.9.0 --filter @bitrix24-reporting/api test -- --runInBand`
   - `corepack pnpm@10.9.0 --filter @bitrix24-reporting/web exec vitest run`
   - `corepack pnpm@10.9.0 typecheck`
   - `corepack pnpm@10.9.0 lint`
7. Verify locally in the browser on `http://127.0.0.1:5173/`:
   - "Конверсии" tab opens.
   - June 2026 cohort loads.
   - No visible rate is over `100%`.
   - "Первый успешный звонок" is explained as direct/high-confidence outgoing
     connected call longer than 30 seconds.
   - Manager/source/customer table keeps the left subject visible when scrolled.

## Completion Evidence

- `corepack pnpm@10.9.0 --filter @bitrix24-reporting/api exec vitest run test/source-cohort-trajectory.test.ts test/source-cohort-conversion.test.ts`:
  18 tests passed.
- `corepack pnpm@10.9.0 --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts src/App.test.tsx`:
  53 tests passed.
- `corepack pnpm@10.9.0 --filter @bitrix24-reporting/api test -- --runInBand`:
  58 files / 587 tests passed.
- `corepack pnpm@10.9.0 --filter @bitrix24-reporting/web exec vitest run`:
  10 files / 167 tests passed.
- `corepack pnpm@10.9.0 -r typecheck`: passed for contracts, proto, web, and
  api.
- `corepack pnpm@10.9.0 -r lint`: passed for contracts, proto, web, and api.
- Browser smoke on `http://127.0.0.1:5173/`: logged in with the local smoke
  user, "Конверсии" opens, old visible strings `Конверсия источников`,
  `Desktop only`, `Live API`, `Comment mode`, `connected=true`,
  `overThirtySeconds`, `owner-layer`, `WIP`, `fallback`, and `forward` are
  absent, first-call/repeat-events/CRM-stage-without-fact/stuck-after-meeting
  methodology is available in header hints, the trajectory table uses the
  `Проигрыш` column instead of a misleading `Корзина` column, Корзина and
  Возврат do not show operational dwell time in the "На этапе" column, the wide
  table renders at 2160px, horizontal scroll keeps the subject column sticky,
  and no visible percentage exceeds `100%`.
