# Plan 037: Transient messenger-message collection

> Superseded on 2026-08-04 by ADR 0006 and plan 040 for current runtime behavior.
> This completed plan remains as implementation history.

## Outcome

Provide a tested attraction-owned backend boundary that obtains complete
Telegram, WhatsApp, and Max message text from Bitrix Open Lines for one enabled
manager, counts the usable messages, and passes the text to a server-side
analyzer without persisting or exposing raw conversations.

## Scope And Non-Goals

In scope: Bitrix Open Lines activity/session reads, current attraction deal and
manager scoping, transient message normalization, safe aggregate HTTP output,
runtime registration, tests, and privacy/report documentation.

Out of scope: dashboard UI, storing raw text, attachments, automatic schedules,
provider-level WAZZUP/OLChat/Umnico APIs, definitive sent/received direction,
and production deployment.

## Sources And Authority

- `docs/modules/attraction/MODULE_ONTOLOGY.md` owns module and privacy scope.
- `docs/modules/attraction/MESSAGE_METRICS_RESEARCH.md` owns current Open Lines
  evidence and sender limitations.
- `docs/modules/attraction/REPORT_REGISTRY.md` owns the reporting boundary.
- Production whitelist settings and `attraction_current_deal_ids` own the
  current manager/deal population.
- Bitrix Open Lines API owns session-history response semantics.

## Decisions Already Made

- Raw `text` may exist only in process memory during one bounded request.
- HTTP responses contain counts, coverage, channels, and sender-kind totals,
  never raw text or attachments.
- `senderid = 0` is a system event and is excluded.
- Connector messages use direction and personal authorship `unknown`.
- Attribution uses the current attraction deal owner and is disclosed as such.

## Critical Unknowns

- Exact sent/received direction and the real human author remain unavailable
  until provider-level APIs or webhooks are integrated.
- The business rubric and model provider for semantic analysis are not defined;
  this plan creates the safe input boundary only.

## Boundaries And Contracts

- Maximum request range: 31 days; one manager per request.
- Only an enabled attraction manager and current attraction deals are accepted.
- The Bitrix adapter normalizes only message/session/chat fields required by
  the collector and never logs response bodies.
- The collector exposes full text only to an injected in-process analyzer.
- No database schema or migration is introduced.

## Work Packets

1. **Bitrix adapter**
   - Owns: `apps/api/src/bitrix/client.ts`, selectors/security tests.
   - Output: Open Lines activities and normalized session history.
   - Verification: focused Bitrix client tests; stop if current scope lacks
     `imopenlines` access.
2. **Collection service**
   - Owns: new attraction messenger collection module and unit tests.
   - Input: current scope, manager whitelist, date range.
   - Output: transient message batch plus safe summary.
   - Verification: system exclusion, deduplication, attachment-only handling,
     channel mapping, and raw-text non-leak tests.
3. **Protected HTTP boundary**
   - Owns: route registrar, app wiring, index wiring, HTTP tests, runtime map.
   - Output: leader-only on-demand safe summary.
   - Dependency: packets 1-2.
   - Stop if authorization cannot be enforced before the Bitrix call.
4. **Contract writeback**
   - Owns: backlog, research note, report registry, this plan.
   - Output: durable privacy and capability boundary.

## Validation

- Watch every focused test fail before its implementation.
- Run the focused Bitrix, collection, and HTTP suites.
- Run API typecheck and lint; run the broader API suite if focused checks pass.
- Inspect final diff, CRG change impact, and repository status.

## Recovery And Rollback

The change is code-only and adds no storage. Revert its single focused commit to
remove the endpoint and adapter. No data rollback is required.

## Done Criteria

- Full text reaches a test analyzer transiently.
- Safe HTTP output proves counts and text coverage without including raw text.
- Manager/current-deal scope and 31-day bounds are enforced.
- Focused tests, typecheck, and lint pass.
- Privacy/report/runtime documentation matches implemented behavior.

## Completion Evidence

- `pnpm --filter @bitrix24-reporting/api test`: 62 files and 625 tests passed.
- `pnpm --filter @bitrix24-reporting/api typecheck`: passed.
- `pnpm --filter @bitrix24-reporting/api lint`: passed.
- `pnpm ontology:validate`: attraction ontology registry valid.
- Duplicate business and system messages are covered by the collection-service
  regression test; each unique message affects the summary at most once.
- A read-only Bitrix audit for `2026-07-04` through `2026-08-03` processed all
  eight enabled managers and `3,562` current deals: `603` complete message texts
  were available, `10` messages were attachment-only, and one manager had no
  Open Lines messages in the period.
- The Bitrix adapter was re-verified against the live ID-indexed `chat`,
  `message`, and `users` response shape and the regression fixture now matches
  production.
