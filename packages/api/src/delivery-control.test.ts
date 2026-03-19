import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildDispatchControlQueue,
    buildDispatchControlQueueWithExternalRiskSignals,
    getOperationDate,
    type DeliveryControlBaseDelivery,
    type DeliveryControlFleetVehicle,
    type DeliveryControlOverride,
} from './delivery-control';

function createDelivery(overrides: Partial<DeliveryControlBaseDelivery>): DeliveryControlBaseDelivery {
    return {
        orderId: 'order-1',
        status: 'confirmed',
        totalAmount: '120.00',
        createdAt: new Date('2026-03-16T08:00:00.000Z'),
        distanceKm: 12,
        totalEstimatedWeightKg: 18,
        itemCount: 3,
        minFreshnessScore: 72,
        nearestExpiryDate: new Date('2026-03-19T12:00:00.000Z'),
        deliveryWindowStart: new Date('2026-03-16T14:00:00.000Z'),
        deliveryWindowEnd: new Date('2026-03-16T18:00:00.000Z'),
        hasValidRouteCoordinates: true,
        origin: {
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
        },
        ...overrides,
    };
}

function requireArrayItem<T>(items: T[], index: number, message: string): T {
    const item = items[index];
    assert.ok(item !== undefined, message);
    return item;
}

test('buildDispatchControlQueue applies manual overrides before AI ordering and chooses a matching vehicle', () => {
    const now = new Date('2026-03-16T09:30:00.000Z');
    const operationDate = getOperationDate(now);

    const deliveries: DeliveryControlBaseDelivery[] = [
        createDelivery({
            orderId: 'order-priority',
            totalAmount: '220.00',
            totalEstimatedWeightKg: 42,
            minFreshnessScore: 35,
            nearestExpiryDate: new Date('2026-03-16T23:00:00.000Z'),
        }),
        createDelivery({
            orderId: 'order-pinned',
            totalAmount: '80.00',
            totalEstimatedWeightKg: 6,
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
        }),
        createDelivery({
            orderId: 'order-delayed',
            totalAmount: '150.00',
            totalEstimatedWeightKg: 14,
            minFreshnessScore: 55,
        }),
    ];

    const vehicles: DeliveryControlFleetVehicle[] = [
        {
            id: 'vehicle-pickup',
            farmId: 'farm-1',
            label: 'Pickup 01',
            vehicleType: 'pickup',
            capacityKg: 120,
            refrigeration: false,
            availabilityStatus: 'available',
        },
        {
            id: 'vehicle-fridge',
            farmId: 'farm-1',
            label: 'Van Refrigerada',
            vehicleType: 'refrigerated_van',
            capacityKg: 80,
            refrigeration: true,
            availabilityStatus: 'available',
        },
    ];

    const overrides: DeliveryControlOverride[] = [
        {
            id: 'override-pin',
            orderId: 'order-pinned',
            operationDate,
            action: 'pin_to_top',
            reason: 'customer_priority',
            reasonNotes: null,
            createdAt: new Date('2026-03-16T09:00:00.000Z'),
        },
        {
            id: 'override-delay',
            orderId: 'order-delayed',
            operationDate,
            action: 'delay',
            reason: 'awaiting_picking',
            reasonNotes: 'Aguardando separacao final',
            createdAt: new Date('2026-03-16T09:05:00.000Z'),
        },
    ];

    const result = buildDispatchControlQueue(deliveries, {
        now,
        operationDate,
        overrides,
        vehicles,
        waveAssignments: [],
    });

    assert.deepEqual(
        result.map((delivery) => delivery.orderId),
        ['order-pinned', 'order-priority', 'order-delayed'],
    );

    const pinnedDelivery = requireArrayItem(result, 0, 'expected pinned delivery');
    const priorityDelivery = requireArrayItem(result, 1, 'expected priority delivery');
    const delayedDelivery = requireArrayItem(result, 2, 'expected delayed delivery');

    assert.equal(priorityDelivery.recommendation.suggestedVehicleType, 'refrigerated_van');
    assert.equal(priorityDelivery.recommendation.suggestedVehicle?.id, 'vehicle-fridge');
    assert.equal(priorityDelivery.recommendation.riskLevel, 'high');
    assert.equal(pinnedDelivery.activeOverride?.action, 'pin_to_top');
    assert.equal(delayedDelivery.activeOverride?.action, 'delay');
});

test('buildDispatchControlQueue lowers confidence when key operational signals are missing', () => {
    const now = new Date('2026-03-16T09:30:00.000Z');

    const result = buildDispatchControlQueue(
        [
            createDelivery({
                orderId: 'order-low-confidence',
                distanceKm: null,
                minFreshnessScore: null,
                nearestExpiryDate: null,
                hasValidRouteCoordinates: false,
            }),
        ],
        {
            now,
            operationDate: getOperationDate(now),
            overrides: [],
            vehicles: [],
            waveAssignments: [],
        },
    );

    const queuedDelivery = requireArrayItem(result, 0, 'expected queued delivery');

    assert.equal(queuedDelivery.recommendation.confidence, 'low');
    assert.match(queuedDelivery.recommendation.explanation, /revisao humana/i);
});

test('buildDispatchControlQueueWithExternalRiskSignals penalizes priority when external risk is critical', async () => {
    const now = new Date('2026-03-16T09:30:00.000Z');
    const operationDate = getOperationDate(now);
    const deliveries = [
        createDelivery({
            orderId: 'order-weather-risk',
        }),
    ];

    const baseline = buildDispatchControlQueue(deliveries, {
        now,
        operationDate,
        overrides: [],
        vehicles: [],
        waveAssignments: [],
    });

    const result = await buildDispatchControlQueueWithExternalRiskSignals(deliveries, {
        now,
        operationDate,
        overrides: [],
        vehicles: [],
        waveAssignments: [],
        resolveExternalSignals: async () => [
            {
                source: 'weather',
                status: 'available',
                impact: 'critical',
                summary: 'tempestade severa prevista na rota',
            },
        ],
    });

    const baselineDelivery = requireArrayItem(baseline, 0, 'expected baseline delivery');
    const queuedDelivery = requireArrayItem(result, 0, 'expected delivery with external signals');

    assert.equal(
        queuedDelivery.recommendation.priorityScore,
        baselineDelivery.recommendation.priorityScore - 12,
    );
    assert.match(queuedDelivery.recommendation.externalContext.summary, /tempestade severa/i);
});

test('buildDispatchControlQueueWithExternalRiskSignals falls back to base scoring and logs a warning when the provider throws', async () => {
    const now = new Date('2026-03-16T09:30:00.000Z');
    const operationDate = getOperationDate(now);
    const deliveries = [
        createDelivery({
            orderId: 'order-fallback-error',
        }),
    ];

    const baseline = buildDispatchControlQueue(deliveries, {
        now,
        operationDate,
        overrides: [],
        vehicles: [],
        waveAssignments: [],
    });

    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        warnings.push(args);
    };

    try {
        const result = await buildDispatchControlQueueWithExternalRiskSignals(deliveries, {
            now,
            operationDate,
            overrides: [],
            vehicles: [],
            waveAssignments: [],
            resolveExternalSignals: async () => {
                throw new Error('weather provider offline');
            },
        });

        const baselineDelivery = requireArrayItem(baseline, 0, 'expected baseline delivery');
        const queuedDelivery = requireArrayItem(result, 0, 'expected fallback delivery');

        assert.equal(queuedDelivery.recommendation.priorityScore, baselineDelivery.recommendation.priorityScore);
        assert.equal(queuedDelivery.recommendation.riskLevel, baselineDelivery.recommendation.riskLevel);
        assert.equal(queuedDelivery.recommendation.externalContext.status, baselineDelivery.recommendation.externalContext.status);
        assert.equal(warnings.length, 1);
        assert.match(String(warnings[0]?.[0] ?? ''), /external risk signals/i);
    } finally {
        console.warn = originalWarn;
    }
});

test('buildDispatchControlQueueWithExternalRiskSignals falls back to base scoring when the provider times out', async () => {
    const now = new Date('2026-03-16T09:30:00.000Z');
    const operationDate = getOperationDate(now);
    const deliveries = [
        createDelivery({
            orderId: 'order-fallback-timeout',
        }),
    ];

    const baseline = buildDispatchControlQueue(deliveries, {
        now,
        operationDate,
        overrides: [],
        vehicles: [],
        waveAssignments: [],
    });

    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        warnings.push(args);
    };

    try {
        const result = await buildDispatchControlQueueWithExternalRiskSignals(deliveries, {
            now,
            operationDate,
            overrides: [],
            vehicles: [],
            waveAssignments: [],
            externalSignalsTimeoutMs: 5,
            resolveExternalSignals: async () => {
                await new Promise(() => undefined);
                return [];
            },
        });

        const baselineDelivery = requireArrayItem(baseline, 0, 'expected baseline delivery');
        const queuedDelivery = requireArrayItem(result, 0, 'expected timeout fallback delivery');

        assert.equal(queuedDelivery.recommendation.priorityScore, baselineDelivery.recommendation.priorityScore);
        assert.equal(queuedDelivery.recommendation.riskLevel, baselineDelivery.recommendation.riskLevel);
        assert.equal(warnings.length, 1);
        assert.match(String(warnings[0]?.[0] ?? ''), /timed out/i);
    } finally {
        console.warn = originalWarn;
    }
});
