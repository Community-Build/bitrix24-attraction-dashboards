# Plan 006: Define manager call attribution policy for shared attraction roles

> The linked-only display behavior for manager IDs `7538` and `118` was
> superseded on 2026-08-09 by [plan 042](./042-show-all-calls-for-adelia-and-maria.md)
> and GitHub issue #147. Their `direct_only` deal-attribution policy remains;
> only the workload display now uses all calls. This plan is retained as
> historical rationale.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 70d9efb..HEAD -- packages/contracts/src/index.ts apps/api/src/domain/attraction-managers.ts apps/api/src/domain/fact-report-adapters.ts apps/api/src/domain/operational-reports.ts apps/api/src/server/service.ts apps/api/test/calls-workload.test.ts apps/api/test/service.test.ts apps/api/test/analytics-facts.test.ts apps/web/src/lib/dashboard-types.ts apps/web/src/lib/api-client.ts apps/web/src/proto`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: the manager-catalog work that adds `7538` and `118` to the attraction manager catalog
- **Category**: bug
- **Planned at**: commit `70d9efb`, 2026-06-21

## Why This Matters

The attraction calls workload report currently works for ordinary attraction
managers, but it over-attributes calls for shared/community managers whose phone
work is split between attraction and the club/community contour. Investigation
after syncing `7538` Maria Salicheva and `118` Adelia Kosmasova showed that
Adelia has a large historical `contact_single_deal_fallback` tail: those calls
are real manager calls, but they are not reliable evidence of work on an
attraction deal. The dashboard needs a role-aware attribution policy that keeps
ordinary manager calculations unchanged while counting only direct deal-linked
calls for shared/community managers.

## Current State

- `apps/api/src/domain/attraction-managers.ts` is the static attraction manager
  catalog. At the time this plan was written, the active branch already added:

```ts
// apps/api/src/domain/attraction-managers.ts:18
{ id: "7538", name: "Мария Саличева" },
{ id: "118", name: "Аделия Космасова" }
```

- `ManagerDirectoryEntry` currently carries only identity fields:

```ts
// packages/contracts/src/index.ts:635
export interface ManagerDirectoryEntry {
  id: string;
  name: string;
}
```

- `CallSnapshot` currently has no attribution metadata:

```ts
// packages/contracts/src/index.ts:309
export interface CallSnapshot {
  id: string;
  crmActivityId: string | null;
  portalUserId: string | null;
  callType: string | null;
  callStartDate: string;
  callDurationSeconds: number;
  crmEntityType: string | null;
  crmEntityId: string | null;
  callFailedCode: string | null;
}
```

- The canonical touchpoint adapter currently turns every call fact with a
  `dealId` into a `DEAL` call, losing `linkReason`:

```ts
// apps/api/src/domain/fact-report-adapters.ts:85
crmEntityType: fact.dealId ? "DEAL" : null,
crmEntityId: fact.dealId,
```

- The report builder links calls to scoped deals through activity bindings,
  activity owner, or deal call entity. It has no manager-specific policy:

```ts
// apps/api/src/domain/operational-reports.ts:3261
const resolveLinkedDeal = (
  call: CallSnapshot,
  activity: ActivitySnapshot | null
) => {
  const boundDealIds = call.crmActivityId
    ? (activityBindingsByActivityId.get(call.crmActivityId) ?? [])
        .filter((binding) => binding.ownerTypeId === "2")
        .map((binding) => binding.ownerId)
    : [];
```

```ts
// apps/api/src/domain/operational-reports.ts:3319
const deal = resolveLinkedDeal(call, activity);
if (!deal) {
  continue;
}
```

- `getCallsWorkloadReport` already uses canonical facts when available:

```ts
// apps/api/src/server/service.ts:2480
const canonical = await loadCanonicalReportInputs({
  stageHistory,
  activities,
  calls
});
```

```ts
// apps/api/src/server/service.ts:1307
hasTouchpointFacts && fallback.calls
  ? touchpointFactsToCalls(touchpointFacts)
  : fallback.calls,
```

- The manager directory table stores only `id` and `name`; do not add a SQLite
  migration for this plan unless unavoidable:

```ts
// apps/api/src/server/sqlite-repository.ts:1036
CREATE TABLE IF NOT EXISTS manager_directory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
```

- Domain documentation says reports must use safe local data and stay in the
  agreed attraction manager whitelist:

```md
<!-- docs/modules/attraction/ontology/07-reporting-and-guardrails.md:31 -->
- Использовать `deal_id`, внутренние идентификаторы, stage ids и агрегаты.
- Не выводить имена, телефоны, email, raw payloads и сырые комментарии.
- Дашборды читают локальный API и SQLite snapshot, а не Bitrix напрямую.
- Отчеты должны оставаться в согласованном whitelist менеджеров привлечения,
  если отдельный issue явно не расширяет scope.
```

- Investigation data to preserve as regression intent:
  - Current week `2026-06-15..2026-06-21`: Adelia `118` had 3 total calls and 0 direct attraction calls; Maria `7538` had 11 total calls and 6 direct attraction calls across 5 deals.
  - Full synced range: Adelia had 104 `contact_single_deal_fallback` calls and only 2 direct attraction calls. Those fallback calls must not become her primary attraction KPI.

## Commands You Will Need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Session gate | `pnpm session:preflight --allow-dirty` | exits 0 only after you confirm dirty files belong to this active task |
| API tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts test/service.test.ts test/analytics-facts.test.ts` | all tests pass |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0, no TypeScript errors |
| Web typecheck | `pnpm --filter @bitrix24-reporting/web typecheck` | exits 0, no TypeScript errors |
| Contracts typecheck | `pnpm --filter @bitrix24-reporting/contracts typecheck` | exits 0, no TypeScript errors |
| Ontology validation | `pnpm ontology:validate` | exits 0 |

## Suggested Executor Toolkit

- Use Context7 before changing TypeScript or React types. The relevant
  TypeScript pattern is a string literal union used as a typed policy field,
  e.g. `"standard" | "direct_only"`.
- Use the in-app browser only if you decide to manually inspect the dashboard UI
  after implementation. Unit/API verification is the primary gate for this plan.

## Scope

**In scope**:

- `packages/contracts/src/index.ts`
- `apps/api/src/domain/attraction-managers.ts`
- `apps/api/src/domain/fact-report-adapters.ts`
- `apps/api/src/domain/operational-reports.ts`
- `apps/api/src/server/service.ts`
- `apps/api/test/calls-workload.test.ts`
- `apps/api/test/service.test.ts`
- `apps/api/test/analytics-facts.test.ts`
- `apps/web/src/lib/dashboard-types.ts`
- `apps/web/src/lib/api-client.ts`
- The specific `apps/web/src/proto` component(s) that render the calls workload
  manager rows, only if the API response needs a visible label.
- `docs/modules/attraction/ontology/07-reporting-and-guardrails.md`, only if
  you add the domain rule to documentation.

**Out of scope**:

- SQLite schema migrations for `manager_directory`.
- Direct Bitrix reads from dashboard rendering.
- Changing the attraction manager whitelist UI behavior beyond carrying the new
  optional policy field in manager options.
- Reworking leadgen calls workload semantics.
- Recomputing historical facts or mutating production/local SQLite data.
- Displaying deal names, contact names, phones, emails, or raw payloads.

## Git Workflow

- Branch: `codex/manager-call-attribution-policy`.
- If you are continuing from the dirty `codex/add-attraction-community-managers`
  branch, first inspect `git status --short` and `git diff`. Do not overwrite
  or revert the existing manager-addition edits.
- Do not commit, push, or open a PR unless the operator explicitly requests it.
- Commit message style, if later requested: imperative scoped subject, e.g.
  `Define manager call attribution policy`.

## Steps

### Step 1: Add typed attribution policy to contracts

In `packages/contracts/src/index.ts`, add a string literal union:

```ts
export type CallAttributionPolicy = "standard" | "direct_only";
```

Add optional fields without breaking existing consumers:

- `ManagerDirectoryEntry.callAttributionPolicy?: CallAttributionPolicy`
- `CallSnapshot.linkReason?: string | null`
- `CallSnapshot.linkConfidence?: AnalyticsLinkConfidence | null`
- `ManagerCallsWorkloadRow.callAttributionPolicy?: CallAttributionPolicy`
- `LinkedDealCallPopulationSummary.excludedByPolicyCalls?: CallPopulationSummary`
- `LinkedDealCallReportSummary.excludedByPolicyCalls?: CallPopulationSummary`

Keep these optional so raw SQLite call rows and existing clients remain
compatible.

**Verify**:
`pnpm --filter @bitrix24-reporting/contracts typecheck` -> exits 0.

### Step 2: Mark shared/community managers in the attraction catalog

In `apps/api/src/domain/attraction-managers.ts`, keep ordinary managers
unchanged. Add `callAttributionPolicy: "direct_only"` only to:

- `7538` Maria Salicheva
- `118` Adelia Kosmasova

Do not hardcode those IDs inside report calculation logic. The report must read
the policy from `managerDirectory`.

If either manager is missing from `ATTRACTION_MANAGER_CATALOG`, stop and report
unless the operator confirms this plan should also absorb the manager-addition
branch.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/attraction-managers.test.ts` -> exits 0.

### Step 3: Preserve canonical link reason when adapting facts to calls

In `apps/api/src/domain/fact-report-adapters.ts`, make
`touchpointFactsToCalls()` copy `fact.linkReason` and `fact.linkConfidence` into
the returned `CallSnapshot`.

Do not remove the current `crmEntityType: fact.dealId ? "DEAL" : null` behavior
yet; ordinary managers still rely on current linked-call semantics.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/analytics-facts.test.ts` -> exits 0.

### Step 4: Apply policy inside `buildCallsWorkloadReport`

In `apps/api/src/domain/operational-reports.ts`, derive each manager's policy
from `managerDirectory`.

Target behavior:

- `standard`: current behavior. Direct and fallback-linked calls continue to
  count in `linkedDealCalls`.
- `direct_only`: count only high-confidence direct deal links in the primary
  `linkedDealCalls`.
- For `direct_only`, exclude calls whose `call.linkReason` is
  `contact_single_deal_fallback` from the primary linked accumulator and add
  them to `excludedByPolicyCalls`.

Direct reasons to treat as primary evidence:

- `activity_binding_deal`
- `activity_owner_deal`
- `call_entity_deal`

Keep `allCalls` unchanged for every manager. All real phone activity must still
appear in workload totals even when excluded from attraction attribution.

Avoid changing `resolveLinkedDeal()` into a manager-specific function unless
needed. A clean shape is:

1. Resolve the linked deal as today.
2. Resolve `managerId`.
3. Resolve `policy`.
4. If policy is `direct_only` and `call.linkReason === "contact_single_deal_fallback"`, add the call to an excluded accumulator and `continue` before adding to `linkedRows`.

For raw DB calls without `linkReason`, keep current behavior. Those calls use
activity binding/owner/entity logic and should not be treated as fallback.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts` -> exits 0.

### Step 5: Add regression tests for ordinary and direct-only managers

Extend `apps/api/test/calls-workload.test.ts`.

Add tests covering:

1. An ordinary manager with a call whose `linkReason` is
   `contact_single_deal_fallback` still gets that call in `linkedDealCalls`.
2. A direct-only manager with the same fallback-linked call keeps the call in
   `allCalls`, but `linkedDealCalls.totalCalls` remains 0 and
   `linkedDealCalls.excludedByPolicyCalls.totalCalls` is 1.
3. A direct-only manager with `activity_binding_deal` or `activity_owner_deal`
   still gets that call in primary `linkedDealCalls`.
4. Report totals preserve the same split: primary `linkedDealCalls` excludes
   direct-only fallback, while `allCalls` still includes all phone calls.

Use the existing first test in `apps/api/test/calls-workload.test.ts:6` as the
structural pattern for in-memory report input.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts` -> all tests pass.

### Step 6: Carry the new response fields through service and web normalizers

In `apps/api/src/server/service.ts`, ensure `managerDirectory` passed into
`buildCallsWorkloadReport()` retains `callAttributionPolicy` from
`ATTRACTION_MANAGER_CATALOG`. Be careful at `ensureManagerDirectory()`:

- `ATTRACTION_MANAGER_CATALOG` is merged into `existingById` first.
- Fetched Bitrix users and SQLite rows may only have `id` and `name`; they
  should not erase catalog policy for known managers.

If current merge order erases `callAttributionPolicy`, change it so catalog
metadata wins for known attraction managers.

In `apps/web/src/lib/dashboard-types.ts`, mirror the new optional fields from
contracts.

In `apps/web/src/lib/api-client.ts`, normalize:

- `callAttributionPolicy`
- `excludedByPolicyCalls` at row and report level

Missing fields from older API responses must normalize safely to `undefined` or
zero-filled summaries without throwing.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/service.test.ts` -> exits 0.

### Step 7: Surface the policy in the dashboard UI only where useful

Find the calls workload manager-row rendering under `apps/web/src/proto`.
If the row already has space for manager-level secondary text or badges, add a
compact label for direct-only managers:

`учитываются только прямые связи`

Do not add explanatory paragraphs, marketing copy, or a new card. Keep it as a
small status chip/secondary line near the calls KPI. If there is no clean local
place, skip UI rendering in this plan and rely on API fields plus tests.

If showing excluded fallback calls, phrase it as a diagnostic, not a KPI:

`спорная привязка: N`

Do not show deal names or contact details.

**Verify**:
`pnpm --filter @bitrix24-reporting/web typecheck` -> exits 0.

### Step 8: Document the domain rule

In `docs/modules/attraction/ontology/07-reporting-and-guardrails.md`, add a
short rule under reporting/activity calls:

- Ordinary attraction managers count direct and single-contact fallback calls.
- Shared/community managers count only direct deal-linked calls in the primary
  attraction calls KPI.
- Fallback for shared/community managers may be shown as a diagnostic but must
  not affect primary attribution.

Keep the wording business-facing. Do not mention TypeScript, tables, or function
names in the ontology document.

**Verify**:
`pnpm ontology:validate` -> exits 0.

## Test Plan

Add or update tests in:

- `apps/api/test/calls-workload.test.ts`
  - ordinary manager fallback remains counted;
  - direct-only manager fallback is excluded from primary linked calls;
  - direct-only manager direct binding remains counted;
  - all-calls totals remain unchanged.
- `apps/api/test/service.test.ts`
  - catalog policy survives manager-directory merging and reaches the report
    builder for managers `118` and `7538`.
- `apps/api/test/analytics-facts.test.ts`
  - `touchpointFactsToCalls()` preserves `linkReason` and `linkConfidence`.
- Web tests only if the UI display changes. If no UI change is made, do not add
  brittle DOM tests.

Final focused verification:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/calls-workload.test.ts test/service.test.ts test/analytics-facts.test.ts
pnpm --filter @bitrix24-reporting/contracts typecheck
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/web typecheck
pnpm ontology:validate
```

Expected result: every command exits 0.

## Done Criteria

- [ ] `ManagerDirectoryEntry` supports a typed optional call-attribution policy.
- [ ] `7538` and `118` are configured as `direct_only`; ordinary managers remain
      default/standard.
- [ ] Canonical call facts preserve `linkReason` into report input.
- [ ] `contact_single_deal_fallback` is excluded from the primary linked calls
      KPI only for `direct_only` managers.
- [ ] Ordinary manager linked-call calculations are unchanged by tests.
- [ ] `allCalls` still includes every manager call regardless of attribution
      policy.
- [ ] Excluded fallback calls are available as diagnostic data, not silently
      discarded.
- [ ] No SQLite migration is introduced.
- [ ] No files outside the in-scope list are modified, except test snapshots if
      explicitly required by a web UI test.
- [ ] `plans/README.md` status row for plan 006 is updated when done.

## STOP Conditions

Stop and report back if:

- `ATTRACTION_MANAGER_CATALOG` does not contain `7538` and `118`, and the
  operator has not confirmed that this plan should include manager addition.
- Implementing direct-only policy requires changing raw SQLite schema.
- A standard manager's fallback-linked calls decrease in tests.
- `touchpointFactsToCalls()` cannot preserve `linkReason` without breaking
  existing `CallSnapshot` consumers.
- The dashboard UI requires a broad redesign to display the policy.
- Verification fails twice after a reasonable fix attempt.

## Maintenance Notes

- Future shared roles should use the policy field rather than new hardcoded ID
  checks.
- Reviewers should scrutinize whether policy is read from manager metadata, not
  from a scattered allowlist inside report calculation.
- If new link reasons are added later, decide explicitly whether they are
  direct evidence or fallback evidence before counting them for `direct_only`.
- This plan intentionally keeps fallback data available for diagnostics because
  it is useful for data-quality investigations even when excluded from the
  primary KPI.
