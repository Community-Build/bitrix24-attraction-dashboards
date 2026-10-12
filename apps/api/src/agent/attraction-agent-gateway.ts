import type {
  AttractionOntologyResponse,
  ModuleCapabilityManifest,
  ModuleReportCapability,
  OntologySourceDocumentResponse,
  ReportRange,
  RevenueVelocityDimension,
  RevenueVelocityView,
  UnitEconomicsEventParticipantMode
} from "@bitrix24-reporting/contracts";
import { z } from "zod";

import type { PlaybookReader } from "./playbook-reader.js";
import type { AttractionDataReader } from "./attraction-data-contract.js";

export interface ExtendedReportFilters {
  managerIds?: string[] | undefined;
  sourceKeys?: string[] | undefined;
  customerKeys?: string[] | undefined;
  qualityKeys?: string[] | undefined;
  tariffKeys?: string[] | undefined;
}

export interface AttractionAgentReportRequest {
  reportId: string;
  periodDays?: number | undefined;
  range?: ReportRange | undefined;
  compareRanges?: ReportRange[] | undefined;
  filters?: ExtendedReportFilters | undefined;
  includeBreakdown?: boolean | undefined;
  dimension?: RevenueVelocityDimension | undefined;
  view?: RevenueVelocityView | undefined;
  asOf?: string | undefined;
  eventParticipantMode?: UnitEconomicsEventParticipantMode | undefined;
  maxBytes?: number | undefined;
}

export interface AttractionAgentReportResult {
  reportId: string;
  truncated: boolean;
  data: unknown | null;
  summary?: {
    byteLength: number;
    topLevelKeys: string[];
  };
}

export type AttractionAgentReportServiceRequest = Omit<
  AttractionAgentReportRequest,
  "reportId" | "maxBytes"
>;

export interface AttractionAgentSearchResult {
  kind:
    | "source"
    | "source-document"
    | "concept"
    | "transition"
    | "report-binding";
  id: string;
  label: string;
  snippet: string;
}

export interface AttractionAgentReportService {
  getDashboard?(input: AttractionAgentReportServiceRequest): Promise<unknown>;
  getSourceQualityConversionReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getActivitiesWorkloadReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getAcquisitionOutcomesReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getTargetGroupConversionReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getManagerActionOutcomeReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getCallsWorkloadReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getConversionEventsReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getCohortConversionReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getTocFlowReport?(input: AttractionAgentReportServiceRequest): Promise<unknown>;
  getRevenueVelocityReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
  getUnitEconomicsReport?(
    input: AttractionAgentReportServiceRequest
  ): Promise<unknown>;
}

export interface AttractionAgentOntologyReader {
  getOverview(): Promise<AttractionOntologyResponse>;
  readSource(input: { sourceId: string }): Promise<OntologySourceDocumentResponse>;
}

export interface CreateAttractionAgentGatewayInput {
  manifest: ModuleCapabilityManifest;
  service: AttractionAgentReportService;
  ontology: AttractionAgentOntologyReader;
  playbook: PlaybookReader;
  data?: AttractionDataReader;
  defaultSearchLimit?: number;
  maxSearchLimit?: number;
  maxReportBytes?: number;
}

export class AttractionAgentGatewayError extends Error {
  readonly code:
    | "INVALID_INPUT"
    | "REPORT_NOT_FOUND"
    | "REPORT_NOT_AVAILABLE"
    | "REPORT_NOT_AGENT_READABLE";

  constructor(
    code:
      | "INVALID_INPUT"
      | "REPORT_NOT_FOUND"
      | "REPORT_NOT_AVAILABLE"
      | "REPORT_NOT_AGENT_READABLE",
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "AttractionAgentGatewayError";
    this.code = code;
  }
}

const rangeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1)
});

const filtersSchema = z.object({
  managerIds: z.array(z.string().min(1)).optional(),
  sourceKeys: z.array(z.string().min(1)).optional(),
  customerKeys: z.array(z.string().min(1)).optional(),
  qualityKeys: z.array(z.string().min(1)).optional(),
  tariffKeys: z.array(z.string().min(1)).optional()
});

const reportRequestSchema = z.object({
  reportId: z.string().min(1),
  periodDays: z.number().int().positive().max(3660).optional(),
  range: rangeSchema.optional(),
  compareRanges: z.array(rangeSchema).max(4).optional(),
  filters: filtersSchema.optional(),
  includeBreakdown: z.boolean().optional(),
  dimension: z
    .enum([
      "manager",
      "source",
      "customer",
      "managerSource",
      "sourceCustomer",
      "managerCustomer"
    ])
    .optional(),
  view: z.enum(["systemState", "operationalPeriod", "createdCohort"]).optional(),
  asOf: z.string().min(1).optional(),
  eventParticipantMode: z.enum(["invited", "attended"]).optional(),
  maxBytes: z.number().int().positive().max(1_000_000).optional()
});

const searchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional()
});

type ReportHandler = (
  service: AttractionAgentReportService,
  input: AttractionAgentReportServiceRequest
) => Promise<unknown> | undefined;

const reportHandlers: Record<string, ReportHandler> = {
  dashboard: (service, input) => service.getDashboard?.(input),
  "source-quality-conversion": (service, input) =>
    service.getSourceQualityConversionReport?.(input),
  "activities-workload": (service, input) =>
    service.getActivitiesWorkloadReport?.(input),
  "acquisition-outcomes": (service, input) =>
    service.getAcquisitionOutcomesReport?.(input),
  "target-group-conversion": (service, input) =>
    service.getTargetGroupConversionReport?.(input),
  "manager-action-outcomes": (service, input) =>
    service.getManagerActionOutcomeReport?.(input),
  "calls-workload": (service, input) => service.getCallsWorkloadReport?.(input),
  "conversion-events": (service, input) =>
    service.getConversionEventsReport?.(input),
  "cohort-conversion": (service, input) =>
    service.getCohortConversionReport?.(input),
  "toc-flow": (service, input) => service.getTocFlowReport?.(input),
  "revenue-velocity": (service, input) =>
    service.getRevenueVelocityReport?.(input),
  "unit-economics": (service, input) => service.getUnitEconomicsReport?.(input)
} satisfies Record<string, ReportHandler>;

function parseReportRequest(input: AttractionAgentReportRequest) {
  const result = reportRequestSchema.safeParse(input);
  if (!result.success) {
    throw new AttractionAgentGatewayError(
      "INVALID_INPUT",
      "Invalid report request.",
      { cause: result.error }
    );
  }
  return result.data;
}

function parseSearchInput(input: { query: string; limit?: number }) {
  const result = searchInputSchema.safeParse(input);
  if (!result.success) {
    throw new AttractionAgentGatewayError("INVALID_INPUT", "Invalid search input.", {
      cause: result.error
    });
  }
  return {
    query: result.data.query.trim(),
    ...(result.data.limit === undefined ? {} : { limit: result.data.limit })
  };
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function textMatches(input: { text: string; query: string }) {
  return input.text.toLocaleLowerCase("ru-RU").includes(input.query);
}

function snippetFor(input: { text: string; query: string }) {
  const text = compact(input.text);
  const lowerText = text.toLocaleLowerCase("ru-RU");
  const index = lowerText.indexOf(input.query);
  if (index === -1) {
    return text.slice(0, 220);
  }
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + input.query.length + 150);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${
    end < text.length ? "..." : ""
  }`;
}

function topLevelKeys(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).slice(0, 20)
    : [];
}

function boundReportOutput(input: {
  reportId: string;
  data: unknown;
  maxBytes: number;
}): AttractionAgentReportResult {
  const serialized = JSON.stringify(input.data);
  const byteLength = Buffer.byteLength(serialized, "utf8");

  if (byteLength <= input.maxBytes) {
    return {
      reportId: input.reportId,
      truncated: false,
      data: input.data
    };
  }

  return {
    reportId: input.reportId,
    truncated: true,
    data: null,
    summary: {
      byteLength,
      topLevelKeys: topLevelKeys(input.data)
    }
  };
}

function toServiceRequest(
  request: AttractionAgentReportRequest
): AttractionAgentReportServiceRequest {
  return Object.fromEntries(
    Object.entries(request).filter(
      ([key]) => key !== "reportId" && key !== "maxBytes"
    )
  ) as AttractionAgentReportServiceRequest;
}

function readableLocalSource(source: { href: string }) {
  return (
    source.href.startsWith("docs/modules/attraction/") &&
    source.href.endsWith(".md")
  );
}

function reportById(manifest: ModuleCapabilityManifest, reportId: string) {
  return manifest.reports.find((report) => report.id === reportId);
}

function requireRunnableReport(input: {
  manifest: ModuleCapabilityManifest;
  reportId: string;
}): ModuleReportCapability {
  const report = reportById(input.manifest, input.reportId);

  if (!report) {
    throw new AttractionAgentGatewayError(
      "REPORT_NOT_FOUND",
      `Report ${input.reportId} was not found in module capabilities.`
    );
  }
  if (report.status !== "available") {
    throw new AttractionAgentGatewayError(
      "REPORT_NOT_AVAILABLE",
      `Report ${input.reportId} is not available.`
    );
  }
  if (!report.agentReadable) {
    throw new AttractionAgentGatewayError(
      "REPORT_NOT_AGENT_READABLE",
      `Report ${input.reportId} is not approved for agent execution.`
    );
  }

  return report;
}

export function createAttractionAgentGateway(
  input: CreateAttractionAgentGatewayInput
) {
  const defaultSearchLimit = input.defaultSearchLimit ?? 5;
  const maxSearchLimit = input.maxSearchLimit ?? 20;
  const maxReportBytes = input.maxReportBytes ?? 200_000;

  function effectiveSearchLimit(limit?: number) {
    return Math.min(limit ?? defaultSearchLimit, maxSearchLimit);
  }

  async function searchOntology({
    query,
    limit
  }: {
    query: string;
    limit?: number | undefined;
  }): Promise<AttractionAgentSearchResult[]> {
    const parsedInput = parseSearchInput({
      query,
      ...(limit === undefined ? {} : { limit })
    });
    const normalizedQuery = parsedInput.query.toLocaleLowerCase("ru-RU");
    const effectiveLimit = effectiveSearchLimit(parsedInput.limit);
    const ontology = await input.ontology.getOverview();
    const candidates: AttractionAgentSearchResult[] = [];

    for (const source of ontology.sources) {
      const text = `${source.label} ${source.href}`;
      if (textMatches({ text, query: normalizedQuery })) {
        candidates.push({
          kind: "source",
          id: source.id,
          label: source.label,
          snippet: snippetFor({ text, query: normalizedQuery })
        });
      }

      if (readableLocalSource(source)) {
        try {
          const document = await input.ontology.readSource({
            sourceId: source.id
          });
          if (textMatches({ text: document.content, query: normalizedQuery })) {
            candidates.push({
              kind: "source-document",
              id: source.id,
              label: source.label,
              snippet: snippetFor({
                text: document.content,
                query: normalizedQuery
              })
            });
          }
        } catch {
          // Source search is best-effort; direct readSource preserves exact errors.
        }
      }
    }

    for (const concept of ontology.concepts) {
      const text = `${concept.label} ${concept.definition}`;
      if (textMatches({ text, query: normalizedQuery })) {
        candidates.push({
          kind: "concept",
          id: concept.id,
          label: concept.label,
          snippet: snippetFor({ text, query: normalizedQuery })
        });
      }
    }

    for (const transition of ontology.transitions) {
      const text = `${transition.label} ${transition.definition}`;
      if (textMatches({ text, query: normalizedQuery })) {
        candidates.push({
          kind: "transition",
          id: transition.id,
          label: transition.label,
          snippet: snippetFor({ text, query: normalizedQuery })
        });
      }
    }

    for (const binding of ontology.reportBindings) {
      const text = `${binding.label} ${binding.sceneId} ${binding.blockId}`;
      if (textMatches({ text, query: normalizedQuery })) {
        candidates.push({
          kind: "report-binding",
          id: binding.id,
          label: binding.label,
          snippet: snippetFor({ text, query: normalizedQuery })
        });
      }
    }

    return candidates.slice(0, effectiveLimit);
  }

  return {
    getOntologyOverview() {
      return input.ontology.getOverview();
    },
    ...(input.data ? {
      getDataSchema: () => input.data!.getSchema(),
      queryData: (request: Parameters<AttractionDataReader["query"]>[0]) => input.data!.query(request)
    } : {}),
    async listOntologySources() {
      return (await input.ontology.getOverview()).sources;
    },
    readOntologySource({ sourceId }: { sourceId: string }) {
      return input.ontology.readSource({ sourceId });
    },
    searchOntology,
    listPlaybookSections() {
      return input.playbook.listSections();
    },
    readPlaybookSection({ sectionId }: { sectionId: string }) {
      return input.playbook.readSection({ sectionId });
    },
    searchPlaybook({ query, limit }: { query: string; limit?: number }) {
      return input.playbook.search({
        query,
        limit: effectiveSearchLimit(limit)
      });
    },
    listReports() {
      return Promise.resolve([...input.manifest.reports]);
    },
    async runReport(request: AttractionAgentReportRequest) {
      const parsedRequest = parseReportRequest(request);
      const report = requireRunnableReport({
        manifest: input.manifest,
        reportId: parsedRequest.reportId
      });
      const handler = reportHandlers[report.id];
      const data = await handler?.(input.service, toServiceRequest(parsedRequest));

      if (data === undefined) {
        throw new AttractionAgentGatewayError(
          "REPORT_NOT_AVAILABLE",
          `Report ${report.id} has no runtime handler.`
        );
      }

      return boundReportOutput({
        reportId: report.id,
        data,
        maxBytes: parsedRequest.maxBytes ?? maxReportBytes
      });
    }
  };
}
