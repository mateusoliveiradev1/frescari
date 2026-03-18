import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildDispatchControlQueue,
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

    assert.equal(result[1].recommendation.suggestedVehicleType, 'refrigerated_van');
    assert.equal(result[1].recommendation.suggestedVehicle?.id, 'vehicle-fridge');
    assert.equal(result[1].recommendation.riskLevel, 'high');
    assert.equal(result[0].activeOverride?.action, 'pin_to_top');
    assert.equal(result[2].activeOverride?.action, 'delay');
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

    assert.equal(result[0].recommendation.confidence, 'low');
    assert.match(result[0].recommendation.explanation, /revisao humana/i);
});

test('buildDispatchControlQueue keeps the queue operational and exposes degraded external context when providers are unavailable', () => {
    const now = new Date('2026-03-16T09:30:00.000Z');

    const result = buildDispatchControlQueue(
        [
            createDelivery({
                orderId: 'order-external-degraded',
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

    assert.equal(result[0].recommendation.externalContext.status, 'degraded');
    assert.match(result[0].recommendation.externalContext.summary, /contexto externo degradado/i);
    assert.match(result[0].recommendation.explanation, /contexto externo degradado/i);
});
