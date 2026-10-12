import { fork } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { dataQuerySchema } from "./attraction-data-contract.js";
import type { AttractionDataQuery, AttractionDataReader, AttractionDataResult, AttractionDataSchema } from "./attraction-data-contract.js";

export type { AttractionDataReader } from "./attraction-data-contract.js";

export class AttractionDataError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AttractionDataError";
  }
}

export function createAttractionDataReader(input: {
  databaseUrl: string;
  categoryIds: string[];
  portalHost?: string | undefined;
}): AttractionDataReader {
  if (!input.databaseUrl.startsWith("file:") || input.categoryIds.length === 0) {
    throw new Error("Attraction data MCP requires a file database and category scope.");
  }
  const rawPath = input.databaseUrl.slice(5);
  const databasePath = isAbsolute(rawPath) ? rawPath : resolve(rawPath);
  const host = input.portalHost?.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const portalUrl = host ? new URL(`https://${host}`) : null;
  if (portalUrl && (portalUrl.pathname !== "/" || portalUrl.username || portalUrl.password || portalUrl.search || portalUrl.hash)) {
    throw new Error("Attraction data MCP requires a plain Bitrix portal host.");
  }
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  const workerPath = fileURLToPath(new URL(`./attraction-data-worker.${extension}`, import.meta.url));
  let active = 0;

  function run<T>(operation: "schema" | "query", query?: AttractionDataQuery): Promise<T> {
    if (active >= 2) {
      return Promise.reject(new AttractionDataError("SQL_BUSY", "Two analytical requests are already running. Retry after they finish."));
    }
    active += 1;
    return new Promise<T>((resolveResult, reject) => {
      let child;
      try {
        child = fork(workerPath, [], {
        execArgv: ["--max-old-space-size=128", "--disable-warning=ExperimentalWarning"],
        env: {},
        stdio: ["ignore", "ignore", "ignore", "ipc"]
        });
      } catch {
        active -= 1;
        reject(new AttractionDataError("DATA_UNAVAILABLE", "Analytical query process could not start."));
        return;
      }
      let outcome: { error: Error | null; result?: T | undefined } | undefined;
      const finish = (error: Error | null, result?: T) => {
        if (outcome) return;
        outcome = { error, result };
        clearTimeout(timer);
        child.kill("SIGKILL");
      };
      const timer = setTimeout(() => finish(new AttractionDataError("SQL_TIMEOUT", "Analytical request exceeded 5 seconds. Narrow the query.")), 5_000);
      child.once("error", () => finish(new AttractionDataError("DATA_UNAVAILABLE", "Analytical query process could not start.")));
      child.once("close", () => {
        active -= 1;
        clearTimeout(timer);
        if (!outcome) outcome = { error: new AttractionDataError("SQL_RESOURCE_LIMIT", "Analytical process exited before returning a result.") };
        if (outcome.error) reject(outcome.error);
        else resolveResult(outcome.result as T);
      });
      child.once("message", (message: { result?: T; error?: { code: string; message: string } }) => {
        finish(message.error ? new AttractionDataError(message.error.code, message.error.message) : null, message.result);
      });
      child.send({ operation, databasePath, categoryIds: input.categoryIds, portalOrigin: portalUrl?.origin ?? null, query }, (error) => {
        if (error) finish(new AttractionDataError("DATA_UNAVAILABLE", "Analytical query process could not receive the request."));
      });
    });
  }

  return {
    getSchema: () => run<AttractionDataSchema>("schema"),
    query(query) {
      const parsed = dataQuerySchema.safeParse(query);
      if (!parsed.success) {
        return Promise.reject(new AttractionDataError("INVALID_INPUT", "Provide SQL, scalar named parameters and maxRows between 1 and 1000."));
      }
      return run<AttractionDataResult>("query", parsed.data);
    }
  };
}
