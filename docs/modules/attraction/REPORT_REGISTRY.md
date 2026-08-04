# Attraction Report Registry

## ontology-hub

- Module: `attraction`.
- Registry contract: [attraction-ontology.json](./ontology/registry/attraction-ontology.json).
- Validation: `pnpm ontology:validate`.
- Source hierarchy: Bitrix shows the factual process configuration; regulations
  and sheets are evidence; ontology registry records the canonical
  interpretation; drift is classified by the governance role/unit.
- Update registry and this report registry when Bitrix stages, enum reasons,
  fields, SLA rules, report logic, or the conversion event catalog changes.
- Review drift before deploy.
- Do not add the separate Лидген УС contour to this registry or dashboard scene.

Stable dashboard anchors used by ontology report bindings:

- `attraction-funnel-flow`
- `attraction-acquisition-outcomes`
- `attraction-conversion-events`
- `attraction-activities-sla`
- `attraction-revenue-velocity`
- `attraction-ontology-drift`

## activities-calls

## operational-dashboard

- Module: `attraction`.
- Report scene: `operations` / `Операционный`.
- Backend route: `/api/reports/operational-dashboard`.
- Backend contract: `OperationalDashboardReport`.
- Current membership source: the atomically replaced
  `attraction_current_deal_ids` projection for category 10 and the active
  attraction manager whitelist. Page rendering reads this local projection and
  never calls Bitrix directly.
- Current metrics: `openDeals`, `stageWip`, `riskSummary`, `risks`, planned
  meetings/tasks, and the corresponding current manager workload fields must
  intersect retained deal snapshots with the reconciled current-ID set.
- Historical period metrics: `createdDeals`, held meetings, won sales, lost
  deals, and their historical manager totals continue to use retained
  snapshots and facts selected by the report range.
- A deal moved to another category, reassigned outside the manager whitelist,
  or deleted upstream remains available to historical reports but cannot
  appear as current WIP, planned work, or a current operational risk.
- `currentScope.status` is `ready`, `stale`, `uninitialized`, or
  `scope_mismatch`. Uninitialized or mismatched state hides current metrics;
  stale state shows the last atomically reconciled set with an explicit UI
  warning. Sync health treats all three non-ready states as blocking.
- Reconciliation is complete-set based, not delta based. The set and freshness
  marker advance only after a complete Bitrix inventory and snapshot refresh
  commit successfully. See [ADR 0004](../../adr/0004-current-attraction-scope-projection.md).

## source-cohort-conversion

- Module: `attraction`.
- Report scene: `source-cohorts` / `Конверсии`.
- Dashboard block: `attraction-source-cohort-trajectory-conversions`.
- Backend route: `/api/reports/source-cohort-conversion`.
- Backend contract: `SourceCohortConversionReport.trajectory`.
- Unit of analysis: attraction deal created inside the selected cohort month and
  current filter scope.
- Stage trajectory source: canonical `deal_stage_facts`, with the initial
  attraction stage counted from `deal_snapshots.date_create` when Bitrix stage
  history does not include the initial `NEW` row.
- Stage identity is resolved by stable stage IDs/semantics first:
  `C10:MEETING` for the meeting stage and `C10:CONTRACT` for the contract
  stage. Russian name matching is only a fallback for incomplete catalogs.
- Current deal outcome is resolved once for aggregates and both drill-down
  kinds. `C10:UC_XEEP0A` (`Отклонено потребителем`) remains an open,
  repairable route even though Bitrix publishes semantic `F`;
  `C10:UC_EA3R76` (`Возврат в Лидген(неквал)`) is counted separately as
  `returned`, never as an open or lost deal.
- Stage transition lines: `SourceCohortConversionReport.trajectory.stageTransitions`
  is built from consecutive stages in the canonical per-deal timeline. A
  transition is counted once per deal for the pair `fromStageId -> toStageId`;
  the line percentage is calculated from deals that reached `fromStageId`, or
  from the full cohort for the initial `null -> first stage` transition.
- Action trajectory sources:
  - first call attempt: first high-confidence direct outgoing call after deal
    creation, regardless of connection result;
  - first successful call: `deal_touchpoint_facts.kind = call`, high-confidence
    direct deal link, outgoing, `payload.connected = true`,
    `payload.overThirtySeconds = true`, occurred on or after deal creation;
    medium-confidence contact fallback is counted separately in
    `firstSuccessfulCallFallbackDeals` and shown as a data-quality caveat, not
    mixed into the direct numerator;
  - completed meeting: `deal_touchpoint_facts.kind = meeting`, direct/trusted
    deal link, `payload.completed = true`, occurred on or after deal creation;
  - attended event: `event_visit_facts.final_status = attended`,
    direct/trusted deal link, occurred on or after deal creation.
- The default participant journey is exposed through
  `SourceCohortConversionReport.trajectory.conversionJourney` as
  `created -> first_call -> confirmed_conversation -> meeting_completed ->
  contract -> transferred`. Event visits are an optional branch and are not a
  mandatory step between meeting and contract.
- `meeting_scheduled` remains available as a process diagnostic: it means that
  a meeting date was recorded in the deal or a linked CRM meeting was created.
  It is not proof that the meeting happened and it is not the denominator for
  `meeting_completed`; completed-meeting conversion is conditional on the
  confirmed-conversation step.
- Deal drill-down is loaded lazily from
  `/api/reports/source-cohort-conversion/journey-deals` for one visible journey
  step and the same range, manager, source, business-club, and target-group
  filters as the aggregate report. It exposes three reconciled views:
  `reached` contains the deals counted at the selected step, `missed` contains
  deals in the strict previous-step denominator that did not make the selected
  transition, and `not_advanced` contains deals at the selected step without a
  strict transition to the next visible step. The route reads the local
  SQLite-backed reporting snapshot and never performs a direct Bitrix read
  during page rendering.
- The same lazy route accepts `drilldownKind=crm_stage` with a canonical stage
  ID from `trajectory.stageNodes`. In the existing `CRM-этапы` table, each
  visible stage row opens the same three reconciled views from canonical stage
  history. A shortcut to a later productive stage is labeled as a skipped
  stage, not a loss; terminal loss stages open a reached-only deal list. When a
  deal enters the same stage more than once, the current cycle uses the latest
  selected-stage entry and only a next-stage entry after that timestamp.
- Drill-down rows may expose only deal ID, a generated Bitrix deal URL, current
  manager, current stage, outcome, relevant timestamps, deterministic status,
  and deterministic reason. Deal titles, contact names, phones, emails, and raw
  Bitrix payloads are excluded from the contract and UI.
- Drill-down status is operational, not predictive:
  `advanced` means the strict next transition exists; `within_sla` and `stuck`
  mean the required fact is still missing before or after the configured
  threshold; `lost` means the deal is already in a loss outcome; `returned`
  means the deal is currently in the separate return-to-leadgen route;
  `data_gap` means the observed chronology or successful outcome conflicts
  with the required facts. The current thresholds are 3 days from creation to
  first attempt or confirmed conversation, 7 days from creation to completed
  meeting, 7 days from completed meeting to contract, and 14 days from
  contract to transfer. These thresholds classify rows; they do not change the
  aggregate journey numerator or denominator.
- Fact-step chain:
  `SourceCohortConversionReport.trajectory.factSteps` is the canonical ordered
  chain `created -> first_successful_call -> meeting_stage -> completed_meeting
  -> attended_event -> contract_stage -> won`.
  - `created`: deals created inside the selected cohort month and filter scope.
  - `first_successful_call`: first trusted successful call defined above.
  - `meeting_stage`: the CRM stage whose canonical name is
    `Встреча-знакомство`; this is a CRM stage, not proof that a meeting
    happened.
  - `completed_meeting`: trusted completed meeting fact defined above.
  - `attended_event`: trusted attended event fact defined above.
  - `contract_stage`: the CRM stage whose canonical name contains `Контракт`;
    this is contract movement, not final sale.
  - `won`: deal reached a configured won stage or successful stage semantic.
  Each step publishes `rateFromCohort` and `rateFromPrevious`. `rateFromPrevious`
  is a conditional intersection against the previous factual step, so it cannot
  exceed `100%` when CRM stages and factual actions are not perfectly nested.
- Named conversion gaps:
  `SourceCohortConversionReport.trajectory.conversionGaps` exposes management
  gaps with fixed denominators:
  - `no_successful_call`: no trusted first successful call; denominator
    `created`.
  - `successful_call_without_meeting_stage`: successful call exists, but the CRM
    meeting stage was not reached; denominator `first_successful_call`.
  - `meeting_stage_without_fact`: CRM meeting stage was reached, but no trusted
    completed meeting fact exists; denominator `meeting_stage`.
  - `completed_meeting_without_next_stage`: trusted completed meeting fact
    exists, but there is no later forward CRM stage; denominator
    `completed_meeting`.
  - `attended_event_without_contract`: trusted attended event exists, but the
    contract stage was not reached; denominator `attended_event`.
  - `contract_without_win`: contract stage was reached, but the deal did not
    reach won; denominator `contract_stage`.
- Repeat event attendance: a deal is counted in `repeatAttendedEventDeals`
  when it has two or more trusted attended event visits after deal creation;
  `repeatAttendedEventVisits` counts additional visits beyond the first.
- Event performance is exposed through
  `SourceCohortConversionReport.trajectory.eventPerformance` and uses an
  event-date cohort, not the deal-creation cohort:
  - include trusted event participation records whose event date is inside the
    selected range and deduplicate them by event and deal;
  - `invitedVisits` counts all included event/deal pairs, `attendedVisits`
    counts the pairs with a trusted attended status, and
    `attendanceRate = attendedVisits / invitedVisits`;
  - the web client must show attendance as unavailable when invitation fields
    are missing from an incompatible or incomplete API response; it must not
    infer `invitedVisits = attendedVisits`;
  - a visit is contract-eligible only when the deal had not entered the contract
    stage before that event; a later re-entry does not count as a new contract;
  - count a transfer when its timestamp is after the attended event, with no
    upper time cutoff; the observation ends at the current local snapshot;
  - `contractRate = contractAfterVisits / contractEligibleVisits` and
    `transferredRate = transferredAfterVisits / attendedVisits`;
  - `medianDaysToContract` is measured from the event date to the first-ever
    contract-stage entry, only for contract-eligible visits;
  - rows are available by event type, individual event and current visit owner;
    a later contract can be observed after more than one event exposure, so row
    totals are non-additive;
  - observed post-event conversion is descriptive and must not be presented as
    causal event impact;
  - recent event cohorts naturally have less follow-up time, so comparisons
    across cohort months must show the cohort month and snapshot date.
- Stage and action facts are intentionally separate. `Встреча-знакомство` in CRM
  does not prove that a meeting happened; the report surfaces
  `meetingStageWithoutFactDeals` as a process/data-quality gap.
- Stage duration table uses canonical `deal_stage_facts`, not UI state:
  `medianDaysFromCreate` is the median duration from deal creation to first
  entry into the stage. `medianDaysOnStage` is the median completed dwell time
  per deal on that stage, calculated from `entered_at` to `left_at`. If a deal
  re-enters the same stage, its completed dwell times on that stage are summed
  first so one deal contributes one value to the median.
- Loss stages are outcomes, not operating queues. Stages with semantic `F`
  or names like `Корзина` / `Возврат` do not publish `medianDaysOnStage`.
- Open current-stage aging is not mixed into `medianDaysOnStage`; it needs a
  separate WIP/SLA aging layer because otherwise completed dwell time and current
  unfinished age would answer different management questions in one number.
- Speed/SLA buckets live in
  `SourceCohortConversionReport.trajectory.speedSteps`.
  - First successful call SLA: 3 days from deal creation. Buckets: `0-1`,
    `1-3`, `3-7`, `7+`, and `Нет факта`.
  - Completed meeting SLA: 7 days from deal creation. Buckets: `0-3`, `3-7`,
    `7-14`, `14+`, and `Нет факта`.
  - Attended event SLA: 14 days from deal creation. Buckets: `0-7`, `7-14`,
    `14-30`, `30+`, and `Нет факта`.
  - Contract-stage SLA: 14 days from deal creation. Buckets: `0-7`, `7-14`,
    `14-30`, `30+`, and `Нет факта`.
  - Post-meeting next-stage SLA: 7 days from the trusted completed meeting fact
    to the next productive forward CRM stage. Buckets: `0-3`, `3-7`, `7-14`,
    `14+`, and `Нет факта`.
  Each deal with a fact is assigned to exactly one time bucket. `Нет факта`
  is not a slow fact; it is a separate absence-of-evidence bucket.
- Slow counters answer "fact happened, but later than SLA":
  `slowFirstSuccessfulCallDeals`, `slowCompletedMeetingDeals`,
  `slowAttendedEventDeals`, and `slowContractStageDeals`. Denominator is the
  full slice for creation-relative steps and the completed-meeting slice for
  post-meeting movement.
- Stale counters answer "open work is stuck now":
  `staleAfterCompletedMeetingDeals` means there is a trusted completed meeting,
  the deal is still open, and no later productive CRM stage exists after
  7 days. `staleOpenContractStageDeals` means the current open stage is the
  contract stage and current age on that stage is over 14 days. Won/lost,
  basket, return, and non-qualified outcomes are excluded from stale open-work
  counters.
- Contract movement is reported separately from final sale: `contractStageDeals`
  counts deals that reached the attraction stage whose canonical name contains
  `Контракт`; contract timing uses the same `deal_stage_facts` duration rules.
  `contractWithoutWinDeals` is the management gap for deals that reached this
  stage but did not reach a won stage.
- Manager rows use the current deal responsible from the local CRM snapshot. They
  are safe for current-owner operational review; historical action-owner
  ranking requires a separate attribution layer.
- Source rows are the current CRM proxy for a supplier slice; there is no
  canonical supplier entity in this report contract yet.
- `qualityRows` groups deals by the final-quality value in the current local
  snapshot. It is an outcome/descriptive slice, not an intake-quality feature
  and not a causal driver.
- Event-manager rows use the current visit owner from the local snapshot. They
  do not prove who invited, conducted a reflection, or owned the deal at the
  time of attendance.
- Диагностика менеджеров lives in
  `SourceCohortConversionReport.trajectory.managerDiagnostics`. It is
  deterministic, not LLM-generated, and uses the same canonical row facts as
  the table.
  - Rows with `N < 10` get `low_sample`; they are descriptive only and must not
    be ranked.
  - A strong first call signal requires first-successful-call conversion at
    least 10 percentage points above the cohort and median days to the first
    successful call less than or equal to the cohort median.
  - A slow-call bottleneck is raised when the slow-call rate is at least 10
    percentage points above the cohort or the median first successful call is
    at least 2 days slower than the cohort median.
  - A CRM-meeting-without-fact bottleneck is raised when
    `meetingStageWithoutFactDeals / meetingStageDeals` is at least 10
    percentage points above the cohort and the count is at least 3.
  - A post-meeting bottleneck is raised when completed meetings without a later
    forward stage, or stale open deals after completed meeting, are at least 10
    percentage points above the cohort and the count is at least 3.
  - A contract bottleneck is raised when contract-stage deals without won, or
    stale open contract-stage deals, are at least 10 percentage points above
    the cohort and the count is at least 2.
  - Manager diagnostics are attributed to the current deal responsible in the
    local CRM snapshot (`текущему ответственному сделки`). A true historical
    action-owner comparison needs a separate attribution layer and must not
    silently reuse this field.
- Source and customer loss-shape analysis is exposed as
  `SourceCohortConversionReport.trajectory.*Rows[].lossShape` and rendered in
  the `Источник` / `Заказчик` tabs as `Профиль потерь`.
  - `not_reached_successful_call`: no trusted successful call; source field is
    `noSuccessfulCallDeals`.
  - `call_without_meeting_stage`: successful call exists, CRM meeting stage was
    not reached; source field is `successfulCallWithoutMeetingStageDeals`.
  - `meeting_stage_without_fact`: CRM meeting stage exists, completed meeting
    fact does not; source field is `meetingStageWithoutFactDeals`.
  - `meeting_fact_without_next_stage`: completed meeting has no later forward
    productive CRM stage. Source fields are
    `completedMeetingWithoutNextStageDeals` and
    `staleAfterCompletedMeetingDeals`; the aggregate shape uses `max(...)` to
    avoid double counting when the same deal is both no-next and stale.
  - `event_without_contract`: attended event exists, contract stage was not
    reached; source field is `attendedEventWithoutContractDeals`.
  - `contract_without_win`: contract stage reached, won stage not reached;
    source field is `contractWithoutWinDeals`.
  - `terminal_loss`: final lost outcome, including basket/return/loss stages.
    Basket/return are terminal losses, not current-stage workload.
  - `open_wip`: deal remains open and is not terminal loss or won.
  Dominant shape is descriptive: highest nonzero deal count wins; ties prefer
  later-funnel severity from contract to event to meeting to call to terminal
  and open deals. Rows with `N < 10` still must not be used for hard source or
  customer ranking.
- Customer/business-club slices must expose coverage:
  `businessClubDeals`, `businessClubMissingDeals`, and
  `businessClubCoverageRate`. If more than half of cohort deals have no
  business-club value, the customer slice is descriptive and must not be used as
  a hard ranking.
- Every slice must show denominator and data-quality status. Rows with `N < 10`
  must not be used for hard manager/source/customer/quality ranking.
- Dashboard rendering reads cached API/SQLite data only and must not perform
  direct Bitrix reads.

Privacy and module boundaries:

- The report must not expose deal names, contact names, phones, emails, raw
  Bitrix payloads, cookies, tokens, or webhooks.
- Leadgen dashboard/report behavior is outside this attraction report contract
  unless a separate reviewed issue expands scope.

### Conversion event stage table

- Module: `attraction`.
- Report scene: `activities-calls` / `Отчет активности`.
- Dashboard block: `attraction-conversion-events`.
- Ontology binding: `docs/modules/attraction/ontology/05-meetings-events-formats.md`
  and `docs/modules/attraction/ontology/07-reporting-and-guardrails.md`.
- Backend contract: `ActivitiesWorkloadReport.conversionEventRows`.
- Data source: cached canonical `event_visit_facts` joined with
  `deal_touchpoint_facts.kind = conversion_event_visit`.
- Link rule: include only direct attraction deal links with
  `linkReason = event_visit_deal`; do not use contact fallback links.
- Manager scope: use the attraction deal owner, not the smart-process visit
  responsible user, because visit records can be owned by a technical Bitrix
  user.
- Business columns: `Мероприятие`, `Пригласили`, `Дошли`, `Отказ`, `Еще ждут`,
  `С каких этапов звали`.
- Stage breakdown uses the canonical stage name at invitation time, so one
  event can be valid for different attraction stages in the same period.

### Message metrics research

- Current research note: [MESSAGE_METRICS_RESEARCH.md](./MESSAGE_METRICS_RESEARCH.md).
- Bitrix-only implementation can count non-system Open Lines messages through
  `imopenlines.session.history.get` without persisting message text.
- Activities exposes a manually triggered messenger section using the selected
  date and manager filters. It does not call Bitrix during normal report render.
- `POST /api/messenger-messages/summary` returns total non-system messages,
  messages with text, attachment-only messages, unique Open Lines sessions,
  deals with messages, excluded system events, and per-manager/channel rows.
  `Unique dialogs` is not presented as unique people.
- `POST /api/messenger-messages/read` is a leader-only, one-manager reader for
  at most 500 newest messages in a maximum-31-day range. It is `no-store`, omits
  names/contact data/raw payloads, and never writes text to SQLite, logs, MCP,
  comments, or report state.
- `POST /api/messenger-messages/collect` remains the server-side analysis input
  boundary and returns safe counts/coverage only.
- Exact `sent` / `received` split is not confirmed from Bitrix-only data because
  external Wazzup/OLChat messages may be recorded as `imconnector` messages even
  when sent outside Bitrix.

### Stage/loss-reason table

- Module: `attraction`.
- Backend contract: `buildAcquisitionOutcomesReport` aggregates cached `deal_snapshots` rows whose `stage_semantic_id` is lost (`F`) and whose resolved lost date is inside the requested range.
- Data scope: only attraction category deals inside the attraction manager whitelist are persisted and reported.
- Stage labels: resolved from cached deal stage catalog entries for attraction category stages.
- Reason labels: read from cached `deal_snapshots.refusal_reason_value`; empty values render as `Причина не указана`.

Reason dictionary semantics:

- `Корзина` attraction loss rows resolve through the attraction basket/lost reason list in `UF_CRM_1772109151192`, with legacy fallback to `UF_CRM_1647422744` when the destination-specific field is empty.
- `Возврат` attraction loss rows resolve through the attraction return reason list in `UF_CRM_1776949411825` (`Причина отказа (Привлечение Возврат в Лидген)`), with legacy fallback to `UF_CRM_1647422744` when the destination-specific field is empty.
- The attraction report must not read leadgen category `28`, leadgen reason dictionaries, or the leadgen manager whitelist to resolve this table.

Privacy and module boundaries:

- The report must not expose deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or webhooks.
- Dashboard rendering reads cached API/SQLite data only and must not perform direct Bitrix reads.
- Leadgen dashboard/report behavior is outside this attraction report contract unless a separate reviewed issue expands scope.
