import type express from "express";

import type { ApiRouteHandler } from "./route-handler.js";

export interface AttractionRouteHandlers {
  receiveCallEvent: ApiRouteHandler;
  listCallAnalysisQueue: ApiRouteHandler;
  analyzeCall: ApiRouteHandler;
  getCallAnalysis: ApiRouteHandler;
  getDashboard: ApiRouteHandler;
  getSourceQualityConversionReport: ApiRouteHandler;
  getSourceCohortConversionReport: ApiRouteHandler;
  getSourceCohortConversionJourneyDrilldown: ApiRouteHandler;
  getActivitiesWorkloadReport: ApiRouteHandler;
  getOperationalDashboardReport: ApiRouteHandler;
  getAcquisitionOutcomesReport: ApiRouteHandler;
  getTargetGroupConversionReport: ApiRouteHandler;
  getManagerActionOutcomeReport: ApiRouteHandler;
  getCallsWorkloadReport: ApiRouteHandler;
  getConversionEventsReport: ApiRouteHandler;
  getCohortConversionReport: ApiRouteHandler;
  getTocFlowReport: ApiRouteHandler;
  getRevenueVelocityReport: ApiRouteHandler;
  getUnitEconomicsReport: ApiRouteHandler;
  getMeta: ApiRouteHandler;
  getSyncRuns: ApiRouteHandler;
  getOntology: ApiRouteHandler;
  getOntologySource: ApiRouteHandler;
  getModuleOntology: ApiRouteHandler;
  getModuleOntologySource: ApiRouteHandler;
  getModuleMeta: ApiRouteHandler;
  getSalesPlan: ApiRouteHandler;
  replaceSalesPlan: ApiRouteHandler;
  getSalesPlanQuarter: ApiRouteHandler;
  replaceSalesPlanQuarter: ApiRouteHandler;
  getEffectiveSalesPlan: ApiRouteHandler;
  getPricingSettings: ApiRouteHandler;
  replacePricingSettings: ApiRouteHandler;
  getOperationalThresholdSettings: ApiRouteHandler;
  replaceOperationalThresholdSettings: ApiRouteHandler;
  getUnitEconomicsSettings: ApiRouteHandler;
  replaceUnitEconomicsCostRules: ApiRouteHandler;
  getConversionEventTypeSettings: ApiRouteHandler;
  replaceConversionEventTypeSettings: ApiRouteHandler;
  getManagerWhitelistSettings: ApiRouteHandler;
  replaceManagerWhitelistSettings: ApiRouteHandler;
  updateWonStages: ApiRouteHandler;
}

const callAnalysisQueuePaths = [
  "/api/calls/analysis-queue",
  "/api/modules/:moduleId/calls/analysis-queue"
];
const callEventPaths = [
  "/api/calls/events/bitrix",
  "/api/modules/:moduleId/calls/events/bitrix"
];
const analyzeCallPaths = [
  "/api/calls/:callId/analyze",
  "/api/modules/:moduleId/calls/:callId/analyze"
];
const callAnalysisPaths = [
  "/api/calls/:callId/analysis",
  "/api/modules/:moduleId/calls/:callId/analysis"
];

export type AttractionCallRouteHandlers = Pick<
  AttractionRouteHandlers,
  | "receiveCallEvent"
  | "listCallAnalysisQueue"
  | "analyzeCall"
  | "getCallAnalysis"
>;

export function registerAttractionCallRoutes(
  app: express.Express,
  handlers: AttractionCallRouteHandlers
) {
  app.get(callAnalysisQueuePaths, handlers.listCallAnalysisQueue);
  app.post(callEventPaths, handlers.receiveCallEvent);
  app.post(analyzeCallPaths, handlers.analyzeCall);
  app.get(callAnalysisPaths, handlers.getCallAnalysis);
}

export type AttractionReportRouteHandlers = Pick<
  AttractionRouteHandlers,
  | "getDashboard"
  | "getSourceQualityConversionReport"
  | "getSourceCohortConversionReport"
  | "getSourceCohortConversionJourneyDrilldown"
  | "getActivitiesWorkloadReport"
  | "getOperationalDashboardReport"
  | "getAcquisitionOutcomesReport"
  | "getTargetGroupConversionReport"
  | "getManagerActionOutcomeReport"
  | "getCallsWorkloadReport"
  | "getConversionEventsReport"
  | "getCohortConversionReport"
  | "getTocFlowReport"
  | "getRevenueVelocityReport"
  | "getUnitEconomicsReport"
  | "getMeta"
  | "getSyncRuns"
  | "getOntology"
  | "getOntologySource"
  | "getModuleOntology"
  | "getModuleOntologySource"
  | "getModuleMeta"
>;

export function registerAttractionReportRoutes(
  app: express.Express,
  handlers: AttractionReportRouteHandlers
) {
  app.get("/api/dashboard", handlers.getDashboard);
  app.get(
    "/api/reports/source-quality-conversion",
    handlers.getSourceQualityConversionReport
  );
  app.get(
    "/api/reports/source-cohort-conversion",
    handlers.getSourceCohortConversionReport
  );
  app.get(
    "/api/reports/source-cohort-conversion/journey-deals",
    handlers.getSourceCohortConversionJourneyDrilldown
  );
  app.get("/api/reports/activities-workload", handlers.getActivitiesWorkloadReport);
  app.get("/api/reports/operational-dashboard", handlers.getOperationalDashboardReport);
  app.get("/api/reports/acquisition-outcomes", handlers.getAcquisitionOutcomesReport);
  app.get(
    "/api/reports/target-group-conversion",
    handlers.getTargetGroupConversionReport
  );
  app.get(
    "/api/reports/manager-action-outcomes",
    handlers.getManagerActionOutcomeReport
  );
  app.get("/api/reports/calls-workload", handlers.getCallsWorkloadReport);
  app.get("/api/reports/conversion-events", handlers.getConversionEventsReport);
  app.get("/api/reports/cohort-conversion", handlers.getCohortConversionReport);
  app.get("/api/reports/toc-flow", handlers.getTocFlowReport);
  app.get("/api/reports/revenue-velocity", handlers.getRevenueVelocityReport);
  app.get("/api/reports/unit-economics", handlers.getUnitEconomicsReport);
  app.get("/api/meta", handlers.getMeta);
  app.get("/api/sync-runs", handlers.getSyncRuns);
  app.get("/api/ontology", handlers.getOntology);
  app.get("/api/ontology/sources/:sourceId", handlers.getOntologySource);
  app.get("/api/modules/:moduleId/ontology", handlers.getModuleOntology);
  app.get(
    "/api/modules/:moduleId/ontology/sources/:sourceId",
    handlers.getModuleOntologySource
  );
  app.get("/api/modules/:moduleId/meta", handlers.getModuleMeta);
}

export type AttractionSettingsRouteHandlers = Pick<
  AttractionRouteHandlers,
  | "getSalesPlan"
  | "replaceSalesPlan"
  | "getSalesPlanQuarter"
  | "replaceSalesPlanQuarter"
  | "getEffectiveSalesPlan"
  | "getPricingSettings"
  | "replacePricingSettings"
  | "getOperationalThresholdSettings"
  | "replaceOperationalThresholdSettings"
  | "getUnitEconomicsSettings"
  | "replaceUnitEconomicsCostRules"
  | "getConversionEventTypeSettings"
  | "replaceConversionEventTypeSettings"
  | "getManagerWhitelistSettings"
  | "replaceManagerWhitelistSettings"
  | "updateWonStages"
>;

export function registerAttractionSettingsRoutes(
  app: express.Express,
  handlers: AttractionSettingsRouteHandlers
) {
  app.get("/api/sales-plan", handlers.getSalesPlan);
  app.put("/api/sales-plan", handlers.replaceSalesPlan);
  app.get("/api/sales-plan/quarter", handlers.getSalesPlanQuarter);
  app.put("/api/sales-plan/quarter", handlers.replaceSalesPlanQuarter);
  app.get("/api/sales-plan/effective", handlers.getEffectiveSalesPlan);
  app.get("/api/settings/pricing", handlers.getPricingSettings);
  app.put("/api/settings/pricing", handlers.replacePricingSettings);
  app.get(
    "/api/settings/operational-thresholds",
    handlers.getOperationalThresholdSettings
  );
  app.put(
    "/api/settings/operational-thresholds",
    handlers.replaceOperationalThresholdSettings
  );
  app.get("/api/settings/unit-economics", handlers.getUnitEconomicsSettings);
  app.put(
    "/api/settings/unit-economics/cost-rules",
    handlers.replaceUnitEconomicsCostRules
  );
  app.get(
    "/api/settings/conversion-event-types",
    handlers.getConversionEventTypeSettings
  );
  app.put(
    "/api/settings/conversion-event-types",
    handlers.replaceConversionEventTypeSettings
  );
  app.get("/api/settings/manager-whitelist", handlers.getManagerWhitelistSettings);
  app.put(
    "/api/settings/manager-whitelist",
    handlers.replaceManagerWhitelistSettings
  );
  app.put("/api/settings/won-stages", handlers.updateWonStages);
}

export function registerAttractionRoutes(
  app: express.Express,
  handlers: AttractionRouteHandlers
) {
  registerAttractionCallRoutes(app, handlers);
  registerAttractionReportRoutes(app, handlers);
  registerAttractionSettingsRoutes(app, handlers);
}
