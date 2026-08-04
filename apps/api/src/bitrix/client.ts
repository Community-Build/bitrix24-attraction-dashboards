import type {
  ConversionEventTypeOption,
  ConversionEventVisitSnapshot,
  EventSnapshot,
  EventVisitStageHistorySnapshot,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";

import {
  buildContactEnrichmentValuesParams,
  buildConversionEventListParams,
  buildConversionEventItemListParams,
  buildDealBackfillParams,
  buildDealEnrichmentValuesParams,
  buildSmartProcessStageHistoryListParams
} from "./selectors.js";
import {
  assertAllowedCallEnrichmentWriteMethod,
  assertAllowedBitrixMethod,
  assertSafeCallEnrichmentWriteFields,
  assertSafeSelectFields,
  redactWebhookUrl
} from "./security.js";
import {
  parseConversionEventDate,
  resolveConversionEventName,
  resolveConversionEventStatus
} from "../domain/conversion-events.js";
import {
  CALL_ENRICHMENT_CONTACT_FIELD_CODES,
  CALL_ENRICHMENT_DEAL_FIELD_CODES,
  type CallEnrichmentEntityType
} from "../server/call-enrichment-fields.js";

interface BitrixClientConfig {
  dealCategoryIds: string[];
  qualityFieldName?: string;
  portalHost?: string;
  userId?: string;
  webhookToken?: string;
  timeoutMs: number;
  requestIntervalMs: number;
}

const CONVERSION_EVENT_ENTITY_TYPE_ID = 137;
const CONVERSION_EVENT_TYPE_ENTITY_TYPE_ID = 156;
const CONVERSION_EVENT_VISIT_ENTITY_TYPE_ID = 162;
const CONVERSION_EVENT_VISIT_TYPE_TITLE = "Посещения мероприятий";
const BITRIX_REQUEST_MAX_ATTEMPTS = 8;

interface BitrixResponse<T> {
  result?: T;
  next?: number;
  total?: number;
  error?: string;
  error_description?: string;
}

interface BitrixResultItems<T> {
  items?: T[];
}

interface DealListRow {
  ID: string;
  CONTACT_ID?: string | null;
  LEAD_ID: string | null;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  DATE_CLOSED?: string | null;
  CATEGORY_ID: string | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  OPPORTUNITY: number | null;
  ASSIGNED_BY_ID: string | null;
  SOURCE_ID: string | null;
  UTM_SOURCE: string | null;
  UTM_MEDIUM: string | null;
  UTM_CAMPAIGN: string | null;
  UTM_CONTENT: string | null;
  UTM_TERM: string | null;
  [key: string]: unknown;
}

export interface DealAuditRow {
  ID: string;
  ASSIGNED_BY_ID: string | null;
  DATE_CREATE: string;
  CATEGORY_ID: string | null;
}

interface StatusRow {
  ENTITY_ID: string;
  STATUS_ID: string;
  NAME: string;
  SORT?: string | null;
  CATEGORY_ID?: string | null;
  EXTRA?: {
    SEMANTICS?: string | null;
    COLOR?: string | null;
  };
}

interface DealFieldMetadata {
  title?: string;
  type?: string | null;
  settings?: Record<string, string | number | null>;
  items?: Array<{
    ID?: string | number;
    VALUE?: string;
    id?: string | number;
    value?: string;
  }>;
}

export interface StageHistoryRow {
  ID: string | number;
  OWNER_ID: string | number;
  CATEGORY_ID: string | number | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  TYPE_ID: number | null;
  CREATED_TIME: string;
}

export interface ActivityRow {
  ID: string;
  OWNER_TYPE_ID: string;
  OWNER_ID: string;
  TYPE_ID: string | null;
  PROVIDER_ID: string | null;
  RESPONSIBLE_ID: string | null;
  CREATED: string;
  DEADLINE: string | null;
  LAST_UPDATED: string;
  COMPLETED: string;
  COMPLETED_DATE?: string | null;
}

export interface OpenLineActivityRow {
  ID: string;
  OWNER_TYPE_ID: string;
  OWNER_ID: string;
  PROVIDER_ID: string;
  RESPONSIBLE_ID: string | null;
  LAST_UPDATED: string;
  ORIGIN_ID: string | null;
}

interface OpenLineHistoryRawMessage {
  id?: string | number;
  chatid?: string | number;
  senderid?: string | number;
  date?: string;
  text?: string | null;
  params?: Record<string, unknown> | null;
}

interface OpenLineHistoryRawUser {
  id?: string | number;
  connector?: boolean | string | number | null;
}

interface OpenLineHistoryRawChat {
  id?: string | number;
  name?: string | null;
  entityId?: string | null;
  entityType?: string | null;
}

interface OpenLineHistoryRawResult {
  chat?:
    | OpenLineHistoryRawChat
    | OpenLineHistoryRawChat[]
    | Record<string, OpenLineHistoryRawChat>
    | null;
  message?:
    | OpenLineHistoryRawMessage[]
    | Record<string, OpenLineHistoryRawMessage>
    | null;
  users?:
    | OpenLineHistoryRawUser[]
    | Record<string, OpenLineHistoryRawUser>
    | null;
}

export interface OpenLineSessionHistory {
  sessionId: string;
  chat: {
    id: string | null;
    entityId: string | null;
    entityType: string | null;
  };
  messages: Array<{
    id: string;
    chatId: string | null;
    senderId: string;
    date: string;
    text: string | null;
    attachmentFileIds: string[];
    hasAttachment: boolean;
  }>;
  users: Array<{
    id: string;
    connector: boolean | null;
  }>;
}

interface ActivityBindingListRow {
  entityTypeId: string | number;
  entityId: string | number;
}

export interface ActivityBindingRow {
  activityId: string;
  ownerTypeId: string;
  ownerId: string;
}

export interface CallRecordingActivityFileRow {
  id?: string | number;
  ID?: string | number;
  name?: string | null;
  NAME?: string | null;
  url?: string | null;
}

export interface CallRecordingActivityRow {
  ID: string;
  OWNER_TYPE_ID: string | null;
  OWNER_ID: string | null;
  PROVIDER_ID: string | null;
  FILES?: CallRecordingActivityFileRow[] | null;
  STORAGE_ELEMENT_IDS?: Array<string | number> | null;
}

export interface DiskFileRow {
  ID: string;
  DOWNLOAD_URL: string | null;
  NAME?: string | null;
  SIZE?: string | number | null;
}

export interface DiskFileDownload {
  fileId: string;
  fileName: string;
  bytes: Buffer;
}

export class DiskFileDownloadError extends Error {
  constructor(
    readonly code:
      | "DISK_FILE_TOO_LARGE"
      | "DISK_FILE_DOWNLOAD_FAILED"
      | "DISK_FILE_UNSAFE_URL",
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "DiskFileDownloadError";
  }
}

export interface CallRow {
  ID: string;
  CALL_ID?: string | number | null;
  CRM_ACTIVITY_ID: string | null;
  PORTAL_USER_ID: string | null;
  CALL_TYPE: string | null;
  CALL_START_DATE: string;
  CALL_DURATION: string | number | null;
  CRM_ENTITY_TYPE: string | null;
  CRM_ENTITY_ID: string | null;
  CALL_FAILED_CODE: string | null;
}

export interface UserRow {
  ID: string;
  NAME: string | null;
  LAST_NAME: string | null;
}

export interface ContactRow {
  ID: string;
  [key: string]: unknown;
}

export type CallEnrichmentValuesRow = Record<string, unknown>;

interface SmartProcessTypeRow {
  entityTypeId: string | number;
  title?: string | null;
}

interface SmartProcessTypeListResult {
  types?: SmartProcessTypeRow[];
}

interface IblockElementRow {
  ID: string | number;
  NAME?: string | null;
}

interface SmartProcessFieldMetadata {
  title?: string | null;
  type?: string | null;
  settings?: Record<string, string | null>;
  items?: Array<{
    ID?: string | number;
    VALUE?: string;
    id?: string | number;
    value?: string;
  }>;
}

interface SmartProcessFieldsResult {
  fields?: Record<string, SmartProcessFieldMetadata>;
}

interface SmartProcessCategoryResult {
  categories?: Array<{
    id: string | number;
    name?: string | null;
    title?: string | null;
    stages?: Array<{
      id?: string | number;
      statusId?: string | number;
      name?: string | null;
      title?: string | null;
    }>;
  }>;
}

interface ConversionEventItemRow {
  id: string | number;
  title?: string | null;
  stageId?: string | number | null;
  categoryId?: string | number | null;
  parentId2?: unknown;
  contactId?: unknown;
  assignedById?: unknown;
  sourceId?: string | number | null;
  createdTime?: string | null;
  updatedTime?: string | null;
  [key: string]: unknown;
}

interface ConversionEventRow {
  id: string | number;
  title?: string | null;
  stageId?: string | number | null;
  categoryId?: string | number | null;
  createdTime?: string | null;
  updatedTime?: string | null;
  [key: string]: unknown;
}

interface SmartProcessStageHistoryRow {
  ID: string | number;
  OWNER_ID: string | number;
  CATEGORY_ID?: string | number | null;
  STAGE_ID: string;
  TYPE_ID?: number | null;
  CREATED_TIME: string;
}

function buildDealStageEntityId(categoryId: string) {
  return categoryId === "0" ? "DEAL_STAGE" : `DEAL_STAGE_${categoryId}`;
}

function normalizeDealStageStatusId(categoryId: string, statusId: string) {
  const normalizedCategoryId = categoryId.trim() || "0";
  const normalizedStatusId = statusId.trim();

  if (normalizedCategoryId === "0" || /^C\d+:/i.test(normalizedStatusId)) {
    return normalizedStatusId;
  }

  return `C${normalizedCategoryId}:${normalizedStatusId}`;
}

function delay(milliseconds: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

function isRateLimitMessage(message: string) {
  return /too many requests|query_limit_exceeded/i.test(message);
}

function getErrorCauseCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return cause && typeof cause === "object" && "code" in cause
    ? String((cause as { code?: unknown }).code)
    : "";
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const causeCode = getErrorCauseCode(error);

  return (
    error.name === "AbortError" ||
    error.message === "fetch failed" ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    causeCode === "UND_ERR_HEADERS_TIMEOUT" ||
    causeCode === "ECONNRESET"
  );
}

function describeBitrixError(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const causeCode = getErrorCauseCode(error);
  if (causeCode) {
    return `${error.name}:${causeCode}`;
  }

  return error.name === "AbortError" && error.message
    ? `${error.name}:${error.message}`
    : error.name;
}

function createAbortError(message: string) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function logBitrixRequest(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console[level](`bitrix.${event}`, JSON.stringify(details));
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringArray(values: string[]) {
  return values.map((value) => String(value));
}

function pickAllowedFieldValues(
  row: Record<string, unknown>,
  fieldCodes: string[]
): CallEnrichmentValuesRow {
  return Object.fromEntries(
    fieldCodes
      .filter((fieldCode) => Object.prototype.hasOwnProperty.call(row, fieldCode))
      .map((fieldCode) => [fieldCode, row[fieldCode]])
  );
}

function normalizeOptionalString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "Y") {
    return true;
  }

  if (value === 0 || value === "0" || value === "N") {
    return false;
  }

  return null;
}

function normalizeOpenLineAttachmentIds(
  params: Record<string, unknown> | null | undefined
) {
  if (!params) {
    return [];
  }

  const rawFileIds = params.FILE_ID ?? params.fileId;
  const values = Array.isArray(rawFileIds) ? rawFileIds : [rawFileIds];
  return [
    ...new Set(
      values.flatMap((value) => {
        const normalized = normalizeOptionalString(value);
        return normalized ? [normalized] : [];
      })
    )
  ];
}

function parsePositiveByteCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function assertDiskFileSize(byteLength: number, maxBytes: number) {
  if (byteLength > maxBytes) {
    throw new DiskFileDownloadError(
      "DISK_FILE_TOO_LARGE",
      "Bitrix24 disk file is too large to download.",
      413
    );
  }
}

async function readDiskFileResponseWithLimit(
  response: Response,
  maxBytes: number
) {
  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer());
    assertDiskFileSize(bytes.byteLength, maxBytes);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        assertDiskFileSize(totalBytes, maxBytes);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

function normalizeOpenLineCollection<T>(
  value: T[] | Record<string, T> | null | undefined
) {
  if (Array.isArray(value)) {
    return value;
  }

  return value && typeof value === "object" ? Object.values(value) : [];
}

function isOpenLineHistoryRawChat(
  value: unknown
): value is OpenLineHistoryRawChat {
  if (!value || typeof value !== "object") {
    return false;
  }

  return ["id", "name", "entityId", "entityType"].some(
    (field) => field in value
  );
}

function normalizeOpenLineChat(
  value: OpenLineHistoryRawResult["chat"]
): OpenLineHistoryRawChat {
  if (isOpenLineHistoryRawChat(value)) {
    return value;
  }

  return normalizeOpenLineCollection(value).find(isOpenLineHistoryRawChat) ?? {};
}

function extractLinkedId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const directMatch = /^\d+$/.exec(trimmed);
    if (directMatch) {
      return directMatch[0];
    }

    const crmMatch = /(?:^|[_:])(\d+)$/u.exec(trimmed);
    return crmMatch?.[1] ?? trimmed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const linkedId = extractLinkedId(item);
      if (linkedId) {
        return linkedId;
      }
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      extractLinkedId(record.ID) ??
      extractLinkedId(record.id) ??
      extractLinkedId(record.VALUE) ??
      extractLinkedId(record.value)
    );
  }

  return null;
}

function normalizeFieldTitle(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ru").replace(/ё/g, "е");
}

function findFieldByExactTitle<T extends { title?: string | null }>(
  fields: Record<string, T>,
  title: string
) {
  const normalizedTitle = normalizeFieldTitle(title);
  return Object.entries(fields).find(
    ([, field]) => normalizeFieldTitle(field.title) === normalizedTitle
  )?.[0];
}

function findConversionEventNameField(
  fields: Record<string, SmartProcessFieldMetadata>
) {
  return (
    findFieldByExactTitle(fields, "Мероприятие") ??
    Object.entries(fields).find(([, field]) => {
      const title = normalizeFieldTitle(field.title);
      return title.includes("мероприят") && !title.includes("дата");
    })?.[0] ??
    null
  );
}

function findConversionEventDateField(
  fields: Record<string, SmartProcessFieldMetadata>
) {
  return (
    findFieldByExactTitle(fields, "Дата мероприятия") ??
    Object.entries(fields).find(([, field]) => {
      const title = normalizeFieldTitle(field.title);
      return (
        title.includes("дата") &&
        title.includes("мероприят") &&
        (field.type === "date" || field.type === "datetime")
      );
    })?.[0] ??
    null
  );
}

function findConversionEventTypeField(
  fields: Record<string, SmartProcessFieldMetadata>
) {
  return (
    findFieldByExactTitle(fields, "Тип мероприятия") ??
    findFieldByExactTitle(fields, "Виды мероприятий") ??
    (fields.parentId156 ? "parentId156" : null) ??
    Object.entries(fields).find(([, field]) => {
      const title = normalizeFieldTitle(field.title);
      return (
        (title.includes("тип") || title.includes("вид")) &&
        title.includes("мероприят")
      );
    })?.[0] ??
    null
  );
}

function findConversionEventFormatField(
  fields: Record<string, SmartProcessFieldMetadata>
) {
  return (
    findFieldByExactTitle(fields, "Формат") ??
    Object.entries(fields).find(([, field]) => {
      const title = normalizeFieldTitle(field.title);
      return title.includes("формат");
    })?.[0] ??
    null
  );
}

function fieldItemsToValueMap(field: SmartProcessFieldMetadata | undefined) {
  if (!field?.items || field.items.length === 0) {
    return {};
  }

  return Object.fromEntries(
    field.items.flatMap((item) => {
      const id = item.ID ?? item.id;
      const value = item.VALUE ?? item.value;

      return id !== undefined && value ? [[String(id), value]] : [];
    })
  ) as Record<string, string>;
}

function extractDynamicEntityTypeId(field: SmartProcessFieldMetadata | undefined) {
  const parentEntityTypeId = Number(field?.settings?.parentEntityTypeId);
  if (Number.isFinite(parentEntityTypeId)) {
    return parentEntityTypeId;
  }

  const dynamicEntityKey = Object.entries(field?.settings ?? {}).find(
    ([key, value]) => key.startsWith("DYNAMIC_") && value === "Y"
  )?.[0];
  if (!dynamicEntityKey) {
    return null;
  }

  const entityTypeId = Number(dynamicEntityKey.replace("DYNAMIC_", ""));
  return Number.isFinite(entityTypeId) ? entityTypeId : null;
}

function isNetworkDiscoveryError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.includes("fetch failed") ||
      error.message.includes("UND_ERR_CONNECT_TIMEOUT") ||
      error.message.includes("timed out"))
  );
}

function normalizeDateValue(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeEventStatus(stageName: string | null | undefined): EventSnapshot["status"] {
  const label = normalizeFieldTitle(stageName);
  const stageCode = label.split(":").pop() ?? label;

  if (label.includes("отмен")) {
    return "canceled";
  }

  if (stageCode === "fail") {
    return "canceled";
  }

  if (label.includes("заверш") || label.includes("проведен") || label.includes("прош")) {
    return "completed";
  }

  if (stageCode === "success") {
    return "completed";
  }

  if (label.includes("план")) {
    return "planned";
  }

  if (label.includes("преданонс")) {
    return "preannounce";
  }

  if (label.includes("чернов")) {
    return "draft";
  }

  if (stageCode === "new") {
    return "draft";
  }

  return "unknown";
}

function buildActivityOwnerFilter(ownerIds: string[]) {
  if (ownerIds.length === 1) {
    return {
      OWNER_TYPE_ID: 2,
      OWNER_ID: ownerIds[0]
    };
  }

  return {
    BINDINGS: ownerIds.map((ownerId) => ({
      OWNER_TYPE_ID: 2,
      OWNER_ID: ownerId
    }))
  };
}

function chunkValues<T>(values: T[], chunkSize = 50) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

const ACTIVITY_OWNER_CHUNK_SIZE = 10;

export class BitrixClient {
  private readonly baseUrl: string | null;
  private lastRequestAt = 0;
  private requestQueue: Promise<void> = Promise.resolve();
  private dealFieldsPromise: Promise<Record<string, DealFieldMetadata>> | null =
    null;
  private readonly dynamicItemTitleMaps = new Map<
    number,
    Promise<Record<string, string>>
  >();
  private readonly iblockElementTitleMaps = new Map<
    number,
    Promise<Record<string, string>>
  >();

  constructor(private readonly config: BitrixClientConfig) {
    this.baseUrl =
      config.portalHost && config.userId && config.webhookToken
        ? `https://${config.portalHost}/rest/${config.userId}/${config.webhookToken}`
        : null;
  }

  private ensureConfigured() {
    if (!this.baseUrl) {
      throw new Error("Bitrix24 webhook credentials are not configured.");
    }
  }

  private async call<T>(
    method: string,
    params: Record<string, unknown>,
    options?: {
      allowedCustomFields?: string[];
      callEnrichmentWrite?: {
        entityType: CallEnrichmentEntityType;
        fields: Record<string, unknown>;
      };
      signal?: AbortSignal;
    }
  ) {
    this.ensureConfigured();
    if (options?.callEnrichmentWrite) {
      assertAllowedCallEnrichmentWriteMethod(method);
      assertSafeCallEnrichmentWriteFields(
        options.callEnrichmentWrite.entityType,
        options.callEnrichmentWrite.fields
      );
    } else {
      assertAllowedBitrixMethod(method);
    }

    if (Array.isArray(params.select)) {
      assertSafeSelectFields(
        params.select.filter((value): value is string => typeof value === "string"),
        options?.allowedCustomFields ?? []
      );
    }

    const url = `${this.baseUrl}/${method}`;

    return this.withRequestSlot(async () => {
      const maxAttempts = BITRIX_REQUEST_MAX_ATTEMPTS;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const controller = new AbortController();
        let abortFromExternalSignal: (() => void) | null = null;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            const error = createAbortError(`Bitrix24 ${method} request timed out`);
            controller.abort(error);
            reject(error);
          }, this.config.timeoutMs);
        });
        const externalAbortPromise = options?.signal
          ? new Promise<never>((_resolve, reject) => {
              const abortRequest = () => {
                const reason =
                  options.signal?.reason instanceof Error
                    ? options.signal.reason
                    : createAbortError("Bitrix24 request aborted");
                controller.abort(reason);
                reject(reason);
              };

              if (options.signal?.aborted) {
                abortRequest();
              } else {
                abortFromExternalSignal = abortRequest;
                options.signal?.addEventListener("abort", abortRequest, {
                  once: true
                });
              }
            })
          : null;
        if (options?.signal) {
          options.signal.throwIfAborted?.();
        }

        try {
          const fetchRequest = fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(params),
            signal: controller.signal
          });
          const response = await Promise.race(
            externalAbortPromise
              ? [fetchRequest, timeoutPromise, externalAbortPromise]
              : [fetchRequest, timeoutPromise]
          );

          let payload: BitrixResponse<T>;
          try {
            payload = (await response.json()) as BitrixResponse<T>;
          } catch {
            if (attempt < maxAttempts - 1) {
              const delayMs =
                Math.max(this.config.requestIntervalMs, 1_000) * (attempt + 1);
              logBitrixRequest("warn", "request.retry", {
                method,
                attempt: attempt + 1,
                maxAttempts,
                status: response.status,
                reason: "non_json_response",
                delayMs
              });
              await delay(delayMs);
              continue;
            }

            const error = new Error(
              `Bitrix24 ${method} failed at ${redactWebhookUrl(url)}: non-JSON response (${response.status} ${response.statusText})`
            );
            logBitrixRequest("error", "request.failed", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              status: response.status,
              reason: "non_json_response"
            });
            throw error;
          }

          const errorMessage =
            payload.error_description ?? payload.error ?? response.statusText;
          if (!response.ok || payload.error) {
            if (
              isRateLimitMessage(errorMessage) &&
              attempt < maxAttempts - 1
            ) {
              const delayMs =
                Math.max(this.config.requestIntervalMs, 1_000) * (attempt + 1);
              logBitrixRequest("warn", "request.retry", {
                method,
                attempt: attempt + 1,
                maxAttempts,
                status: response.status,
                reason: "rate_limit",
                delayMs
              });
              await delay(delayMs);
              continue;
            }

            const error = new Error(
              `Bitrix24 ${method} failed at ${redactWebhookUrl(url)}: ${errorMessage}`
            );
            logBitrixRequest("error", "request.failed", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              status: response.status,
              reason: payload.error ?? response.statusText
            });
            throw error;
          }

          return payload;
        } catch (error) {
          if (options?.signal?.aborted) {
            throw error;
          }

          if (isTransientNetworkError(error) && attempt < maxAttempts - 1) {
            const delayMs =
              Math.max(this.config.requestIntervalMs, 1_000) * (attempt + 1);
            logBitrixRequest("warn", "request.retry", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              timeoutMs: this.config.timeoutMs,
              reason: describeBitrixError(error),
              delayMs
            });
            await delay(delayMs);
            continue;
          }

          if (
            !(error instanceof Error && error.message.startsWith("Bitrix24 "))
          ) {
            logBitrixRequest("error", "request.failed", {
              method,
              attempt: attempt + 1,
              maxAttempts,
              timeoutMs: this.config.timeoutMs,
              reason: describeBitrixError(error)
            });
          }
          throw error;
        } finally {
          if (timeout) {
            clearTimeout(timeout);
          }
          if (options?.signal && abortFromExternalSignal) {
            options.signal.removeEventListener("abort", abortFromExternalSignal);
          }
        }
      }

      throw new Error(`Bitrix24 ${method} failed at ${redactWebhookUrl(url)}`);
    });
  }

  private async withRequestSlot<T>(task: () => Promise<T>) {
    const previousRequest = this.requestQueue;
    let releaseRequest!: () => void;
    this.requestQueue = new Promise((resolve) => {
      releaseRequest = resolve;
    });

    await previousRequest;

    const waitMilliseconds = Math.max(
      0,
      this.lastRequestAt + this.config.requestIntervalMs - Date.now()
    );
    if (waitMilliseconds > 0) {
      await delay(waitMilliseconds);
    }

    try {
      return await task();
    } finally {
      this.lastRequestAt = Date.now();
      releaseRequest();
    }
  }

  private extractItems<T>(response: BitrixResponse<T[] | BitrixResultItems<T>>) {
    if (Array.isArray(response.result)) {
      return response.result;
    }

    if (
      response.result &&
      typeof response.result === "object" &&
      Array.isArray((response.result as BitrixResultItems<T>).items)
    ) {
      return (response.result as BitrixResultItems<T>).items ?? [];
    }

    return [] as T[];
  }

  private async collectPagedList<T>(
    method: string,
    buildParams: (start: number) => Record<string, unknown>,
    options?: {
      allowedCustomFields?: string[];
      signal?: AbortSignal;
    }
  ) {
    const rows: T[] = [];
    let start = 0;

    while (true) {
      const response = await this.call<T[] | BitrixResultItems<T>>(
        method,
        buildParams(start),
        options
      );
      const page = this.extractItems(response);

      if (page.length === 0) {
        break;
      }

      rows.push(...page);

      if (typeof response.next === "number") {
        start = response.next;
      } else if (page.length === 50) {
        start += 50;
      } else {
        break;
      }

      await delay(this.config.requestIntervalMs);
    }

    return rows;
  }

  private async collectByAscendingId<T extends { ID: string }>(
    method: string,
    buildParams: (afterId: string) => Record<string, unknown>,
    options?: {
      allowedCustomFields?: string[];
    }
  ) {
    const rows: T[] = [];
    let afterId = "0";

    while (true) {
      const response = await this.call<T[] | BitrixResultItems<T>>(
        method,
        buildParams(afterId),
        options
      );
      const page = this.extractItems(response);

      if (page.length === 0) {
        break;
      }

      rows.push(...page);

      if (page.length < 50) {
        break;
      }

      afterId = page.at(-1)?.ID ?? afterId;
      await delay(this.config.requestIntervalMs);
    }

    return rows;
  }

  private async collectChunked<T>(
    values: string[],
    loader: (chunk: string[]) => Promise<T[]>,
    chunkSize = 50
  ) {
    const rows: T[] = [];

    for (const chunk of chunkValues(values, chunkSize)) {
      const page = await loader(chunk);
      rows.push(...page);

      if (chunk.length === chunkSize) {
        await delay(this.config.requestIntervalMs);
      }
    }

    return rows;
  }

  private async fetchSmartProcessStageNames(
    entityTypeId: number,
    categories: NonNullable<SmartProcessCategoryResult["categories"]>
  ) {
    const stageNames = new Map<string, string>();
    const categoriesMissingStages: string[] = [];

    for (const category of categories) {
      const stages = category.stages ?? [];
      if (stages.length === 0) {
        const categoryId = normalizeOptionalString(category.id);
        if (categoryId) {
          categoriesMissingStages.push(categoryId);
        }
        continue;
      }

      for (const stage of stages) {
        const stageId = normalizeOptionalString(stage.id ?? stage.statusId);
        if (stageId) {
          stageNames.set(stageId, stage.name ?? stage.title ?? stageId);
        }
      }
    }

    for (const categoryId of categoriesMissingStages) {
      try {
        const response = await this.call<StatusRow[]>("crm.status.list", {
          filter: {
            ENTITY_ID: `DYNAMIC_${entityTypeId}_STAGE_${categoryId}`
          }
        });

        for (const row of this.extractItems(response)) {
          const stageId = normalizeOptionalString(row.STATUS_ID);
          if (stageId) {
            stageNames.set(stageId, row.NAME ?? stageId);
          }
        }
      } catch (error) {
        if (!isNetworkDiscoveryError(error)) {
          throw error;
        }
      }
    }

    return stageNames;
  }

  async fetchConversionEventDealFieldName() {
    const fields = await this.fetchDealFieldsMetadata();
    return findFieldByExactTitle(fields, "Мероприятие ОФ") ?? null;
  }

  private async loadConversionEventMetadata(entityTypeId: number) {
    const [fieldResponse, categoryResponse] = await Promise.all([
      this.call<SmartProcessFieldsResult>("crm.item.fields", {
        entityTypeId
      }),
      this.call<SmartProcessCategoryResult>("crm.category.list", {
        entityTypeId
      })
    ]);
    const fields = fieldResponse.result?.fields ?? {};
    const stageNames = await this.fetchSmartProcessStageNames(
      entityTypeId,
      categoryResponse.result?.categories ?? []
    );

    return {
      entityTypeId,
      eventNameFieldName: findConversionEventNameField(fields),
      eventDateFieldName: findConversionEventDateField(fields),
      eventEntityTypeId: extractDynamicEntityTypeId(
        fields[findConversionEventNameField(fields) ?? ""]
      ) ?? CONVERSION_EVENT_ENTITY_TYPE_ID,
      stageNames
    };
  }

  private async discoverConversionEventVisitEntityTypeId() {
    const typeResponse = await this.call<SmartProcessTypeListResult>(
      "crm.type.list",
      {}
    );
    const type = typeResponse.result?.types?.find(
      (candidate) =>
        normalizeFieldTitle(candidate.title) ===
        normalizeFieldTitle(CONVERSION_EVENT_VISIT_TYPE_TITLE)
    );
    const entityTypeId = Number(type?.entityTypeId);
    return Number.isFinite(entityTypeId) ? entityTypeId : null;
  }

  private async discoverConversionEventMetadata() {
    try {
      return await this.loadConversionEventMetadata(
        CONVERSION_EVENT_VISIT_ENTITY_TYPE_ID
      );
    } catch (knownEntityError) {
      let discoveredEntityTypeId: number | null = null;

      try {
        discoveredEntityTypeId =
          await this.discoverConversionEventVisitEntityTypeId();
      } catch (discoveryError) {
        if (!isNetworkDiscoveryError(discoveryError)) {
          throw discoveryError;
        }
      }

      if (
        discoveredEntityTypeId &&
        discoveredEntityTypeId !== CONVERSION_EVENT_VISIT_ENTITY_TYPE_ID
      ) {
        return this.loadConversionEventMetadata(discoveredEntityTypeId);
      }

      if (isNetworkDiscoveryError(knownEntityError)) {
        return null;
      }

      throw knownEntityError;
    }
  }

  private async discoverConversionEventItemMetadata() {
    const visitMetadata = await this.discoverConversionEventMetadata();
    if (!visitMetadata?.eventEntityTypeId) {
      return null;
    }

    const entityTypeId = visitMetadata.eventEntityTypeId;
    const [fieldResponse, categoryResponse] = await Promise.all([
      this.call<SmartProcessFieldsResult>("crm.item.fields", {
        entityTypeId
      }),
      this.call<SmartProcessCategoryResult>("crm.category.list", {
        entityTypeId
      })
    ]);
    const fields = fieldResponse.result?.fields ?? {};
    const eventDateFieldName = findConversionEventDateField(fields);
    const eventTypeFieldName = findConversionEventTypeField(fields);
    const eventFormatFieldName = findConversionEventFormatField(fields);
    const eventTypeEntityTypeId =
      extractDynamicEntityTypeId(
        eventTypeFieldName ? fields[eventTypeFieldName] : undefined
      ) ?? CONVERSION_EVENT_TYPE_ENTITY_TYPE_ID;
    const eventTypeMap =
      eventTypeFieldName && fields[eventTypeFieldName]?.items
        ? fieldItemsToValueMap(fields[eventTypeFieldName])
        : await this.fetchDynamicItemTitleMap(eventTypeEntityTypeId);
    const stageNames = await this.fetchSmartProcessStageNames(
      entityTypeId,
      categoryResponse.result?.categories ?? []
    );

    return {
      entityTypeId,
      eventDateFieldName,
      eventTypeFieldName,
      eventTypeMap,
      eventFormatFieldName,
      eventFormatMap: fieldItemsToValueMap(
        eventFormatFieldName ? fields[eventFormatFieldName] : undefined
      ),
      stageNames
    };
  }

  async listConversionEventVisits(input: {
    modifiedAfter: string | null;
    reportYear: number;
    dealIds?: string[];
    contactIds?: string[];
    signal?: AbortSignal;
  }): Promise<ConversionEventVisitSnapshot[]> {
    const metadata = await this.discoverConversionEventMetadata();
    if (!metadata) {
      return [];
    }

    const allowedCustomFields = [
      metadata.eventNameFieldName,
      metadata.eventDateFieldName
    ].filter((value): value is string => Boolean(value));
    const baseOptions = {
      entityTypeId: metadata.entityTypeId,
      modifiedAfter: input.modifiedAfter,
      eventNameFieldName: metadata.eventNameFieldName,
      eventDateFieldName: metadata.eventDateFieldName
    };
    const scopedRows: ConversionEventItemRow[][] = [];

    if (input.dealIds && input.dealIds.length > 0) {
      scopedRows.push(
        await this.collectChunked(
          input.dealIds,
          (chunk) =>
            this.collectPagedList<ConversionEventItemRow>(
              "crm.item.list",
              (start) =>
                buildConversionEventItemListParams({
                  ...baseOptions,
                  start,
                  dealIds: chunk
                }),
              {
                allowedCustomFields,
                ...(input.signal ? { signal: input.signal } : {})
              }
            ),
          50
        )
      );
    }

    if (input.contactIds && input.contactIds.length > 0) {
      scopedRows.push(
        await this.collectChunked(
          input.contactIds,
          (chunk) =>
            this.collectPagedList<ConversionEventItemRow>(
              "crm.item.list",
              (start) =>
                buildConversionEventItemListParams({
                  ...baseOptions,
                  start,
                  contactIds: chunk
                }),
              {
                allowedCustomFields,
                ...(input.signal ? { signal: input.signal } : {})
              }
            ),
          50
        )
      );
    }

    const rows =
      scopedRows.length > 0
        ? Array.from(
            new Map(
              scopedRows.flat().map((row) => [String(row.id), row])
            ).values()
          )
        : await this.collectPagedList<ConversionEventItemRow>(
            "crm.item.list",
            (start) =>
              buildConversionEventItemListParams({
                ...baseOptions,
                start
              }),
            {
              allowedCustomFields,
              ...(input.signal ? { signal: input.signal } : {})
            }
          );

    return rows.map((row) => {
      const stageId = normalizeOptionalString(row.stageId) ?? "";
      const stageName = metadata.stageNames.get(stageId) ?? stageId;
      const eventId = metadata.eventNameFieldName
        ? extractLinkedId(row[metadata.eventNameFieldName])
        : null;
      const rawEventName = metadata.eventNameFieldName
        ? normalizeOptionalString(row[metadata.eventNameFieldName])
        : null;
      const eventName = resolveConversionEventName(
        rawEventName && rawEventName !== eventId && !/^\d+$/.test(rawEventName)
          ? rawEventName
          : null,
        row.title ?? null
      );
      const explicitDate = metadata.eventDateFieldName
        ? normalizeDateValue(normalizeOptionalString(row[metadata.eventDateFieldName]))
        : null;
      const eventDate =
        explicitDate ?? parseConversionEventDate(eventName, input.reportYear) ?? "";

      return {
        id: String(row.id),
        eventId,
        eventName,
        eventDate,
        status: resolveConversionEventStatus(stageName),
        stageId,
        stageName,
        dealId: extractLinkedId(row.parentId2),
        contactId: extractLinkedId(row.contactId),
        managerId: normalizeOptionalString(row.assignedById),
        sourceId: normalizeOptionalString(row.sourceId),
        createdTime: row.createdTime ?? "",
        updatedTime: row.updatedTime ?? row.createdTime ?? ""
      };
    });
  }

  async listConversionEvents(input: {
    modifiedAfter: string | null;
    eventTypeIds?: string[];
    eventIds?: string[];
    signal?: AbortSignal;
  }): Promise<EventSnapshot[]> {
    const metadata = await this.discoverConversionEventItemMetadata();
    if (!metadata) {
      return [];
    }

    const allowedCustomFields = [
      metadata.eventDateFieldName,
      metadata.eventTypeFieldName,
      metadata.eventFormatFieldName
    ].filter((value): value is string => Boolean(value));
    const buildListParams = (start: number, eventIds?: string[]) =>
      buildConversionEventListParams({
        entityTypeId: metadata.entityTypeId,
        modifiedAfter: input.modifiedAfter,
        start,
        eventDateFieldName: metadata.eventDateFieldName,
        eventTypeFieldName: metadata.eventTypeFieldName,
        ...(input.eventTypeIds ? { eventTypeIds: input.eventTypeIds } : {}),
        ...(eventIds ? { eventIds } : {}),
        eventFormatFieldName: metadata.eventFormatFieldName
      });
    const rows =
      input.eventIds && input.eventIds.length > 0
        ? await this.collectChunked(
            input.eventIds,
            (chunk) =>
              this.collectPagedList<ConversionEventRow>(
                "crm.item.list",
                (start) => buildListParams(start, chunk),
                {
                  allowedCustomFields,
                  ...(input.signal ? { signal: input.signal } : {})
                }
              ),
            50
          )
        : await this.collectPagedList<ConversionEventRow>(
            "crm.item.list",
            (start) => buildListParams(start),
            {
              allowedCustomFields,
              ...(input.signal ? { signal: input.signal } : {})
            }
          );

    return rows.map((row) => {
      const stageId = normalizeOptionalString(row.stageId) ?? "";
      const eventTypeId = metadata.eventTypeFieldName
        ? extractLinkedId(row[metadata.eventTypeFieldName])
        : null;
      const formatId = metadata.eventFormatFieldName
        ? extractLinkedId(row[metadata.eventFormatFieldName])
        : null;
      const eventDate = metadata.eventDateFieldName
        ? normalizeDateValue(normalizeOptionalString(row[metadata.eventDateFieldName]))
        : null;

      return {
        eventId: String(row.id),
        entityTypeId: metadata.entityTypeId,
        categoryId:
          row.categoryId === null || row.categoryId === undefined
            ? null
            : Number(row.categoryId),
        title: row.title ?? null,
        eventDate: eventDate ?? row.createdTime ?? "",
        startAt: eventDate,
        endAt: null,
        stageId,
        stageName: metadata.stageNames.get(stageId) ?? stageId,
        status: normalizeEventStatus(metadata.stageNames.get(stageId) ?? stageId),
        eventTypeId,
        eventTypeLabel: eventTypeId ? metadata.eventTypeMap[eventTypeId] ?? eventTypeId : null,
        formatId,
        createdTime: row.createdTime ?? "",
        updatedTime: row.updatedTime ?? row.createdTime ?? ""
      };
    });
  }

  async listConversionEventTypeOptions(): Promise<ConversionEventTypeOption[]> {
    const metadata = await this.discoverConversionEventItemMetadata();
    if (!metadata) {
      return [];
    }

    return Object.entries(metadata.eventTypeMap).map(([id, title]) => ({
      id,
      title,
      categoryId: null,
      stageId: null,
      selectedForPlannedInventory: false
    }));
  }

  async listConversionEventVisitStageHistory(input: {
    visitIds: string[];
    signal?: AbortSignal;
  }): Promise<EventVisitStageHistorySnapshot[]> {
    const metadata = await this.discoverConversionEventMetadata();
    if (!metadata || input.visitIds.length === 0) {
      return [];
    }

    const rows = await this.collectChunked(
      input.visitIds,
      (chunk) =>
        this.collectPagedList<SmartProcessStageHistoryRow>(
          "crm.stagehistory.list",
          (start) =>
            buildSmartProcessStageHistoryListParams({
              entityTypeId: metadata.entityTypeId,
              ownerIds: chunk,
              start
            }),
          input.signal ? { signal: input.signal } : undefined
        ),
      100
    );

    return rows.map((row) => {
      const stageId = normalizeOptionalString(row.STAGE_ID) ?? "";

      return {
        historyId: String(row.ID),
        visitId: String(row.OWNER_ID),
        entityTypeId: metadata.entityTypeId,
        categoryId:
          row.CATEGORY_ID === null || row.CATEGORY_ID === undefined
            ? null
            : Number(row.CATEGORY_ID),
        stageId,
        stageName: metadata.stageNames.get(stageId) ?? stageId,
        typeId: row.TYPE_ID ?? null,
        changedAt: row.CREATED_TIME
      };
    });
  }

  async listDeals(cursor: {
    modifiedAfter: string | null;
    categoryIds?: string[];
    assignedByIds?: string[];
    qualityFieldName?: string;
    customFieldNames?: string[];
  }) {
    const categoryIds = cursor.categoryIds ?? this.config.dealCategoryIds;
    const qualityFieldName =
      cursor.qualityFieldName ?? this.config.qualityFieldName;
    const customFieldNames = Array.from(
      new Set([
        ...(qualityFieldName ? [qualityFieldName] : []),
        ...(cursor.customFieldNames ?? [])
      ])
    );
    const allowedCustomFields = customFieldNames;

    if (cursor.modifiedAfter === null) {
      return this.collectByAscendingId<DealListRow>(
        "crm.deal.list",
        (afterId) =>
          buildDealBackfillParams({
            afterId,
            categoryIds,
            ...(cursor.assignedByIds
              ? { assignedByIds: cursor.assignedByIds }
              : {}),
            customFieldNames
          }),
        {
          allowedCustomFields
        }
      );
    }

    return this.collectByAscendingId<DealListRow>(
      "crm.deal.list",
      (afterId) =>
        buildDealBackfillParams({
          afterId,
          categoryIds,
          ...(cursor.assignedByIds
            ? { assignedByIds: cursor.assignedByIds }
            : {}),
          ...(cursor.modifiedAfter
            ? { modifiedAfter: cursor.modifiedAfter }
            : {}),
          customFieldNames
        }),
      {
        allowedCustomFields
      }
    );
  }

  async listDealsForAudit(input: { filter: Record<string, unknown> }) {
    return this.collectPagedList<DealAuditRow>("crm.deal.list", (start) => ({
      select: ["ID", "ASSIGNED_BY_ID", "DATE_CREATE", "CATEGORY_ID"],
      filter: input.filter,
      order: {
        ID: "ASC" as const
      },
      start
    }));
  }

  async getDealEnrichmentValues(
    dealId: string
  ): Promise<CallEnrichmentValuesRow | null> {
    const response = await this.call<Array<Record<string, unknown>>>(
      "crm.deal.list",
      buildDealEnrichmentValuesParams(dealId),
      {
        allowedCustomFields: CALL_ENRICHMENT_DEAL_FIELD_CODES
      }
    );
    const row = this.extractItems(response)[0];

    return row
      ? pickAllowedFieldValues(row, CALL_ENRICHMENT_DEAL_FIELD_CODES)
      : null;
  }

  async updateDealEnrichmentField(input: {
    entityId: string;
    fieldCode: string;
    value: unknown;
  }) {
    const fields = {
      [input.fieldCode]: input.value
    };
    await this.call<boolean>(
      "crm.deal.update",
      {
        id: input.entityId,
        fields
      },
      {
        callEnrichmentWrite: {
          entityType: "deal",
          fields
        }
      }
    );
  }

  async fetchDealStages(categoryIds: string[]): Promise<StageCatalogEntry[]> {
    const rows = await Promise.all(
      Array.from(new Set(categoryIds)).map(async (categoryId) => {
        const response = await this.call<StatusRow[]>("crm.status.list", {
          filter: {
            ENTITY_ID: buildDealStageEntityId(categoryId)
          }
        });

        return this.extractItems(response).map((row) => ({
          entityType: "deal" as const,
          categoryId,
          statusId: normalizeDealStageStatusId(categoryId, row.STATUS_ID),
          name: row.NAME,
          semanticId: row.EXTRA?.SEMANTICS ?? null,
          sortOrder: toNumber(row.SORT)
        }));
      })
    );

    return rows.flat();
  }

  async fetchSourceCatalog(): Promise<StageCatalogEntry[]> {
    const response = await this.call<StatusRow[]>("crm.status.list", {
      filter: {
        ENTITY_ID: "SOURCE"
      }
    });

    return this.extractItems(response).map((row) => ({
      entityType: "source" as const,
      categoryId: row.CATEGORY_ID ? String(row.CATEGORY_ID) : null,
      statusId: row.STATUS_ID,
      name: row.NAME,
      semanticId: row.EXTRA?.SEMANTICS ?? null,
      sortOrder: toNumber(row.SORT)
    }));
  }

  private fetchDealFieldsMetadata() {
    if (!this.dealFieldsPromise) {
      this.dealFieldsPromise = this.call<Record<string, DealFieldMetadata>>(
        "crm.deal.fields",
        {}
      )
        .then((response) => response.result ?? {})
        .catch((error: unknown) => {
          this.dealFieldsPromise = null;
          throw error;
        });
    }

    return this.dealFieldsPromise;
  }

  private fetchDynamicItemTitleMap(entityTypeId: number) {
    const cached = this.dynamicItemTitleMaps.get(entityTypeId);
    if (cached) {
      return cached;
    }

    const request = this.collectPagedList<{
      id: number | string;
      title: string;
    }>("crm.item.list", (start) => ({
      entityTypeId,
      select: ["id", "title"],
      order: {
        id: "ASC" as const
      },
      start
    }))
      .then(
        (items) =>
          Object.fromEntries(
            items.map((item) => [String(item.id), item.title])
          ) as Record<string, string>
      )
      .catch((error: unknown) => {
        this.dynamicItemTitleMaps.delete(entityTypeId);
        throw error;
      });

    this.dynamicItemTitleMaps.set(entityTypeId, request);
    return request;
  }

  private fetchIblockElementTitleMap(iblockId: number) {
    const cached = this.iblockElementTitleMaps.get(iblockId);
    if (cached) {
      return cached;
    }

    const request = this.collectPagedList<IblockElementRow>(
      "lists.element.get",
      (start) => ({
        IBLOCK_TYPE_ID: "lists",
        IBLOCK_ID: iblockId,
        SELECT: ["ID", "NAME"],
        ELEMENT_ORDER: {
          ID: "ASC" as const
        },
        start
      })
    )
      .then(
        (items) =>
          Object.fromEntries(
            items.flatMap((item) =>
              item.NAME ? [[String(item.ID), item.NAME]] : []
            )
          ) as Record<string, string>
      )
      .catch((error: unknown) => {
        this.iblockElementTitleMaps.delete(iblockId);
        throw error;
      });

    this.iblockElementTitleMaps.set(iblockId, request);
    return request;
  }

  async fetchDealFieldValueMap(fieldName: string) {
    if (!fieldName) {
      return {};
    }

    const fields = await this.fetchDealFieldsMetadata();
    const field = fields[fieldName];
    if (field?.items && field.items.length > 0) {
      return Object.fromEntries(
        field.items.flatMap((item) => {
          const id = item.ID ?? item.id;
          const value = item.VALUE ?? item.value;

          return id !== undefined && value ? [[String(id), value]] : [];
        })
      ) as Record<string, string>;
    }

    const iblockId = Number(field?.settings?.IBLOCK_ID);
    if (field?.type === "iblock_element" && Number.isFinite(iblockId)) {
      return this.fetchIblockElementTitleMap(iblockId);
    }

    const dynamicEntityKey = Object.entries(field?.settings ?? {}).find(
      ([key, value]) => key.startsWith("DYNAMIC_") && value === "Y"
    )?.[0];

    if (!dynamicEntityKey) {
      return {};
    }

    const entityTypeId = Number(dynamicEntityKey.replace("DYNAMIC_", ""));
    if (!Number.isFinite(entityTypeId)) {
      return {};
    }

    return this.fetchDynamicItemTitleMap(entityTypeId);
  }

  async fetchDealQualityMap(fieldName: string) {
    return this.fetchDealFieldValueMap(fieldName);
  }

  async fetchContactFieldValueMap(fieldName: string) {
    if (!fieldName) {
      return {};
    }

    const response = await this.call<Record<string, DealFieldMetadata>>(
      "crm.contact.fields",
      {}
    );
    const field = response.result?.[fieldName];
    if (!field?.items || field.items.length === 0) {
      return {};
    }

    return Object.fromEntries(
      field.items.flatMap((item) => {
        const id = item.ID ?? item.id;
        const value = item.VALUE ?? item.value;

        return id !== undefined && value ? [[String(id), value]] : [];
      })
    ) as Record<string, string>;
  }

  async listStageHistory(input: {
    ownerIds?: string[];
    categoryIds?: string[];
    signal?: AbortSignal;
  }) {
    if (input.categoryIds && input.categoryIds.length > 0) {
      return (
        await Promise.all(
          input.categoryIds.map((categoryId) =>
            this.collectPagedList<StageHistoryRow>(
              "crm.stagehistory.list",
              (start) => ({
                entityTypeId: 2,
                filter: {
                  CATEGORY_ID: categoryId
                },
                select: [
                  "ID",
                  "OWNER_ID",
                  "CATEGORY_ID",
                  "STAGE_ID",
                  "STAGE_SEMANTIC_ID",
                  "TYPE_ID",
                  "CREATED_TIME"
                ],
                order: {
                  ID: "ASC" as const
                },
                start
              }),
              input.signal ? { signal: input.signal } : undefined
            )
          )
        )
      ).flat();
    }

    const ownerIds = input.ownerIds ?? [];
    if (ownerIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      ownerIds,
      (chunk) =>
        this.collectPagedList<StageHistoryRow>(
          "crm.stagehistory.list",
          (start) => ({
            entityTypeId: 2,
            filter: {
              "@OWNER_ID": toStringArray(chunk)
            },
            select: [
              "ID",
              "OWNER_ID",
              "CATEGORY_ID",
              "STAGE_ID",
              "STAGE_SEMANTIC_ID",
              "TYPE_ID",
              "CREATED_TIME"
            ],
            order: {
              ID: "ASC" as const
            },
            start
          }),
          input.signal ? { signal: input.signal } : undefined
        ),
      20
    );
  }

  async listActivities(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
    providerId?: string;
  }) {
    if (input.ownerIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      input.ownerIds,
      (chunk) =>
        this.collectByAscendingId<ActivityRow>("crm.activity.list", (afterId) => ({
          order: {
            ID: "ASC" as const
          },
          filter: {
            ...buildActivityOwnerFilter(chunk),
            ">ID": afterId,
            ...(input.providerId
              ? {
                  PROVIDER_ID: input.providerId
                }
              : {}),
            ...(input.modifiedAfter
              ? {
                  ">=LAST_UPDATED": input.modifiedAfter
                }
              : {})
          },
          select: [
            "ID",
            "OWNER_TYPE_ID",
            "OWNER_ID",
            "TYPE_ID",
            "PROVIDER_ID",
            "RESPONSIBLE_ID",
            "CREATED",
            "DEADLINE",
            "LAST_UPDATED",
            "COMPLETED",
            "COMPLETED_DATE"
          ],
          start: -1
        })),
      ACTIVITY_OWNER_CHUNK_SIZE
    );
  }

  async listOpenLineActivities(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
  }) {
    if (input.ownerIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      input.ownerIds,
      (chunk) =>
        this.collectByAscendingId<OpenLineActivityRow>(
          "crm.activity.list",
          (afterId) => ({
            order: {
              ID: "ASC" as const
            },
            filter: {
              ...buildActivityOwnerFilter(chunk),
              ">ID": afterId,
              PROVIDER_ID: "IMOPENLINES_SESSION",
              ...(input.modifiedAfter
                ? {
                    ">=LAST_UPDATED": input.modifiedAfter
                  }
                : {})
            },
            select: [
              "ID",
              "OWNER_TYPE_ID",
              "OWNER_ID",
              "PROVIDER_ID",
              "RESPONSIBLE_ID",
              "LAST_UPDATED",
              "ORIGIN_ID"
            ],
            start: -1
          })
        ),
      ACTIVITY_OWNER_CHUNK_SIZE
    );
  }

  async getOpenLineSessionHistory(
    sessionId: string
  ): Promise<OpenLineSessionHistory> {
    const response = await this.call<OpenLineHistoryRawResult>(
      "imopenlines.session.history.get",
      {
        SESSION_ID: sessionId
      }
    );
    const result = response.result ?? {};
    const chat = normalizeOpenLineChat(result.chat);

    return {
      sessionId,
      chat: {
        id: normalizeOptionalString(chat.id),
        entityId: normalizeOptionalString(chat.entityId),
        entityType: normalizeOptionalString(chat.entityType)
      },
      messages: normalizeOpenLineCollection(result.message).flatMap((message) => {
        const id = normalizeOptionalString(message.id);
        const senderId = normalizeOptionalString(message.senderid);
        const date = normalizeOptionalString(message.date);
        if (!id || !senderId || !date) {
          return [];
        }

        const attachmentFileIds = normalizeOpenLineAttachmentIds(message.params);
        return [
          {
            id,
            chatId: normalizeOptionalString(message.chatid),
            senderId,
            date,
            text: typeof message.text === "string" ? message.text : null,
            attachmentFileIds,
            hasAttachment: attachmentFileIds.length > 0
          }
        ];
      }),
      users: normalizeOpenLineCollection(result.users).flatMap((user) => {
        const id = normalizeOptionalString(user.id);
        return id
          ? [
              {
                id,
                connector: normalizeOptionalBoolean(user.connector)
              }
            ]
          : [];
      })
    };
  }

  async listContacts(input: { ids: string[]; customFieldNames?: string[] }) {
    if (input.ids.length === 0) {
      return [];
    }

    const customFieldNames = Array.from(new Set(input.customFieldNames ?? []));

    return this.collectChunked(
      input.ids,
      async (chunk) => {
        const response = await this.call<ContactRow[]>(
          "crm.contact.list",
          {
            order: {
              ID: "ASC" as const
            },
            filter: {
              "@ID": toStringArray(chunk)
            },
            select: ["ID", ...customFieldNames],
            start: 0
          },
          {
            allowedCustomFields: customFieldNames
          }
        );

        return this.extractItems(response);
      }
    );
  }

  async getContactEnrichmentValues(
    contactId: string
  ): Promise<CallEnrichmentValuesRow | null> {
    const response = await this.call<ContactRow[]>(
      "crm.contact.list",
      buildContactEnrichmentValuesParams(contactId),
      {
        allowedCustomFields: CALL_ENRICHMENT_CONTACT_FIELD_CODES
      }
    );
    const row = this.extractItems(response)[0];

    return row
      ? pickAllowedFieldValues(row, CALL_ENRICHMENT_CONTACT_FIELD_CODES)
      : null;
  }

  async updateContactEnrichmentField(input: {
    entityId: string;
    fieldCode: string;
    value: unknown;
  }) {
    const fields = {
      [input.fieldCode]: input.value
    };
    await this.call<boolean>(
      "crm.contact.update",
      {
        id: input.entityId,
        fields
      },
      {
        callEnrichmentWrite: {
          entityType: "contact",
          fields
        }
      }
    );
  }

  async listActivitiesByIds(activityIds: string[]) {
    if (activityIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      activityIds,
      async (chunk) => {
        const response = await this.call<ActivityRow[]>("crm.activity.list", {
          order: {
            ID: "ASC" as const
          },
          filter: {
            OWNER_TYPE_ID: 2,
            "@ID": toStringArray(chunk)
          },
          select: [
            "ID",
            "OWNER_TYPE_ID",
            "OWNER_ID",
            "TYPE_ID",
            "PROVIDER_ID",
            "RESPONSIBLE_ID",
            "CREATED",
            "DEADLINE",
            "LAST_UPDATED",
            "COMPLETED",
            "COMPLETED_DATE"
          ],
          start: 0
        });

        return this.extractItems(response);
      }
    );
  }

  async listActivityBindings(activityIds: string[]) {
    if (activityIds.length === 0) {
      return [];
    }

    const rows: ActivityBindingRow[] = [];
    for (const activityId of Array.from(new Set(activityIds))) {
      const response = await this.call<ActivityBindingListRow[]>(
        "crm.activity.binding.list",
        {
          activityId
        }
      );

      rows.push(
        ...this.extractItems(response).map((row) => ({
          activityId,
          ownerTypeId: String(row.entityTypeId),
          ownerId: String(row.entityId)
        }))
      );
    }

    return rows;
  }

  async listCallRecordingActivitiesByIds(activityIds: string[]) {
    if (activityIds.length === 0) {
      return [];
    }

    return this.collectChunked(
      activityIds,
      async (chunk) => {
        const response = await this.call<CallRecordingActivityRow[]>(
          "crm.activity.list",
          {
            order: {
              ID: "ASC" as const
            },
            filter: {
              "@ID": toStringArray(chunk)
            },
            select: [
              "ID",
              "OWNER_TYPE_ID",
              "OWNER_ID",
              "PROVIDER_ID",
              "FILES",
              "STORAGE_ELEMENT_IDS"
            ],
            start: 0
          }
        );

        return this.extractItems(response);
      }
    );
  }

  async getDiskFile(fileId: string | number) {
    const response = await this.call<DiskFileRow>("disk.file.get", {
      id: String(fileId)
    });

    return response.result ?? null;
  }

  async downloadDiskFile(
    fileId: string | number,
    options: { maxBytes: number }
  ): Promise<DiskFileDownload | null> {
    const normalizedFileId = String(fileId).trim();
    if (!normalizedFileId) {
      return null;
    }
    if (!Number.isFinite(options.maxBytes) || options.maxBytes < 1) {
      throw new DiskFileDownloadError(
        "DISK_FILE_DOWNLOAD_FAILED",
        "Bitrix24 disk file download limit is invalid.",
        502
      );
    }

    const file = await this.getDiskFile(normalizedFileId);
    const downloadUrl = normalizeOptionalString(file?.DOWNLOAD_URL);
    if (!file || !downloadUrl) {
      return null;
    }

    const declaredSize = parsePositiveByteCount(file.SIZE);
    if (declaredSize !== null) {
      assertDiskFileSize(declaredSize, options.maxBytes);
    }

    let parsedDownloadUrl: URL;
    let portalOrigin: string;
    try {
      parsedDownloadUrl = new URL(downloadUrl);
      portalOrigin = new URL(`https://${this.config.portalHost ?? ""}`).origin;
    } catch {
      throw new DiskFileDownloadError(
        "DISK_FILE_UNSAFE_URL",
        "Bitrix24 disk file download URL is invalid.",
        502
      );
    }
    if (
      parsedDownloadUrl.protocol !== "https:" ||
      parsedDownloadUrl.origin !== portalOrigin ||
      parsedDownloadUrl.username ||
      parsedDownloadUrl.password
    ) {
      throw new DiskFileDownloadError(
        "DISK_FILE_UNSAFE_URL",
        "Bitrix24 disk file download URL is not allowed.",
        502
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response: Response;
    try {
      response = await fetch(parsedDownloadUrl, {
        method: "GET",
        redirect: "error",
        signal: controller.signal
      });
    } catch {
      clearTimeout(timeout);
      throw new DiskFileDownloadError(
        "DISK_FILE_DOWNLOAD_FAILED",
        "Bitrix24 disk file download failed.",
        502
      );
    }

    try {
      if (!response.ok) {
        throw new DiskFileDownloadError(
          "DISK_FILE_DOWNLOAD_FAILED",
          "Bitrix24 disk file download failed.",
          502
        );
      }
      const responseUrl = normalizeOptionalString(response.url);
      if (responseUrl) {
        try {
          if (new URL(responseUrl).origin !== portalOrigin) {
            throw new Error("unexpected origin");
          }
        } catch {
          throw new DiskFileDownloadError(
            "DISK_FILE_UNSAFE_URL",
            "Bitrix24 disk file response URL is not allowed.",
            502
          );
        }
      }

      const contentLength = parsePositiveByteCount(
        response.headers.get("content-length")
      );
      if (contentLength !== null) {
        assertDiskFileSize(contentLength, options.maxBytes);
      }

      let bytes: Buffer;
      try {
        bytes = await readDiskFileResponseWithLimit(response, options.maxBytes);
      } catch (error) {
        if (error instanceof DiskFileDownloadError) {
          throw error;
        }
        throw new DiskFileDownloadError(
          "DISK_FILE_DOWNLOAD_FAILED",
          "Bitrix24 disk file download failed.",
          502
        );
      }

      return {
        fileId: normalizeOptionalString(file.ID) ?? normalizedFileId,
        fileName:
          normalizeOptionalString(file.NAME) ?? `attachment-${normalizedFileId}`,
        bytes
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async listCalls(input: {
    activityIds?: string[];
    callStartDateFrom?: string;
    callStartDateTo?: string;
    portalUserIds?: string[];
  }) {
    if (input.activityIds && input.activityIds.length === 0) {
      return [];
    }

    if (input.activityIds && input.activityIds.length > 0) {
      return this.collectChunked(input.activityIds, (chunk) =>
        this.collectPagedList<CallRow>("voximplant.statistic.get", (start) => ({
          FILTER: {
            CRM_ACTIVITY_ID: toStringArray(chunk)
          },
          start
        }))
      );
    }

    if (
      input.callStartDateFrom &&
      input.callStartDateTo &&
      input.portalUserIds &&
      input.portalUserIds.length > 0
    ) {
      return this.collectPagedList<CallRow>("voximplant.statistic.get", (start) => ({
        FILTER: {
          ">=CALL_START_DATE": input.callStartDateFrom,
          "<=CALL_START_DATE": input.callStartDateTo,
          PORTAL_USER_ID: toStringArray(input.portalUserIds ?? [])
        },
        start
      }));
    }

    return [];
  }

  async fetchUsers(input: { ids: string[] }) {
    if (input.ids.length === 0) {
      return [];
    }

    return this.collectChunked(
      input.ids,
      async (chunk) => {
        const response = await this.call<UserRow[]>("user.get", {
          ID: toStringArray(chunk)
        });

        return this.extractItems(response);
      },
      50
    );
  }
}
