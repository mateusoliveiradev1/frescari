import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import type { NextRequest } from 'next/server';

process.env.STRIPE_SECRET_KEY ??= 'sk_test_mocked';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_mocked';

const dbTables = {
    orders: { name: 'orders' },
    orderItems: { name: 'order_items' },
    productLots: { name: 'product_lots' },
    products: { name: 'products' },
    masterProducts: { name: 'master_products' },
};

const stripeState = {
    event: null as unknown,
};

const dbState = {
    selectQueue: [] as unknown[],
    orderInsertError: null as null | Error,
    ordersInserted: [] as unknown[],
    orderItemsInserted: [] as unknown[],
    stockUpdates: [] as unknown[],
    executeCalls: [] as unknown[],
};

function resetMockState() {
    stripeState.event = null;
    dbState.selectQueue = [];
    dbState.orderInsertError = null;
    dbState.ordersInserted = [];
    dbState.orderItemsInserted = [];
    dbState.stockUpdates = [];
    dbState.executeCalls = [];
}

function createThenableChain(result: unknown) {
    const chain = {
        from() {
            return chain;
        },
        innerJoin() {
            return chain;
        },
        leftJoin() {
            return chain;
        },
        where() {
            return chain;
        },
        limit() {
            return Promise.resolve(result);
        },
        orderBy() {
            return Promise.resolve(result);
        },
        returning() {
            return Promise.resolve(result);
        },
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
            return Promise.resolve(result).then(onFulfilled, onRejected);
        },
    };

    return chain;
}

function createInsertChain(table: unknown, values: unknown) {
    const executeInsert = async () => {
        if (table === dbTables.orders) {
            if (dbState.orderInsertError) {
                throw dbState.orderInsertError;
            }

            dbState.ordersInserted.push(values);
            return [{ id: 'order-created-1' }];
        }

        if (table === dbTables.orderItems) {
            dbState.orderItemsInserted.push(values);
        }

        return [];
    };

    return {
        returning: executeInsert,
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
            return executeInsert().then(onFulfilled, onRejected);
        },
    };
}

function createUpdateChain(table: unknown, values: unknown) {
    const executeUpdate = async () => {
        if (table === dbTables.productLots) {
            dbState.stockUpdates.push(values);
        }

        return [];
    };

    const chain = {
        where() {
            return chain;
        },
        returning: executeUpdate,
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
            return executeUpdate().then(onFulfilled, onRejected);
        },
    };

    return chain;
}

const mockDb = {
    execute: async (query: unknown) => {
        dbState.executeCalls.push(query);
        return [];
    },
    select() {
        const nextResult = dbState.selectQueue.shift() ?? [];
        return createThenableChain(nextResult);
    },
    insert(table: unknown) {
        return {
            values(values: unknown) {
                return createInsertChain(table, values);
            },
        };
    },
    update(table: unknown) {
        return {
            set(values: unknown) {
                return createUpdateChain(table, values);
            },
        };
    },
    query: {
        orders: {
            findFirst: async () => null,
        },
    },
};

class StripeMock {
    webhooks = {
        constructEvent: () => stripeState.event,
    };
}

const originalModuleLoad = (Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
})._load;

before(() => {
    (Module as typeof Module & {
        _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    })._load = function patchedModuleLoad(request: string, parent: unknown, isMain: boolean) {
        if (request === 'stripe') {
            return { __esModule: true, default: StripeMock };
        }

        if (request === '@frescari/db') {
            return {
                authDb: {
                    transaction: async (callback: (db: typeof mockDb) => Promise<unknown>) => callback(mockDb),
                },
                enableRlsBypassContext: async () => undefined,
                orders: dbTables.orders,
                orderItems: dbTables.orderItems,
                productLots: dbTables.productLots,
                products: dbTables.products,
                masterProducts: dbTables.masterProducts,
            };
        }

        if (request === '@frescari/api') {
            return {
                buildDeliveryAddressLine: (address: Record<string, string>) =>
                    `${address.street}, ${address.number} - ${address.city}/${address.state}`,
                geocodeDeliveryAddress: async () => ({ latitude: -23.55, longitude: -46.63 }),
                isWeighableSaleUnit: (saleUnit?: string | null) => saleUnit === 'kg' || saleUnit === 'g',
                parseDeliveryPointMetadata: (raw: string | undefined) =>
                    raw ? { latitude: -23.55, longitude: -46.63 } : null,
                resolveEffectiveSaleUnit: (saleUnit?: string | null, lotUnit?: string | null) => saleUnit ?? lotUnit ?? 'unit',
                toDeliveryPointGeoJson: (point: unknown) => point,
            };
        }

        return originalModuleLoad.call(this, request, parent, isMain);
    };
});

after(() => {
    (Module as typeof Module & {
        _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    })._load = originalModuleLoad;
});

beforeEach(() => {
    resetMockState();
});

function createCheckoutCompletedEvent(sessionOverrides: Partial<Record<string, unknown>> = {}) {
    return {
        type: 'checkout.session.completed',
        data: {
            object: {
                id: 'cs_test_123',
                payment_intent: 'pi_test_123',
                metadata: {
                    buyer_tenant_id: 'buyer-tenant-1',
                    items: JSON.stringify([
                        {
                            lotId: '11111111-1111-4111-8111-111111111111',
                            qty: 2,
                            pt: 'UNIT',
                            name: 'Tomate',
                            price: 10,
                        },
                    ]),
                    address: JSON.stringify({
                        street: 'Rua das Flores',
                        number: '123',
                        cep: '01010-000',
                        city: 'Sao Paulo',
                        state: 'SP',
                    }),
                    delivery_fee: '12.50',
                    delivery_point: '{"latitude":-23.55,"longitude":-46.63}',
                },
                ...sessionOverrides,
            },
        },
    };
}

function createWebhookRequest() {
    return new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: '{}',
        headers: {
            'stripe-signature': 'sig_test',
        },
    }) as unknown as NextRequest;
}

test('stripe webhook treats duplicate stripeSessionId insertion as already processed', async () => {
    const duplicateError = Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
    });

    stripeState.event = createCheckoutCompletedEvent();
    dbState.selectQueue.push(
        [],
        [
            {
                lotId: '11111111-1111-4111-8111-111111111111',
                productId: 'product-1',
                sellerTenantId: 'seller-tenant-1',
                availableQty: '10.000',
                lotUnit: 'unit',
                saleUnit: 'unit',
                pricingType: 'UNIT',
                masterPricingType: 'UNIT',
            },
        ],
    );
    dbState.orderInsertError = duplicateError;

    const { POST } = await import('./route');

    const response = await POST(createWebhookRequest());

    assert.equal(response.status, 200);
    assert.equal(dbState.ordersInserted.length, 0);
    assert.equal(dbState.stockUpdates.length, 0);
});

test('stripe webhook rejects checkout completion when stock is insufficient before creating the order', async () => {
    stripeState.event = createCheckoutCompletedEvent();
    dbState.selectQueue.push(
        [],
        [
            {
                lotId: '11111111-1111-4111-8111-111111111111',
                productId: 'product-1',
                sellerTenantId: 'seller-tenant-1',
                availableQty: '1.000',
                lotUnit: 'unit',
                saleUnit: 'unit',
                pricingType: 'UNIT',
                masterPricingType: 'UNIT',
            },
        ],
    );

    const { POST } = await import('./route');

    const response = await POST(createWebhookRequest());

    assert.equal(response.status, 500);
    assert.equal(dbState.ordersInserted.length, 0);
    assert.equal(dbState.orderItemsInserted.length, 0);
    assert.equal(dbState.stockUpdates.length, 0);
});
