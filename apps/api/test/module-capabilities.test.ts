import type { ModuleCapabilityManifest } from "@bitrix24-reporting/contracts";
import { describe, expect, it } from "vitest";

import {
  type ModuleCapabilityAdapter,
  createAttractionCapabilityManifest,
  createAttractionCapabilityAdapter,
  createLeadgenCapabilityAdapter,
  createLeadgenCapabilityManifest,
  createModuleCapabilityRegistry
} from "../src/server/module-capabilities";

const fakeCustomModuleManifest = {
  moduleId: "custom-module",
  displayName: "Custom module",
  ontologyRef: "docs/modules/custom-module/MODULE_ONTOLOGY.md",
  reports: [
    {
      id: "activation-overview",
      title: "Activation overview",
      description: "Metadata-only custom activation report descriptor.",
      route: "/api/modules/custom-module/reports/activation-overview",
      inputSchemaId: "custom-module.activation-overview.input.v1",
      outputSchemaId: "custom-module.activation-overview.output.v1",
      status: "available",
      agentReadable: true
    }
  ],
  safeReadModels: [
    {
      id: "custom-activation-summary",
      title: "Custom activation summary",
      description: "Aggregated custom activation read model.",
      schemaId: "custom-module.activation-summary.v1",
      agentReadable: true
    }
  ],
  capabilities: ["report", "agent-safe-read"],
  dataPolicy: {
    allowedScopes: ["custom-module:activation-summary"],
    forbiddenFields: [
      "deal.title",
      "contact.name",
      "contact.phone",
      "contact.email",
      "rawBitrixPayload"
    ],
    piiExcluded: true,
    rawPayloadAccess: false,
    directBitrixAccess: false,
    arbitrarySqliteAccess: false
  }
} satisfies ModuleCapabilityManifest;

function getFakeCustomModuleActivationReport() {
  const [activationReport] = fakeCustomModuleManifest.reports;
  if (!activationReport) {
    throw new Error("Missing custom module activation report fixture");
  }
  return activationReport;
}

const expectedAttractionAnalyticsRoutes = [
  "/api/dashboard",
  "/api/reports/source-quality-conversion",
  "/api/reports/activities-workload",
  "/api/reports/operational-dashboard",
  "/api/reports/acquisition-outcomes",
  "/api/reports/target-group-conversion",
  "/api/reports/manager-action-outcomes",
  "/api/reports/calls-workload",
  "/api/reports/conversion-events",
  "/api/reports/cohort-conversion",
  "/api/reports/toc-flow",
  "/api/reports/revenue-velocity",
  "/api/reports/unit-economics"
] as const;

describe("module capability manifests", () => {
  it("defines attraction and leadgen as metadata-only manifests", () => {
    const attraction = createAttractionCapabilityManifest();
    const leadgen = createLeadgenCapabilityManifest();

    expect(attraction.moduleId).toBe("attraction");
    expect(leadgen.moduleId).toBe("leadgen");
    expect(attraction.capabilities).toContain("ontology");
    expect(leadgen.capabilities).toContain("report");
    expect(attraction.reports.every((report) => report.status === "available")).toBe(
      true
    );
    expect(leadgen.reports.every((report) => report.status === "available")).toBe(
      true
    );
    expect(leadgen.reports.map((report) => report.id)).not.toContain(
      "source-quality-conversion"
    );

    for (const manifest of [attraction, leadgen]) {
      expect(manifest.dataPolicy).toMatchObject({
        piiExcluded: true,
        rawPayloadAccess: false,
        directBitrixAccess: false,
        arbitrarySqliteAccess: false
      });
      expect(JSON.stringify(manifest)).not.toMatch(
        /SqliteRepository|BITRIX24_WEBHOOK|sqliteUrl|webhook/i
      );
    }
  });

  it("registers a fake custom-module manifest without attraction assumptions", () => {
    const registry = createModuleCapabilityRegistry({
      adapters: [{ manifest: fakeCustomModuleManifest }]
    });

    expect(registry.list().map((manifest) => manifest.moduleId)).toEqual([
      "attraction",
      "leadgen",
      "custom-module"
    ]);
    expect(registry.get("custom-module")?.reports).toEqual([
      expect.objectContaining({
        id: "activation-overview",
        status: "planned",
        agentReadable: true
      })
    ]);
    expect(registry.get("custom-module")?.dataPolicy.allowedScopes).not.toContain(
      "attraction:manager-whitelist"
    );
  });

  it("describes every live attraction analytics route exactly once", () => {
    const attraction = createAttractionCapabilityManifest();

    expect(attraction.reports.map((report) => report.route).sort()).toEqual(
      [...expectedAttractionAnalyticsRoutes].sort()
    );
    expect(new Set(attraction.reports.map((report) => report.id)).size).toBe(
      attraction.reports.length
    );
    expect(new Set(attraction.reports.map((report) => report.route)).size).toBe(
      attraction.reports.length
    );
  });

  it("keeps sensitive financial execution policy explicit for agents", () => {
    const attraction = createAttractionCapabilityManifest();
    const reportsById = new Map(
      attraction.reports.map((report) => [report.id, report])
    );

    expect(reportsById.get("revenue-velocity")).toEqual(
      expect.objectContaining({
        route: "/api/reports/revenue-velocity",
        status: "available",
        agentReadable: true
      })
    );
    expect(reportsById.get("unit-economics")).toEqual(
      expect.objectContaining({
        route: "/api/reports/unit-economics",
        status: "available",
        agentReadable: false
      })
    );
  });

  it("keeps custom-module reports available only when the adapter lists the live route", () => {
    const registry = createModuleCapabilityRegistry({
      adapters: [
        {
          manifest: fakeCustomModuleManifest,
          availableReportRoutes: [
            "/api/modules/custom-module/reports/activation-overview"
          ]
        }
      ]
    });

    expect(registry.get("custom-module")?.reports).toEqual([
      expect.objectContaining({
        id: "activation-overview",
        status: "available"
      })
    ]);
  });

  it("derives built-in report availability from narrow service adapter inputs", () => {
    const attractionAdapter = createAttractionCapabilityAdapter({
      getDashboard: () => undefined,
      getSourceQualityConversionReport: () => undefined,
      getRevenueVelocityReport: () => undefined
    });
    const leadgenUnavailableAdapter = createLeadgenCapabilityAdapter(undefined);
    const leadgenAvailableAdapter = createLeadgenCapabilityAdapter({
      getLeadgenFunnelReport: () => undefined
    });

    expect([...(attractionAdapter.availableReportRoutes ?? [])].sort()).toEqual(
      [
        "/api/dashboard",
        "/api/reports/revenue-velocity",
        "/api/reports/source-quality-conversion"
      ].sort()
    );
    expect([...(leadgenUnavailableAdapter.availableReportRoutes ?? [])]).toEqual([]);
    expect([...(leadgenAvailableAdapter.availableReportRoutes ?? [])]).toEqual([
      "/api/modules/leadgen/reports/funnel"
    ]);
  });

  it("rejects unsafe custom module manifests before publishing metadata", () => {
    const unsafeRawPayloadManifest = {
      ...fakeCustomModuleManifest,
      dataPolicy: {
        ...fakeCustomModuleManifest.dataPolicy,
        rawPayloadAccess: true
      }
    } as unknown as ModuleCapabilityManifest;

    expect(() =>
      createModuleCapabilityRegistry({
        adapters: [{ manifest: { ...fakeCustomModuleManifest, moduleId: "" } }]
      })
    ).toThrow(/moduleId.*URL-safe/i);
    expect(() =>
      createModuleCapabilityRegistry({
        adapters: [
          {
            manifest: {
              ...fakeCustomModuleManifest,
              reports: [
                {
                  ...getFakeCustomModuleActivationReport(),
                  route: "https://example.com/report"
                }
              ]
            }
          }
        ]
      })
    ).toThrow(/report.*route.*\/api\//i);
    expect(() =>
      createModuleCapabilityRegistry({
        adapters: [{ manifest: unsafeRawPayloadManifest }]
      })
    ).toThrow(/rawPayloadAccess/i);
  });

  it("keeps plain extra manifests as planned metadata for backwards compatibility", () => {
    const registry = createModuleCapabilityRegistry({
      extraManifests: [fakeCustomModuleManifest]
    });

    expect(registry.get("custom-module")?.reports).toEqual([
      expect.objectContaining({
        id: "activation-overview",
        status: "planned"
      })
    ]);
  });

  it("rejects duplicate module capability manifests", () => {
    expect(() =>
      createModuleCapabilityRegistry({
        adapters: [
          {
            manifest: {
              ...createLeadgenCapabilityManifest(),
              displayName: "Duplicate leadgen"
            }
          } satisfies ModuleCapabilityAdapter
        ]
      })
    ).toThrow(/Duplicate module capability manifest.*leadgen/);
  });
});
