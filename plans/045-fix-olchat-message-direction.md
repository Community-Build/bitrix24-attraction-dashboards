# 045 — Fix OLChat message direction across the messenger feature

## Outcome

Classify OLChat Telegram messages from provider evidence for every attraction
manager, restore hidden outgoing messages, keep genuine service events excluded,
and prove the complete reader/summary/storage path locally before any rollout.

## Scope and non-goals

- In scope: provider parsing, system-event classification, historical SQLite
  normalization, summary/reader copy, connector test matrix, accepted ontology,
  and local UI verification.
- Non-goal: infer authorship from the deal owner. OLChat does not identify the
  physical author in the observed prefix, so the UI may show the responsible
  manager only as operational attribution.
- Non-goal: deploy, mutate production data, change OLChat settings, or archive
  dashboard comments in this local phase.

## Sources and authority

- GitHub issue [#155](https://github.com/Community-Build/bitrix24-attraction-dashboards/issues/155).
- `docs/adr/0006-persist-messenger-messages-for-analysis.md` and
  `docs/modules/attraction/MODULE_ONTOLOGY.md` own the privacy, attribution, and
  reporting boundaries.
- Source, tests, and a redacted read-only production sample own the parser
  behavior. The 2026-07 Kuznetsova sample contains 218 connector messages, 205
  `OLChat Telegram / Исходящее` messages currently hidden as system events, and
  27 genuine system events.

## Decisions and contracts

- Direction is determined only from structural evidence: provider marker,
  Bitrix operator identity, or reviewed connector semantics. Message prose is
  never used.
- The OLChat Telegram outgoing marker is accepted only at the start of the raw
  message and only with Bitrix `sender_id = 0`; this prevents a client message
  from spoofing the marker.
- Unmarked OLChat connector messages are incoming. Unmarked OLChat
  `sender_id = 0` rows remain system events. Explicit Bitrix operators remain
  outgoing.
- Provider prefixes are removed from display text but retained in `raw_text`.
- Unknown-author outgoing rows remain separate from confirmed-author rows.

## Critical unknowns

- OLChat WhatsApp uses a different shape in the observed corpus: real outgoing
  messages carry operator IDs while `sender_id = 0` rows are service events.
  It must stay on its existing rule unless a separate structural marker is
  proven.

## Work packets

1. **Provider classifier** — owner: `apps/api/src/domain/messenger-messages.ts`.
   Add the OLChat Telegram rule, scope existing markers to their providers, and
   centralize the system decision. Verify with a table-driven connector matrix
   and spoof cases.
2. **Storage normalization** — owner:
   `apps/api/src/server/sqlite/messenger-messages.ts` and SQLite tests. Bump the
   normalization version, recalculate `is_system`, direction, cleaned text, and
   author without changing `raw_text`.
3. **Reporting/UI contract** — owner: messenger collection and attraction web
   reader/summary files. Update only statements that still claim OLChat has no
   direction; keep leader-only and no-body aggregate boundaries unchanged.
4. **Durable contract** — owner: ADR/research/ontology/backlog. Record the
   verified OLChat Telegram rule and its authorship limitation once.
5. **Independent local gates** — run focused API/web tests, full API/web suites,
   typecheck, lint, ontology validation, diff checks, architecture review,
   code review, Ponytail review, and local browser verification.

## Validation

- Parser matrix covers WAZZUP, Umnico, OLChat Telegram, OLChat WhatsApp,
  operator, connector, `sender_id = 0`, attachment-only, and spoofed markers.
- SQLite migration converts stale OLChat outgoing rows from system/unknown to
  non-system/outgoing, keeps service rows hidden, and is idempotent.
- Summary/reader tests prove outgoing/incoming totals, unknown-author
  separation, no message bodies in aggregates, and plain-text display.
- Local representative Kuznetsova fixture yields 218 incoming, 205 outgoing,
  zero unknown, and 27 excluded system rows.

## Recovery and rollback

- Code rollback is a normal revert of plan 045 changes.
- No production rollback is needed in this phase because no deploy or data
  mutation is authorized.
- A future rollout must back up the mounted SQLite database first. Reverting the
  parser does not destroy `raw_text`; a later normalization version can restore
  classifications deterministically.

## Done criteria

- All planned local checks are green and the final diff has no blocking code,
  architecture, security-boundary, or Ponytail findings.
- The implementation is committed on `codex/155-fix-messenger-direction-all-connectors`.
- Production remains unchanged until explicit rollout authorization.

## Completion evidence

- Focused API: 12 tests passed; focused web: 52 tests passed.
- Full API: 640 tests passed; full web: 192 tests passed.
- Workspace typecheck, lint, ontology validation, and `git diff --check` passed.
- Local browser at 612×767 rendered the Kuznetsova reader with 16 retained
  messages for 27 July–2 August: 7 outgoing, 9 incoming, zero unknown, and no
  console warnings or errors.
- Code, architecture, and Ponytail reviews found no remaining blocking issue.
  The deliberately rejected alternative was a provider strategy hierarchy;
  the single classifier remains the smaller deep module.
