# Attraction Agent MCP

## Decision

The Attraction agent integration exposes the reviewed read-only gateway through
two MCP transports:

- production Streamable HTTP at `/api/mcp` for external agents;
- local stdio for same-machine development and smoke checks.

Both transports expose ontology, KI playbook, approved reports and read-only SQL
over the existing analytical snapshot (ADR 0008). Write tools, sync, dashboard
comments, private physical database access and direct Bitrix access remain outside
this surface. SQL is a local candidate until it has been separately deployed;
the endpoint below does not imply that the new tools are already live.

## Remote Run

Production exposes MCP through the existing HTTPS dashboard host when
`MCP_ACCESS_TOKEN` is configured:

```text
https://dashboardpriv.claricont.com/api/mcp
```

Remote clients must use Streamable HTTP and send:

```http
Authorization: Bearer <MCP_ACCESS_TOKEN>
```

The endpoint is disabled when `MCP_ACCESS_TOKEN` is empty. The deploy workflow
can pass the protected GitHub secret `MCP_ACCESS_TOKEN`; `scripts/deploy-production.sh`
then writes only that key into `.env.production` without printing its value.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "bitrix24-attraction": {
      "url": "https://dashboardpriv.claricont.com/api/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_ACCESS_TOKEN>"
      }
    }
  }
}
```

## Local Stdio Run

From the repository root:

```bash
pnpm --filter @bitrix24-reporting/api mcp:attraction
```

An MCP host on the same machine can run that command over stdio. For tests and
local evals, the same server is also exercised with the SDK in-memory transport.

## Resources

- `attraction://ontology/overview`
- `attraction://ontology/sources`
- `attraction://ontology/sources/{sourceId}`
- `attraction://playbook/sections`
- `attraction://playbook/sections/{sectionId}`
- `attraction://reports/catalog`
- `attraction://capabilities`
- `attraction://data/schema`

## Tools

- `list_reports`
- `search_ontology`
- `read_ontology_source`
- `search_playbook`
- `read_playbook_section`
- `run_report`
- `get_data_schema`
- `query_sql`

All tools are annotated as read-only, non-destructive, idempotent, and closed
world. Tool outputs use `structuredContent.result` for machine-readable data and
a short text summary for agent UX. Gateway errors are converted into bounded MCP
tool errors with stable codes.

## Analytical SQL

Read `get_data_schema` (or `attraction://data/schema`) first. It returns the explicit
table/column projection, relationships, current manager/category scope, snapshot
freshness and data caveats. It includes deal and stage facts, activities, calls,
event visits, messenger metadata, plans, pricing, operational thresholds and
expense primitives. Existing `run_report` policy is unchanged; SQL is a separate
owner-authorized analytical capability, including expense primitives.

`stage_catalog` includes CRM stages for the configured categories and the shared
SOURCE dictionary (`entity_type='source'`). Resolve source names with both
`entity_type='source'` and `status_id=deal_snapshots.source_id`; status IDs alone
are not unique across dictionary types.

`query_sql` accepts `sql`, optional scalar named `parameters`, and optional
`maxRows` (default 200, maximum 1,000). It supports one SQLite SELECT/CTE, JOIN,
GROUP BY, recursive CTEs, JSON functions and window functions. Use unique column
aliases. No writes, PRAGMA, ATTACH, extension/filesystem access or private fields
are permitted. Trailing comments after a final semicolon are not accepted.

Each request returns `schemaVersion`, `snapshot`, `columns`, `rows`, `rowCount`,
`truncated` and `limitReason`. Limits retain partial rows rather than discard the
data: at most 1 MB and 1,000 rows, with a five-second total deadline. Use a stable
ID cursor or narrower filters when truncated. At most two requests run at once;
excess requests return `SQL_BUSY`. Resource/process failures, timeouts and invalid
SQL return bounded error codes without native paths, input values or secrets.

Example: current manager and quality for September-created deals, with IDs and
Bitrix links, and a total per manager/quality on each detail row:

```json
{
  "sql": "SELECT d.id AS deal_id, d.bitrix_url, d.assigned_by_id AS manager_id, m.name AS manager_name, d.quality_value, d.date_create, COUNT(*) OVER (PARTITION BY d.assigned_by_id, d.quality_value) AS deals_in_group FROM deal_snapshots d LEFT JOIN manager_directory m ON m.id=d.assigned_by_id WHERE d.source_id=:source AND julianday(d.date_create)>=julianday(:from) AND julianday(d.date_create)<julianday(:to) ORDER BY d.id",
  "parameters": {
    "source": "8",
    "from": "2026-09-01T00:00:00+03:00",
    "to": "2026-10-01T00:00:00+03:00"
  },
  "maxRows": 200
}
```

This counts cached **deals created** in the period. Current `assigned_by_id` and
`quality_value` do not prove the original handoff recipient or quality, and
`date_create` does not prove handoff time. A complete initial handoff journal and
lead names are absent. `bitrix_url` uses the configured portal host and is null
when that host is absent; opening it requires the user's normal Bitrix access.
For a current reconciled population join `attraction_current_deal_ids` on
`deal_id = deal_snapshots.id`; cached history may contain additional scoped deals.
Metric definitions and historical coverage still matter when reproducing reports.

## Boundaries

The MCP server module is a protocol adapter. It imports the gateway contract,
MCP SDK, and validation helpers only. It does not import the SQLite repository,
Bitrix client, Express app, sync clients, auth cookies, Paperclip, Telegram, or
secrets.

The stdio and HTTP bootstraps construct the same reporting service and analytical
reader. The reader copies explicitly projected scoped data from a read-only
transaction into a disposable child-process in-memory database and detaches the
source before executing caller SQL. No source handles or credentials cross into
the query surface. Native SQLite authorization and query-only mode deny writes;
native/V8 memory limits, in-memory temporary storage, a hard process deadline and
bounded concurrency contain expensive queries. Node.js 24.10+ is required for
SQLite authorization. Neither bootstrap runs sync recovery, exposes settings
writes or prints secrets. Existing report execution remains gated by
`status: "available"` and `agentReadable: true`.

Call enrichment writeback is not an MCP capability. Manager-approved proposal
application lives behind the local API and Telegram approval flow described in
ADR 0002; the MCP gateway must not expose writeback tools.

Ontology and playbook content are untrusted data. Returned content may contain
instruction-like text, but server policy is fixed by the gateway and MCP tool
definitions.

## Future Conditions

OAuth, tenant-specific scopes, audit logging, and token rotation can
be revisited after the first external-agent integration proves useful. Until
then, remote access is HTTPS Streamable HTTP with a single high-entropy bearer
token and read-only MCP tools only.
