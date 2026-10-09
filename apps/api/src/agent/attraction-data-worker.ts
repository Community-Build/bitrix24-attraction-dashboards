import { DatabaseSync, constants } from "node:sqlite";
import { pathToFileURL } from "node:url";

import type { AttractionDataQuery, AttractionDataResult, AttractionDataSchema } from "./attraction-data-contract.js";

const MAX_BYTES = 1_000_000;
const managerScope = "IN (SELECT manager_id FROM main.module_manager_whitelist_settings)";
const dealScope = "IN (SELECT id FROM main.deal_snapshots)";
const activityScope = "IN (SELECT id FROM main.activity_snapshots)";

// Explicit columns prevent future private fields from becoming MCP data automatically.
const tables = [
  ["module_manager_whitelist_settings", "Enabled Attraction managers and teams", "module_key,manager_id,manager_name,team_id,team_name,enabled,sort_order,updated_at", "module_key = 'attraction' AND enabled = 1"],
  ["manager_directory", "Manager names (employees, not leads)", "id,name", `id ${managerScope}`],
  ["deal_snapshots", "Cached deals; assigned_by_id and quality_value are current values; bitrix_url opens the deal", "id,contact_id,lead_id,category_id,stage_id,stage_semantic_id,opportunity,assigned_by_id,source_id,quality_value,business_club_value,target_group_value,meeting_type_value,meeting_date_value,tariff_value,conversion_event_value,refusal_reason_value,date_create,date_modify,date_closed,CAST(bitrix_deal_url(id) AS TEXT) AS bitrix_url", `assigned_by_id ${managerScope} AND category_id IN (SELECT value FROM json_each(:categories))`],
  ["attraction_current_deal_ids", "Membership in the last reconciled current scope; cached history may contain additional deals", "deal_id", `deal_id ${dealScope}`],
  ["stage_catalog", "CRM stages for configured deal categories and the shared source dictionary", "entity_type,category_id,status_id,name,semantic_id,sort_order", "entity_type = 'source' OR category_id IN (SELECT value FROM json_each(:categories))"],
  ["stage_history_snapshots", "Stage transitions of scoped deals", "id,owner_id,category_id,stage_id,stage_semantic_id,type_id,created_time", `owner_id ${dealScope}`],
  ["activity_snapshots", "Activity metadata; excludes text and clears owner identifiers outside scoped deals", `id,CASE WHEN owner_type_id IN ('2','DEAL') AND owner_id ${dealScope} THEN owner_type_id END AS owner_type_id,CASE WHEN owner_type_id IN ('2','DEAL') AND owner_id ${dealScope} THEN owner_id END AS owner_id,type_id,provider_id,responsible_id,created_time,deadline,last_updated,completed,completed_time`, `(owner_type_id IN ('2','DEAL') AND owner_id ${dealScope}) OR id IN (SELECT activity_id FROM source.activity_binding_snapshots WHERE owner_type_id IN ('2','DEAL') AND owner_id ${dealScope})`],
  ["activity_binding_snapshots", "Activity bindings to scoped deals only", "activity_id,owner_type_id,owner_id", `activity_id ${activityScope} AND owner_type_id IN ('2','DEAL') AND owner_id ${dealScope}`],
  ["activity_deadline_changes", "Observed activity deadline changes", "id,activity_id,owner_id,responsible_id,previous_deadline,next_deadline,changed_at", `activity_id ${activityScope} AND owner_id ${dealScope}`],
  ["deal_meeting_date_changes", "Observed deal meeting date changes", "id,deal_id,slot_index,assigned_by_id,previous_meeting_date,next_meeting_date,changed_at", `deal_id ${dealScope}`],
  ["deal_meeting_slots", "Meeting slot metadata; excludes free text location and calendar content", "deal_id,slot_index,date_value,type_value,event_id,source,updated_at", `deal_id ${dealScope}`],
  ["conversion_event_visit_snapshots", "Legacy conversion event visits linked to scoped deals", "id,event_id,event_name,event_date,status,stage_id,stage_name,deal_id,contact_id,manager_id,source_id,created_time,updated_time", `deal_id ${dealScope}`],
  ["identity_links", "Deal/lead/contact identifier links and confidence", "identity_id,module_key,deal_id,lead_id,contact_id,deal_category_id,lead_category_id,current_manager_id,current_stage_id,source_id,created_at,updated_at,link_confidence,link_reason", `module_key = 'attraction' AND deal_id ${dealScope}`],
  ["deal_stage_facts", "Normalized stage intervals; excludes raw payloads", "fact_id,source_system,source_entity_id,deal_id,contact_id,lead_id,category_id,stage_id,stage_name,stage_semantic_id,entered_at,left_at,manager_id,source_id,sort_order", `deal_id ${dealScope}`],
  ["deal_touchpoint_facts", "Normalized touchpoints and event-time attribution; excludes raw payloads", "fact_id,kind,source_system,source_entity_type,source_entity_id,occurred_at,deal_id,contact_id,lead_id,manager_id,source_id,stage_id_at_event,stage_name_at_event,link_confidence,link_reason", `deal_id ${dealScope}`],
  ["event_visit_facts", "Normalized event attendance statuses and dates", "visit_id,event_id,deal_id,contact_id,lead_id,manager_id,source_id,current_stage_id,current_stage_name,invited_at,confirmed_at,attended_at,refused_at,final_status,event_date,stage_id_at_event,link_confidence,link_reason", `deal_id ${dealScope}`],
  ["event_visit_stage_history", "Event visit stage transitions", "history_id,visit_id,entity_type_id,category_id,stage_id,stage_name,type_id,changed_at", "visit_id IN (SELECT visit_id FROM main.event_visit_facts)"],
  ["event_snapshots", "Cached business event inventory, including events without visits", "event_id,entity_type_id,category_id,title,event_date,start_at,end_at,stage_id,stage_name,status,event_type_id,event_type_label,format_id,created_time,updated_time", "1"],
  ["module_event_type_settings", "Attraction enabled event types", "module_key,event_type_id,event_type_label,enabled,updated_at", "module_key = 'attraction'"],
  ["conversion_event_type_options", "Planned conversion event inventory selection", "id,title,category_id,stage_id,selected_for_planned_inventory,updated_at", "1"],
  ["call_snapshots", "Whitelisted manager call workload; external CRM identifiers are cleared", "id,CASE WHEN crm_activity_id IN (SELECT id FROM main.activity_snapshots) THEN crm_activity_id END AS crm_activity_id,portal_user_id,call_type,call_start_date,call_duration_seconds,CASE WHEN crm_entity_type = 'DEAL' AND crm_entity_id IN (SELECT id FROM main.deal_snapshots) THEN crm_entity_type END AS crm_entity_type,CASE WHEN crm_entity_type = 'DEAL' AND crm_entity_id IN (SELECT id FROM main.deal_snapshots) THEN crm_entity_id END AS crm_entity_id,call_failed_code", `portal_user_id ${managerScope}`],
  ["messenger_session_snapshots", "Messenger session metadata, without text or contact identity", "session_id,activity_id,deal_id,deal_manager_id,channel_key,channel_label,activity_updated_at,synced_at", `deal_id ${dealScope}`],
  ["messenger_message_snapshots", "Messenger timing/direction/employee metadata; no text, sender identity or files", "session_id,message_id,activity_id,deal_id,deal_manager_id,occurred_at,occurred_at_ms,channel_key,channel_label,sender_kind,direction,author_manager_id,has_attachment,is_system,synced_at,normalization_version", `deal_id ${dealScope}`],
  ["won_stage_config", "Configured won stages", "stage_id,enabled", "1"],
  ["sales_plan_rows", "Whitelisted manager plans", "period_start,period_end,manager_id,manager_name,target_group_key,target_group_label,planned_deals,planned_amount,updated_at", `manager_id ${managerScope}`],
  ["pricing_rules", "Attraction tariff revenue rules", "id,customer_label,tariff_label,attraction_revenue_amount,enabled,sort_order,updated_at", "1"],
  ["operational_threshold_settings", "Attraction operational thresholds; explicitly projected configuration values", "key,CAST(json_extract(payload_json,'$.noCallsMaxDays') AS REAL) AS no_calls_max_days,CAST(json_extract(payload_json,'$.noActivityMaxDays') AS REAL) AS no_activity_max_days,CAST(json_extract(payload_json,'$.slaBusinessHours.sla1') AS REAL) AS sla1_business_hours,CAST(json_extract(payload_json,'$.slaBusinessHours.sla2') AS REAL) AS sla2_business_hours,CAST(json_extract(payload_json,'$.slaBusinessHours.sla3') AS REAL) AS sla3_business_hours,(SELECT json_group_array(json_object('stage_id',json_extract(value,'$.stageId'),'max_days_on_stage',json_extract(value,'$.maxDaysOnStage'))) FROM json_each(payload_json,'$.stageAging')) AS stage_aging_json,updated_at", "key = 'attraction'"],
  ["sync_coverage", "Historical stream coverage for the current reconciled scope", "scope_key,stream,provider_id,covered_from,covered_to,algorithm_version,synced_at", "scope_key = (SELECT value FROM source.sync_state WHERE key = 'attraction_current_scope_key')"],
  ["unit_economics_cost_articles", "Analytical expense articles", "id,name,pnl_level,cost_behavior,calculation_method,enabled,sort_order,effective_from,effective_to,updated_at", "1"],
  ["unit_economics_cost_rules", "Analytical expense calculation rules", "id,article_id,pnl_level,cost_behavior,calculation_method,unit_price,percent,amount,source_key,quality_value,event_name_pattern,enabled,effective_from,effective_to,sort_order,updated_at", "1"],
  ["unit_economics_cost_facts", "Analytical expenses; excludes comments and source references", "id,article_id,pnl_level,cost_behavior,calculation_method,period_start,period_end,amount,currency,quantity,source_system,confidence,status,created_at,updated_at", "1"],
  ["unit_economics_settings", "Event participant costing mode", "id,event_participant_mode,updated_at", "1"]
] as const;

const relationships = [
  ["deal_snapshots.assigned_by_id", "manager_directory.id"],
  ["deal_snapshots.assigned_by_id", "module_manager_whitelist_settings.manager_id"],
  ["attraction_current_deal_ids.deal_id", "deal_snapshots.id"],
  ["stage_history_snapshots.owner_id", "deal_snapshots.id"],
  ["activity_binding_snapshots.owner_id", "deal_snapshots.id"],
  ["activity_binding_snapshots.activity_id", "activity_snapshots.id"],
  ["activity_deadline_changes.activity_id", "activity_snapshots.id"],
  ["deal_meeting_date_changes.deal_id", "deal_snapshots.id"],
  ["deal_meeting_slots.deal_id", "deal_snapshots.id"],
  ["identity_links.deal_id", "deal_snapshots.id"],
  ["deal_stage_facts.deal_id", "deal_snapshots.id"],
  ["deal_touchpoint_facts.deal_id", "deal_snapshots.id"],
  ["event_visit_facts.deal_id", "deal_snapshots.id"],
  ["event_visit_facts.event_id", "event_snapshots.event_id"],
  ["event_visit_stage_history.visit_id", "event_visit_facts.visit_id"],
  ["conversion_event_visit_snapshots.deal_id", "deal_snapshots.id"],
  ["call_snapshots.crm_activity_id", "activity_snapshots.id"],
  ["messenger_message_snapshots.session_id", "messenger_session_snapshots.session_id"],
  ["messenger_session_snapshots.deal_id", "deal_snapshots.id"],
  ["sales_plan_rows.manager_id", "manager_directory.id"],
  ["unit_economics_cost_rules.article_id", "unit_economics_cost_articles.id"],
  ["unit_economics_cost_facts.article_id", "unit_economics_cost_articles.id"]
].map(([from, to]) => ({ from: from!, to: to! }));

interface Request {
  operation: "schema" | "query";
  databasePath: string;
  categoryIds: string[];
  portalOrigin: string | null;
  query?: AttractionDataQuery;
}

function readData(request: Request): AttractionDataSchema | AttractionDataResult {
  const database = new DatabaseSync(":memory:", { enableDoubleQuotedStringLiterals: false });
  let ready = false;
  try {
    database.exec("PRAGMA hard_heap_limit = 134217728; PRAGMA temp_store = MEMORY;");
    database.function("bitrix_deal_url", (id) => request.portalOrigin && typeof id === "string"
      ? `${request.portalOrigin}/crm/deal/details/${encodeURIComponent(id)}/` : null);
    const sourceUrl = pathToFileURL(request.databasePath);
    sourceUrl.searchParams.set("mode", "ro");
    database.prepare("ATTACH DATABASE ? AS source").run(sourceUrl.href);
    database.exec("BEGIN");
    for (const [name, , columns, scope] of tables) {
      // The binding composite index makes SQLite probe the cross product of both IN lists.
      const scanHint = name === "activity_binding_snapshots" ? " NOT INDEXED" : "";
      const statement = database.prepare(`CREATE TABLE main.${name} AS SELECT ${columns} FROM source.${name}${scanHint} WHERE ${scope}${request.operation === "schema" ? " LIMIT 0" : ""}`);
      statement.setAllowUnknownNamedParameters(true);
      statement.run({ categories: JSON.stringify(request.categoryIds) });
    }
    const state = Object.fromEntries(database.prepare("SELECT key,value FROM source.sync_state WHERE key IN ('attraction_current_scope_key','attraction_current_scope_reconciled_at')").all().map((row) => [row.key, row.value]));
    const lastSync = database.prepare("SELECT finished_at,scope_key FROM source.sync_runs WHERE status = 'success' ORDER BY id DESC LIMIT 1").get();
    const managers = database.prepare("SELECT manager_id FROM source.module_manager_whitelist_settings WHERE module_key = 'attraction' AND enabled = 1 ORDER BY sort_order,manager_id").all();
    const snapshot = {
      readAt: new Date().toISOString(),
      lastSuccessfulSync: lastSync?.finished_at as string | null ?? null,
      lastSyncScopeKey: lastSync?.scope_key as string | null ?? null,
      currentScopeReconciledAt: state.attraction_current_scope_reconciled_at as string | null ?? null,
      categoryIds: request.categoryIds,
      managerIds: managers.map((row) => String(row.manager_id))
    };
    database.exec("COMMIT; DETACH DATABASE source");
    const base = { schemaVersion: "attraction.analytics.v1" as const, snapshot };
    if (request.operation === "schema") {
      return {
        ...base,
        tables: tables.map(([name, description]) => ({
          name, description,
          columns: database.prepare(`PRAGMA table_info(${name})`).all().map((column) => ({ name: String(column.name), type: String(column.type) }))
        })),
        relationships,
        limits: { maxRows: 1_000, maxBytes: MAX_BYTES, timeoutMs: 5_000 },
        caveats: [
          "Only configured Attraction deal categories and enabled manager whitelist are included; the source database is not queryable.",
          "Cached deal history and attraction_current_deal_ids differ; join that table for the current reconciled population.",
          "assigned_by_id and quality_value are current snapshot values; date_create is CRM creation time, not proven handoff time. No initial handoff recipient/quality log is stored.",
          "No lead names, contact personal fields, activity text, message text, transcripts, raw payloads, auth or tokens. bitrix_url is null if the portal host is not configured.",
          "Compare timestamps with julianday() and explicit timezone boundaries; report-specific metric rules still apply. Monetary values use existing source units.",
          "Named parameters only; one SELECT/CTE statement. Partial rows are returned on limits; use filters and stable key pagination. Trailing comments after a semicolon are not accepted."
        ]
      };
    }
    database.exec("PRAGMA query_only = ON");
    const allowedTables = new Set<string>(tables.map(([name]) => name));
    database.setAuthorizer((action, arg1, arg2, dbName) => {
      if (action === constants.SQLITE_SELECT || action === constants.SQLITE_RECURSIVE) return constants.SQLITE_OK;
      if (action === constants.SQLITE_READ && (dbName === "main" || (dbName === null && arg2 === "")) && allowedTables.has(arg1 ?? "")) return constants.SQLITE_OK;
      if (action === constants.SQLITE_FUNCTION && !/^(load_extension|readfile|writefile|pragma_.*)$/i.test(arg2 ?? "")) return constants.SQLITE_OK;
      return constants.SQLITE_DENY;
    });
    ready = true;
    const query = request.query!;
    const statement = database.prepare(query.sql);
    if (statement.sourceSQL.trim() !== query.sql.trim()) throw new Error("single statement required");
    statement.setReadBigInts(true);
    statement.setAllowBareNamedParameters(true);
    const columns = statement.columns().map((column) => column.name);
    if (new Set(columns).size !== columns.length) throw new Error("duplicate column names");
    const result: AttractionDataResult = { ...base, columns, rows: [], rowCount: 0, truncated: false, limitReason: null };
    let bytes = Buffer.byteLength(JSON.stringify(result)) + 128;
    for (const row of statement.iterate(query.parameters ?? {})) {
      if (result.rows.length >= (query.maxRows ?? 200)) {
        result.truncated = true;
        result.limitReason = "rows";
        break;
      }
      const safeRow = Object.fromEntries(Object.entries(row).map(([key, value]) => {
        if (value instanceof Uint8Array) throw new Error("binary output");
        return [key, typeof value === "bigint" ? (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : value.toString()) : value];
      })) as AttractionDataResult["rows"][number];
      bytes += Buffer.byteLength(JSON.stringify(safeRow)) + 1;
      if (bytes > MAX_BYTES) {
        result.truncated = true;
        result.limitReason = "bytes";
        break;
      }
      result.rows.push(safeRow);
    }
    result.rowCount = result.rows.length;
    return result;
  } catch {
    // Never forward native SQL errors: they can contain filesystem paths or caller data.
    throw { code: ready ? "SQL_REJECTED" : "DATA_UNAVAILABLE", message: ready
      ? "Use one read-only SELECT/CTE over the advertised schema, valid named parameters and unique scalar column aliases."
      : "The scoped analytical snapshot could not be prepared." };
  } finally {
    database.close();
  }
}

process.once("message", (request: Request) => {
  try {
    const result = readData(request);
    process.send?.({ result });
  } catch (error) {
    process.send?.({ error });
  }
});
