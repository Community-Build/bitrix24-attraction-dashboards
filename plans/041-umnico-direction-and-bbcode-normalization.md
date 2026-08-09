# Plan 041: Umnico direction and BBCode normalization

> Completed through GitHub issue #145 and PR #146.

## Outcome

Correct Umnico message direction in the Activities messenger report and reader,
remove the connector service header and bold BBCode from displayed text, and
normalize already-cached rows without losing their original raw text.

## Scope And Non-goals

In scope: the provider-specific Umnico direction rule, cleaned author/body text,
an idempotent SQLite normalization version for historical rows, reader copy,
focused tests, contract documentation, production rollout, and de-identified
production verification.

Not in scope: inferring OLChat direction, changing Bitrix collection methods,
message retention/access, exposing bodies in aggregates or evidence, rescoring
other provider semantics, or replacing the production database.

## Sources And Authority

- Product-owner browser comments recorded on 2026-08-09.
- GitHub issue #145.
- ADR 0006 and the attraction messenger reporting contracts.
- Current source parser and production SQLite snapshots.
- One sanitized `imopenlines.session.history.get` response-shape check for the
  affected dialog; no message bodies are included in evidence.

## Decisions Already Made

- For Umnico, `Outcoming message` is an explicit outgoing marker.
- A non-system Umnico connector message without that marker is incoming. This
  rule does not generalize to OLChat.
- `[b]` and `[/b]` are formatting tokens: remove the tokens from displayed body
  and author text while retaining their content and exact `raw_text`.
- Historical rows must be normalized in place through an idempotent versioned
  migration so report aggregates and the reader agree immediately after deploy.

## Critical Unknowns

- Umnico exposes no separate direction field in the observed Bitrix history
  payload; the rule depends on the connector's stable text convention.
- OLChat has substantial BBCode usage but no verified outgoing marker, so its
  direction remains unknown even though display text can be cleaned.

## Boundaries And Contracts

- Classification and display-text cleanup remain domain logic shared by new
  sync rows and the historical SQLite migration.
- `raw_text` remains unchanged and never enters aggregate responses or logs.
- The normalization migration writes only derived message columns and its own
  integer version; it does not alter session, deal, timestamps, attachments, or
  access scope.
- Existing current-scope and leader-only reader/attachment controls remain.

## Work Packets

1. Domain parser
   - Owns: `apps/api/src/domain/messenger-messages.ts` and sync tests.
   - Output: Umnico marker parsing, unmarked incoming classification, BBCode
     cleanup, and resolved author where the whitelist match is provable.
2. Historical cache normalization
   - Owns: messenger SQLite repository/schema and repository tests.
   - Output: idempotent versioned update of derived fields, preserving raw text.
   - Stop: no production mutation before backup and deployment readiness.
3. Reader contract
   - Owns: reader copy/tests and durable messenger docs.
   - Output: accurate provider explanation and clean rendered labels/body.
4. Verification and release
   - Owns: targeted/full checks, CRG diff review, browser inspection, commit,
     PR/CI/merge/deploy, production backup, health/API/data smoke.

## Validation

- API: focused sync/parser and SQLite migration tests, then the relevant API
  suite plus typecheck/lint.
- Web: reader regression test and full web suite.
- Browser: desktop and mobile reader inspection, keyboard/focus, console, and
  visible absence of service headers and BBCode.
- Data: compare de-identified Umnico marked/unmarked/direction counts before and
  after normalization; verify `raw_text` count and SQLite integrity are stable.
- Review: CRG changed-file risk, final diff/status, and independent reviewer.

## Recovery And Rollback

Create and verify a SQLite backup before production starts the migrated code.
Code rollback restores the previous parser/UI. The migration changes only
derived columns; exact `raw_text` remains available for a version-bumped forward
reclassification if the provider contract is revised.

## Done Criteria

- New and historical Umnico marked messages are outgoing; unmarked non-system
  Umnico messages are incoming; OLChat direction is unchanged.
- The reader shows neither the Umnico service prefix nor `[b]` / `[/b]` tokens.
- Raw text is byte-preserved, migration is idempotent, and focused/full checks
  pass.
- PR is green and merged, production deploy succeeds, VPS revision/health and
  sanitized direction counts are verified, and issue #145 contains the outcome.
