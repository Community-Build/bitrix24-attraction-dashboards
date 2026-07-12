# 034 Simplify The Conversion Report

Status: DONE

## Outcome

The existing `Конверсии` scene becomes one decision-led report with two internal
modes: participant journey and event performance. The default view must let the
head of sales identify the largest factual transition gap, compare managers,
sources, customers and final-quality groups, and inspect which event types have
observable post-event conversion without scrolling through duplicate reports.

## Scope

- Keep the existing creation-month cohort selector and report endpoint.
- Add final-quality rows to the canonical trajectory payload.
- Add event-date performance for event types, individual events and visit
  owners, using only trusted direct deal links.
- Replace the old stacked cohort/WIP/target/breakdown/trajectory composition
  with one compact conversion workspace.
- Preserve facts, CRM stages, data-quality gaps and timing. Keep event-depth
  facts in the API, but do not show them beside event-date conversion until
  both use one cohort and outcome-window methodology.
- Update focused API/web tests, report methodology and browser evidence.

## Non-goals

- Mobile-specific redesign.
- Historical responsibility attribution that the snapshot cannot prove.
- Causal claims about event effectiveness.
- Source-to-supplier master-data migration.
- Push, PR, deploy or production mutation.

## Sources And Authority

- `docs/modules/attraction/MODULE_ONTOLOGY.md`
- `docs/modules/attraction/REPORT_REGISTRY.md`
- `apps/api/src/domain/source-cohort-trajectory.ts`
- `apps/web/src/proto/source-cohort-trajectory-section.tsx`
- local SQLite canonical facts and current browser rendering

## Decisions

- The participant path keeps events as an optional branch, not a mandatory
  linear funnel step.
- `meeting_scheduled` is labelled as a CRM scheduling signal, not proof that a
  meeting occurred.
- Event conversion is an observed 60-day post-attendance outcome. Only mature
  event visits enter its denominator; one later contract may be observed after
  more than one event, so row totals are non-additive.
- Individual event rows with `N < 10` remain descriptive and are not ranked.
- Manager trajectory rows continue to mean current deal owner. Event-manager
  rows mean current visit owner. Both limitations stay visible in the UI.
- `Итоговое качество` is descriptive current-snapshot segmentation, not intake
  quality or a causal driver.
- The month selector is a shared analysis period: creation month in participant
  mode and event month in event-performance mode. The UI states this explicitly.
- Repeat-attendance depth is withheld from the primary screen because its
  creation-cohort denominator is not comparable with the event-date 60-day
  denominator. Showing both together would imply a false comparison.

## Work Packets

1. Extend shared contracts and API report building for quality and event
   performance. Verify with focused domain tests.
2. Replace the conversion scene composition and trajectory UI. Verify with web
   component tests and accessibility assertions.
3. Run API/web suites, typecheck, lint and diff checks.
4. Inspect the local report in the in-app browser at desktop widths, check
   console, focus states, empty/low-sample states and metric values.
5. Run one bounded code/design review, fix deterministic findings and commit.

## Recovery

The change remains on `codex/conversion-trajectory-prototype`. No migration or
database write is required. Reverting the final local commit restores the prior
report composition.

## Done

- The default conversion screen has no duplicate cohort breakdowns.
- All four requested dimensions are available in one comparison table.
- Facts, stages and gaps are explicit modes of one participant report.
- Event type, event and visit-owner rows show mature post-event outcomes.
- Metric definitions and attribution limits are visible and tested.
- Focused and workspace checks pass; browser evidence is accepted.
- Work is committed locally and not deployed.

## Verification

- API trajectory tests: 19 passed, including contract re-entry after an event.
- Web tests: 171 passed; focused app tests: 19 passed.
- API/web typecheck and lint passed; web production build and `git diff --check`
  passed.
- In-app browser: both report modes rendered, labels and cohort context checked,
  no page/report overflow, no console errors, viewport override reset.
