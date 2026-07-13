# Conversion Trajectory Execution Profile

## Goal

Build the existing "Конверсии" report into a management-grade conversion
trajectory report that a ROP can trust for decisions:

- show factual conversion steps, not only CRM stages;
- show speed and stale-work signals beside conversion;
- explain which managers move deals to which step and where deals stop;
- show source/customer loss shapes without treating basket/return as active
  "on stage" work;
- keep all business-truth calculations in domain/report code and contracts,
  not in ad hoc browser code;
- verify the numbers against deterministic tests and the local SQLite-backed
  report path before any deploy.

This profile is mandatory for these plans:

- [029 Add fact-step conversion diagnostics](./029-add-fact-conversion-diagnostics.md)
- [030 Add speed and SLA buckets](./030-add-speed-sla-buckets.md)
- [031 Add manager diagnostic cards](./031-add-manager-diagnostic-cards.md)
- [032 Add source and customer loss-shape analysis](./032-add-source-customer-loss-shapes.md)

Do not implement the deferred data-quality layer in this sequence.

## Operating Rules

- Keep the report tab named "Конверсии".
- Keep the route `/api/reports/source-cohort-conversion`.
- Keep cohort controls where users already expect them.
- Use Russian business labels in the UI. Do not expose enum keys or English
  technical tags.
- "Первый успешный звонок" must mean the first outgoing connected/over-30s call
  from canonical touchpoint facts.
- CRM meeting stage and factual meeting must stay separate concepts.
- Basket, return, non-qualified and other loss stages are terminal outcomes,
  not active current-stage workload.
- Rows with `N < 10` can be shown descriptively but must not be used for hard
  manager/source/customer ranking.
- Do not display deal names, contact names, phones, emails, or other personal
  data.

## Per-Plan Execution Loop

Run this loop after each plan, before moving to the next plan.

1. **Start gate**
   - Run `pnpm session:preflight --allow-dirty` only when continuing the same
     active task and after reading the dirty diff.
   - Read the target plan fully.
   - Run the CRG gate for code-facing work:
     `get_minimal_context_tool` with this repo root and the specific plan goal.
   - Confirm the plan's in-scope files still match the drift check.

2. **Implement only the current plan**
   - Change only files listed in the plan unless a STOP condition forces a
     scope decision.
   - Add/adjust contracts before UI when the API shape changes.
   - Add domain tests for metric truth before relying on browser output.
   - Update `docs/modules/attraction/REPORT_REGISTRY.md` when methodology
     changes.

3. **Run targeted verification**
   - API metric tests:
     `pnpm --filter @bitrix24-reporting/api exec vitest run test/source-cohort-trajectory.test.ts`
   - Web report tests:
     `pnpm --filter @bitrix24-reporting/web exec vitest run src/App.test.tsx`
   - Typecheck:
     `pnpm typecheck`
   - Lint:
     `pnpm lint`

4. **Review pass 1: code-reviewer**
   - Review the diff, not the whole repo.
   - Findings must be concrete: file, line, impact, fix.
   - Fix every Critical and Warning finding.
   - Suggestions are fixed only when they are low-risk and in-scope.

5. **Review pass 2: Ponytail**
   - Run a Ponytail complexity pass on the diff.
   - Delete or simplify confirmed over-engineering.
   - Do not remove tests, guards, or explicit methodology notes just to reduce
     line count.

6. **Review pass 3: architecture/improve**
   - Run an architect/improve-codebase-architecture pass on the touched seams:
     contracts, domain builder, API normalizer, UI section, report registry.
   - Fix blocking seam or locality regressions in the current plan.
   - Broader architectural candidates that are not required for the current
     plan become follow-up plans, not scope creep.

7. **Repeat bug scan**
   - Re-run tests after fixes.
   - Re-review the changed diff for new Critical/Warning findings.
   - Re-run Ponytail only if the fixes added new abstraction or more code.
   - Continue until:
     - no Critical findings;
     - no Warning findings in touched code;
     - no confirmed Ponytail cuts left;
     - no blocking architecture seam issue left.

8. **Browser QA**
   - Start the local app with `pnpm start` if it is not already running.
   - Use the in-app Browser at `http://127.0.0.1:5173/`.
   - Open "Конверсии".
   - Select at least two cohort months, including a month with enough volume and
     a small month.
   - Click manager/source/customer tabs.
   - Verify visual state and numbers against the API/test expectations below.
   - Capture screenshots or concise notes for visible regressions before fixing.

9. **Plan close**
   - Update the plan row in `plans/README.md` only after checks and browser QA
     pass.
   - If any criterion fails and cannot be fixed inside the plan scope, mark the
     plan BLOCKED with a one-line reason.
   - Do not start the next plan while the current plan has unresolved Critical,
     Warning, browser, or metric-truth failures.

## Definition Of Done

A plan is done only when all relevant items are true.

### Data And Methodology

- Every new metric has a source-of-truth definition in
  `docs/modules/attraction/REPORT_REGISTRY.md`.
- Every new metric is calculated in `apps/api/src/domain/source-cohort-trajectory.ts`
  or another reviewed domain/report module.
- Browser code renders normalized API data; it does not invent business counts.
- Tests cover denominator choice, zero-count behavior, small sample behavior,
  and at least one negative case.
- Stage/fact semantics are documented:
  - CRM meeting stage is not a meeting fact.
  - event attendance is not a contract.
  - contract stage is not a won deal.
  - basket/return are terminal outcomes.

### Product And UI

- The visible report stays inside "Конверсии".
- Cohort controls remain usable and visible where the user already expects them.
- Labels are Russian and business-readable.
- Ambiguous columns have tooltips or helper text:
  - first successful call;
  - CRM stage vs fact;
  - stale after meeting;
  - contract stage vs won;
  - low sample.
- No table cell uses unexplained shorthand like `+0` or raw enum names.
- Text does not overlap, truncate into nonsense, or require horizontal scroll
  for the main management takeaway.
- Horizontal scroll is acceptable only for dense detail tables, not for the
  primary conclusion.

### Code Quality

- Contracts, API normalizer, domain builder, UI types and tests change together.
- New helpers have one clear owner and are not duplicated between API and web.
- No direct Bitrix reads are added to page rendering.
- No personal data is introduced into persisted reporting payloads or UI.
- The diff passes code-reviewer, Ponytail and architecture/improve gates.

### Browser Checks

In the in-app Browser, verify:

- report tab label is "Конверсии";
- cohort month selector works and changes headline counts;
- fact conversion diagnostics render with Russian labels;
- speed/SLA layer shows medians, slow counts and stale counts without confusing
  no-fact with slow-fact;
- manager view explains who is better/faster and where they stall;
- source/customer views show dominant loss shape and ROP question;
- low-sample rows are visibly marked and not hard-ranked;
- basket/return appear as losses, not as active "на этапе";
- reload keeps the report usable and does not trigger a heavy all-dashboard
  request.

### Numeric Smoke Checks

For every plan, compare at least one cohort in three places:

- API/domain test fixture expectation.
- Local API response from `/api/reports/source-cohort-conversion`.
- Browser-rendered value.

The three values must match after applying the same filters and cohort. If they
do not match, stop and fix the calculation or normalizer before changing UI
copy.

## Stop Rules

Stop and report instead of continuing if:

- the plan requires a new endpoint or report tab to work;
- the calculation needs direct Bitrix reads at render time;
- a metric cannot be derived from cached local data without personal data;
- source/customer/manager rows cannot be explained with the current attribution
  rules;
- browser output contradicts API output;
- a review pass finds a Critical issue that needs cross-plan redesign.
