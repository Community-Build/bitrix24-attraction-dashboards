import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAttractionDataReader, type AttractionDataReader } from "../src/agent/attraction-data";
import { createSqliteRepository } from "../src/server/sqlite-repository";

describe("Attraction analytical SQL", () => {
  let directory: string;
  let database: Database.Database;
  let reader: AttractionDataReader;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "attraction-data-"));
    const databaseUrl = `file:${join(directory, "snapshot.db")}`;
    createSqliteRepository({ databaseUrl, defaultWonStageIds: [] }).close();
    database = new Database(databaseUrl.slice(5));
    database.exec(`
      DELETE FROM module_manager_whitelist_settings;
      INSERT INTO module_manager_whitelist_settings VALUES ('attraction','78','Manager 78',NULL,NULL,1,1,'2026-10-08');
      INSERT INTO module_manager_whitelist_settings VALUES ('attraction','999','Excluded',NULL,NULL,0,2,'2026-10-08');
      INSERT INTO manager_directory VALUES ('78','Manager 78'), ('999','Excluded');
      INSERT INTO deal_snapshots (id,title,category_id,stage_id,assigned_by_id,source_id,quality_value,date_create,date_modify)
        VALUES ('101','Private name','10','NEW','78','8','good','2026-09-01T10:00:00+03:00','2026-10-08'),
               ('102','Other name','10','NEW','78','8','bad','2026-09-30T18:00:00+03:00','2026-10-08'),
               ('103','Foreign manager','10','NEW','999','8','good','2026-09-02','2026-10-08'),
               ('104','Foreign category','28','NEW','78','8','good','2026-09-02','2026-10-08');
      INSERT INTO attraction_current_deal_ids VALUES ('101'), ('103'), ('104');
      INSERT INTO stage_history_snapshots VALUES ('h1','101','10','NEW','P',1,'2026-09-01');
      INSERT INTO stage_history_snapshots VALUES ('h2','103','10','NEW','P',1,'2026-09-01');
      INSERT INTO activity_snapshots (id,owner_type_id,owner_id,created_time,last_updated,completed,subject,description)
        VALUES ('a1','2','101','2026-09-01','2026-09-01',0,'Private subject','Private task'),
               ('a2','2','103','2026-09-01','2026-09-01',0,'Foreign subject','Foreign task');
      INSERT INTO activity_binding_snapshots VALUES ('a1','2','101'), ('a1','2','103');
      INSERT INTO sync_runs (started_at,finished_at,status,mode,scope_key) VALUES ('2026-10-08T09:00:00Z','2026-10-08T09:01:00Z','success','incremental','scope-10');
      INSERT INTO sync_state VALUES ('attraction_current_scope_key','scope-10');
      CREATE TABLE private_secrets (token TEXT);
      INSERT INTO private_secrets VALUES ('SECRET');
      ALTER TABLE deal_snapshots ADD COLUMN future_private_field TEXT DEFAULT 'SECRET';
    `);
    reader = createAttractionDataReader({ databaseUrl, categoryIds: ["10"], portalHost: "portal.bitrix24.ru" });
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("discovers safe columns, relationships, scope and freshness", async () => {
    const schema = await reader.getSchema();
    expect(schema.snapshot).toMatchObject({ managerIds: ["78"], categoryIds: ["10"], lastSuccessfulSync: "2026-10-08T09:01:00Z" });
    expect(schema.relationships).toContainEqual({ from: "deal_snapshots.assigned_by_id", to: "manager_directory.id" });
    const columns = schema.tables.find((table) => table.name === "deal_snapshots")!.columns.map((column) => column.name);
    expect(columns).toContain("bitrix_url");
    for (const column of ["title", "future_private_field", "refusal_reason_detail"]) expect(columns).not.toContain(column);
    expect(JSON.stringify(schema)).not.toMatch(/private_secrets|message_text|full_transcript|attachment_file_ids_json/);
  });

  it("runs parameterized joins, CTEs, grouping and windows with deal IDs and Bitrix links", async () => {
    const result = await reader.query({
      sql: `WITH scoped AS (
        SELECT d.*, m.name AS manager_name FROM deal_snapshots d
        JOIN manager_directory m ON m.id = d.assigned_by_id
        WHERE d.source_id = :source AND julianday(d.date_create) >= julianday(:from)
          AND julianday(d.date_create) < julianday(:to)
      ) SELECT id, bitrix_url, manager_name, quality_value, count(*) OVER () AS total FROM scoped ORDER BY id`,
      parameters: { source: "8", from: "2026-09-01T00:00:00+03:00", to: "2026-10-01T00:00:00+03:00" }
    });
    expect(result.rows).toEqual([
      { id: "101", bitrix_url: "https://portal.bitrix24.ru/crm/deal/details/101/", manager_name: "Manager 78", quality_value: "good", total: 2 },
      { id: "102", bitrix_url: "https://portal.bitrix24.ru/crm/deal/details/102/", manager_name: "Manager 78", quality_value: "bad", total: 2 }
    ]);
    expect((await reader.query({ sql: "SELECT quality_value, count(*) AS n FROM deal_snapshots GROUP BY quality_value ORDER BY quality_value" })).rows).toEqual([
      { quality_value: "bad", n: 1 }, { quality_value: "good", n: 1 }
    ]);
    expect((await reader.query({ sql: "SELECT id FROM deal_snapshots WHERE source_id = :source", parameters: { source: "8' OR 1=1 --" } })).rows).toEqual([]);
  });

  it("scopes dependent rows and reads a new consistent snapshot for each request", async () => {
    expect((await reader.query({ sql: "SELECT owner_id FROM stage_history_snapshots" })).rows).toEqual([{ owner_id: "101" }]);
    expect((await reader.query({ sql: "SELECT owner_id FROM activity_binding_snapshots" })).rows).toEqual([{ owner_id: "101" }]);
    expect((await reader.query({ sql: "SELECT deal_id FROM attraction_current_deal_ids" })).rows).toEqual([{ deal_id: "101" }]);
    database.prepare("UPDATE deal_snapshots SET quality_value = ? WHERE id = ?").run("new", "101");
    expect((await reader.query({ sql: "SELECT quality_value FROM deal_snapshots WHERE id = '101'" })).rows).toEqual([{ quality_value: "new" }]);
    database.exec("DELETE FROM module_manager_whitelist_settings");
    expect((await reader.query({ sql: "SELECT count(*) AS n FROM deal_snapshots" })).rows).toEqual([{ n: 0 }]);
  });

  it.each([
    "UPDATE deal_snapshots SET quality_value = 'evil'",
    "DELETE FROM deal_snapshots",
    "CREATE TABLE evil (id TEXT)",
    "ATTACH DATABASE '/tmp/evil.db' AS evil",
    "PRAGMA database_list",
    "SELECT * FROM pragma_database_list",
    "SELECT load_extension('/tmp/evil')",
    "SELECT * FROM private_secrets",
    "SELECT title FROM deal_snapshots",
    "SELECT future_private_field FROM deal_snapshots",
    "SELECT * FROM source.deal_snapshots",
    "WITH deal_snapshots AS (SELECT * FROM source.deal_snapshots) SELECT * FROM deal_snapshots",
    "SELECT * FROM sqlite_master",
    "SELECT 1; DELETE FROM deal_snapshots",
    "SELECT 1; SELECT 2"
  ])("rejects unsafe SQL without changing the source: %s", async (sql) => {
    await expect(reader.query({ sql })).rejects.toMatchObject({ code: "SQL_REJECTED" });
    expect(database.prepare("SELECT count(*) AS n FROM deal_snapshots").get()).toEqual({ n: 4 });
  });

  it("clears identifiers of activity owners and calls outside the deal scope", async () => {
    database.exec(`
      INSERT INTO activity_snapshots (id,owner_type_id,owner_id,created_time,last_updated,completed) VALUES ('a3','2','103','2026-09-01','2026-09-01',0);
      INSERT INTO activity_binding_snapshots VALUES ('a3','2','101');
      INSERT INTO call_snapshots VALUES ('c1','a2','78','1','2026-09-01',30,'DEAL','103',NULL);
    `);
    expect((await reader.query({ sql: "SELECT id,owner_id,owner_type_id FROM activity_snapshots WHERE id='a3'" })).rows).toEqual([{ id: "a3", owner_id: null, owner_type_id: null }]);
    expect((await reader.query({ sql: "SELECT crm_activity_id,crm_entity_id,call_duration_seconds FROM call_snapshots" })).rows).toEqual([{ crm_activity_id: null, crm_entity_id: null, call_duration_seconds: 30 }]);
  });

  it("excludes private message content but keeps aggregate metadata", async () => {
    database.exec(`
      INSERT INTO messenger_session_snapshots VALUES ('s1','a1','101','78','openlines','Open Lines','2026-09-01','2026-09-01');
      INSERT INTO messenger_message_snapshots (session_id,message_id,activity_id,deal_id,occurred_at,occurred_at_ms,channel_key,channel_label,sender_id,sender_kind,direction,message_text,raw_text,author_label,synced_at)
        VALUES ('s1','m1','a1','101','2026-09-01',100,'openlines','Open Lines','private-contact','customer','inbound','Private body','Private raw','Private name','2026-09-01');
    `);
    const result = await reader.query({ sql: "SELECT * FROM messenger_message_snapshots" });
    expect(result.rows).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/Private|private-contact|sender_id|message_text|raw_text|author_label/);
    expect(result.rows[0]).toMatchObject({ message_id: "m1", direction: "inbound", sender_kind: "customer" });
  });

  it("keeps partial rows on row/byte limits and rejects ambiguous or binary output", async () => {
    expect(await reader.query({ sql: "SELECT id FROM deal_snapshots ORDER BY id", maxRows: 1 })).toMatchObject({ rows: [{ id: "101" }], rowCount: 1, truncated: true, limitReason: "rows" });
    const large = await reader.query({ sql: "SELECT printf('%0500000d', 1) AS value UNION ALL SELECT printf('%0500000d', 2)" });
    expect(large).toMatchObject({ rowCount: 1, truncated: true, limitReason: "bytes" });
    await expect(reader.query({ sql: "SELECT id, id FROM deal_snapshots" })).rejects.toMatchObject({ code: "SQL_REJECTED" });
    await expect(reader.query({ sql: "SELECT X'1234' AS binary" })).rejects.toMatchObject({ code: "SQL_REJECTED" });
  });

  it("validates input and bounds concurrency and runaway queries", async () => {
    await expect(reader.query({ sql: "SELECT 1", maxRows: 1001 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const sql = "WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM x WHERE n<1000000000) SELECT sum(n) FROM x";
    const first = reader.query({ sql }).catch((error: { code: string }) => error.code);
    const second = reader.query({ sql }).catch((error: { code: string }) => error.code);
    await expect(reader.query({ sql: "SELECT 1" })).rejects.toMatchObject({ code: "SQL_BUSY" });
    expect(await Promise.all([first, second])).toEqual(["SQL_TIMEOUT", "SQL_TIMEOUT"]);
    expect((await reader.query({ sql: "SELECT count(*) AS n FROM deal_snapshots" })).rows).toEqual([{ n: 2 }]);
  }, 10_000);
});
