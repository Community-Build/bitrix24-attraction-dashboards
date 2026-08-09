# ADR 0007: Leader-only deal activity content

## Status

Accepted on 2026-08-10 by explicit product-owner feedback on the deal-analysis
timeline.

## Context

The deal-analysis drawer showed task IDs, raw timestamps and call duration, but
not the work object itself. `activity_snapshots` did not retain Bitrix activity
`SUBJECT` or `DESCRIPTION`, so a leader could not understand what a task was or
what instruction it contained. Call analysis was stored separately and the
deal detail returned only a short conclusion, not the existing transcript.

The product owner requires one chronological view of tasks, calls, messages,
meetings, conversion events and stage changes. Page rendering must continue to
read the local snapshot and must not call Bitrix directly.

## Decision

The normal attraction sync selects Bitrix activity `SUBJECT` and `DESCRIPTION`.
Before persistence, markup and executable blocks are removed, whitespace is
normalized, and values are bounded to 500 and 4,000 characters respectively.
Only the cleaned text is stored in `activity_snapshots`; raw Bitrix payloads are
not retained.

The privacy-safe deal-analysis summary remains unchanged. Cleaned task content,
message bodies, call-analysis conclusions and the saved call transcript are
returned only by the lazy, leader-only detail route for one exact deal ID. The
same access boundary applies to starting call analysis. None of this content may
enter aggregate responses, MCP, dashboard comments, notifications or logs.

The timeline excludes technical Open Lines activities and messenger system rows
(`sender_id = 0` / system classification). Rows without a user-visible message
body are not rendered as customer communication. Task deadlines are presented
as the planned completion time (`Выполнить до`), distinct from creation and
actual completion.

The deal drawer is a read-only context view. It may preview an already saved call
score, summary and transcript, but it does not start a second analysis flow.
Every call action opens the existing call-analysis workspace with the exact call
preselected and its date applied to the queue filters; manual analysis remains
owned by that workspace.

## Consequences

- A sync is required before older activities gain titles and descriptions.
- The activity snapshot and its backups now contain bounded sensitive work
  text and inherit the leader-only access and retention controls.
- The deal drawer reads existing call-analysis storage and routes manual work to
  the existing call-analysis workspace instead of creating a second analysis
  pipeline or a second mutation owner.
- Raw AI evaluation, evidence quotes and raw Bitrix payloads remain excluded.

## Revisit Conditions

Revisit if non-leader roles need access, a legal retention period is introduced,
activity volume makes SQLite unsuitable, or task content must be redacted with
stronger PII rules.
