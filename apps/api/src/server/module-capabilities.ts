import type { ModuleCapabilityManifest } from "@bitrix24-reporting/contracts";

export interface ModuleCapabilityRegistry {
  get(moduleId: string): ModuleCapabilityManifest | undefined;
  list(): ModuleCapabilityManifest[];
}

export interface ModuleCapabilityAdapter {
  manifest: ModuleCapabilityManifest;
  availableReportRoutes?: Iterable<string>;
}

export interface ModuleCapabilityRegistryInput {
  adapters?: ModuleCapabilityAdapter[];
  extraManifests?: ModuleCapabilityManifest[];
  includeDefaultAdapters?: boolean;
}

export interface AttractionCapabilityService {
  getDashboard?: unknown;
  getSourceQualityConversionReport?: unknown;
  getActivitiesWorkloadReport?: unknown;
  getOperationalDashboardReport?: unknown;
  getAcquisitionOutcomesReport?: unknown;
  getTargetGroupConversionReport?: unknown;
  getManagerActionOutcomeReport?: unknown;
  getCallsWorkloadReport?: unknown;
  getConversionEventsReport?: unknown;
  getCohortConversionReport?: unknown;
  getTocFlowReport?: unknown;
  getRevenueVelocityReport?: unknown;
  getUnitEconomicsReport?: unknown;
}

export interface LeadgenCapabilityService {
  getLeadgenFunnelReport?: unknown;
  getActivitiesWorkloadReport?: unknown;
  getCallsWorkloadReport?: unknown;
}

interface ReportAvailabilityDescriptor<TService> {
  route: string;
  isAvailable(service: TService): boolean;
}

const privateFieldExclusions = [
  "deal.title",
  "contact.id",
  "contact.name",
  "contact.phone",
  "contact.email",
  "rawBitrixPayload"
];

const moduleIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const unsafeManifestTokenPattern =
  /SqliteRepository|BITRIX24_WEBHOOK|sqliteUrl|databaseUrl|webhook/i;

const attractionCapabilityReportAvailability: Array<
  ReportAvailabilityDescriptor<AttractionCapabilityService>
> = [
  {
    route: "/api/dashboard",
    isAvailable: (service) => typeof service.getDashboard === "function"
  },
  {
    route: "/api/reports/source-quality-conversion",
    isAvailable: (service) =>
      typeof service.getSourceQualityConversionReport === "function"
  },
  {
    route: "/api/reports/activities-workload",
    isAvailable: (service) =>
      typeof service.getActivitiesWorkloadReport === "function"
  },
  {
    route: "/api/reports/operational-dashboard",
    isAvailable: (service) =>
      typeof service.getOperationalDashboardReport === "function"
  },
  {
    route: "/api/reports/acquisition-outcomes",
    isAvailable: (service) =>
      typeof service.getAcquisitionOutcomesReport === "function"
  },
  {
    route: "/api/reports/target-group-conversion",
    isAvailable: (service) =>
      typeof service.getTargetGroupConversionReport === "function"
  },
  {
    route: "/api/reports/manager-action-outcomes",
    isAvailable: (service) =>
      typeof service.getManagerActionOutcomeReport === "function"
  },
  {
    route: "/api/reports/calls-workload",
    isAvailable: (service) => typeof service.getCallsWorkloadReport === "function"
  },
  {
    route: "/api/reports/conversion-events",
    isAvailable: (service) =>
      typeof service.getConversionEventsReport === "function"
  },
  {
    route: "/api/reports/cohort-conversion",
    isAvailable: (service) =>
      typeof service.getCohortConversionReport === "function"
  },
  {
    route: "/api/reports/toc-flow",
    isAvailable: (service) => typeof service.getTocFlowReport === "function"
  },
  {
    route: "/api/reports/revenue-velocity",
    isAvailable: (service) =>
      typeof service.getRevenueVelocityReport === "function"
  },
  {
    route: "/api/reports/unit-economics",
    isAvailable: (service) => typeof service.getUnitEconomicsReport === "function"
  }
];

const leadgenCapabilityReportAvailability: Array<
  ReportAvailabilityDescriptor<LeadgenCapabilityService | undefined>
> = [
  {
    route: "/api/modules/leadgen/reports/funnel",
    isAvailable: (service) =>
      typeof service?.getLeadgenFunnelReport === "function"
  },
  {
    route: "/api/modules/leadgen/reports/activities-workload",
    isAvailable: (service) =>
      typeof service?.getActivitiesWorkloadReport === "function"
  },
  {
    route: "/api/modules/leadgen/reports/calls-workload",
    isAvailable: (service) =>
      typeof service?.getCallsWorkloadReport === "function"
  }
];

function createReportingDataPolicy(
  allowedScopes: string[]
): ModuleCapabilityManifest["dataPolicy"] {
  return {
    allowedScopes: [...allowedScopes],
    forbiddenFields: [...privateFieldExclusions],
    piiExcluded: true,
    rawPayloadAccess: false,
    directBitrixAccess: false,
    arbitrarySqliteAccess: false
  };
}

function createAvailableReportRouteSet<TService>(
  service: TService,
  descriptors: Array<ReportAvailabilityDescriptor<TService>>
) {
  return descriptors
    .filter((descriptor) => descriptor.isAvailable(service))
    .map((descriptor) => descriptor.route);
}

function createManifestOnlyAdapter(
  manifest: ModuleCapabilityManifest
): ModuleCapabilityAdapter {
  return {
    manifest,
    availableReportRoutes: manifest.reports
      .filter((report) => report.status === "available")
      .map((report) => report.route)
  };
}

function createPlannedManifestAdapter(
  manifest: ModuleCapabilityManifest
): ModuleCapabilityAdapter {
  return {
    manifest,
    availableReportRoutes: []
  };
}

export function createAttractionCapabilityManifest(): ModuleCapabilityManifest {
  return {
    moduleId: "attraction",
    displayName: "Привлечение",
    ontologyRef: "docs/modules/attraction/MODULE_ONTOLOGY.md",
    reports: [
      {
        id: "dashboard",
        title: "Дашборд Привлечения",
        description:
          "Attraction-owned dashboard summary over cached local reporting data.",
        route: "/api/dashboard",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.dashboard.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "source-quality-conversion",
        title: "Конверсия по качеству источника",
        description:
          "Attraction-owned conversion report grouped by source quality.",
        route: "/api/reports/source-quality-conversion",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.source-quality-conversion.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "activities-workload",
        title: "Нагрузка по активностям",
        description: "Attraction-owned workload report over cached activities.",
        route: "/api/reports/activities-workload",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.activities-workload.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "operational-dashboard",
        title: "Операционный дашборд",
        description:
          "Attraction-owned operational report for risks, sales, SLA, plans and open deals over cached local data.",
        route: "/api/reports/operational-dashboard",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.operational-dashboard.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "acquisition-outcomes",
        title: "Исходы привлечения",
        description: "Attraction-owned report for acquisition outcomes.",
        route: "/api/reports/acquisition-outcomes",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.acquisition-outcomes.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "target-group-conversion",
        title: "Конверсия целевой группы",
        description: "Attraction-owned target group conversion report.",
        route: "/api/reports/target-group-conversion",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.target-group-conversion.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "manager-action-outcomes",
        title: "Исходы действий менеджеров",
        description:
          "Attraction-owned report connecting manager actions to cached acquisition outcomes.",
        route: "/api/reports/manager-action-outcomes",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.manager-action-outcomes.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "calls-workload",
        title: "Нагрузка по звонкам",
        description: "Attraction-owned call workload report.",
        route: "/api/reports/calls-workload",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.calls-workload.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "conversion-events",
        title: "Конверсионные события",
        description:
          "Attraction-owned report for cached conversion event invitations and visits.",
        route: "/api/reports/conversion-events",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.conversion-events.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "cohort-conversion",
        title: "Когортная конверсия",
        description:
          "Attraction-owned cohort conversion report over cached deal lifecycle data.",
        route: "/api/reports/cohort-conversion",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.cohort-conversion.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "toc-flow",
        title: "TOC flow",
        description:
          "Attraction-owned throughput and flow report over cached stage movement data.",
        route: "/api/reports/toc-flow",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.toc-flow.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "revenue-velocity",
        title: "Денежная скорость",
        description:
          "Attraction-owned aggregate revenue velocity report over cached pipeline and action data.",
        route: "/api/reports/revenue-velocity",
        inputSchemaId: "attraction.revenue-velocity-request.v1",
        outputSchemaId: "attraction.revenue-velocity.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "unit-economics",
        title: "Юнит-экономика",
        description: "Attraction-owned unit economics report.",
        route: "/api/reports/unit-economics",
        inputSchemaId: "attraction.report-range-with-filters.v1",
        outputSchemaId: "attraction.unit-economics.v1",
        status: "available",
        agentReadable: false
      }
    ],
    safeReadModels: [
      {
        id: "attraction-report-summaries",
        title: "Attraction report summaries",
        description:
          "Aggregated attraction metrics exposed through report endpoints only.",
        schemaId: "attraction.report-summaries.v1",
        agentReadable: true
      }
    ],
    capabilities: ["report", "ontology", "sync", "comments", "agent-safe-read"],
    dataPolicy: createReportingDataPolicy([
      "attraction:reports",
      "attraction:ontology",
      "attraction:comments",
      "attraction:sync-status"
    ])
  };
}

export function createAttractionCapabilityAdapter(
  service: AttractionCapabilityService
): ModuleCapabilityAdapter {
  return {
    manifest: createAttractionCapabilityManifest(),
    availableReportRoutes: createAvailableReportRouteSet(
      service,
      attractionCapabilityReportAvailability
    )
  };
}

export function createLeadgenCapabilityManifest(): ModuleCapabilityManifest {
  return {
    moduleId: "leadgen",
    displayName: "Лидогенерация",
    ontologyRef: "docs/modules/leadgen/MODULE_ONTOLOGY.md",
    reports: [
      {
        id: "leadgen-funnel",
        title: "Воронка лидогенерации",
        description:
          "Leadgen-owned funnel report for cached category 28 deal data.",
        route: "/api/modules/leadgen/reports/funnel",
        inputSchemaId: "leadgen.range-request.v1",
        outputSchemaId: "leadgen.funnel-report.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "leadgen-activities-workload",
        title: "Нагрузка по активностям лидогенерации",
        description:
          "Leadgen-owned activities workload report over cached module data.",
        route: "/api/modules/leadgen/reports/activities-workload",
        inputSchemaId: "leadgen.range-request.v1",
        outputSchemaId: "leadgen.activities-workload.v1",
        status: "available",
        agentReadable: true
      },
      {
        id: "leadgen-calls-workload",
        title: "Нагрузка по звонкам лидогенерации",
        description: "Leadgen-owned call workload report over cached module data.",
        route: "/api/modules/leadgen/reports/calls-workload",
        inputSchemaId: "leadgen.range-request.v1",
        outputSchemaId: "leadgen.calls-workload.v1",
        status: "available",
        agentReadable: true
      }
    ],
    safeReadModels: [
      {
        id: "leadgen-report-summaries",
        title: "Leadgen report summaries",
        description:
          "Aggregated leadgen metrics exposed through module report endpoints only.",
        schemaId: "leadgen.report-summaries.v1",
        agentReadable: true
      }
    ],
    capabilities: ["report", "sync", "agent-safe-read"],
    dataPolicy: createReportingDataPolicy([
      "leadgen:reports",
      "leadgen:sync-status"
    ])
  };
}

export function createLeadgenCapabilityAdapter(
  service: LeadgenCapabilityService | undefined
): ModuleCapabilityAdapter {
  return {
    manifest: createLeadgenCapabilityManifest(),
    availableReportRoutes: createAvailableReportRouteSet(
      service,
      leadgenCapabilityReportAvailability
    )
  };
}

function validateModuleCapabilityManifest(manifest: ModuleCapabilityManifest) {
  if (!moduleIdPattern.test(manifest.moduleId)) {
    throw new Error("moduleId must be non-empty URL-safe text");
  }

  if (!manifest.displayName.trim()) {
    throw new Error(
      `Module capability manifest for "${manifest.moduleId}" must include displayName`
    );
  }

  if (!manifest.ontologyRef.trim()) {
    throw new Error(
      `Module capability manifest for "${manifest.moduleId}" must include ontologyRef`
    );
  }

  for (const report of manifest.reports) {
    if (!report.route.startsWith("/api/")) {
      throw new Error(
        `Invalid report route for "${manifest.moduleId}.${report.id}": reports[].route must start with /api/`
      );
    }
  }

  const dataPolicy = manifest.dataPolicy;
  if (dataPolicy.piiExcluded !== true) {
    throw new Error(
      `Module capability manifest for "${manifest.moduleId}" has unsafe dataPolicy.piiExcluded`
    );
  }
  if (dataPolicy.rawPayloadAccess !== false) {
    throw new Error(
      `Module capability manifest for "${manifest.moduleId}" has unsafe dataPolicy.rawPayloadAccess`
    );
  }
  if (dataPolicy.directBitrixAccess !== false) {
    throw new Error(
      `Module capability manifest for "${manifest.moduleId}" has unsafe dataPolicy.directBitrixAccess`
    );
  }
  if (dataPolicy.arbitrarySqliteAccess !== false) {
    throw new Error(
      `Module capability manifest for "${manifest.moduleId}" has unsafe dataPolicy.arbitrarySqliteAccess`
    );
  }

  if (unsafeManifestTokenPattern.test(JSON.stringify(manifest))) {
    throw new Error(
      `Module capability manifest for "${manifest.moduleId}" contains unsafe implementation metadata`
    );
  }
}

function normalizeAdapterManifest(
  adapter: ModuleCapabilityAdapter
): ModuleCapabilityManifest {
  validateModuleCapabilityManifest(adapter.manifest);
  const availableReportRoutes = new Set(adapter.availableReportRoutes ?? []);

  return {
    ...adapter.manifest,
    reports: adapter.manifest.reports.map((report) =>
      report.status === "available" && !availableReportRoutes.has(report.route)
        ? { ...report, status: "planned" }
        : report
    ),
    safeReadModels: adapter.manifest.safeReadModels.map((safeReadModel) => ({
      ...safeReadModel
    })),
    capabilities: [...adapter.manifest.capabilities],
    dataPolicy: {
      ...adapter.manifest.dataPolicy,
      allowedScopes: [...adapter.manifest.dataPolicy.allowedScopes],
      forbiddenFields: [...adapter.manifest.dataPolicy.forbiddenFields]
    }
  };
}

export function createModuleCapabilityRegistry(
  input: ModuleCapabilityRegistryInput = {}
): ModuleCapabilityRegistry {
  const adapters = [
    ...(input.includeDefaultAdapters === false
      ? []
      : [
          createManifestOnlyAdapter(createAttractionCapabilityManifest()),
          createManifestOnlyAdapter(createLeadgenCapabilityManifest())
        ]),
    ...(input.adapters ?? []),
    ...(input.extraManifests ?? []).map(createPlannedManifestAdapter)
  ];
  const manifestsById = new Map<string, ModuleCapabilityManifest>();

  for (const adapter of adapters) {
    const manifest = normalizeAdapterManifest(adapter);
    if (manifestsById.has(manifest.moduleId)) {
      throw new Error(
        `Duplicate module capability manifest for moduleId "${manifest.moduleId}"`
      );
    }

    manifestsById.set(manifest.moduleId, manifest);
  }

  return {
    get(moduleId) {
      return manifestsById.get(moduleId);
    },
    list() {
      return [...manifestsById.values()];
    }
  };
}
