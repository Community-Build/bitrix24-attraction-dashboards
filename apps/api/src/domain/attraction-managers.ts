import type {
  ManagerDirectoryEntry,
  ManagerTeamSetting,
  ManagerWhitelistSetting,
  ReportFilters
} from "@bitrix24-reporting/contracts";

export const ATTRACTION_MANAGER_CATALOG = [
  { id: "78", name: "Егоров Андрей" },
  { id: "11234", name: "Ромашова Ольга" },
  { id: "7824", name: "Мусальникова Кристина" },
  { id: "6994", name: "Кузнецова Анастасия" },
  { id: "7814", name: "Дарья Бычкова" },
  { id: "72", name: "Крохалева Мария" },
  { id: "2236", name: "Потапова Мария" },
  { id: "2764", name: "Каньков Вячеслав" },
  { id: "13020", name: "Какулия Илья" },
  {
    id: "7538",
    name: "Мария Саличева",
    callAttributionPolicy: "direct_only",
    callDisplayPolicy: "all_calls"
  },
  {
    id: "118",
    name: "Аделия Космасова",
    callAttributionPolicy: "direct_only",
    callDisplayPolicy: "all_calls"
  }
] satisfies ManagerDirectoryEntry[];

export const ATTRACTION_MANAGER_IDS = ATTRACTION_MANAGER_CATALOG.map(
  (manager) => manager.id
);

const attractionManagerOrder = new Map(
  ATTRACTION_MANAGER_IDS.map((id, index) => [id, index])
);
export const NO_ATTRACTION_MANAGER_MATCH_ID = "__NO_ATTRACTION_MANAGER_MATCH__";

export function normalizeAttractionManagerFilters(
  filters: ReportFilters | undefined,
  managerIds: string[] = ATTRACTION_MANAGER_IDS
): ReportFilters {
  const effectiveManagerIds =
    managerIds.length > 0 ? managerIds : [NO_ATTRACTION_MANAGER_MATCH_ID];
  const managerIdSet = new Set(effectiveManagerIds);
  const requestedManagerIds = filters?.managerIds ?? [];
  const scopedManagerIds = requestedManagerIds.filter((id) =>
    managerIdSet.has(id)
  );

  return {
    ...(filters ?? {}),
    managerIds:
      requestedManagerIds.length > 0
        ? scopedManagerIds.length > 0
          ? scopedManagerIds
          : [NO_ATTRACTION_MANAGER_MATCH_ID]
        : effectiveManagerIds
  };
}

export function resolveAttractionManagerAccessScope(input: {
  settings: ManagerWhitelistSetting[];
  defaultManagerId: string | null | undefined;
  canSeeAllTeams: boolean;
}) {
  const enabledSettings = input.settings
    .filter((setting) => setting.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  if (input.canSeeAllTeams) {
    return enabledSettings.map((setting) => setting.managerId);
  }

  const defaultManagerId = input.defaultManagerId?.trim();
  if (!defaultManagerId) {
    return [];
  }

  const ownSetting = enabledSettings.find(
    (setting) => setting.managerId === defaultManagerId
  );
  const teamId = ownSetting?.teamId?.trim();

  if (!ownSetting || !teamId) {
    return ownSetting ? [ownSetting.managerId] : [];
  }

  return enabledSettings
    .filter((setting) => setting.teamId === teamId)
    .map((setting) => setting.managerId);
}

export function buildManagerTeams(
  settings: ManagerWhitelistSetting[]
): ManagerTeamSetting[] {
  const teams = new Map<string, ManagerTeamSetting>();

  for (const setting of [...settings].sort(
    (left, right) => left.sortOrder - right.sortOrder
  )) {
    const teamId = setting.teamId?.trim();
    const teamName = setting.teamName?.trim();
    if (!setting.enabled || !teamId || !teamName) {
      continue;
    }

    const existing = teams.get(teamId);
    if (existing) {
      existing.managerIds.push(setting.managerId);
      existing.sortOrder = Math.min(existing.sortOrder, setting.sortOrder);
      if (setting.updatedAt > existing.updatedAt) {
        existing.updatedAt = setting.updatedAt;
      }
      continue;
    }

    teams.set(teamId, {
      id: teamId,
      name: teamName,
      managerIds: [setting.managerId],
      sortOrder: setting.sortOrder,
      updatedAt: setting.updatedAt
    });
  }

  return Array.from(teams.values()).sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ru")
  );
}

export function sortAttractionManagers(rows: ManagerDirectoryEntry[]) {
  return [...rows].sort((left, right) => {
    const leftOrder = attractionManagerOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = attractionManagerOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, "ru");
  });
}
