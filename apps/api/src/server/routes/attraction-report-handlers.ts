import type express from "express";
import { z } from "zod";

import type { AttractionReportRouteHandlers } from "./attraction-routes.js";

export interface RangeRequest {
  periodDays?: number;
  range?: {
    from: string;
    to: string;
  };
  compareRanges?: Array<{
    from: string;
    to: string;
  }>;
  filters?: {
    managerIds?: string[];
    sourceKeys?: string[];
  };
  includeBreakdown?: boolean;
}

export type RevenueVelocityRequest = RangeRequest & {
  dimension: string;
  view: string;
  asOf?: string;
  filters?: RangeRequest["filters"] & {
    customerKeys?: string[];
    qualityKeys?: string[];
    tariffKeys?: string[];
  };
};

export interface AttractionReportRouteService {
  getDashboard(input: RangeRequest): Promise<unknown>;
  getSourceQualityConversionReport(input: RangeRequest): Promise<unknown>;
  getSourceCohortConversionReport(input: RangeRequest): Promise<unknown>;
  getActivitiesWorkloadReport(input: RangeRequest): Promise<unknown>;
  getOperationalDashboardReport(input: RangeRequest): Promise<unknown>;
  getAcquisitionOutcomesReport(input: RangeRequest): Promise<unknown>;
  getTargetGroupConversionReport(input: RangeRequest): Promise<unknown>;
  getManagerActionOutcomeReport(input: RangeRequest): Promise<unknown>;
  getCallsWorkloadReport(input: RangeRequest): Promise<unknown>;
  getConversionEventsReport(input: RangeRequest): Promise<unknown>;
  getCohortConversionReport(input: RangeRequest): Promise<unknown>;
  getTocFlowReport(input: RangeRequest): Promise<unknown>;
  getRevenueVelocityReport(input: RevenueVelocityRequest): Promise<unknown>;
  getUnitEconomicsReport(input: RangeRequest): Promise<unknown>;
  getMeta(input?: RangeRequest): Promise<unknown>;
  getSyncRuns?(input?: { limit?: number }): Promise<unknown>;
  getAttractionOntology?(): Promise<unknown>;
  getAttractionOntologySourceDocument?(sourceId: string): Promise<unknown>;
}

export interface ModuleReportRouteService {
  getMeta?(input?: RangeRequest): Promise<unknown>;
}

export type SendTimedJson = <T>(input: {
  request: express.Request;
  response: express.Response;
  next: express.NextFunction;
  moduleId: string;
  route: string;
  handler: () => Promise<T>;
}) => Promise<void>;

export interface CreateAttractionReportRouteHandlersInput {
  service: AttractionReportRouteService;
  getModuleService(moduleId: string): ModuleReportRouteService | undefined;
  authEnabled: boolean;
  denyIfMissingAttractionAccess(response: express.Response): boolean;
  requireModuleAccess(
    response: express.Response,
    permission: undefined,
    moduleId: string
  ): unknown | null;
  parseRangeRequest(query: unknown): RangeRequest;
  parseRevenueVelocityRequest(query: unknown): RevenueVelocityRequest;
  scopeRangeRequest?(
    request: express.Request,
    response: express.Response,
    input: RangeRequest
  ): Promise<RangeRequest>;
  scopeRevenueVelocityRequest?(
    request: express.Request,
    response: express.Response,
    input: RevenueVelocityRequest
  ): Promise<RevenueVelocityRequest>;
  sendTimedJson: SendTimedJson;
}

const syncRunHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(5)
});

function createErrorResponse(code: string, details?: unknown) {
  return {
    error: code,
    code,
    ...(details === undefined ? {} : { details })
  };
}

function requestRouteParam(request: express.Request, name: string) {
  const value = request.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function requestModuleId(request: express.Request) {
  return requestRouteParam(request, "moduleId").trim() || "attraction";
}

function isOntologySourceLookupError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    ((error as { code?: unknown }).code === "SOURCE_NOT_FOUND" ||
      (error as { code?: unknown }).code === "SOURCE_NOT_READABLE" ||
      (error as { code?: unknown }).code === "SOURCE_OUTSIDE_ALLOWLIST")
  );
}

export function createAttractionReportRouteHandlers({
  service,
  getModuleService,
  authEnabled,
  denyIfMissingAttractionAccess,
  requireModuleAccess,
  parseRangeRequest,
  parseRevenueVelocityRequest,
  scopeRangeRequest,
  scopeRevenueVelocityRequest,
  sendTimedJson
}: CreateAttractionReportRouteHandlersInput): AttractionReportRouteHandlers {
  const parseScopedRangeRequest = async (
    request: express.Request,
    response: express.Response
  ) => {
    const input = parseRangeRequest(request.query);
    return scopeRangeRequest ? scopeRangeRequest(request, response, input) : input;
  };

  const parseScopedRevenueVelocityRequest = async (
    request: express.Request,
    response: express.Response
  ) => {
    const input = parseRevenueVelocityRequest(request.query);
    return scopeRevenueVelocityRequest
      ? scopeRevenueVelocityRequest(request, response, input)
      : input;
  };

  return {
    getDashboard: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "dashboard",
        handler: async () =>
          service.getDashboard(await parseScopedRangeRequest(request, response))
      });
    },
    getSourceQualityConversionReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "source-quality-conversion",
        handler: async () =>
          service.getSourceQualityConversionReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getSourceCohortConversionReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "source-cohort-conversion",
        handler: async () =>
          service.getSourceCohortConversionReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getActivitiesWorkloadReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "activities-workload",
        handler: async () =>
          service.getActivitiesWorkloadReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getOperationalDashboardReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "operational-dashboard",
        handler: async () =>
          service.getOperationalDashboardReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getAcquisitionOutcomesReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "acquisition-outcomes",
        handler: async () =>
          service.getAcquisitionOutcomesReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getTargetGroupConversionReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "target-group-conversion",
        handler: async () =>
          service.getTargetGroupConversionReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getManagerActionOutcomeReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "manager-action-outcomes",
        handler: async () =>
          service.getManagerActionOutcomeReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getCallsWorkloadReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "calls-workload",
        handler: async () =>
          service.getCallsWorkloadReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getConversionEventsReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "conversion-events",
        handler: async () =>
          service.getConversionEventsReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getCohortConversionReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "cohort-conversion",
        handler: async () =>
          service.getCohortConversionReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getTocFlowReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "toc-flow",
        handler: async () =>
          service.getTocFlowReport(await parseScopedRangeRequest(request, response))
      });
    },
    getRevenueVelocityReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "revenue-velocity",
        handler: async () =>
          service.getRevenueVelocityReport(
            await parseScopedRevenueVelocityRequest(request, response)
          )
      });
    },
    getUnitEconomicsReport: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "unit-economics",
        handler: async () =>
          service.getUnitEconomicsReport(
            await parseScopedRangeRequest(request, response)
          )
      });
    },
    getMeta: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId: "attraction",
        route: "meta",
        handler: async () =>
          service.getMeta(
            scopeRangeRequest
              ? await scopeRangeRequest(request, response, {})
              : undefined
          )
      });
    },
    getSyncRuns: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      if (!service.getSyncRuns) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const query = syncRunHistoryQuerySchema.parse(request.query);
        response.json(await service.getSyncRuns({ limit: query.limit }));
      } catch (error) {
        next(error);
      }
    },
    getOntology: async (_request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      if (!service.getAttractionOntology) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        response.json(await service.getAttractionOntology());
      } catch (error) {
        next(error);
      }
    },
    getOntologySource: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      if (!service.getAttractionOntologySourceDocument) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        response.json(
          await service.getAttractionOntologySourceDocument(
            requestRouteParam(request, "sourceId")
          )
        );
      } catch (error) {
        if (isOntologySourceLookupError(error)) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }

        next(error);
      }
    },
    getModuleOntology: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "attraction") {
        next("route");
        return;
      }

      if (authEnabled && !requireModuleAccess(response, undefined, moduleId)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      if (!service.getAttractionOntology) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        response.json(await service.getAttractionOntology());
      } catch (error) {
        next(error);
      }
    },
    getModuleOntologySource: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "attraction") {
        next("route");
        return;
      }

      if (authEnabled && !requireModuleAccess(response, undefined, moduleId)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      if (!service.getAttractionOntologySourceDocument) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        response.json(
          await service.getAttractionOntologySourceDocument(
            requestRouteParam(request, "sourceId")
          )
        );
      } catch (error) {
        if (isOntologySourceLookupError(error)) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }

        next(error);
      }
    },
    getModuleMeta: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      const moduleService = getModuleService(moduleId);
      const getMeta = moduleService?.getMeta;
      if (!getMeta) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      if (authEnabled && !requireModuleAccess(response, undefined, moduleId)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId,
        route: `${moduleId}.meta`,
        handler: async () =>
          getMeta(
            moduleId === "attraction" && scopeRangeRequest
              ? await scopeRangeRequest(request, response, {})
              : undefined
          )
      });
    }
  };
}
