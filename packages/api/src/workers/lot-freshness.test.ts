import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createBullLotEventPublisher,
    enqueueLotFreshnessRun,
    LOT_EXPIRING_SOON_EVENT_NAME,
    LOT_EXPIRING_SOON_THRESHOLD,
    LOT_FRESHNESS_JOB_NAME,
    LOT_FRESHNESS_SCHEDULER_ID,
    SIX_HOURS_IN_MS,
    calculateFreshnessScore,
    ensureLotFreshnessSchedule,
    runLotFreshnessPass,
    type ActiveLotRecord,
    type LotExpiringSoonEvent,
    type LotFreshnessRepository,
} from './lot-freshness';

function createRepository(lots: ActiveLotRecord[]): {
    repository: LotFreshnessRepository;
    updates: Array<{ lotId: string; freshnessScore: number; isExpired: boolean }>;
} {
    const updates: Array<{ lotId: string; freshnessScore: number; isExpired: boolean }> = [];

    return {
        repository: {
            findActiveLots: async () => lots,
            updateFreshness: async (update) => {
                updates.push(update);
            },
        },
        updates,
    };
}

function createPublisher() {
    const events: LotExpiringSoonEvent[] = [];

    return {
        publisher: {
            publishExpiringSoon: async (event: LotExpiringSoonEvent) => {
                events.push(event);
            },
        },
        events,
    };
}

test('calculates the freshness score from harvest to expiry lifespan', () => {
    const score = calculateFreshnessScore(
        '2026-03-10',
        '2026-03-14',
        new Date(2026, 2, 12, 12, 0, 0, 0),
    );

    assert.equal(score, 50);
});

test('publishes lot.expiring_soon when the score crosses below the threshold', async () => {
    const lot: ActiveLotRecord = {
        id: 'lot-1',
        tenantId: 'tenant-1',
        productId: 'product-1',
        lotCode: 'L-001',
        harvestDate: '2026-03-10',
        expiryDate: '2026-03-15',
        freshnessScore: 55,
        isExpired: false,
    };
    const { repository, updates } = createRepository([lot]);
    const { publisher, events } = createPublisher();

    const result = await runLotFreshnessPass({
        repository,
        publisher,
        now: new Date(2026, 2, 14, 12, 0, 0, 0),
    });

    assert.equal(result.processedLots, 1);
    assert.equal(result.updatedLots, 1);
    assert.equal(result.expiringSoonEvents, 1);
    assert.equal(result.expiredLots, 0);
    assert.deepEqual(updates, [
        {
            lotId: 'lot-1',
            freshnessScore: 25,
            isExpired: false,
        },
    ]);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, LOT_EXPIRING_SOON_EVENT_NAME);
    assert.equal(events[0]?.freshnessScore, 25);
    assert.equal(events[0]?.previousFreshnessScore, 55);
});

test('does not publish a duplicate expiring event when the lot is already below the threshold', async () => {
    const lot: ActiveLotRecord = {
        id: 'lot-2',
        tenantId: 'tenant-1',
        productId: 'product-2',
        lotCode: 'L-002',
        harvestDate: '2026-03-10',
        expiryDate: '2026-03-15',
        freshnessScore: LOT_EXPIRING_SOON_THRESHOLD - 1,
        isExpired: false,
    };
    const { repository, updates } = createRepository([lot]);
    const { publisher, events } = createPublisher();

    const result = await runLotFreshnessPass({
        repository,
        publisher,
        now: new Date(2026, 2, 15, 10, 0, 0, 0),
    });

    assert.equal(result.processedLots, 1);
    assert.equal(result.expiringSoonEvents, 0);
    assert.equal(events.length, 0);
    assert.deepEqual(updates, [
        {
            lotId: 'lot-2',
            freshnessScore: 10,
            isExpired: false,
        },
    ]);
});

test('uses a BullMQ-safe job id for lot.expiring_soon events', async () => {
    const calls: Array<{
        name: string;
        data: LotExpiringSoonEvent;
        opts?: { jobId?: string };
    }> = [];
    const queue = {
        add: async (
            name: string,
            data: LotExpiringSoonEvent,
            opts?: { jobId?: string },
        ) => {
            calls.push({ name, data, opts });
            return undefined;
        },
    };
    const publisher = createBullLotEventPublisher(queue);

    await publisher.publishExpiringSoon({
        type: LOT_EXPIRING_SOON_EVENT_NAME,
        lotId: 'lot-4',
        tenantId: 'tenant-1',
        productId: 'product-4',
        lotCode: 'L-004',
        freshnessScore: 22,
        previousFreshnessScore: 48,
        harvestDate: '2026-03-10T00:00:00.000Z',
        expiryDate: '2026-03-15T23:59:59.999Z',
        occurredAt: '2026-03-14T12:00:00.000Z',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.opts?.jobId, 'lot-expiring-soon-lot-4');
});

test('enqueues a one-shot freshness run with a BullMQ-safe manual job id', async () => {
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
                id: 'manual-run-123',
                waitUntilFinished: async () => ({
                    processedLots: 0,
                    updatedLots: 0,
                    expiredLots: 0,
                    expiringSoonEvents: 0,
                }),
            };
        },
    };

    await enqueueLotFreshnessRun(queue);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.name, LOT_FRESHNESS_JOB_NAME);
    assert.deepEqual(calls[0]?.data, { triggeredBy: 'manual' });
    assert.match(calls[0]?.opts?.jobId ?? '', /^manual-run-\d+$/);
});

test('marks expired lots automatically and forces freshness to zero', async () => {
    const lot: ActiveLotRecord = {
        id: 'lot-3',
        tenantId: 'tenant-9',
        productId: 'product-3',
        lotCode: 'L-003',
        harvestDate: '2026-03-10',
        expiryDate: '2026-03-13',
        freshnessScore: 18,
        isExpired: false,
    };
    const { repository, updates } = createRepository([lot]);
    const { publisher, events } = createPublisher();

    const result = await runLotFreshnessPass({
        repository,
        publisher,
        now: new Date(2026, 2, 14, 10, 0, 0, 0),
    });

    assert.equal(result.processedLots, 1);
    assert.equal(result.expiredLots, 1);
    assert.equal(result.expiringSoonEvents, 0);
    assert.equal(events.length, 0);
    assert.deepEqual(updates, [
        {
            lotId: 'lot-3',
            freshnessScore: 0,
            isExpired: true,
        },
    ]);
});

test('registers the recurring scheduler for the lot freshness worker every 6 hours', async () => {
    const calls: unknown[] = [];
    const queue = {
        upsertJobScheduler: async (...args: unknown[]) => {
            calls.push(args);
            return undefined;
        },
    };

    await ensureLotFreshnessSchedule(queue);

    assert.equal(calls.length, 1);
    const [schedulerId, repeatOpts, jobTemplate] = calls[0] as [
        string,
        { every: number },
        { name: string; data: { triggeredBy: string } },
    ];

    assert.equal(schedulerId, LOT_FRESHNESS_SCHEDULER_ID);
    assert.deepEqual(repeatOpts, { every: SIX_HOURS_IN_MS });
    assert.equal(jobTemplate.name, LOT_FRESHNESS_JOB_NAME);
    assert.deepEqual(jobTemplate.data, { triggeredBy: 'scheduler' });
});
