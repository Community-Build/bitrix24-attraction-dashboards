import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { BitrixClient } from "../bitrix/client.js";
import { readEnv } from "../config/env.js";
import { createAttractionAgentGateway } from "../agent/attraction-agent-gateway.js";
import { createAttractionDataReader } from "../agent/attraction-data.js";
import { createAttractionMcpServer } from "../agent/mcp-server.js";
import { createPlaybookReader } from "../agent/playbook-reader.js";
import { createAttractionCapabilityManifest } from "../server/module-capabilities.js";
import { createSqliteRepository } from "../server/sqlite-repository.js";
import { createReportingService } from "../server/service.js";

async function main() {
  const env = readEnv();
  const repository = createSqliteRepository({
    databaseUrl: env.attractionDatabaseUrl,
    defaultWonStageIds: env.reportWonStageIds
  });
  const client = new BitrixClient({
    timeoutMs: env.BITRIX24_TIMEOUT_MS,
    requestIntervalMs: env.BITRIX24_REQUEST_INTERVAL_MS,
    qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD,
    dealCategoryIds: env.bitrixDealCategoryIds,
    ...(env.BITRIX24_PORTAL_HOST
      ? { portalHost: env.BITRIX24_PORTAL_HOST }
      : {}),
    ...(env.BITRIX24_WEBHOOK_USER_ID
      ? { userId: env.BITRIX24_WEBHOOK_USER_ID }
      : {}),
    ...(env.BITRIX24_WEBHOOK_TOKEN
      ? { webhookToken: env.BITRIX24_WEBHOOK_TOKEN }
      : {})
  });
  const service = createReportingService({
    dealCategoryIds: env.bitrixDealCategoryIds,
    leadgenCategoryId: env.leadgenCategoryId,
    leadgenManagerIds: env.leadgenManagerIds,
    qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD,
    tariffFieldName: env.BITRIX24_DEAL_TARIFF_FIELD,
    businessClubFieldName: env.BITRIX24_DEAL_BUSINESS_CLUB_FIELD,
    ...(env.BITRIX24_DEAL_TARGET_GROUP_FIELD
      ? { targetGroupFieldName: env.BITRIX24_DEAL_TARGET_GROUP_FIELD }
      : {}),
    ...(env.BITRIX24_DEAL_MEETING_TYPE_FIELD
      ? { meetingTypeFieldName: env.BITRIX24_DEAL_MEETING_TYPE_FIELD }
      : {}),
    ...(env.BITRIX24_DEAL_MEETING_DATE_FIELD
      ? { meetingDateFieldName: env.BITRIX24_DEAL_MEETING_DATE_FIELD }
      : {}),
    ...(env.BITRIX24_CONTACT_TARGET_GROUP_FIELD
      ? { contactTargetGroupFieldName: env.BITRIX24_CONTACT_TARGET_GROUP_FIELD }
      : {}),
    ...(env.BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD
      ? {
          legacyContactTargetGroupFieldName:
            env.BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD
        }
      : {}),
    repository,
    client,
    defaultPeriodDays: env.REPORT_DEFAULT_PERIOD_DAYS,
    bootstrapLookbackDays: env.BITRIX24_BOOTSTRAP_LOOKBACK_DAYS
  });
  const gateway = createAttractionAgentGateway({
    data: createAttractionDataReader({
      databaseUrl: env.attractionDatabaseUrl,
      categoryIds: env.bitrixDealCategoryIds,
      portalHost: env.BITRIX24_PORTAL_HOST
    }),
    manifest: createAttractionCapabilityManifest(),
    service,
    ontology: {
      getOverview: () => service.getAttractionOntology(),
      readSource: ({ sourceId }) =>
        service.getAttractionOntologySourceDocument(sourceId)
    },
    playbook: createPlaybookReader()
  });
  const server = createAttractionMcpServer(gateway);
  let closing = false;

  const close = async () => {
    if (closing) {
      return;
    }
    closing = true;
    await server.close().catch(() => undefined);
    repository.close();
  };

  process.once("SIGINT", () => {
    void close().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void close().finally(() => process.exit(0));
  });

  await server.connect(new StdioServerTransport());
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : "MCP server failed.";
  console.error("attraction_mcp.start_failed", message);
  process.exit(1);
});
