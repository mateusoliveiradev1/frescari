import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { withRlsMockDb } from './test-db';

process.env.STRIPE_SECRET_KEY ??= 'sk_test_mocked';

const stripeState = {
    retrievedPaymentIntentIds: [] as string[],
    captureCalls: 0,
    lastCapturePayload: null as Record<string, unknown> | null,
    paymentIntent: {
        status: 'succeeded',
        amount_received: 1400,
        amount_capturable: 0,
        transfer_data: undefined as { destination: string } | undefined,
        metadata: {} as Record<string, string>,
    },
};

class StripeMock {
    checkout = {
        sessions: {
            retrieve: async () => ({
                payment_intent: 'pi_mock_123',
            }),
        },
    };

    paymentIntents = {
        retrieve: async (paymentIntentId: string) => {
            stripeState.retrievedPaymentIntentIds.push(paymentIntentId);

            return {
                id: paymentIntentId,
                ...stripeState.paymentIntent,
            };
        },
        capture: async (_paymentIntentId: string, payload: Record<string, unknown>) => {
            stripeState.captureCalls += 1;
            stripeState.lastCapturePayload = payload;

            if (stripeState.paymentIntent.status === 'succeeded') {
                throw new Error('capture should not be called for already captured payments');
            }

            stripeState.paymentIntent = {
                ...stripeState.paymentIntent,
                status: 'succeeded',
                amount_received: Number(payload.amount_to_capture ?? 0),
                amount_capturable: 0,
                metadata: (payload.metadata as Record<string, string> | undefined) ?? {},
            };

            return {
                id: 'pi_mock_123',
                status: 'succeeded',
            };
        },
    };
}

const originalModuleLoad = (Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
})._load;

(Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
})._load = function patchedModuleLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === 'stripe') {
        return { __esModule: true, default: StripeMock };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
};

beforeEach(() => {
    stripeState.retrievedPaymentIntentIds.length = 0;
    stripeState.captureCalls = 0;
    stripeState.lastCapturePayload = null;
    stripeState.paymentIntent = {
        status: 'succeeded',
        amount_received: 1400,
        amount_capturable: 0,
        transfer_data: undefined,
        metadata: {},
    };
});

type FlowState = {
    order: {
        id: string;
        buyerTenantId: string;
        sellerTenantId: string;
        status: string;
        totalAmount: string;
        deliveryFee: string;
        paymentIntentId: string;
        stripeSessionId: string | null;
        createdAt: Date;
        deliveryStreet: string;
        deliveryNumber: string;
        deliveryCep: string;
        deliveryCity: string;
        deliveryState: string;
        deliveryAddress: string;
        deliveryNotes: string | null;
        deliveryWindowStart: Date | null;
        deliveryWindowEnd: Date | null;
    };
    items: Array<{
        id: string;
        qty: string;
        unitPrice: string;
        saleUnit: string;
        productId: string;
        productName: string;
        pricingType: string;
        masterPricingType: string | null;
        productSaleUnit: string;
        unitWeightG: number | null;
    }>;
    insertedNotifications?: Array<Record<string, unknown>>;
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

function createCaptureItemsSelectChain(state: FlowState) {
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
        where: async () => state.items.map((item) => ({
            id: item.id,
            qty: item.qty,
            unitPrice: item.unitPrice,
            saleUnit: item.saleUnit,
            productName: item.productName,
            pricingType: item.pricingType,
            masterPricingType: item.masterPricingType,
        })),
    };
}

function createDeliveriesSelectChain(state: FlowState) {
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
        orderBy: async () => {
            if (!['payment_authorized', 'confirmed', 'picking', 'ready_for_dispatch'].includes(state.order.status)) {
                return [];
            }

            return state.items.map((item) => ({
                orderId: state.order.id,
                status: state.order.status,
                totalAmount: state.order.totalAmount,
                deliveryFee: state.order.deliveryFee,
                createdAt: state.order.createdAt,
                buyerTenantId: state.order.buyerTenantId,
                buyerName: 'Restaurante Central',
                deliveryStreet: state.order.deliveryStreet,
                deliveryNumber: state.order.deliveryNumber,
                deliveryCep: state.order.deliveryCep,
                deliveryCity: state.order.deliveryCity,
                deliveryState: state.order.deliveryState,
                deliveryAddress: state.order.deliveryAddress,
                deliveryNotes: state.order.deliveryNotes,
                deliveryWindowStart: state.order.deliveryWindowStart,
                deliveryWindowEnd: state.order.deliveryWindowEnd,
                farmId: 'farm-1',
                farmName: 'Sitio Horizonte',
                farmLatitude: -23.55,
                farmLongitude: -46.63,
                deliveryLatitude: -23.57,
                deliveryLongitude: -46.65,
                distanceKm: 4.82,
                orderItemId: item.id,
                productId: item.productId,
                productName: item.productName,
                itemQty: item.qty,
                itemSaleUnit: item.saleUnit,
                productSaleUnit: item.productSaleUnit,
                unitWeightG: item.unitWeightG,
                estimatedWeightKg: Number(item.qty),
                lotExpiryDate: '2026-03-18',
                lotFreshnessScore: 72,
            }));
        },
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

function createNotificationInsertChain(
    values: Array<Record<string, unknown>>,
    onInsert: (rows: Array<Record<string, unknown>>) => void,
) {
    onInsert(values);

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

async function createFlowCaller(state: FlowState) {
    const [{ orderItems, orders }, { createTRPCRouter }, { orderRouter }, { logisticsRouter }] = await Promise.all([
        import('@frescari/db'),
        import('./trpc'),
        import('./routers/order'),
        import('./routers/logistics'),
    ]);

    const db = withRlsMockDb({
        select(selection: Record<string, unknown>) {
            const keys = Object.keys(selection);

            if ('type' in selection && 'id' in selection && Object.keys(selection).length === 2) {
                return createTenantSelectChain();
            }

            if ('orderId' in selection && 'buyerName' in selection) {
                return createDeliveriesSelectChain(state);
            }

            if ('productName' in selection && 'pricingType' in selection && 'qty' in selection) {
                return createCaptureItemsSelectChain(state);
            }

            if (keys.includes('operationDate') && keys.includes('action') && keys.includes('reason')) {
                return createSupplementalSelectChain([]);
            }

            if (keys.includes('vehicleType') && keys.includes('capacityKg') && keys.includes('availabilityStatus')) {
                return createSupplementalSelectChain([]);
            }

            if (keys.includes('waveId') && keys.includes('selectedVehicleLabel') && keys.includes('confirmedAt')) {
                return createSupplementalSelectChain([]);
            }

            if (keys.includes('userId')) {
                return createSupplementalSelectChain([
                    { userId: 'buyer-user-1' },
                ]);
            }

            throw new Error(`Unexpected select shape: ${keys.join(', ')}`);
        },
        insert() {
            return {
                values(values: Record<string, unknown> | Record<string, unknown>[]) {
                    const notificationRows = Array.isArray(values) ? values : [values];
                    return createNotificationInsertChain(notificationRows, (rows) => {
                        state.insertedNotifications = [
                            ...(state.insertedNotifications ?? []),
                            ...rows,
                        ];
                    });
                },
            };
        },
        query: {
            orders: {
                findFirst: async () => state.order,
            },
        },
        transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
            update(table: unknown) {
                if (table === orderItems) {
                    return {
                        set(values: Record<string, unknown>) {
                            return {
                                where: async () => {
                                    state.items[0] = {
                                        ...state.items[0],
                                        qty: String(values.qty),
                                    };
                                },
                            };
                        },
                    };
                }

                if (table === orders) {
                    return {
                        set(values: Record<string, unknown>) {
                            return {
                                where: async () => {
                                    state.order = {
                                        ...state.order,
                                        status: String(values.status ?? state.order.status),
                                        totalAmount: String(values.totalAmount ?? state.order.totalAmount),
                                        paymentIntentId: String(values.paymentIntentId ?? state.order.paymentIntentId),
                                    };
                                },
                            };
                        },
                    };
                }

                throw new Error('Unexpected table update inside transaction');
            },
        }),
    });

    const testRouter = createTRPCRouter({
        order: orderRouter,
        logistics: logisticsRouter,
    });

    return testRouter.createCaller(createProducerContext(db as never));
}

test('awaiting_weight -> confirmed -> /dashboard/entregas stays visible after captureWeighedOrder', async () => {
    stripeState.paymentIntent = {
        status: 'succeeded',
        amount_received: 1400,
        amount_capturable: 0,
        transfer_data: undefined,
        metadata: {
            frescari_capture_fingerprint:
                '22222222-2222-4222-8222-222222222222:1.100',
            frescari_capture_total_amount_cents: '1400',
        },
    };

    const state: FlowState = {
        order: {
            id: '11111111-1111-4111-8111-111111111111',
            buyerTenantId: 'buyer-1',
            sellerTenantId: 'tenant-1',
            status: 'awaiting_weight',
            totalAmount: '13.0000',
            deliveryFee: '3.00',
            paymentIntentId: 'pi_mock_123',
            stripeSessionId: null,
            createdAt: new Date('2026-03-13T13:00:00.000Z'),
            deliveryStreet: 'Rua das Flores',
            deliveryNumber: '45',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Flores, 45 - Sao Paulo/SP',
            deliveryNotes: 'Entregar na doca 2',
            deliveryWindowStart: new Date('2026-03-13T15:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-13T18:00:00.000Z'),
        },
        items: [
            {
                id: '22222222-2222-4222-8222-222222222222',
                qty: '1.000',
                unitPrice: '10.0000',
                saleUnit: 'kg',
                productId: 'product-1',
                productName: 'Tomate Italiano',
                pricingType: 'WEIGHT',
                masterPricingType: null,
                productSaleUnit: 'kg',
                unitWeightG: null,
            },
        ],
    };

    const caller = await createFlowCaller(state);
    const app = caller as Record<string, any>;

    const captureResult = await app.order.captureWeighedOrder({
        orderId: state.order.id,
        weighedItems: [
            {
                orderItemId: state.items[0].id,
                finalWeight: 1.1,
            },
        ],
    });

    assert.equal(captureResult.success, true);
    assert.equal(captureResult.alreadyCaptured, true);
    assert.equal(captureResult.finalAmount, 14);
    assert.equal(state.order.status, 'confirmed');
    assert.equal(state.order.totalAmount, '14.0000');
    assert.equal(state.items[0].qty, '1.1');
    assert.deepEqual(stripeState.retrievedPaymentIntentIds, ['pi_mock_123']);
    assert.equal(stripeState.captureCalls, 0);

    const pendingDeliveries = await app.logistics.getPendingDeliveries();

    assert.equal(pendingDeliveries.length, 1);
    assert.equal(pendingDeliveries[0].orderId, state.order.id);
    assert.equal(pendingDeliveries[0].status, 'confirmed');
    assert.equal(pendingDeliveries[0].distanceKm, 4.82);
    assert.deepEqual(pendingDeliveries[0].origin, {
        farmId: 'farm-1',
        farmName: 'Sitio Horizonte',
        latitude: -23.55,
        longitude: -46.63,
    });
    assert.deepEqual(pendingDeliveries[0].destination, {
        latitude: -23.57,
        longitude: -46.65,
    });
    assert.equal(pendingDeliveries[0].items.length, 1);
    assert.deepEqual(pendingDeliveries[0].items[0], {
        orderItemId: state.items[0].id,
        productId: 'product-1',
        productName: 'Tomate Italiano',
        qty: '1.1',
        saleUnit: 'kg',
        productSaleUnit: 'kg',
        unitWeightG: null,
        estimatedWeightKg: 1.1,
    });
});

test('captureWeighedOrder omits application_fee_amount when the PaymentIntent was created without Connect transfer_data', async () => {
    stripeState.paymentIntent = {
        status: 'requires_capture',
        amount_received: 0,
        amount_capturable: 1400,
        transfer_data: undefined,
        metadata: {},
    };

    const state: FlowState = {
        order: {
            id: '11111111-1111-4111-8111-111111111111',
            buyerTenantId: 'buyer-1',
            sellerTenantId: 'tenant-1',
            status: 'awaiting_weight',
            totalAmount: '13.0000',
            deliveryFee: '3.00',
            paymentIntentId: 'pi_mock_123',
            stripeSessionId: null,
            createdAt: new Date('2026-03-13T13:00:00.000Z'),
            deliveryStreet: 'Rua das Flores',
            deliveryNumber: '45',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Flores, 45 - Sao Paulo/SP',
            deliveryNotes: 'Entregar na doca 2',
            deliveryWindowStart: new Date('2026-03-13T15:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-13T18:00:00.000Z'),
        },
        items: [
            {
                id: '22222222-2222-4222-8222-222222222222',
                qty: '1.000',
                unitPrice: '10.0000',
                saleUnit: 'kg',
                productId: 'product-1',
                productName: 'Tomate Italiano',
                pricingType: 'WEIGHT',
                masterPricingType: null,
                productSaleUnit: 'kg',
                unitWeightG: null,
            },
        ],
    };

    const caller = await createFlowCaller(state);
    const app = caller as Record<string, any>;

    const captureResult = await app.order.captureWeighedOrder({
        orderId: state.order.id,
        weighedItems: [
            {
                orderItemId: state.items[0].id,
                finalWeight: 1.1,
            },
        ],
    });

    assert.equal(captureResult.success, true);
    assert.equal(captureResult.alreadyCaptured, false);
    assert.equal(stripeState.captureCalls, 1);
    assert.deepEqual(stripeState.lastCapturePayload, {
        amount_to_capture: 1400,
        metadata: {
            frescari_capture_fingerprint:
                '22222222-2222-4222-8222-222222222222:1.100',
            frescari_capture_total_amount_cents: '1400',
        },
    });
    assert.equal(state.order.status, 'confirmed');
    assert.equal(state.order.totalAmount, '14.0000');
});

test('captureWeighedOrder rejects conflicting retries when Stripe already captured a different weight fingerprint', async () => {
    stripeState.paymentIntent = {
        status: 'succeeded',
        amount_received: 1520,
        amount_capturable: 0,
        transfer_data: undefined,
        metadata: {
            frescari_capture_fingerprint:
                '22222222-2222-4222-8222-222222222222:1.200',
            frescari_capture_total_amount_cents: '1520',
        },
    };

    const state: FlowState = {
        order: {
            id: '11111111-1111-4111-8111-111111111111',
            buyerTenantId: 'buyer-1',
            sellerTenantId: 'tenant-1',
            status: 'awaiting_weight',
            totalAmount: '16.4000',
            deliveryFee: '2.00',
            paymentIntentId: 'pi_mock_123',
            stripeSessionId: null,
            createdAt: new Date('2026-03-13T13:00:00.000Z'),
            deliveryStreet: 'Rua das Flores',
            deliveryNumber: '45',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Flores, 45 - Sao Paulo/SP',
            deliveryNotes: 'Entregar na doca 2',
            deliveryWindowStart: new Date('2026-03-13T15:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-13T18:00:00.000Z'),
        },
        items: [
            {
                id: '22222222-2222-4222-8222-222222222222',
                qty: '1.200',
                unitPrice: '12.0000',
                saleUnit: 'kg',
                productId: 'product-1',
                productName: 'Tomate Italiano',
                pricingType: 'WEIGHT',
                masterPricingType: null,
                productSaleUnit: 'kg',
                unitWeightG: null,
            },
        ],
    };

    const caller = await createFlowCaller(state);
    const app = caller as Record<string, any>;

    await assert.rejects(
        () =>
            app.order.captureWeighedOrder({
                orderId: state.order.id,
                weighedItems: [
                    {
                        orderItemId: state.items[0].id,
                        finalWeight: 1.1,
                    },
                ],
            }),
        /capturado com pesos diferentes/i,
    );

    assert.equal(state.order.status, 'awaiting_weight');
    assert.equal(state.order.totalAmount, '16.4000');
    assert.equal(state.items[0].qty, '1.200');
    assert.equal(stripeState.captureCalls, 0);
});

test('captureWeighedOrder rejects conflicting retries for already confirmed orders even without Stripe fingerprint metadata', async () => {
    stripeState.paymentIntent = {
        status: 'succeeded',
        amount_received: 1500,
        amount_capturable: 0,
        transfer_data: undefined,
        metadata: {},
    };

    const state: FlowState = {
        order: {
            id: '11111111-1111-4111-8111-111111111111',
            buyerTenantId: 'buyer-1',
            sellerTenantId: 'tenant-1',
            status: 'confirmed',
            totalAmount: '14.0000',
            deliveryFee: '3.00',
            paymentIntentId: 'pi_mock_123',
            stripeSessionId: null,
            createdAt: new Date('2026-03-13T13:00:00.000Z'),
            deliveryStreet: 'Rua das Flores',
            deliveryNumber: '45',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Flores, 45 - Sao Paulo/SP',
            deliveryNotes: 'Entregar na doca 2',
            deliveryWindowStart: new Date('2026-03-13T15:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-13T18:00:00.000Z'),
        },
        items: [
            {
                id: '22222222-2222-4222-8222-222222222222',
                qty: '1.100',
                unitPrice: '10.0000',
                saleUnit: 'kg',
                productId: 'product-1',
                productName: 'Tomate Italiano',
                pricingType: 'WEIGHT',
                masterPricingType: null,
                productSaleUnit: 'kg',
                unitWeightG: null,
            },
        ],
    };

    const caller = await createFlowCaller(state);
    const app = caller as Record<string, any>;

    await assert.rejects(
        () =>
            app.order.captureWeighedOrder({
                orderId: state.order.id,
                weighedItems: [
                    {
                        orderItemId: state.items[0].id,
                        finalWeight: 1.2,
                    },
                ],
            }),
        /confirmado com pesos diferentes/i,
    );

    assert.equal(state.order.status, 'confirmed');
    assert.equal(state.order.totalAmount, '14.0000');
    assert.equal(state.items[0].qty, '1.100');
    assert.equal(stripeState.captureCalls, 0);
});

test('captureWeighedOrder requires fingerprint metadata to reconcile already-captured orders that are still awaiting local confirmation', async () => {
    stripeState.paymentIntent = {
        status: 'succeeded',
        amount_received: 1520,
        amount_capturable: 0,
        transfer_data: undefined,
        metadata: {},
    };

    const state: FlowState = {
        order: {
            id: '11111111-1111-4111-8111-111111111111',
            buyerTenantId: 'buyer-1',
            sellerTenantId: 'tenant-1',
            status: 'awaiting_weight',
            totalAmount: '13.0000',
            deliveryFee: '2.00',
            paymentIntentId: 'pi_mock_123',
            stripeSessionId: null,
            createdAt: new Date('2026-03-13T13:00:00.000Z'),
            deliveryStreet: 'Rua das Flores',
            deliveryNumber: '45',
            deliveryCep: '01010-000',
            deliveryCity: 'Sao Paulo',
            deliveryState: 'SP',
            deliveryAddress: 'Rua das Flores, 45 - Sao Paulo/SP',
            deliveryNotes: 'Entregar na doca 2',
            deliveryWindowStart: new Date('2026-03-13T15:00:00.000Z'),
            deliveryWindowEnd: new Date('2026-03-13T18:00:00.000Z'),
        },
        items: [
            {
                id: '22222222-2222-4222-8222-222222222222',
                qty: '1.000',
                unitPrice: '12.0000',
                saleUnit: 'kg',
                productId: 'product-1',
                productName: 'Tomate Italiano',
                pricingType: 'WEIGHT',
                masterPricingType: null,
                productSaleUnit: 'kg',
                unitWeightG: null,
            },
        ],
    };

    const caller = await createFlowCaller(state);
    const app = caller as Record<string, any>;

    await assert.rejects(
        () =>
            app.order.captureWeighedOrder({
                orderId: state.order.id,
                weighedItems: [
                    {
                        orderItemId: state.items[0].id,
                        finalWeight: 1.1,
                    },
                ],
            }),
        /sem rastreabilidade de pesos/i,
    );

    assert.equal(state.order.status, 'awaiting_weight');
    assert.equal(state.order.totalAmount, '13.0000');
    assert.equal(state.items[0].qty, '1.000');
    assert.equal(stripeState.captureCalls, 0);
});
