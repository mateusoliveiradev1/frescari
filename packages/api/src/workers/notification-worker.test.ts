import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DELIVERY_DELAY_SCAN_JOB_NAME,
    DELIVERY_DELAY_SCAN_SCHEDULER_ID,
    FIVE_MINUTES_IN_MS,
    enqueueDeliveryDelayScan,
    ensureDeliveryDelayScanSchedule,
    processLotNotificationEvent,
    runDeliveryDelayScanPass,
    type DeliveryDelayCandidate,
    type DeliveryDelayNotifier,
    type DeliveryDelayRepository,
    type LotNotificationEmitter,
} from './notification-worker';
import {
    LOT_EXPIRED_EVENT_NAME,
    LOT_EXPIRING_SOON_EVENT_NAME,
    type LotNotificationEvent,
} from './lot-freshness';

test('processes a lot notification event with the configured emitter', async () => {
    const events: LotNotificationEvent[] = [];
    const emitter: LotNotificationEmitter = {
        emit: async (event) => {
            events.push(event);
        },
    };

    const result = await processLotNotificationEvent({
        event: {
            type: LOT_EXPIRING_SOON_EVENT_NAME,
            lotId: 'lot-1',
            tenantId: 'tenant-1',
            productId: 'product-1',
            lotCode: 'L-001',
            freshnessScore: 22,
            previousFreshnessScore: 48,
            harvestDate: '2026-03-10',
            expiryDate: '2026-03-15',
            occurredAt: '2026-03-14T12:00:00.000Z',
        },
        emitter,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, LOT_EXPIRING_SOON_EVENT_NAME);
    assert.deepEqual(result, {
        eventType: LOT_EXPIRING_SOON_EVENT_NAME,
        lotId: 'lot-1',
        emitted: true,
    });
});

test('runs the delivery delay scan and emits one notification per delayed order candidate', async () => {
    const delayedOrders: DeliveryDelayCandidate[] = [
        {
            orderId: 'order-1',
            buyerTenantId: 'buyer-1',
            sellerTenantId: 'seller-1',
            status: 'ready_for_dispatch',
            deliveryWindowEnd: new Date('2026-03-18T12:00:00.000Z'),
        },
        {
            orderId: 'order-2',
            buyerTenantId: 'buyer-2',
            sellerTenantId: 'seller-2',
            status: 'in_transit',
            deliveryWindowEnd: new Date('2026-03-18T13:00:00.000Z'),
        },
    ];
    const repository: DeliveryDelayRepository = {
        findDelayedOrders: async () => delayedOrders,
    };
    const emitted: DeliveryDelayCandidate[] = [];
    const notifier: DeliveryDelayNotifier = {
        emitDelayedNotification: async (order) => {
            emitted.push(order);
        },
    };

    const result = await runDeliveryDelayScanPass({
        repository,
        notifier,
        now: new Date('2026-03-18T14:00:00.000Z'),
    });

    assert.equal(emitted.length, 2);
    assert.equal(result.scannedOrders, 2);
    assert.equal(result.notifiedOrders, 2);
    assert.deepEqual(result.latestDeliveryWindowEnd, new Date('2026-03-18T13:00:00.000Z'));
});

test('registers the recurring delivery delay scan every 5 minutes', async () => {
    const calls: unknown[] = [];
    const queue = {
        upsertJobScheduler: async (...args: unknown[]) => {
            calls.push(args);
            return undefined;
        },
    };

    await ensureDeliveryDelayScanSchedule(queue);

    assert.equal(calls.length, 1);
    const [schedulerId, repeatOpts, jobTemplate] = calls[0] as [
        string,
        { every: number },
        { name: string; data: { triggeredBy: string } },
    ];

    assert.equal(schedulerId, DELIVERY_DELAY_SCAN_SCHEDULER_ID);
    assert.deepEqual(repeatOpts, { every: FIVE_MINUTES_IN_MS });
    assert.equal(jobTemplate.name, DELIVERY_DELAY_SCAN_JOB_NAME);
    assert.deepEqual(jobTemplate.data, { triggeredBy: 'scheduler' });
});

test('enqueues a one-shot delivery delay scan with a deterministic-safe manual job id', async () => {
    const calls: Array<{
        name: string;
        data: { triggeredBy: string };
        opts?: { jobId?: string };
    }> = [];
    const queue = {
        add: async (
            name: string,
            data: { triggeredBy: string },
            opts?: { jobId?: string },
        ) => {
            calls.push({ name, data, opts });

            return {
                id: 'delivery-delay-job-123',
                waitUntilFinished: async () => ({
                    scannedOrders: 0,
                    notifiedOrders: 0,
                    latestDeliveryWindowEnd: null,
                }),
            };
        },
    };

    await enqueueDeliveryDelayScan(queue);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.name, DELIVERY_DELAY_SCAN_JOB_NAME);
    assert.deepEqual(calls[0]?.data, { triggeredBy: 'manual' });
    assert.match(calls[0]?.opts?.jobId ?? '', /^delivery-delay-scan:\d+$/);
});

test('processes expired lot events with the same emitter flow', async () => {
    const events: LotNotificationEvent[] = [];
    const emitter: LotNotificationEmitter = {
        emit: async (event) => {
            events.push(event);
        },
    };

    const result = await processLotNotificationEvent({
        event: {
            type: LOT_EXPIRED_EVENT_NAME,
            lotId: 'lot-9',
            tenantId: 'tenant-9',
            productId: 'product-9',
            lotCode: 'L-009',
            freshnessScore: 0,
            previousFreshnessScore: 11,
            harvestDate: '2026-03-10',
            expiryDate: '2026-03-12',
            occurredAt: '2026-03-18T14:00:00.000Z',
        },
        emitter,
    });

    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, LOT_EXPIRED_EVENT_NAME);
    assert.deepEqual(result, {
        eventType: LOT_EXPIRED_EVENT_NAME,
        lotId: 'lot-9',
        emitted: true,
    });
});
