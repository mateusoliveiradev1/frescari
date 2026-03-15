import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRlsMockDb } from './test-db';

type DeliveryRow = {
    orderId: string;
    status: 'payment_authorized' | 'confirmed' | 'picking';
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
            return selectCallCount === 1
                ? createTenantSelectChain()
                : createDeliveriesSelectChain(deliveryRows);
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
            return selectCallCount === 1
                ? createTenantSelectChain()
                : createDeliveriesSelectChain(deliveryRows);
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

test('logistics.updateDeliveryStatus only advances producer orders to allowed delivery states', async () => {
    const orderId = '11111111-1111-4111-8111-111111111111';

    const state = {
        order: {
            id: orderId,
            sellerTenantId: 'tenant-1',
            status: 'picking',
        },
        updatedStatus: null as string | null,
    };

    let selectCallCount = 0;

    const db = withRlsMockDb({
        select() {
            selectCallCount += 1;
            return createTenantSelectChain();
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
                            state.updatedStatus = String(values.status);
                            state.order = {
                                ...state.order,
                                status: state.updatedStatus,
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

    const mutationResult = await logisticsNamespace.updateDeliveryStatus({
        orderId,
        status: 'in_transit',
    });

    assert.deepEqual(mutationResult, { success: true, status: 'in_transit' });
    assert.equal(state.updatedStatus, 'in_transit');
});
