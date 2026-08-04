import {
  buildMessengerSessionSnapshot,
  extractOpenLineSessionId,
  type MessengerManagerIdentity,
  type OpenLineSessionHistoryInput
} from "../domain/messenger-messages.js";
import type { ReplaceMessengerSessionInput } from "./sqlite-repository.js";

const DEFAULT_BOOTSTRAP_LOOKBACK_DAYS = 365;
const SESSION_HISTORY_CONCURRENCY = 5;

export type MessengerSyncRepository = {
  getManagerWhitelistSettings(moduleKey: string): Promise<
    Array<MessengerManagerIdentity & { enabled: boolean }>
  >;
  getCurrentAttractionScope(): Promise<{
    scopeKey: string | null;
    dealIds: string[];
  }>;
  getDealsByIds(dealIds: string[]): Promise<
    Array<{ id: string; assignedById: string | null }>
  >;
  getSyncCursor(key: string): Promise<string | null>;
  setSyncCursor(input: {
    key: string;
    cursorValue: string;
    updatedAt: string;
  }): Promise<void>;
  replaceMessengerSessions(
    rows: ReplaceMessengerSessionInput[]
  ): Promise<{ sessions: number; messages: number }>;
  reconcileMessengerDealManagers(
    rows: Array<{ dealId: string; managerId: string | null }>
  ): Promise<{ sessions: number; messages: number }>;
};

type MessengerSyncClient = {
  listOpenLineActivities(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
  }): Promise<
    Array<{
      ID: string;
      OWNER_ID: string;
      LAST_UPDATED: string;
      ORIGIN_ID: string | null;
    }>
  >;
  getOpenLineSessionHistory(
    sessionId: string
  ): Promise<OpenLineSessionHistoryInput>;
};

export interface MessengerMessageSyncResult {
  modifiedAfter: string;
  activities: number;
  sessionsSeen: number;
  sessionsStored: number;
  messagesStored: number;
  failedSessions: number;
  cursorAdvanced: boolean;
}

function subtractDays(value: string, days: number) {
  const timestamp = Date.parse(value);
  return new Date(timestamp - days * 24 * 60 * 60 * 1_000).toISOString();
}

function buildCursorKey(scopeKey: string | null, managers: MessengerManagerIdentity[]) {
  const scope =
    scopeKey ?? managers.map((manager) => manager.managerId).sort().join(",");
  return `attraction:${scope}:messenger_messages`;
}

async function mapWithConcurrency<T, R>(input: {
  items: T[];
  concurrency: number;
  task: (item: T) => Promise<R>;
}) {
  const results: Array<R | undefined> = new Array(input.items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(input.concurrency, input.items.length) },
    async () => {
      while (nextIndex < input.items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = input.items[index];
        if (item !== undefined) {
          results[index] = await input.task(item);
        }
      }
    }
  );
  await Promise.all(workers);
  return results.filter((result): result is R => result !== undefined);
}

export async function synchronizeMessengerMessages(input: {
  repository: MessengerSyncRepository;
  client: MessengerSyncClient;
  now: () => string;
  bootstrapLookbackDays?: number;
}): Promise<MessengerMessageSyncResult> {
  const syncedAt = input.now();
  const settings = await input.repository.getManagerWhitelistSettings(
    "attraction"
  );
  const managers = settings
    .filter((setting) => setting.enabled)
    .map(({ managerId, managerName }) => ({ managerId, managerName }));
  const enabledManagerIds = new Set(managers.map((manager) => manager.managerId));
  const scope = await input.repository.getCurrentAttractionScope();
  const deals = (await input.repository.getDealsByIds(scope.dealIds)).filter(
    (deal) => deal.assignedById && enabledManagerIds.has(deal.assignedById)
  );
  const dealManagerIds = new Map(
    deals.map((deal) => [deal.id, deal.assignedById as string])
  );

  await input.repository.reconcileMessengerDealManagers(
    deals.map((deal) => ({
      dealId: deal.id,
      managerId: deal.assignedById
    }))
  );

  const cursorKey = buildCursorKey(scope.scopeKey, managers);
  const storedCursor = await input.repository.getSyncCursor(cursorKey);
  const lookbackDays = Math.max(
    1,
    Math.trunc(input.bootstrapLookbackDays ?? DEFAULT_BOOTSTRAP_LOOKBACK_DAYS)
  );
  const modifiedAfter = storedCursor ?? subtractDays(syncedAt, lookbackDays);
  const activities =
    deals.length > 0
      ? await input.client.listOpenLineActivities({
          ownerIds: deals.map((deal) => deal.id),
          modifiedAfter
        })
      : [];
  const sessions = new Map<
    string,
    {
      sessionId: string;
      activityId: string;
      dealId: string;
      dealManagerId: string;
      updatedAt: string;
    }
  >();

  for (const activity of activities) {
    const sessionId = extractOpenLineSessionId(activity.ORIGIN_ID);
    const dealManagerId = dealManagerIds.get(activity.OWNER_ID);
    if (!sessionId || !dealManagerId) {
      continue;
    }
    sessions.set(sessionId, {
      sessionId,
      activityId: activity.ID,
      dealId: activity.OWNER_ID,
      dealManagerId,
      updatedAt: activity.LAST_UPDATED
    });
  }

  let failedSessions = 0;
  const snapshots = await mapWithConcurrency({
    items: [...sessions.values()],
    concurrency: SESSION_HISTORY_CONCURRENCY,
    task: async (session): Promise<ReplaceMessengerSessionInput | null> => {
      try {
        const history = await input.client.getOpenLineSessionHistory(
          session.sessionId
        );
        return buildMessengerSessionSnapshot({
          activity: {
            id: session.activityId,
            dealId: session.dealId,
            dealManagerId: session.dealManagerId,
            updatedAt: session.updatedAt
          },
          history,
          managers,
          syncedAt
        });
      } catch {
        failedSessions += 1;
        return null;
      }
    }
  });
  const successfulSnapshots = snapshots.filter(
    (snapshot): snapshot is ReplaceMessengerSessionInput => snapshot !== null
  );
  const stored = await input.repository.replaceMessengerSessions(
    successfulSnapshots
  );
  const cursorAdvanced = failedSessions === 0;
  if (cursorAdvanced) {
    await input.repository.setSyncCursor({
      key: cursorKey,
      cursorValue: syncedAt,
      updatedAt: syncedAt
    });
  }

  return {
    modifiedAfter,
    activities: activities.length,
    sessionsSeen: sessions.size,
    sessionsStored: stored.sessions,
    messagesStored: stored.messages,
    failedSessions,
    cursorAdvanced
  };
}
