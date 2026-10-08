# ADR 0008: Read-only analytical SQL through MCP

## Status

Accepted scope by product owner on 2026-10-08: first provide SQL over existing
data, without importing lead names; include deal IDs and Bitrix deal links.
Implementation is a local candidate. Production rollout requires separate approval.

## Context

Predefined `run_report` handlers cannot answer arbitrary analytical questions or
recalculate new combinations of metrics. Direct access to the physical SQLite
database would also expose private task/message/transcript text, operational
records and future columns outside the analytical contract.

## Decision

Add `get_data_schema`, `query_sql` and `attraction://data/schema` to both existing
MCP transports. Existing report and knowledge tools remain compatible.

SQL reads an explicit projection of analytical columns and configured Attraction
deal categories/enabled managers. Deal-dependent history, visits, activities and
messenger metadata inherit that deal scope. Manager call workload inherits the
manager whitelist; foreign CRM/activity identifiers are cleared. Module-wide
business event inventory, analytical rules and expense primitives are exposed for
recalculation. Existing report-level `agentReadable` gates still apply to
`run_report`; SQL is a separate owner-authorized capability over these primitives.

Exclude lead names, contact personal data, free text about refusals, work-object
text, message sender identities/files/bodies, transcripts, raw payloads, comments,
auth, tokens and registration/writeback storage. Employee manager names and
deal/lead/contact identifiers remain useful analytical fields. Explicit columns
prevent a future schema addition from silently expanding access.

A disposable child process attaches the source file in `mode=ro`, copies the
projection in one read transaction, then detaches the source. Only the resulting
in-memory tables exist when caller SQL runs. This makes CTE/view-name shadowing
irrelevant to row isolation. SQLite authorization allows reads and analytical
functions; query-only mode provides an additional write barrier. No SQL regex is
used as an access-control boundary. The standard `node:sqlite` API requires
Node.js 24.10+; no runtime dependency is added.

Bound each request by rows/bytes, native/V8 memory and a five-second process
deadline; allow at most two requests per shared reader. Return partial rows with
explicit truncation, freshness/scope metadata and stable sanitized errors. SQL
text and parameter values are not logged. Query workers do not inherit secrets.

## Consequences

Agents and ordinary MCP clients can perform SELECT/CTE, JOIN, GROUP BY, JSON and
window calculations without adding a report handler. The source database needs no
migration or data backfill, and caller queries cannot mutate it. A fresh snapshot
is prepared for each request; cached historical deals and current scope membership
remain distinct. Projection preparation and query execution share the deadline;
large snapshots/queries can hit resource limits and must be measured before rollout.

This does not recover absent historical handoff facts or names. Creation time,
current manager and current quality must not be labeled as proven initial delivery
time/recipient/quality. URLs open existing Bitrix deals and confer no Bitrix access.

Rollback removes the two data tools/reader wiring; the existing MCP report and
knowledge surface stays available. No production data rollback is necessary.
