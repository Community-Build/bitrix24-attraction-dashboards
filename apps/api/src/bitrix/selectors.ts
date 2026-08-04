import {
  CALL_ENRICHMENT_CONTACT_FIELD_CODES,
  CALL_ENRICHMENT_DEAL_FIELD_CODES
} from "../server/call-enrichment-fields.js";

export const ALLOWED_DEAL_FIELDS = [
  "ID",
  "CONTACT_ID",
  "LEAD_ID",
  "DATE_CREATE",
  "DATE_MODIFY",
  "DATE_CLOSED",
  "CATEGORY_ID",
  "STAGE_ID",
  "STAGE_SEMANTIC_ID",
  "OPPORTUNITY",
  "ASSIGNED_BY_ID",
  "SOURCE_ID",
  "UTM_SOURCE",
  "UTM_MEDIUM",
  "UTM_CAMPAIGN",
  "UTM_CONTENT",
  "UTM_TERM"
] as const;

export const ALLOWED_LEAD_FIELDS = [
  "ID",
  "DATE_CREATE",
  "DATE_MODIFY",
  "STATUS_ID",
  "SOURCE_ID",
  "OPPORTUNITY",
  "ASSIGNED_BY_ID",
  "UTM_SOURCE",
  "UTM_MEDIUM",
  "UTM_CAMPAIGN",
  "UTM_CONTENT",
  "UTM_TERM"
] as const;

export const ALLOWED_BITRIX_METHODS = [
  "crm.deal.list",
  "crm.status.list",
  "crm.deal.fields",
  "crm.type.list",
  "crm.item.fields",
  "crm.category.list",
  "crm.contact.list",
  "crm.contact.fields",
  "crm.item.list",
  "lists.element.get",
  "crm.stagehistory.list",
  "crm.activity.list",
  "crm.activity.binding.list",
  "imopenlines.session.history.get",
  "disk.file.get",
  "voximplant.statistic.get",
  "user.get"
] as const;

interface SelectorOptions {
  categoryIds: string[];
  assignedByIds?: string[];
  modifiedAfter?: string;
  start?: number;
  qualityFieldName?: string;
  customFieldNames?: string[];
}

interface BackfillSelectorOptions {
  afterId: string;
  categoryIds: string[];
  assignedByIds?: string[];
  modifiedAfter?: string;
  qualityFieldName?: string;
  customFieldNames?: string[];
}

function buildCategoryFilter(categoryIds: string[]) {
  if (categoryIds.length === 1) {
    return {
      CATEGORY_ID: categoryIds[0]
    };
  }

  return {
    "@CATEGORY_ID": categoryIds
  };
}

function buildAssignedByFilter(assignedByIds: string[] | undefined) {
  if (!assignedByIds || assignedByIds.length === 0) {
    return {};
  }

  if (assignedByIds.length === 1) {
    return {
      ASSIGNED_BY_ID: assignedByIds[0]
    };
  }

  return {
    "@ASSIGNED_BY_ID": assignedByIds
  };
}

function buildDealScopeFilter(options: {
  categoryIds: string[];
  assignedByIds?: string[];
}) {
  return {
    ...buildCategoryFilter(options.categoryIds),
    ...buildAssignedByFilter(options.assignedByIds)
  };
}

function buildDealSelectFields(options: {
  qualityFieldName?: string;
  customFieldNames?: string[];
}) {
  return [
    ...ALLOWED_DEAL_FIELDS,
    ...Array.from(
      new Set([
        ...(options.qualityFieldName ? [options.qualityFieldName] : []),
        ...(options.customFieldNames ?? [])
      ])
    )
  ];
}

export function buildDealListParams(options: SelectorOptions) {
  return {
    select: buildDealSelectFields(options),
    filter: options.modifiedAfter
      ? {
          ...buildDealScopeFilter(options),
          ">=DATE_MODIFY": options.modifiedAfter
        }
      : buildDealScopeFilter(options),
    order: {
      ID: "ASC" as const
    },
    start: options.start ?? 0
  };
}

export function buildDealBackfillParams(options: BackfillSelectorOptions) {
  return {
    select: buildDealSelectFields(options),
    filter: {
      ...buildDealScopeFilter(options),
      ...(options.modifiedAfter ? { ">=DATE_MODIFY": options.modifiedAfter } : {}),
      ">ID": options.afterId
    },
    order: {
      ID: "ASC" as const
    },
    start: -1
  };
}

export function buildLeadListParams(options: SelectorOptions) {
  return {
    select: [...ALLOWED_LEAD_FIELDS],
    filter: options.modifiedAfter
      ? { ">=DATE_MODIFY": options.modifiedAfter }
      : {},
    order: {
      ID: "ASC" as const
    },
    start: options.start ?? 0
  };
}

export function buildLeadBackfillParams(options: BackfillSelectorOptions) {
  return {
    select: [...ALLOWED_LEAD_FIELDS],
    filter: {
      ">ID": options.afterId
    },
    order: {
      ID: "ASC" as const
    },
    start: -1
  };
}

export function buildContactEnrichmentValuesParams(contactId: string) {
  return {
    order: {
      ID: "ASC" as const
    },
    filter: {
      ID: contactId
    },
    select: ["ID", ...CALL_ENRICHMENT_CONTACT_FIELD_CODES],
    start: 0
  };
}

export function buildDealEnrichmentValuesParams(dealId: string) {
  return {
    order: {
      ID: "ASC" as const
    },
    filter: {
      ID: dealId
    },
    select: [
      "ID",
      "CONTACT_ID",
      "ASSIGNED_BY_ID",
      ...CALL_ENRICHMENT_DEAL_FIELD_CODES
    ],
    start: 0
  };
}

export function buildConversionEventItemListParams(options: {
  entityTypeId: number;
  modifiedAfter: string | null;
  start?: number;
  eventNameFieldName?: string | null;
  eventDateFieldName?: string | null;
  dealIds?: string[];
  contactIds?: string[];
}) {
  const filter = {
    ...(options.modifiedAfter
      ? {
          ">=updatedTime": options.modifiedAfter
        }
      : {}),
    ...(options.dealIds && options.dealIds.length > 0
      ? options.dealIds.length === 1
        ? { parentId2: options.dealIds[0] }
        : { "@parentId2": options.dealIds }
      : {}),
    ...(options.contactIds && options.contactIds.length > 0
      ? options.contactIds.length === 1
        ? { contactId: options.contactIds[0] }
        : { "@contactId": options.contactIds }
      : {})
  };

  return {
    entityTypeId: options.entityTypeId,
    select: [
      "id",
      "title",
      "stageId",
      "categoryId",
      "createdTime",
      "updatedTime",
      "assignedById",
      "contactId",
      "parentId2",
      "sourceId",
      ...(options.eventNameFieldName ? [options.eventNameFieldName] : []),
      ...(options.eventDateFieldName ? [options.eventDateFieldName] : [])
    ],
    filter,
    order: {
      id: "ASC" as const
    },
    start: options.start ?? 0
  };
}

export function buildConversionEventListParams(options: {
  entityTypeId: number;
  modifiedAfter: string | null;
  start?: number;
  eventDateFieldName?: string | null;
  eventTypeFieldName?: string | null;
  eventTypeIds?: string[];
  eventIds?: string[];
  eventFormatFieldName?: string | null;
}) {
  const eventTypeFilter =
    options.eventTypeFieldName && options.eventTypeIds && options.eventTypeIds.length > 0
      ? options.eventTypeIds.length === 1
        ? { [options.eventTypeFieldName]: options.eventTypeIds[0] }
        : { [`@${options.eventTypeFieldName}`]: options.eventTypeIds }
      : {};
  const eventIdFilter =
    options.eventIds && options.eventIds.length > 0
      ? options.eventIds.length === 1
        ? { id: options.eventIds[0] }
        : { "@id": options.eventIds }
      : {};

  return {
    entityTypeId: options.entityTypeId,
    select: [
      "id",
      "title",
      "stageId",
      "categoryId",
      "createdTime",
      "updatedTime",
      ...(options.eventDateFieldName ? [options.eventDateFieldName] : []),
      ...(options.eventTypeFieldName ? [options.eventTypeFieldName] : []),
      ...(options.eventFormatFieldName ? [options.eventFormatFieldName] : [])
    ],
    filter: {
      ...(options.modifiedAfter
        ? {
            ">=updatedTime": options.modifiedAfter
          }
        : {}),
      ...eventIdFilter,
      ...eventTypeFilter
    },
    order: {
      id: "ASC" as const
    },
    start: options.start ?? 0
  };
}

export function buildSmartProcessStageHistoryListParams(options: {
  entityTypeId: number;
  ownerIds: string[];
  start?: number;
}) {
  return {
    entityTypeId: options.entityTypeId,
    filter:
      options.ownerIds.length === 1
        ? {
            OWNER_ID: options.ownerIds[0]
          }
        : {
            "@OWNER_ID": options.ownerIds
          },
    select: ["ID", "OWNER_ID", "CATEGORY_ID", "STAGE_ID", "TYPE_ID", "CREATED_TIME"],
    order: {
      ID: "ASC" as const
    },
    start: options.start ?? 0
  };
}
