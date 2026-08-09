# Backlog

This file mirrors the GitHub Issues backlog. GitHub Issues are the source of truth after repository setup; keep this document as a local planning summary.

## P0

### Performance: make prototype reports lazy-loaded
- Area: infra, web
- Problem: the prototype currently waits for almost every report plus cohort/source/TOC breakdowns before marking runtime data ready.
- Expected behavior: initial render should load only shared metadata and the active scene data; heavy reports should load by active screen or in background.
- Acceptance criteria:
  - Opening the dashboard does not wait for all screens.
  - Sales, activities, cohorts, and funnel screens can load their own report bundles independently.
  - No direct Bitrix calls are added to page rendering.
  - Existing API/web tests remain green.

### Governance: keep reporting scoped to attraction managers
- Area: infra, api
- Problem: operational rows must never show managers outside the agreed attraction whitelist.
- Expected behavior: sales, calls, SLA, activities, manager action-outcome, cohorts, and funnel overlays use the same manager scope unless the user explicitly filters narrower.
- Acceptance criteria:
  - Default report rows contain only the seven agreed managers.
  - Activities, calls, and action-outcome reports cannot reintroduce outside managers through related activities or calls.
  - Regression tests cover this rule.

## P1

### Show messenger attachment download failures inline ([#151](https://github.com/Community-Build/bitrix24-attraction-dashboards/issues/151))
- Area: activities, web
- Problem: when the protected attachment endpoint fails, the long scrolled
  reader shows the error only at its top, so the clicked button appears inert.
- Expected behavior: show an actionable Russian error beside the exact
  attachment and turn the same control into an explicit retry action; after a
  successful response retain a visible real download link so browsers that
  block asynchronous synthetic clicks still let the operator save the file.
- Acceptance criteria:
  - Known attachment error codes have clear operator-facing messages.
  - Unknown failures have a safe generic retry message.
  - Successful Blob downloads keep the automatic attempt and expose a visible
    trusted-click fallback link until the reader changes or closes.
  - Replaced and closed-reader Blob URLs are revoked.
  - Leader-only access, message/file scope validation, the 20 MiB cap, no-store
    headers, aggregate values, and message privacy remain unchanged.
- Data dependency: actual retrieval of files rejected by Bitrix with
  `ACCESS_DENIED` requires a separately authorized integration-permission
  change; issue #151 does not mutate credentials or permissions.

### Clarify messenger author versus responsible manager ([#149](https://github.com/Community-Build/bitrix24-attraction-dashboards/issues/149))
- Area: activities, web, api
- Problem: ambiguous WAZZUP author token `Телефон` is rendered next to an
  outgoing direction inside a manager drawer, which makes a technical source
  token look like a person and hides the difference between proven authorship
  and operational responsibility for the deal.
- Expected behavior: confirmed outgoing rows name the author; unresolved
  outgoing rows name the responsible manager without claiming authorship;
  supported-provider incoming rows are labelled as client messages.
- Acceptance criteria:
  - The reader contract exposes confirmed versus operational attribution.
  - Summary copy and columns distinguish confirmed author from responsible
    manager.
  - Counts, stored author IDs, manager scope, leader-only access, and message
    privacy boundaries do not change.
  - Focused/full tests and production session `32984` verification pass.

### Show all telephony calls for Adelia and Maria ([#147](https://github.com/Community-Build/bitrix24-attraction-dashboards/issues/147))
- Area: activities, api, data
- Problem: the Activities dashboard applies `direct_only` to Maria Salicheva
  and Adelia Kosmasova, so their primary call metrics omit synchronized
  telephony calls that cannot be linked directly to Attraction deals.
- Expected behavior: both managers use all synchronized telephony calls for
  primary call counters and the outgoing-call heatmap; linked-deal and stage
  metrics remain Attraction-only.
- Acceptance criteria:
  - Manager IDs `7538` and `118` use `all_calls` for display while retaining
    `direct_only` for deal attribution.
  - `linkedDealCalls`, calls-per-deal, and stage breakdown remain deal-scoped.
  - Manager whitelist, access, funnel/SLA reports, sync, and call-analysis
    authorization do not change.
  - Focused API/web tests and production before/after checks pass.

### Activities messenger totals and SQLite-backed manager reader
- Area: activities, web, api, data
- Problem: the Activities report does not show messenger-message volume for its
  selected date/manager filters, and an authorized leader cannot inspect the
  underlying text without leaving the reporting workflow.
- Expected behavior: the Activities screen automatically reads cached messenger
  totals for the common date/manager filter, shows all known-direction outgoing
  messages with confirmed/unknown author split, unique Open Lines dialogs and deals,
  incoming/unknown-direction messages, and opens stored full text separately.
- Acceptance criteria:
  - Every selected manager must be enabled in the attraction whitelist and
    messages must belong to current attraction deals. Confirmed outgoing rows
    use the actual message author; incoming/unknown rows use the deal owner.
  - System events are retained as evidence but excluded from business totals;
    attachment-only and outgoing-unknown-author rows are counted separately. The
    overall sent total and its unique-dialog/deal metrics include both confirmed
    and unknown-author outgoing rows.
  - The summary response never contains message text; the leader-only reader
    returns at most 500 newest messages with `Cache-Control: no-store`.
  - Complete cleaned and original text is stored only in dedicated attraction
    SQLite tables. It never enters aggregates, logs, MCP, comments, notifications,
    or raw payload storage and is rendered as plain text rather than HTML.
  - WAZZUP rows use the embedded outgoing/system markers; unmarked WAZZUP rows
    are incoming. Umnico uses its embedded `Outcoming message` marker and treats
    unmarked non-system rows as incoming. OLChat direction remains `unknown`.
  - The reader strips WAZZUP/Umnico service headers and bold BBCode tokens,
    links to the owning deal, and downloads only validated message attachments
    through a bounded proxy.
  - Any valid common dashboard range is accepted, initial report rendering
    performs no Bitrix read, changing the range automatically reloads the block,
    and service/HTTP/client/UI tests cover the boundary.
- Data dependencies:
  - Bitrix methods `crm.activity.list`, `imopenlines.session.history.get`, and
    `disk.file.get` with the existing production webhook.
- Verification plan:
  - Focused Vitest suites for sync/parsing, SQLite replacement, author-aware
    scoping, privacy-safe summary output, HTTP authorization, text escaping, and
    automatic UI loading.

### Telegram activity summaries by attraction team
- Area: activities, api
- Problem: the scheduled Telegram report sends one combined summary even though attraction managers are already assigned to teams.
- Expected behavior: generate one copy-ready summary per configured attraction team; global report chats receive every team, while optional team-scoped chats receive only their configured team.
- Acceptance criteria:
  - Team membership and ordering come from manager whitelist settings rather than hardcoded names.
  - Managers without a team are omitted from team summaries.
  - Each team has its own totals and employee metric sections.
  - Global recipients keep receiving every team summary.
  - Team-scoped recipients receive only their configured team's message and any continuation chunks.
  - Existing schedule, retry behavior, and Telegram size limit remain unchanged.

### Sales planning tab: plan percent and "as is vs required"
- Area: sales
- Problem: comments ask for planning, percentage of plan, and forecast logic instead of just factual KPI tables.
- Expected behavior: add a `Планирование` tab with plan progress and required action volume versus actual action volume.
- Acceptance criteria:
  - Shows `% от плана`.
  - Shows `как есть` and `как надо` rows.
  - Supports manager and cohort filters.
  - Uses conditional formatting outside the neutral `±15%` band.
- Data dependencies:
  - Need plan source and granularity: total, manager, source, month.

### Cohort action-outcome model
- Area: sales, cohorts
- Problem: actions should be counted against the selected deal cohort, not only the current activity period.
- Expected behavior: for selected cohort, show actions and outcomes by manager and deal status.
- Acceptance criteria:
  - Mini-filter allows choosing cohort.
  - Metrics are calculated for deals created in the cohort.
  - Split outcomes into accepted by club, lost, and WIP.
  - Shows action volume for each outcome status.

### Activities operational base and SLA improvements
- Area: activities
- Problem: activities screen needs WIP deals, active base, and clearer SLA semantics.
- Expected behavior: manager summary includes WIP, active base, and SLA fulfillment percentages.
- Acceptance criteria:
  - Adds WIP deals.
  - Adds active base report: last communication not older than one month.
  - Adds quality `Готов ко встрече` and source cuts.
  - SLA displays fulfillment percent.
  - SLA late count `0` is neutral/gray.
  - Conditional formatting uses `±15%` deviation band.

### Financial result by source, quality, and events
- Area: sales, activities
- Problem: comments ask for lead acquisition cost, event cost, and earnings.
- Spec: [Unit Economics And Financial Result For Attraction](./plans/2026-06-02-unit-economics-financial-result.md).
- Expected behavior: add financial-result block showing costs and earned amount by source/quality/event.
- Acceptance criteria:
  - Shows lead purchase cost by source and quality.
  - Shows event costs.
  - Shows earned amount.
  - Shows attraction average check and club average check.
- Data dependencies:
  - Need earning formula by customer and contract/tariff type.
  - Need cost source for leads and events.

### Cohort matrix count plus conversion
- Area: cohorts
- Problem: cohort cells need both absolute deal counts and conversion, and rows need created deal count.
- Expected behavior: cohort matrix includes created deals and each cell is split into count plus conversion.
- Acceptance criteria:
  - Adds created deals column.
  - Each cohort cell displays absolute count and conversion.
  - Existing cohort filters continue to work.

### Funnel stable leaders at bottlenecks
- Area: funnel
- Problem: stable leaders should be detected in important funnel places, not just listed generically.
- Expected behavior: strong managers are shown as an overlay on stages/bottlenecks with stability versus compare period.
- Acceptance criteria:
  - Uses compare-aware manager stage conversion.
  - Marks stability by rank retention and conversion threshold.
  - Links the finding to bottleneck/queue context.

## Needs Clarification

### Bitrix access for conversion events and call recordings
- Area: activities, data
- Problem: the current webhook has scopes `bizproc`, `calendar`, `crm`, `disk`, `telephony`, and `user_brief`, but Bitrix still returns `ACCESS_DENIED` for `crm.type.list` and `disk.file.get`.
- Current evidence:
  - `crm.type.list` returns `ACCESS_DENIED / Доступ запрещен`, so smart-process discovery for `Посещения мероприятий` cannot run yet.
  - `disk.file.get` for a telephony `RECORD_FILE_ID` returns `ACCESS_DENIED / Access denied!`, so call recordings stored behind Bitrix Disk cannot be downloaded through Bitrix yet.
  - `voximplant.statistic.get` works; Sipuni-hosted `CALL_RECORD_URL` links time out from this environment.
- Expected behavior:
  - Webhook user has CRM admin access required for `crm.type.list`.
  - Webhook user has read access to telephony recording files for `disk.file.get`, or Sipuni API credentials are configured as the recording download fallback.
- Verification plan:
  - Re-run `crm.type.list`, `crm.item.fields`, and `crm.category.list` for `Посещения мероприятий`.
  - Re-run `disk.file.get` on a known `RECORD_FILE_ID` and verify a `DOWNLOAD_URL` is returned without printing the URL.
  - If Bitrix Disk remains blocked, add direct Sipuni API download using `SIPUNI_USER` and `SIPUNI_SECRET`.

### Plan source
- What is the source of plan values?
- Should plan be monthly, weekly, by manager, by source, or global?

### Attraction economics
- How much does attraction earn by customer, contract type, and tariff?
- What is the difference between attraction average check and club average check?

### Cost data
- Where do lead purchase costs and event costs live?
- Are they imported, configured manually, or entered per period?

### SLA color rules
- Confirm exact coloring besides `late = 0` being gray.
- Confirm whether the `±15%` deviation rule applies to SLA, plan, and action-outcome blocks equally.
