import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRlsMockDb } from './test-db';

type DeliveryRow = {
    orderId: string;
    status: 'payment_authorized' | 'confirmed' | 'picking' | 'ready_for_dispatch';
    totalAmount: string;
    deliveryFee: string;
    createdAt: Date;
    buyerTenantId: string;
    buyerName: string;
    deliveryStreet: string;
    deliveryNumber: string;
    deliveryCep: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryAddress: string;
    deliveryNotes: string | null;
    deliveryWindowStart: Date | null;
    deliveryWindowEnd: Date | null;
    farmId: string;
    farmName: string;
    farmLatitude: number | null;
    farmLongitude: number | null;
    deliveryLatitude: number | null;
    deliveryLongitude: number | null;
    distanceKm: number | null;
    orderItemId: string;
    productId: string;
    productName: string;
    itemQty: string;
    itemSaleUnit: string;
    productSaleUnit: string;
    unitWeightG: number | null;
    estimatedWeightKg: number | null;
    lotExpiryDate?: Date | null;
    lotFreshnessScore?: number | null;
};

type OverrideRow = {
    id: string;
    orderId: string;
    operationDate: string;
    action: 'pin_to_top' | 'delay';
    reason: string;
    reasonNotes: string | null;
    createdAt: Date;
};

type VehicleRow = {
    id: string;
    farmId: string | null;
    label: string;
    vehicleType: 'motorcycle' | 'car' | 'pickup' | 'van' | 'refrigerated_van' | 'truck' | 'refrigerated_truck';
    capacityKg: string;
    refrigeration: boolean;
    availabilityStatus: 'available' | 'in_use' | 'maintenance' | 'offline';
};

type DispatchWaveRow = {
    waveId: string;
    orderId: string;
    sequence: number;
    status: 'confirmed' | 'departed' | 'cancelled';
    confidence: 'high' | 'medium' | 'low';
    recommendedVehicleType: 'motorcycle' | 'car' | 'pickup' | 'van' | 'refrigerated_van' | 'truck' | 'refrigerated_truck';
    selectedVehicleId: string | null;
    selectedVehicleLabel: string | null;
    confirmedAt: Date;
};

function createProducerContext(db: unknown): any {
    return {
        db,
        req: undefined,
        session: { user: { id: 'user-1' } },
        user: {
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'producer',
            name: 'Joao Produtor',
        },
    };
}

async function createLogisticsCaller(db: unknown) {
    const [{ createTRPCRouter }, { logisticsRouter }] = await Promise.all([
        import('./trpc'),
        import('./routers/logistics'),
    ]);

    const testRouter = createTRPCRouter({ logistics: logisticsRouter });
    return testRouter.createCaller(createProducerContext(db as never));
}

function createTenantSelectChain() {
    return {
        from() {
            return this;
        },
        where() {
            return this;
        },
        limit: async () => [{ id: 'tenant-1', type: 'PRODUCER' }],
    };
}

function createDeliveriesSelectChain(rows: DeliveryRow[]) {
    return {
        from() {
            return this;
        },
        innerJoin() {
            return this;
        },
        leftJoin() {
            return this;
        },
        where() {
            return this;
        },
        orderBy: async () => rows,
    };
}

function createSupplementalSelectChain<T>(rows: T[]) {
    return {
        from() {
            return this;
        },
        innerJoin() {
            return this;
        },
        leftJoin() {
            return this;
        },
        where: async () => rows,
        orderBy: async () => rows,
    };
}

function createNotificationInsertChain(values: Record<string, unknown>[]) {
    return {
        onConflictDoNothing() {
            return {
                returning: async () => values.map((_, index) => ({
                    id: `notification-${index + 1}`,
                })),
            };
        },
    };
}

test('logistics.getPendingDeliveries groups item rows per order and exposes safe coordinates', async () => {
    const deliveryRows: DeliveryRow[] = [
        {
            orderId: 'order-1',
            status: 'confirmed',
            totalAmount: '128.4000',
            deliveryFee: '12.50',
            createdAt: new Date('2026-03-12T12:00:00.000Z'),
            buyerTenantId: 'buyer-1',
            buyerName: 'Restaurante Central',
            deliveryStreet: 'Rua das Flores',
            deliveryNumber: '45',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Flores, 45 - Sao Paulo/SP',
            deliveryNotes: 'Entregar na doca 2',
            deliveryWindowStart: new Date('2026-03-12T14:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-12T18:00:00.000Z'),
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
            farmLatitude: -23.55,
            farmLongitude: -46.63,
            deliveryLatitude: -23.57,
            deliveryLongitude: -46.65,
            distanceKm: 4.82,
            orderItemId: 'item-1',
            productId: 'product-1',
            productName: 'Tomate Italiano',
            itemQty: '8.000',
            itemSaleUnit: 'box',
            productSaleUnit: 'box',
            unitWeightG: 1200,
            estimatedWeightKg: 9.6,
        },
        {
            orderId: 'order-1',
            status: 'confirmed',
            totalAmount: '128.4000',
            deliveryFee: '12.50',
            createdAt: new Date('2026-03-12T12:00:00.000Z'),
            buyerTenantId: 'buyer-1',
            buyerName: 'Restaurante Central',
            deliveryStreet: 'Rua das Flores',
            deliveryNumber: '45',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Flores, 45 - Sao Paulo/SP',
            deliveryNotes: 'Entregar na doca 2',
            deliveryWindowStart: new Date('2026-03-12T14:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-12T18:00:00.000Z'),
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
            farmLatitude: -23.55,
            farmLongitude: -46.63,
            deliveryLatitude: -23.57,
            deliveryLongitude: -46.65,
            distanceKm: 4.82,
            orderItemId: 'item-2',
            productId: 'product-2',
            productName: 'Rucula',
            itemQty: '3.500',
            itemSaleUnit: 'kg',
            productSaleUnit: 'kg',
            unitWeightG: null,
            estimatedWeightKg: 3.5,
        },
    ];

    let selectCallCount = 0;

    const db = withRlsMockDb({
        select() {
            selectCallCount += 1;

            if (selectCallCount === 1) {
                return createTenantSelectChain();
            }

            if (selectCallCount === 2) {
                return createDeliveriesSelectChain(deliveryRows);
            }

            return createSupplementalSelectChain([]);
        },
    });

    const caller = await createLogisticsCaller(db);
    const logisticsNamespace = (caller as Record<string, any>).logistics;

    assert.ok(logisticsNamespace?.getPendingDeliveries, 'logistics.getPendingDeliveries should be exposed');

    const result = await logisticsNamespace.getPendingDeliveries();

    assert.equal(result.length, 1);
    assert.equal(result[0].orderId, 'order-1');
    assert.equal(result[0].distanceKm, 4.82);
    assert.deepEqual(result[0].origin, {
        farmId: 'farm-1',
        farmName: 'Sitio Horizonte',
        latitude: -23.55,
        longitude: -46.63,
    });
    assert.deepEqual(result[0].destination, {
        latitude: -23.57,
        longitude: -46.65,
    });
    assert.equal(result[0].items.length, 2);
    assert.deepEqual(result[0].items[0], {
        orderItemId: 'item-1',
        productId: 'product-1',
        productName: 'Tomate Italiano',
        qty: '8.000',
        saleUnit: 'box',
        productSaleUnit: 'box',
        unitWeightG: 1200,
        estimatedWeightKg: 9.6,
    });
    assert.deepEqual(result[0].items[1], {
        orderItemId: 'item-2',
        productId: 'product-2',
        productName: 'Rucula',
        qty: '3.500',
        saleUnit: 'kg',
        productSaleUnit: 'kg',
        unitWeightG: null,
        estimatedWeightKg: 3.5,
    });
});

test('logistics.getPendingDeliveries keeps payment_authorized orders even when map coordinates are unavailable', async () => {
    const deliveryRows: DeliveryRow[] = [
        {
            orderId: 'order-2',
            status: 'payment_authorized',
            totalAmount: '89.5000',
            deliveryFee: '9.90',
            createdAt: new Date('2026-03-13T10:30:00.000Z'),
            buyerTenantId: 'buyer-2',
            buyerName: 'Cozinha do Bairro',
            deliveryStreet: 'Rua das Palmeiras',
            deliveryNumber: '88',
            deliveryCep: '02020-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Palmeiras, 88 - Sao Paulo/SP',
            deliveryNotes: null,
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
            farmLatitude: null,
            farmLongitude: null,
            deliveryLatitude: null,
            deliveryLongitude: null,
            distanceKm: null,
            orderItemId: 'item-3',
            productId: 'product-3',
            productName: 'Abobora Japonesa',
            itemQty: '5.000',
            itemSaleUnit: 'unit',
            productSaleUnit: 'unit',
            unitWeightG: 1800,
            estimatedWeightKg: 9,
        },
    ];

    let selectCallCount = 0;

    const db = withRlsMockDb({
        select() {
            selectCallCount += 1;

            if (selectCallCount === 1) {
                return createTenantSelectChain();
            }

            if (selectCallCount === 2) {
                return createDeliveriesSelectChain(deliveryRows);
            }

            return createSupplementalSelectChain([]);
        },
    });

    const [{ pendingDeliveryStatuses }, caller] = await Promise.all([
        import('./routers/logistics'),
        createLogisticsCaller(db),
    ]);
    const logisticsNamespace = (caller as Record<string, any>).logistics;

    assert.ok(pendingDeliveryStatuses.includes('payment_authorized'));
    assert.ok(logisticsNamespace?.getPendingDeliveries, 'logistics.getPendingDeliveries should be exposed');

    const result = await logisticsNamespace.getPendingDeliveries();

    assert.equal(result.length, 1);
    assert.equal(result[0].orderId, 'order-2');
    assert.equal(result[0].status, 'payment_authorized');
    assert.equal(result[0].distanceKm, null);
    assert.deepEqual(result[0].destination, null);
    assert.deepEqual(result[0].origin, {
        farmId: 'farm-1',
        farmName: 'Sitio Horizonte',
        latitude: null,
        longitude: null,
    });
});

test('logistics.getPendingDeliveries keeps ready_for_dispatch orders visible for dispatch control', async () => {
    const deliveryRows: DeliveryRow[] = [
        {
            orderId: 'order-3',
            status: 'ready_for_dispatch',
            totalAmount: '102.0000',
            deliveryFee: '11.20',
            createdAt: new Date('2026-03-14T09:15:00.000Z'),
            buyerTenantId: 'buyer-3',
            buyerName: 'Mercado da Vila',
            deliveryStreet: 'Rua das Acacias',
            deliveryNumber: '100',
            deliveryCep: '03030-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Acacias, 100 - Sao Paulo/SP',
            deliveryNotes: 'Portaria lateral',
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
            farmId: 'farm-2',
            farmName: 'Fazenda Aurora',
            farmLatitude: -23.51,
            farmLongitude: -46.61,
            deliveryLatitude: -23.5,
            deliveryLongitude: -46.59,
            distanceKm: 2.75,
            orderItemId: 'item-4',
            productId: 'product-4',
            productName: 'Alface Crespa',
            itemQty: '12.000',
            itemSaleUnit: 'unit',
            productSaleUnit: 'unit',
            unitWeightG: 250,
            estimatedWeightKg: 3,
        },
    ];

    let selectCallCount = 0;

    const db = withRlsMockDb({
        select() {
            selectCallCount += 1;

            if (selectCallCount === 1) {
                return createTenantSelectChain();
            }

            if (selectCallCount === 2) {
                return createDeliveriesSelectChain(deliveryRows);
            }

            return createSupplementalSelectChain([]);
        },
    });

    const [{ pendingDeliveryStatuses }, caller] = await Promise.all([
        import('./routers/logistics'),
        createLogisticsCaller(db),
    ]);
    const logisticsNamespace = (caller as Record<string, any>).logistics;

    assert.ok(pendingDeliveryStatuses.includes('ready_for_dispatch'));
    assert.ok(logisticsNamespace?.getPendingDeliveries, 'logistics.getPendingDeliveries should be exposed');

    const result = await logisticsNamespace.getPendingDeliveries();

    assert.equal(result.length, 1);
    assert.equal(result[0].orderId, 'order-3');
    assert.equal(result[0].status, 'ready_for_dispatch');
    assert.equal(result[0].distanceKm, 2.75);
});

test('logistics.updateDeliveryStatus advances producer orders through ready_for_dispatch before transit', async () => {
    const orderId = '11111111-1111-4111-8111-111111111111';

    const state = {
        order: {
            id: orderId,
            buyerTenantId: 'buyer-1',
            sellerTenantId: 'tenant-1',
            status: 'picking',
        },
        updatedStatuses: [] as string[],
    };

    const db = withRlsMockDb({
        select(selection: Record<string, unknown>) {
            if ('userId' in selection) {
                return createSupplementalSelectChain([
                    { userId: 'buyer-user-1' },
                ]);
            }

            return createTenantSelectChain();
        },
        insert() {
            return {
                values(values: Record<string, unknown>[]) {
                    return createNotificationInsertChain(values);
                },
            };
        },
        query: {
            orders: {
                findFirst: async () => state.order,
            },
        },
        update() {
            return {
                set(values: Record<string, unknown>) {
                    return {
                        where: async () => {
                            const nextStatus = String(values.status);
                            state.updatedStatuses.push(nextStatus);
                            state.order = {
                                ...state.order,
                                status: nextStatus,
                            };
                        },
                    };
                },
            };
        },
    });

    const caller = await createLogisticsCaller(db);
    const logisticsNamespace = (caller as Record<string, any>).logistics;

    assert.ok(logisticsNamespace?.updateDeliveryStatus, 'logistics.updateDeliveryStatus should be exposed');

    const readyForDispatchResult = await logisticsNamespace.updateDeliveryStatus({
        orderId,
        status: 'ready_for_dispatch',
    });

    assert.deepEqual(readyForDispatchResult, { success: true, status: 'ready_for_dispatch' });
    assert.equal(state.order.status, 'ready_for_dispatch');

    const inTransitResult = await logisticsNamespace.updateDeliveryStatus({
        orderId,
        status: 'in_transit',
    });

    assert.deepEqual(inTransitResult, { success: true, status: 'in_transit' });
    assert.deepEqual(state.updatedStatuses, ['ready_for_dispatch', 'in_transit']);
});

test('logistics.getPendingDeliveries enriches queue items with AI recommendation and persistent override', async () => {
    const operationDate = new Date().toISOString().slice(0, 10);
    const deliveryRows: DeliveryRow[] = [
        {
            orderId: 'order-priority',
            status: 'confirmed',
            totalAmount: '210.0000',
            deliveryFee: '18.00',
            createdAt: new Date('2026-03-16T07:00:00.000Z'),
            buyerTenantId: 'buyer-1',
            buyerName: 'Mercado Modelo',
            deliveryStreet: 'Rua A',
            deliveryNumber: '100',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua A, 100 - Sao Paulo/SP',
            deliveryNotes: null,
            deliveryWindowStart: new Date('2026-03-16T13:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-16T15:00:00.000Z'),
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
            farmLatitude: -23.55,
            farmLongitude: -46.63,
            deliveryLatitude: -23.57,
            deliveryLongitude: -46.65,
            distanceKm: 11.8,
            orderItemId: 'item-1',
            productId: 'product-1',
            productName: 'Tomate Italiano',
            itemQty: '12.000',
            itemSaleUnit: 'box',
            productSaleUnit: 'box',
            unitWeightG: 2500,
            estimatedWeightKg: 30,
            lotExpiryDate: new Date('2026-03-16T23:00:00.000Z'),
            lotFreshnessScore: 38,
        },
        {
            orderId: 'order-pinned',
            status: 'confirmed',
            totalAmount: '90.0000',
            deliveryFee: '11.00',
            createdAt: new Date('2026-03-16T08:30:00.000Z'),
            buyerTenantId: 'buyer-2',
            buyerName: 'Padaria do Bairro',
            deliveryStreet: 'Rua B',
            deliveryNumber: '20',
            deliveryCep: '02020-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua B, 20 - Sao Paulo/SP',
            deliveryNotes: 'Cliente pediu prioridade',
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
            farmLatitude: -23.55,
            farmLongitude: -46.63,
            deliveryLatitude: -23.56,
            deliveryLongitude: -46.61,
            distanceKm: 4.3,
            orderItemId: 'item-2',
            productId: 'product-2',
            productName: 'Alface',
            itemQty: '4.000',
            itemSaleUnit: 'unit',
            productSaleUnit: 'unit',
            unitWeightG: 300,
            estimatedWeightKg: 1.2,
            lotExpiryDate: new Date('2026-03-18T23:00:00.000Z'),
            lotFreshnessScore: 74,
        },
    ];

    const overrideRows: OverrideRow[] = [
        {
            id: 'override-1',
            orderId: 'order-pinned',
            operationDate,
            action: 'pin_to_top',
            reason: 'customer_priority',
            reasonNotes: null,
            createdAt: new Date('2026-03-16T09:00:00.000Z'),
        },
    ];

    const vehicleRows: VehicleRow[] = [
        {
            id: 'vehicle-1',
            farmId: 'farm-1',
            label: 'Van Refrigerada',
            vehicleType: 'refrigerated_van',
            capacityKg: '80.000',
            refrigeration: true,
            availabilityStatus: 'available',
        },
    ];

    let selectCallCount = 0;

    const db = withRlsMockDb({
        select() {
            selectCallCount += 1;

            if (selectCallCount === 1) {
                return createTenantSelectChain();
            }

            if (selectCallCount === 2) {
                return createDeliveriesSelectChain(deliveryRows);
            }

            if (selectCallCount === 3) {
                return createSupplementalSelectChain(overrideRows);
            }

            if (selectCallCount === 4) {
                return createSupplementalSelectChain(vehicleRows);
            }

            return createSupplementalSelectChain<DispatchWaveRow>([]);
        },
    });

    const caller = await createLogisticsCaller(db);
    const logisticsNamespace = (caller as Record<string, any>).logistics;
    const result = await logisticsNamespace.getPendingDeliveries();

    assert.equal(result[0].orderId, 'order-pinned');
    assert.equal(result[0].activeOverride?.action, 'pin_to_top');
    assert.equal(result[0].dispatchSuggestion?.primaryDelivery.orderId, 'order-pinned');
    assert.deepEqual(result[0].dispatchSuggestion?.orderIds, ['order-pinned', 'order-priority']);
    assert.equal(result[0].dispatchSuggestion?.waveContext.kind, 'suggested');
    assert.deepEqual(
        result[0].dispatchSuggestion?.waveContext.stops.map((stop: { orderId: string; sequence: number }) => ({
            orderId: stop.orderId,
            sequence: stop.sequence,
        })),
        [
            { orderId: 'order-pinned', sequence: 1 },
            { orderId: 'order-priority', sequence: 2 },
        ],
    );
    assert.deepEqual(
        result[0].dispatchSuggestion?.waveContext.polyline,
        [
            { latitude: -23.55, longitude: -46.63 },
            { latitude: -23.56, longitude: -46.61 },
            { latitude: -23.57, longitude: -46.65 },
        ],
    );
    assert.equal(result[0].mapWaveContext?.primaryOrderId, 'order-pinned');
    assert.equal(result[1].recommendation.suggestedVehicleType, 'refrigerated_van');
    assert.equal(result[1].recommendation.suggestedVehicle?.id, 'vehicle-1');
    assert.equal(result[1].recommendation.riskLevel, 'high');
});

test('logistics.getPendingDeliveries returns confirmed mapWaveContext already sequenced by the backend', async () => {
    const deliveryRows: DeliveryRow[] = [
        {
            orderId: 'order-wave-1',
            status: 'ready_for_dispatch',
            totalAmount: '125.0000',
            deliveryFee: '10.00',
            createdAt: new Date('2026-03-16T07:30:00.000Z'),
            buyerTenantId: 'buyer-1',
            buyerName: 'Mercado Norte',
            deliveryStreet: 'Rua C',
            deliveryNumber: '50',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua C, 50 - Sao Paulo/SP',
            deliveryNotes: null,
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
            farmLatitude: -23.55,
            farmLongitude: -46.63,
            deliveryLatitude: -23.57,
            deliveryLongitude: -46.65,
            distanceKm: 8.4,
            orderItemId: 'item-wave-1',
            productId: 'product-wave-1',
            productName: 'Tomate',
            itemQty: '6.000',
            itemSaleUnit: 'box',
            productSaleUnit: 'box',
            unitWeightG: 2500,
            estimatedWeightKg: 15,
            lotExpiryDate: new Date('2026-03-18T23:00:00.000Z'),
            lotFreshnessScore: 65,
        },
        {
            orderId: 'order-wave-2',
            status: 'ready_for_dispatch',
            totalAmount: '98.0000',
            deliveryFee: '9.00',
            createdAt: new Date('2026-03-16T07:45:00.000Z'),
            buyerTenantId: 'buyer-2',
            buyerName: 'Padaria Sul',
            deliveryStreet: 'Rua D',
            deliveryNumber: '90',
            deliveryCep: '02020-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua D, 90 - Sao Paulo/SP',
            deliveryNotes: null,
            deliveryWindowStart: null,
            deliveryWindowEnd: null,
            farmId: 'farm-1',
            farmName: 'Sitio Horizonte',
            farmLatitude: -23.55,
            farmLongitude: -46.63,
            deliveryLatitude: -23.56,
            deliveryLongitude: -46.61,
            distanceKm: 4.3,
            orderItemId: 'item-wave-2',
            productId: 'product-wave-2',
            productName: 'Alface',
            itemQty: '4.000',
            itemSaleUnit: 'unit',
            productSaleUnit: 'unit',
            unitWeightG: 300,
            estimatedWeightKg: 1.2,
            lotExpiryDate: new Date('2026-03-18T23:00:00.000Z'),
            lotFreshnessScore: 38,
        },
    ];

    const waveAssignments: DispatchWaveRow[] = [
        {
            waveId: 'wave-1',
            orderId: 'order-wave-1',
            sequence: 2,
            status: 'confirmed',
            confidence: 'high',
            recommendedVehicleType: 'pickup',
            selectedVehicleId: null,
            selectedVehicleLabel: 'Pickup 01',
            confirmedAt: new Date('2026-03-16T10:00:00.000Z'),
        },
        {
            waveId: 'wave-1',
            orderId: 'order-wave-2',
            sequence: 1,
            status: 'confirmed',
            confidence: 'high',
            recommendedVehicleType: 'pickup',
            selectedVehicleId: null,
            selectedVehicleLabel: 'Pickup 01',
            confirmedAt: new Date('2026-03-16T10:00:00.000Z'),
        },
    ];

    let selectCallCount = 0;

    const db = withRlsMockDb({
        select() {
            selectCallCount += 1;

            if (selectCallCount === 1) {
                return createTenantSelectChain();
            }

            if (selectCallCount === 2) {
                return createDeliveriesSelectChain(deliveryRows);
            }

            if (selectCallCount === 3) {
                return createSupplementalSelectChain<OverrideRow>([]);
            }

            if (selectCallCount === 4) {
                return createSupplementalSelectChain<VehicleRow>([]);
            }

            return createSupplementalSelectChain(waveAssignments);
        },
    });

    const caller = await createLogisticsCaller(db);
    const logisticsNamespace = (caller as Record<string, any>).logistics;
    const result = await logisticsNamespace.getPendingDeliveries();
    const selectedDelivery = result.find((delivery: { orderId: string }) => delivery.orderId === 'order-wave-1');

    assert.ok(selectedDelivery);
    assert.equal(selectedDelivery.dispatchSuggestion, null);
    assert.equal(selectedDelivery.mapWaveContext?.kind, 'confirmed');
    assert.equal(selectedDelivery.mapWaveContext?.primaryOrderId, 'order-wave-1');
    assert.deepEqual(
        selectedDelivery.mapWaveContext?.stops.map((stop: { orderId: string; sequence: number }) => ({
            orderId: stop.orderId,
            sequence: stop.sequence,
        })),
        [
            { orderId: 'order-wave-2', sequence: 1 },
            { orderId: 'order-wave-1', sequence: 2 },
        ],
    );
    assert.deepEqual(
        selectedDelivery.mapWaveContext?.polyline,
        [
            { latitude: -23.55, longitude: -46.63 },
            { latitude: -23.56, longitude: -46.61 },
            { latitude: -23.57, longitude: -46.65 },
        ],
    );
});

test('logistics.confirmDispatchWave persists structured dispatch data and marks orders as ready_for_dispatch', async () => {
    const state = {
        insertedWave: null as Record<string, unknown> | null,
        insertedWaveOrders: null as Record<string, unknown>[] | null,
        insertedNotifications: [] as Record<string, unknown>[],
        updatedStatuses: [] as string[],
        orderLookup: new Map([
            ['11111111-1111-4111-8111-111111111111', {
                id: '11111111-1111-4111-8111-111111111111',
                buyerTenantId: 'buyer-1',
                sellerTenantId: 'tenant-1',
                status: 'confirmed',
            }],
            ['22222222-2222-4222-8222-222222222222', {
                id: '22222222-2222-4222-8222-222222222222',
                buyerTenantId: 'buyer-2',
                sellerTenantId: 'tenant-1',
                status: 'picking',
            }],
        ]),
    };

    let selectCallCount = 0;
    let insertCallCount = 0;

    const db = withRlsMockDb({
        select(selection?: Record<string, unknown>) {
            selectCallCount += 1;

            if (selectCallCount === 1) {
                return createTenantSelectChain();
            }

            if (selection && 'userId' in selection) {
                return createSupplementalSelectChain([
                    { userId: 'buyer-user-1' },
                ]);
            }

            return createSupplementalSelectChain(
                Array.from(state.orderLookup.values()).map((order) => ({
                    id: order.id,
                    status: order.status,
                    buyerTenantId: order.buyerTenantId,
                })),
            );
        },
        insert() {
            insertCallCount += 1;

            if (insertCallCount === 1) {
                return {
                    values(values: Record<string, unknown>) {
                        state.insertedWave = values;
                        return {
                            returning: async () => [{ id: 'wave-1' }],
                        };
                    },
                };
            }

            return {
                values(values: Record<string, unknown>[]) {
                    if (insertCallCount === 2) {
                        state.insertedWaveOrders = values;
                        return {
                            returning: async () => values,
                        };
                    }

                    state.insertedNotifications.push(...values);
                    return createNotificationInsertChain(values);
                },
            };
        },
        update() {
            return {
                set(values: Record<string, unknown>) {
                    return {
                        where: async () => {
                            state.updatedStatuses.push(String(values.status));
                        },
                    };
                },
            };
        },
    });

    const caller = await createLogisticsCaller(db);
    const logisticsNamespace = (caller as Record<string, any>).logistics;

    const result = await logisticsNamespace.confirmDispatchWave({
        orderIds: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
        ],
        confidence: 'high',
        recommendedVehicleType: 'pickup',
        recommendationSummary: 'Saida sugerida para consolidar entregas da manha.',
    });

    assert.deepEqual(result, {
        success: true,
        waveId: 'wave-1',
        status: 'confirmed',
        updatedOrderCount: 2,
    });
    assert.equal(state.insertedWave?.recommendedVehicleType, 'pickup');
    assert.equal(state.insertedWaveOrders?.length, 2);
    assert.deepEqual(state.updatedStatuses, ['ready_for_dispatch']);
});
