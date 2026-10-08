import { z } from "zod";

export const dataQuerySchema = z.object({
  sql: z.string().trim().min(1).max(20_000),
  parameters: z.record(z.string().min(1).max(128), z.union([
    z.string().max(8_192), z.number().finite(), z.null()
  ])).refine((value) => Object.keys(value).length <= 100).optional(),
  maxRows: z.number().int().min(1).max(1_000).default(200)
});

export type AttractionDataQuery = z.input<typeof dataQuerySchema>;

export interface AttractionDataSnapshot {
  readAt: string;
  lastSuccessfulSync: string | null;
  lastSyncScopeKey: string | null;
  currentScopeReconciledAt: string | null;
  categoryIds: string[];
  managerIds: string[];
}

export interface AttractionDataSchema {
  schemaVersion: "attraction.analytics.v1";
  snapshot: AttractionDataSnapshot;
  tables: Array<{
    name: string;
    description: string;
    columns: Array<{ name: string; type: string }>;
  }>;
  relationships: Array<{ from: string; to: string }>;
  limits: { maxRows: number; maxBytes: number; timeoutMs: number };
  caveats: string[];
}

export interface AttractionDataResult {
  schemaVersion: "attraction.analytics.v1";
  snapshot: AttractionDataSnapshot;
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
  rowCount: number;
  truncated: boolean;
  limitReason: "rows" | "bytes" | null;
}

export interface AttractionDataReader {
  getSchema(): Promise<AttractionDataSchema>;
  query(input: AttractionDataQuery): Promise<AttractionDataResult>;
}
