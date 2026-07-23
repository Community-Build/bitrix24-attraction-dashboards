import type {
  ActivitiesWorkloadReport,
  CallsWorkloadReport
} from "@bitrix24-reporting/contracts";

const DEFAULT_MAX_MESSAGE_LENGTH = 4096;
const REPORT_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface DailyActivityReportRangeInput {
  now: Date;
  timezone: string;
  reportTime: string;
}

export interface TelegramActivityReportMessageInput {
  moduleName: string;
  timezone: string;
  now: Date;
  lastSyncFinishedAt: string | null;
  excludedManagerNamePatterns?: string[];
  managerTeams?: Array<{
    id: string;
    name: string;
    managerIds: string[];
  }>;
  managerCatalog?: Array<{
    id: string;
    name: string;
  }>;
  activities: ActivitiesWorkloadReport;
  calls: CallsWorkloadReport;
  maxMessageLength?: number;
}

export interface TelegramActivityReportDelivery {
  teamId: string | null;
  text: string;
}

interface ManagerActivitySummary {
  managerId: string;
  managerName: string;
  createdCount: number;
  closedCount: number;
  meetingCount: number;
  outgoingCalls: number;
}

export function parseDailyActivityReportTime(reportTime: string) {
  const match = REPORT_TIME_PATTERN.exec(reportTime.trim());
  if (!match) {
    throw new Error("Invalid daily activity report time. Expected HH:mm.");
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getZonedDateParts(date: Date, timezone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second"))
  };
}

function getTimezoneOffsetMinutes(date: Date, timezone: string) {
  const parts = getZonedDateParts(date, timezone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return Math.round((localAsUtc - date.getTime()) / 60_000);
}

function formatOffset(offsetMinutes: number) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);

  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

function zonedDateTimeToUtc(
  input: Omit<ZonedDateParts, "second"> & { second?: number },
  timezone: string
) {
  const utcGuess = new Date(
    Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      input.hour,
      input.minute,
      input.second ?? 0
    )
  );
  const firstOffset = getTimezoneOffsetMinutes(utcGuess, timezone);
  const firstCandidate = new Date(utcGuess.getTime() - firstOffset * 60_000);
  const correctedOffset = getTimezoneOffsetMinutes(firstCandidate, timezone);

  if (correctedOffset !== firstOffset) {
    return new Date(utcGuess.getTime() - correctedOffset * 60_000);
  }

  return firstCandidate;
}

function addLocalDays(parts: Pick<ZonedDateParts, "year" | "month" | "day">, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function formatLocalIso(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timezone: string;
}) {
  const utcDate = zonedDateTimeToUtc(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute
    },
    input.timezone
  );
  const offset = formatOffset(getTimezoneOffsetMinutes(utcDate, input.timezone));

  return `${input.year}-${pad2(input.month)}-${pad2(input.day)}T${pad2(
    input.hour
  )}:${pad2(input.minute)}:00.000${offset}`;
}

export function buildDailyActivityReportRange(input: DailyActivityReportRangeInput) {
  const reportTime = parseDailyActivityReportTime(input.reportTime);
  const today = getZonedDateParts(input.now, input.timezone);

  return {
    from: formatLocalIso({
      year: today.year,
      month: today.month,
      day: today.day,
      hour: 0,
      minute: 0,
      timezone: input.timezone
    }),
    to: formatLocalIso({
      year: today.year,
      month: today.month,
      day: today.day,
      hour: reportTime.hour,
      minute: reportTime.minute,
      timezone: input.timezone
    })
  };
}

export function getNextDailyActivityReportDelayMs(
  input: DailyActivityReportRangeInput
) {
  const reportTime = parseDailyActivityReportTime(input.reportTime);
  const today = getZonedDateParts(input.now, input.timezone);
  let target = zonedDateTimeToUtc(
    {
      year: today.year,
      month: today.month,
      day: today.day,
      hour: reportTime.hour,
      minute: reportTime.minute
    },
    input.timezone
  );

  if (target.getTime() <= input.now.getTime()) {
    const tomorrow = addLocalDays(today, 1);
    target = zonedDateTimeToUtc(
      {
        year: tomorrow.year,
        month: tomorrow.month,
        day: tomorrow.day,
        hour: reportTime.hour,
        minute: reportTime.minute
      },
      input.timezone
    );
  }

  return Math.max(0, target.getTime() - input.now.getTime());
}

function formatDateOnly(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDateTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(date)
    .replace(/\u202f/g, " ");
}

function normalizeManagerName(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function isExcludedManagerName(name: string, patterns: string[]) {
  const normalizedName = normalizeManagerName(name);

  return patterns.some((pattern) => {
    const normalizedPattern = normalizeManagerName(pattern);
    return normalizedPattern.length > 0 && normalizedName.includes(normalizedPattern);
  });
}

function buildManagerSummaries(
  input: TelegramActivityReportMessageInput
): ManagerActivitySummary[] {
  const activityRows = new Map(
    input.activities.managerRows.map((row) => [row.managerId, row])
  );
  const callRows = new Map(input.calls.managerRows.map((row) => [row.managerId, row]));
  const managerNames = new Map(
    (input.managerCatalog ?? []).map((manager) => [manager.id, manager.name])
  );
  const managerIds = Array.from(
    new Set([...managerNames.keys(), ...activityRows.keys(), ...callRows.keys()])
  );
  const excludedPatterns = input.excludedManagerNamePatterns ?? [];

  return managerIds
    .map((managerId) => {
      const activityRow = activityRows.get(managerId);
      const callRow = callRows.get(managerId);
      const managerName =
        managerNames.get(managerId) ??
        activityRow?.managerName ??
        callRow?.managerName ??
        `ID ${managerId}`;

      return {
        managerId,
        managerName,
        createdCount: activityRow?.createdCount ?? 0,
        closedCount: activityRow?.closedCount ?? 0,
        meetingCount: activityRow?.meetingCount ?? 0,
        outgoingCalls: callRow?.outgoingCalls ?? 0
      };
    })
    .filter((row) => !isExcludedManagerName(row.managerName, excludedPatterns))
    .sort((left, right) => left.managerName.localeCompare(right.managerName, "ru"));
}

function sumManagerSummaries(rows: ManagerActivitySummary[]) {
  return rows.reduce(
    (total, row) => ({
      createdCount: total.createdCount + row.createdCount,
      closedCount: total.closedCount + row.closedCount,
      meetingCount: total.meetingCount + row.meetingCount,
      outgoingCalls: total.outgoingCalls + row.outgoingCalls
    }),
    {
      createdCount: 0,
      closedCount: 0,
      meetingCount: 0,
      outgoingCalls: 0
    }
  );
}

function formatNumberSection(
  title: string,
  rows: ManagerActivitySummary[],
  getValue: (row: ManagerActivitySummary) => number
) {
  return [title, ...rows.map((row) => `${row.managerName} - ${getValue(row)}`)];
}

function truncateLine(line: string, maxLength: number) {
  if (line.length <= maxLength) {
    return line;
  }

  return `${line.slice(0, Math.max(0, maxLength - 1))}…`;
}

function appendLineToSplitMessages(input: {
  messages: string[];
  currentLines: string[];
  line: string;
  maxMessageLength: number;
  continuationTitle: string;
}) {
  const candidate = [...input.currentLines, input.line].join("\n");
  if (candidate.length <= input.maxMessageLength) {
    input.currentLines.push(input.line);
    return input.currentLines;
  }

  if (input.currentLines.length > 0) {
    input.messages.push(input.currentLines.join("\n"));
  }

  const continuationTitle = truncateLine(
    input.continuationTitle,
    input.maxMessageLength
  );
  const availableLineLength =
    input.maxMessageLength - continuationTitle.length - 1;
  const line = truncateLine(input.line, Math.max(0, availableLineLength));
  const nextLines =
    continuationTitle.length + 1 + line.length <= input.maxMessageLength
      ? [continuationTitle, line]
      : [continuationTitle];

  return nextLines;
}

function splitMessageLines(
  lines: string[],
  maxMessageLength: number,
  continuationTitle: string
) {
  const messages: string[] = [];
  let currentLines: string[] = [];

  for (const line of lines) {
    currentLines = appendLineToSplitMessages({
      messages,
      currentLines,
      line,
      maxMessageLength,
      continuationTitle
    });
  }

  if (currentLines.length > 0) {
    messages.push(currentLines.join("\n"));
  }

  return messages;
}

export function buildTelegramActivityReportDeliveries(
  input: TelegramActivityReportMessageInput
): TelegramActivityReportDelivery[] {
  const maxMessageLength = input.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH;
  const managerRows = buildManagerSummaries(input);
  const lastSync = input.lastSyncFinishedAt
    ? formatDateTime(new Date(input.lastSyncFinishedAt), input.timezone)
    : "нет данных";
  const teams = (input.managerTeams ?? []).filter(
    (team) => team.name.trim() && team.managerIds.length > 0
  );

  if (teams.length > 0) {
    const managerRowsById = new Map(
      managerRows.map((manager) => [manager.managerId, manager])
    );

    return teams.flatMap((team) => {
      const teamRows = team.managerIds
        .map((managerId) => managerRowsById.get(managerId))
        .filter((manager): manager is ManagerActivitySummary => Boolean(manager));

      return buildActivityReportMessages({
        title: `Активность: ${team.name.trim()} за ${formatDateOnly(
          input.now,
          input.timezone
        )}`,
        lastSync,
        managerRows: teamRows,
        maxMessageLength
      }).map((text) => ({ teamId: team.id, text }));
    });
  }

  return buildActivityReportMessages({
    title: `Активность: ${input.moduleName} за ${formatDateOnly(
      input.now,
      input.timezone
    )}`,
    lastSync,
    managerRows,
    maxMessageLength
  }).map((text) => ({ teamId: null, text }));
}

export function buildTelegramActivityReportMessages(
  input: TelegramActivityReportMessageInput
) {
  return buildTelegramActivityReportDeliveries(input).map(
    (delivery) => delivery.text
  );
}

function buildActivityReportMessages(input: {
  title: string;
  lastSync: string;
  managerRows: ManagerActivitySummary[];
  maxMessageLength: number;
}) {
  const totals = sumManagerSummaries(input.managerRows);

  if (input.managerRows.length === 0) {
    return splitMessageLines(
      [input.title, `Последний sync: ${input.lastSync}`, "", "Нет сотрудников в отчёте"],
      input.maxMessageLength,
      `${input.title} (продолжение)`
    );
  }

  const lines = [
    input.title,
    `Последний sync: ${input.lastSync}`,
    "",
    "Итого:",
    `Задачи: ${totals.createdCount}`,
    `Закрыто задач: ${totals.closedCount}`,
    `Исходящие звонки: ${totals.outgoingCalls}`,
    `Встречи: ${totals.meetingCount}`,
    "",
    ...formatNumberSection("Задачи:", input.managerRows, (row) => row.createdCount),
    "",
    ...formatNumberSection("Закрыто задач:", input.managerRows, (row) => row.closedCount),
    "",
    ...formatNumberSection("Исходящие звонки:", input.managerRows, (row) => row.outgoingCalls),
    "",
    ...formatNumberSection("Встречи:", input.managerRows, (row) => row.meetingCount)
  ];

  return splitMessageLines(
    lines,
    input.maxMessageLength,
    `${input.title} (продолжение)`
  );
}
