import {
    Queue,
    QueueEvents,
    Worker,
    type JobsOptions,
} from 'bullmq';
import {
    db,
    enableRlsBypassContext,
    orders,
    type AppDb,
} from '@frescari/db';
import { and, inArray, isNotNull, lt } from 'drizzle-orm';

import {
    emitLotNotificationToProducerUsers,
    emitOrderNotifications,
} from '../notifications/domain-events';
import {
    LOT_EVENTS_QUEUE_NAME,
    LOT_EXPIRED_EVENT_NAME,
    LOT_EXPIRING_SOON_EVENT_NAME,
    createLotEventsQueue,
    createRedisConnection,
    type LotNotificationEvent,
} from './lot-freshness';

export const NOTIFICATION_SCAN_QUEUE_NAME = 'notification-scans';
export const DELIVERY_DELAY_SCAN_JOB_NAME = 'delivery-delay-scan';
export const DELIVERY_DELAY_SCAN_SCHEDULER_ID = 'delivery-delay-scan-every-5-minutes';
export const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
export const NOTIFICATION_RUN_ONCE_TIMEOUT_MS = 60_000;

const deliveryDelayStatuses = ['ready_for_dispatch', 'in_transit'] as const;

const NOTIFICATION_SCAN_JOB_OPTIONS: JobsOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 5_000,
    },
    removeOnComplete: 100,
    removeOnFail: 1_000,
};

type NotificationScanQueueName =
    | typeof DELIVERY_DELAY_SCAN_JOB_NAME
    | typeof DELIVERY_DELAY_SCAN_SCHEDULER_ID;

export type DeliveryDelayScanTriggeredBy = 'scheduler' | 'manual';

export type DeliveryDelayScanJobData = {
    triggeredBy: DeliveryDelayScanTriggeredBy;
};

export type DeliveryDelayCandidate = {
    orderId: string;
    buyerTenantId: string;
    sellerTenantId: string;
    status: string;
    deliveryWindowEnd: Date;
};

export type DeliveryDelayScanSummary = {
    scannedOrders: number;
    notifiedOrders: number;
    latestDeliveryWindowEnd: Date | null;
};

export type LotNotificationJobResult = {
    eventType: LotNotificationEvent['type'];
    lotId: string;
    emitted: true;
};

type BullNotificationScanQueue = Queue<
    DeliveryDelayScanJobData,
    DeliveryDelayScanSummary,
    NotificationScanQueueName
>;

type SchedulerQueue = {
    upsertJobScheduler(
        jobSchedulerId: Parameters<BullNotificationScanQueue['upsertJobScheduler']>[0],
        repeatOpts: Parameters<BullNotificationScanQueue['upsertJobScheduler']>[1],
        jobTemplate: Parameters<BullNotificationScanQueue['upsertJobScheduler']>[2],
    ): Promise<unknown>;
};

type NotificationScanTriggerJob = {
    id?: string | null;
    waitUntilFinished(
        queueEvents: QueueEvents,
        ttl?: number,
    ): Promise<DeliveryDelayScanSummary>;
};

type NotificationScanTriggerQueue = {
    add(
        name: Parameters<BullNotificationScanQueue['add']>[0],
        data: Parameters<BullNotificationScanQueue['add']>[1],
        opts?: JobsOptions,
    ): Promise<NotificationScanTriggerJob>;
};

export interface DeliveryDelayRepository {
    findDelayedOrders(now: Date): Promise<DeliveryDelayCandidate[]>;
}

export interface DeliveryDelayNotifier {
    emitDelayedNotification(order: DeliveryDelayCandidate): Promise<void>;
}

export interface LotNotificationEmitter {
    emit(event: LotNotificationEvent): Promise<void>;
}

export function createNotificationScanQueue() {
    return new Queue<
        DeliveryDelayScanJobData,
        DeliveryDelayScanSummary,
        NotificationScanQueueName
    >(
        NOTIFICATION_SCAN_QUEUE_NAME,
        {
            connection: createRedisConnection('scheduler'),
            defaultJobOptions: NOTIFICATION_SCAN_JOB_OPTIONS,
        },
    );
}

export async function ensureDeliveryDelayScanSchedule(queue: SchedulerQueue) {
    return queue.upsertJobScheduler(
        DELIVERY_DELAY_SCAN_SCHEDULER_ID,
        { every: FIVE_MINUTES_IN_MS },
        {
            name: DELIVERY_DELAY_SCAN_JOB_NAME,
            data: { triggeredBy: 'scheduler' },
            opts: NOTIFICATION_SCAN_JOB_OPTIONS,
        },
    );
}

export async function enqueueDeliveryDelayScan(
    queue: NotificationScanTriggerQueue,
    triggeredBy: DeliveryDelayScanTriggeredBy = 'manual',
) {
    return queue.add(
        DELIVERY_DELAY_SCAN_JOB_NAME,
        { triggeredBy },
        {
            ...NOTIFICATION_SCAN_JOB_OPTIONS,
            jobId: triggeredBy === 'manual'
                ? `delivery-delay-scan:${Date.now()}`
                : undefined,
        },
    );
}

export function createDbDeliveryDelayRepository(
    database: AppDb = db,
): DeliveryDelayRepository {
    return {
        async findDelayedOrders(now) {
            const delayedOrders = await database.transaction(async (tx) => {
                await enableRlsBypassContext(tx);

                return tx
                    .select({
                        orderId: orders.id,
                        buyerTenantId: orders.buyerTenantId,
                        sellerTenantId: orders.sellerTenantId,
                        status: orders.status,
                        deliveryWindowEnd: orders.deliveryWindowEnd,
                    })
                    .from(orders)
                    .where(
                        and(
                            inArray(orders.status, [...deliveryDelayStatuses]),
                            isNotNull(orders.deliveryWindowEnd),
                            lt(orders.deliveryWindowEnd, now),
                        ),
                    );
            });

            return delayedOrders.flatMap((order) => (
                order.deliveryWindowEnd instanceof Date
                    ? [{
                        orderId: order.orderId,
                        buyerTenantId: order.buyerTenantId,
                        sellerTenantId: order.sellerTenantId,
                        status: order.status,
                        deliveryWindowEnd: order.deliveryWindowEnd,
                    }]
                    : []
            ));
        },
    };
}

export function createDbDeliveryDelayNotifier(
    database: AppDb = db,
): DeliveryDelayNotifier {
    return {
        async emitDelayedNotification(order) {
            await database.transaction(async (tx) => {
                await enableRlsBypassContext(tx);

                await emitOrderNotifications({
                    tx: tx as AppDb,
                    type: 'delivery_delayed',
                    orderId: order.orderId,
                    buyerTenantId: order.buyerTenantId,
                    sellerTenantId: order.sellerTenantId,
                    metadata: {
                        orderId: order.orderId,
                        status: order.status,
                        deliveryWindowEnd: order.deliveryWindowEnd.toISOString(),
                    },
                });
            });
        },
    };
}

export function createDbLotNotificationEmitter(
    database: AppDb = db,
): LotNotificationEmitter {
    return {
        async emit(event) {
            await database.transaction(async (tx) => {
                await enableRlsBypassContext(tx);

                await emitLotNotificationToProducerUsers({
                    tx: tx as AppDb,
                    type: event.type === LOT_EXPIRED_EVENT_NAME
                        ? 'lot_expired'
                        : 'lot_expiring_soon',
                    lotId: event.lotId,
                    tenantId: event.tenantId,
                    lotCode: event.lotCode,
                    freshnessScore: event.freshnessScore,
                    metadata: {
                        eventType: event.type,
                        lotId: event.lotId,
                        productId: event.productId,
                        previousFreshnessScore: event.previousFreshnessScore,
                        harvestDate: event.harvestDate,
                        expiryDate: event.expiryDate,
                        occurredAt: event.occurredAt,
                    },
                });
            });
        },
    };
}

export async function processLotNotificationEvent({
    event,
    emitter,
}: {
    event: LotNotificationEvent;
    emitter: LotNotificationEmitter;
}): Promise<LotNotificationJobResult> {
    await emitter.emit(event);

    return {
        eventType: event.type,
        lotId: event.lotId,
        emitted: true,
    };
}

export async function runDeliveryDelayScanPass({
    repository,
    notifier,
    now = new Date(),
}: {
    repository: DeliveryDelayRepository;
    notifier: DeliveryDelayNotifier;
    now?: Date;
}): Promise<DeliveryDelayScanSummary> {
    const delayedOrders = await repository.findDelayedOrders(now);
    let latestDeliveryWindowEnd: Date | null = null;

    for (const order of delayedOrders) {
        if (!latestDeliveryWindowEnd || order.deliveryWindowEnd > latestDeliveryWindowEnd) {
            latestDeliveryWindowEnd = order.deliveryWindowEnd;
        }

        await notifier.emitDelayedNotification(order);
    }

    return {
        scannedOrders: delayedOrders.length,
        notifiedOrders: delayedOrders.length,
        latestDeliveryWindowEnd,
    };
}

export async function startNotificationWorker({
    lotEmitter = createDbLotNotificationEmitter(),
    repository = createDbDeliveryDelayRepository(),
    notifier = createDbDeliveryDelayNotifier(),
    now = () => new Date(),
}: {
    lotEmitter?: LotNotificationEmitter;
    repository?: DeliveryDelayRepository;
    notifier?: DeliveryDelayNotifier;
    now?: () => Date;
} = {}) {
    const lotEventsQueue = createLotEventsQueue(createRedisConnection('scheduler'));
    const notificationScanQueue = createNotificationScanQueue();

    await ensureDeliveryDelayScanSchedule(notificationScanQueue);

    const lotEventsWorker = new Worker<
        LotNotificationEvent,
        LotNotificationJobResult,
        typeof LOT_EXPIRING_SOON_EVENT_NAME | typeof LOT_EXPIRED_EVENT_NAME
    >(
        LOT_EVENTS_QUEUE_NAME,
        async (job) => {
            if (job.name !== LOT_EXPIRING_SOON_EVENT_NAME && job.name !== LOT_EXPIRED_EVENT_NAME) {
                throw new Error(`Unsupported lot notification job: ${job.name}`);
            }

            return processLotNotificationEvent({
                event: job.data,
                emitter: lotEmitter,
            });
        },
        {
            connection: createRedisConnection('worker'),
            concurrency: 1,
        },
    );

    const deliveryDelayWorker = new Worker<
        DeliveryDelayScanJobData,
        DeliveryDelayScanSummary,
        NotificationScanQueueName
    >(
        NOTIFICATION_SCAN_QUEUE_NAME,
        async (job) => {
            if (job.name !== DELIVERY_DELAY_SCAN_JOB_NAME) {
                throw new Error(`Unsupported notification scan job: ${job.name}`);
            }

            return runDeliveryDelayScanPass({
                repository,
                notifier,
                now: now(),
            });
        },
        {
            connection: createRedisConnection('worker'),
            concurrency: 1,
        },
    );

    lotEventsWorker.on('failed', (job, error) => {
        console.error(
            `[notification-worker] lot event job ${job?.id ?? 'unknown'} failed: ${error.message}`,
        );
    });
    deliveryDelayWorker.on('failed', (job, error) => {
        console.error(
            `[notification-worker] delivery delay job ${job?.id ?? 'unknown'} failed: ${error.message}`,
        );
    });

    return {
        lotEventsQueue,
        notificationScanQueue,
        lotEventsWorker,
        deliveryDelayWorker,
        close: async () => {
            await Promise.allSettled([
                lotEventsWorker.close(),
                deliveryDelayWorker.close(),
                lotEventsQueue.close(),
                notificationScanQueue.close(),
            ]);
        },
    };
}

export async function runNotificationScanOnce({
    timeoutMs = NOTIFICATION_RUN_ONCE_TIMEOUT_MS,
}: {
    timeoutMs?: number;
} = {}) {
    const runtime = await startNotificationWorker();
    const queueEvents = new QueueEvents(NOTIFICATION_SCAN_QUEUE_NAME, {
        connection: createRedisConnection('worker'),
    });

    try {
        await queueEvents.waitUntilReady();

        const job = await enqueueDeliveryDelayScan(runtime.notificationScanQueue, 'manual');
        const result = await job.waitUntilFinished(queueEvents, timeoutMs);

        return {
            jobId: job.id ?? null,
            result,
        };
    }
    finally {
        await Promise.allSettled([
            queueEvents.close(),
            runtime.close(),
        ]);
    }
}
