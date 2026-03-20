import {
  Queue,
  QueueEvents,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
} from "bullmq";
import {
  activeProductLotWhere,
  db,
  enableProductLotBypassContext,
  productLots,
} from "@frescari/db";
import { eq } from "drizzle-orm";

type LotDateInput = string | Date;

export const LOT_FRESHNESS_QUEUE_NAME = "lot-freshness";
export const LOT_FRESHNESS_JOB_NAME = "refresh-active-lots";
export const LOT_FRESHNESS_SCHEDULER_ID = "lot-freshness-every-6-hours";
export const LOT_EVENTS_QUEUE_NAME = "lot-events";
export const LOT_EXPIRING_SOON_EVENT_NAME = "lot.expiring_soon";
export const LOT_EXPIRED_EVENT_NAME = "lot.expired";
export const LOT_EXPIRING_SOON_THRESHOLD = 30;
export const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;
export const LOT_FRESHNESS_RUN_ONCE_TIMEOUT_MS = 60_000;

export type LotFreshnessTriggeredBy = "scheduler" | "manual";

export type LotFreshnessJobData = {
  triggeredBy: LotFreshnessTriggeredBy;
};

export type ActiveLotRecord = {
  id: string;
  tenantId: string;
  productId: string;
  lotCode: string;
  harvestDate: LotDateInput;
  expiryDate: LotDateInput;
  freshnessScore: number | null;
  isExpired: boolean;
};

export type LotFreshnessUpdate = {
  lotId: string;
  freshnessScore: number;
  isExpired: boolean;
};

export type LotExpiringSoonEvent = {
  type: typeof LOT_EXPIRING_SOON_EVENT_NAME;
  lotId: string;
  tenantId: string;
  productId: string;
  lotCode: string;
  freshnessScore: number;
  previousFreshnessScore: number | null;
  harvestDate: string;
  expiryDate: string;
  occurredAt: string;
};

export type LotExpiredEvent = {
  type: typeof LOT_EXPIRED_EVENT_NAME;
  lotId: string;
  tenantId: string;
  productId: string;
  lotCode: string;
  freshnessScore: 0;
  previousFreshnessScore: number | null;
  harvestDate: string;
  expiryDate: string;
  occurredAt: string;
};

export type LotNotificationEvent = LotExpiringSoonEvent | LotExpiredEvent;

export type LotFreshnessRunSummary = {
  processedLots: number;
  updatedLots: number;
  expiredLots: number;
  expiringSoonEvents: number;
};

type LotFreshnessQueueName =
  | typeof LOT_FRESHNESS_JOB_NAME
  | typeof LOT_FRESHNESS_SCHEDULER_ID;

type BullLotFreshnessQueue = Queue<
  LotFreshnessJobData,
  LotFreshnessRunSummary,
  LotFreshnessQueueName
>;

type BullLotEventsQueue = Queue<
  LotNotificationEvent,
  void,
  typeof LOT_EXPIRING_SOON_EVENT_NAME | typeof LOT_EXPIRED_EVENT_NAME
>;

export interface LotFreshnessRepository {
  findActiveLots(): Promise<ActiveLotRecord[]>;
  updateFreshness(update: LotFreshnessUpdate): Promise<void>;
}

export interface LotEventPublisher {
  publishExpiringSoon(event: LotExpiringSoonEvent): Promise<void>;
  publishExpired(event: LotExpiredEvent): Promise<void>;
}

export interface LotEventEmitter {
  emit(event: LotNotificationEvent): Promise<void>;
}

type SchedulerQueue = {
  upsertJobScheduler(
    jobSchedulerId: Parameters<BullLotFreshnessQueue["upsertJobScheduler"]>[0],
    repeatOpts: Parameters<BullLotFreshnessQueue["upsertJobScheduler"]>[1],
    jobTemplate: Parameters<BullLotFreshnessQueue["upsertJobScheduler"]>[2],
  ): Promise<unknown>;
};

type LotEventQueue = {
  add(
    name: Parameters<BullLotEventsQueue["add"]>[0],
    data: Parameters<BullLotEventsQueue["add"]>[1],
    opts?: JobsOptions,
  ): Promise<unknown>;
};

type LotFreshnessTriggerJob = {
  id?: string | null;
  waitUntilFinished(
    queueEvents: QueueEvents,
    ttl?: number,
  ): Promise<LotFreshnessRunSummary>;
};

type LotFreshnessTriggerQueue = {
  add(
    name: Parameters<BullLotFreshnessQueue["add"]>[0],
    data: Parameters<BullLotFreshnessQueue["add"]>[1],
    opts?: JobsOptions,
  ): Promise<LotFreshnessTriggerJob>;
};

type FreshnessDatabase = typeof db;
type RedisConnectionRole = "scheduler" | "worker" | "publisher";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOT_FRESHNESS_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5_000,
  },
  removeOnComplete: 100,
  removeOnFail: 1_000,
};

const LOT_EVENT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 10_000,
  },
};

function parseDateOnly(value: string, boundary: "start" | "end") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid date string: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed =
    boundary === "end"
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`Invalid date string: ${value}`);
  }

  return parsed;
}

function normalizeLotDate(value: LotDateInput, boundary: "start" | "end") {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    return parseDateOnly(value, boundary);
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid lot date: ${String(value)}`);
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    boundary === "end" ? 23 : 0,
    boundary === "end" ? 59 : 0,
    boundary === "end" ? 59 : 0,
    boundary === "end" ? 999 : 0,
  );
}

function formatDateOnly(value: LotDateInput) {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    return value;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function calculateFreshnessScore(
  harvestDate: LotDateInput,
  expiryDate: LotDateInput,
  referenceDate = new Date(),
) {
  const normalizedHarvestDate = normalizeLotDate(harvestDate, "start");
  const normalizedExpiryDate = normalizeLotDate(expiryDate, "end");
  const lifetimeMs =
    normalizedExpiryDate.getTime() - normalizedHarvestDate.getTime();

  if (lifetimeMs <= 0) {
    return referenceDate.getTime() >= normalizedExpiryDate.getTime() ? 0 : 100;
  }

  const remainingMs = normalizedExpiryDate.getTime() - referenceDate.getTime();
  const rawScore = (remainingMs / lifetimeMs) * 100;

  if (rawScore <= 0) {
    return 0;
  }

  if (rawScore >= 100) {
    return 100;
  }

  return Math.round(rawScore);
}

export function createDbLotFreshnessRepository(
  database: FreshnessDatabase = db,
): LotFreshnessRepository {
  return {
    async findActiveLots() {
      return database.transaction(async (tx) => {
        await enableProductLotBypassContext(tx);

        return tx.query.productLots.findMany({
          where: activeProductLotWhere(eq(productLots.isExpired, false)),
          columns: {
            id: true,
            tenantId: true,
            productId: true,
            lotCode: true,
            harvestDate: true,
            expiryDate: true,
            freshnessScore: true,
            isExpired: true,
          },
        });
      });
    },
    async updateFreshness(update) {
      await database.transaction(async (tx) => {
        await enableProductLotBypassContext(tx);

        await tx
          .update(productLots)
          .set({
            freshnessScore: update.freshnessScore,
            isExpired: update.isExpired,
          })
          .where(eq(productLots.id, update.lotId));
      });
    },
  };
}

export async function runLotFreshnessPass({
  repository,
  publisher,
  now = new Date(),
}: {
  repository: LotFreshnessRepository;
  publisher: LotEventPublisher;
  now?: Date;
}): Promise<LotFreshnessRunSummary> {
  const activeLots = await repository.findActiveLots();
  const summary: LotFreshnessRunSummary = {
    processedLots: 0,
    updatedLots: 0,
    expiredLots: 0,
    expiringSoonEvents: 0,
  };

  for (const lot of activeLots) {
    const freshnessScore = calculateFreshnessScore(
      lot.harvestDate,
      lot.expiryDate,
      now,
    );
    const isExpired = freshnessScore === 0;
    const shouldPublishExpiringSoon =
      !isExpired &&
      freshnessScore < LOT_EXPIRING_SOON_THRESHOLD &&
      (lot.freshnessScore === null ||
        lot.freshnessScore >= LOT_EXPIRING_SOON_THRESHOLD);
    const shouldPublishExpired = isExpired && !lot.isExpired;

    if (shouldPublishExpiringSoon) {
      await publisher.publishExpiringSoon({
        type: LOT_EXPIRING_SOON_EVENT_NAME,
        lotId: lot.id,
        tenantId: lot.tenantId,
        productId: lot.productId,
        lotCode: lot.lotCode,
        freshnessScore,
        previousFreshnessScore: lot.freshnessScore,
        harvestDate: formatDateOnly(lot.harvestDate),
        expiryDate: formatDateOnly(lot.expiryDate),
        occurredAt: now.toISOString(),
      });
      summary.expiringSoonEvents += 1;
    }

    if (shouldPublishExpired) {
      await publisher.publishExpired({
        type: LOT_EXPIRED_EVENT_NAME,
        lotId: lot.id,
        tenantId: lot.tenantId,
        productId: lot.productId,
        lotCode: lot.lotCode,
        freshnessScore: 0,
        previousFreshnessScore: lot.freshnessScore,
        harvestDate: formatDateOnly(lot.harvestDate),
        expiryDate: formatDateOnly(lot.expiryDate),
        occurredAt: now.toISOString(),
      });
    }

    if (lot.freshnessScore !== freshnessScore || lot.isExpired !== isExpired) {
      await repository.updateFreshness({
        lotId: lot.id,
        freshnessScore,
        isExpired,
      });
      summary.updatedLots += 1;
    }

    if (isExpired) {
      summary.expiredLots += 1;
    }

    summary.processedLots += 1;
  }

  return summary;
}

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required to start the lot freshness worker.");
  }

  return redisUrl;
}

export function createRedisConnection(
  role: RedisConnectionRole,
): ConnectionOptions {
  return {
    url: getRedisUrl(),
    maxRetriesPerRequest: role === "scheduler" ? 1 : null,
  };
}

export function createLotFreshnessQueue(
  connection: ConnectionOptions,
): BullLotFreshnessQueue {
  return new Queue<
    LotFreshnessJobData,
    LotFreshnessRunSummary,
    LotFreshnessQueueName
  >(LOT_FRESHNESS_QUEUE_NAME, {
    connection,
    defaultJobOptions: LOT_FRESHNESS_JOB_OPTIONS,
  });
}

export function createLotEventsQueue(
  connection: ConnectionOptions,
): BullLotEventsQueue {
  return new Queue<
    LotNotificationEvent,
    void,
    typeof LOT_EXPIRING_SOON_EVENT_NAME | typeof LOT_EXPIRED_EVENT_NAME
  >(LOT_EVENTS_QUEUE_NAME, {
    connection,
    defaultJobOptions: LOT_EVENT_JOB_OPTIONS,
  });
}

export async function ensureLotFreshnessSchedule(queue: SchedulerQueue) {
  return queue.upsertJobScheduler(
    LOT_FRESHNESS_SCHEDULER_ID,
    { every: SIX_HOURS_IN_MS },
    {
      name: LOT_FRESHNESS_JOB_NAME,
      data: { triggeredBy: "scheduler" },
      opts: LOT_FRESHNESS_JOB_OPTIONS,
    },
  );
}

export async function enqueueLotFreshnessRun(
  queue: LotFreshnessTriggerQueue,
  triggeredBy: LotFreshnessTriggeredBy = "manual",
) {
  return queue.add(
    LOT_FRESHNESS_JOB_NAME,
    { triggeredBy },
    {
      ...LOT_FRESHNESS_JOB_OPTIONS,
      jobId: triggeredBy === "manual" ? `manual-run-${Date.now()}` : undefined,
    },
  );
}

export function createBullLotEventPublisher(
  queue: LotEventQueue,
): LotEventPublisher {
  return {
    async publishExpiringSoon(event) {
      await queue.add(LOT_EXPIRING_SOON_EVENT_NAME, event, {
        ...LOT_EVENT_JOB_OPTIONS,
        jobId: `lot-expiring-soon-${event.lotId}`,
      });
    },
    async publishExpired(event) {
      await queue.add(LOT_EXPIRED_EVENT_NAME, event, {
        ...LOT_EVENT_JOB_OPTIONS,
        jobId: `lot-expired-${event.lotId}`,
      });
    },
  };
}

export function createInlineLotEventPublisher(
  emitter: LotEventEmitter,
): LotEventPublisher {
  return {
    publishExpiringSoon(event) {
      return emitter.emit(event);
    },
    publishExpired(event) {
      return emitter.emit(event);
    },
  };
}

export async function startLotFreshnessWorker({
  repository = createDbLotFreshnessRepository(),
  now = () => new Date(),
}: {
  repository?: LotFreshnessRepository;
  now?: () => Date;
} = {}) {
  const schedulerConnection = createRedisConnection("scheduler");
  const workerConnection = createRedisConnection("worker");
  const publisherConnection = createRedisConnection("publisher");

  const freshnessQueue = createLotFreshnessQueue(schedulerConnection);
  const lotEventsQueue = createLotEventsQueue(publisherConnection);
  const publisher = createBullLotEventPublisher(lotEventsQueue);

  await ensureLotFreshnessSchedule(freshnessQueue);

  const worker = new Worker<
    LotFreshnessJobData,
    LotFreshnessRunSummary,
    LotFreshnessQueueName
  >(
    LOT_FRESHNESS_QUEUE_NAME,
    async (job) => {
      if (job.name !== LOT_FRESHNESS_JOB_NAME) {
        throw new Error(`Unsupported lot freshness job: ${job.name}`);
      }

      return runLotFreshnessPass({
        repository,
        publisher,
        now: now(),
      });
    },
    {
      connection: workerConnection,
      concurrency: 1,
    },
  );

  worker.on("completed", (job, result) => {
    console.info(
      `[lot-freshness-worker] job ${job?.id ?? "unknown"} completed: ${JSON.stringify(result)}`,
    );
  });
  worker.on("failed", (job, error) => {
    console.error(
      `[lot-freshness-worker] job ${job?.id ?? "unknown"} failed: ${error.message}`,
    );
  });
  worker.on("error", (error) => {
    console.error(`[lot-freshness-worker] worker error: ${error.message}`);
  });

  return {
    freshnessQueue,
    lotEventsQueue,
    worker,
    close: async () => {
      await Promise.allSettled([
        worker.close(),
        freshnessQueue.close(),
        lotEventsQueue.close(),
      ]);
    },
  };
}

export async function runLotFreshnessOnce({
  timeoutMs = LOT_FRESHNESS_RUN_ONCE_TIMEOUT_MS,
}: {
  timeoutMs?: number;
} = {}) {
  const runtime = await startLotFreshnessWorker();
  const queueEventsConnection = createRedisConnection("worker");
  const queueEvents = new QueueEvents(LOT_FRESHNESS_QUEUE_NAME, {
    connection: queueEventsConnection,
  });

  try {
    await queueEvents.waitUntilReady();

    const job = await enqueueLotFreshnessRun(runtime.freshnessQueue, "manual");
    const result = await job.waitUntilFinished(queueEvents, timeoutMs);

    return {
      jobId: job.id ?? null,
      result,
    };
  } finally {
    await Promise.allSettled([queueEvents.close(), runtime.close()]);
  }
}
