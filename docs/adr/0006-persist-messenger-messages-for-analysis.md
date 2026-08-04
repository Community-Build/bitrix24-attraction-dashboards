# ADR 0006: Persist messenger messages for attraction analysis

## Status

Accepted on 2026-08-04 by explicit product-owner decision.

## Context

The first messenger report read Open Lines histories directly from Bitrix only
after a leader pressed a separate calculation button. Message text existed only
in process memory. This made the messenger block behave differently from every
other report, repeated expensive external reads, and prevented later analysis
of how a call and the following messages formed one communication sequence.

The product owner requires messenger totals and the reader to follow the common
date filter automatically and has explicitly authorized retaining full message
text for communication analysis. Structured contact fields, raw Bitrix payloads,
and credential-bearing attachment URLs remain outside the reporting store.

## Options

1. Keep transient live collection and trigger it automatically during page
   render.
2. Create a separate database file for messenger histories.
3. Add dedicated messenger session/message tables to the attraction SQLite
   snapshot and populate them during the normal sync cycle.

## Decision

Use option 3.

`messenger_session_snapshots` and `messenger_message_snapshots` live in the
existing attraction SQLite database. Sync discovers changed
`IMOPENLINES_SESSION` activities, loads their authoritative histories with
bounded concurrency, and replaces each refreshed session atomically. The
initial backfill uses the normal sync lookback; later runs use a dedicated
cursor that advances only when every discovered session was read successfully.

Each message stores stable internal IDs, exact timestamp, current deal manager,
channel, sender class, parsed direction, original author label, resolved author
manager ID when provable, cleaned body text, original body text, attachment file
IDs, and system/attachment flags. System rows are retained for auditability but
excluded from business totals.

Attribution is asymmetric by design:

- a confirmed outgoing message belongs to its resolved message author;
- an outgoing message without a resolvable author is reported separately and
  is not credited to the current deal owner;
- incoming and unsupported-direction messages use the current attraction deal
  owner for the operational manager row.

The Activities messenger block reads SQLite automatically whenever the common
date or manager filter changes. Aggregate responses never contain body text.
The leader-only reader returns at most 500 stored messages for one manager and
the exact selected range. Attachment bytes remain transient and are fetched
through the existing validated, bounded proxy.

## Consequences

- The report no longer performs Open Lines reads during page rendering and can
  respond quickly for a day, week, month, or other valid dashboard range.
- Full message bodies become sensitive local reporting data. Database backups
  inherit the same access boundary and must not be published or committed.
- Message text is available for future call/message sequence analysis without a
  second ingestion path.
- Manager totals may decrease compared with the original prototype because
  `Телефон` and other ambiguous authors are no longer credited to the current
  deal owner.
- The current connector evidence still cannot determine OLChat/Umnico direction;
  those rows remain visible under `unknown` until a provider-specific rule is
  proven.

## Revisit Conditions

Revisit this decision if retention periods become legally required, message
volume makes the primary SQLite database operationally unsuitable, provider
APIs expose stronger author/direction identity, or non-leader roles need access.
