import assert from 'node:assert/strict';
import test from 'node:test';

function createBuyerContext(db: unknown): any {
    return {
        db,
        req: undefined,
        session: { user: { id: 'user-1' } },
        user: {
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'buyer',
            name: 'Comprador Teste',
        },
    };
}

async function createLogisticsCaller(db: unknown) {
    const [{ createTRPCRouter }, { logisticsRouter }] = await Promise.all([
        import('./trpc'),
        import('./routers/logistics'),
    ]);

    const testRouter = createTRPCRouter({ logistics: logisticsRouter });
    return testRouter.createCaller(createBuyerContext(db as never));
}

function createTenantSelectChain(type: 'BUYER' | 'PRODUCER' = 'BUYER') {
    return {
        from() {
            return this;
        },
        where() {
            return this;
        },
        limit: async () => [{ id: 'tenant-1', type }],
    };
}

function createAddressSelectChain() {
    return {
        from() {
            return this;
        },
        where() {
            return this;
        },
        limit: async () => [
            {
                id: '11111111-1111-4111-8111-111111111111',
                tenantId: 'tenant-1',
                location: [-46.63, -23.55] as [number, number],
            },
        ],
    };
}

function createFarmSelectChain() {
    return {
        from() {
            return this;
        },
        where() {
            return this;
        },
        limit: async () => [
            {
                id: '22222222-2222-4222-8222-222222222222',
                location: [-46.61, -23.54] as [number, number],
                baseDeliveryFee: '8.00',
                pricePerKm: '2.00',
                maxDeliveryRadiusKm: '20.00',
                minOrderValue: '50.00',
                freeShippingThreshold: '120.00',
            },
        ],
    };
}

function createDistanceSelectChain(distanceMeters: number) {
    return {
        from() {
            return this;
        },
        innerJoin() {
            return this;
        },
        where() {
            return this;
        },
        limit: async () => [{ distanceMeters }],
    };
}

test('logistics.calculateFreight returns free shipping when subtotal reaches threshold', async () => {
    let selectCallCount = 0;

    const db = {
        select() {
            selectCallCount += 1;

            switch (selectCallCount) {
                case 1:
                    return createTenantSelectChain('BUYER');
                case 2:
                    return createAddressSelectChain();
                case 3:
                    return createFarmSelectChain();
                case 4:
                    return createDistanceSelectChain(5000);
                default:
                    throw new Error(`Unexpected select call #${selectCallCount}`);
            }
        },
    };

    const caller = await createLogisticsCaller(db);
    const logisticsNamespace = (caller as Record<string, any>).logistics;

    const result = await logisticsNamespace.calculateFreight({
        farmId: '22222222-2222-4222-8222-222222222222',
        addressId: '11111111-1111-4111-8111-111111111111',
        subtotal: 140,
    });

    assert.deepEqual(result, {
        freightCost: 0,
        baseFreightCost: 18,
        distanceKm: 5,
        minOrderValue: 50,
        freeShippingThreshold: 120,
        hasReachedMinimumOrder: true,
        remainingForMinimumOrder: 0,
        hasReachedFreeShipping: true,
        remainingForFreeShipping: 0,
    });
});

test('logistics.calculateFreight reports remaining amounts when order is below thresholds', async () => {
    let selectCallCount = 0;

    const db = {
        select() {
            selectCallCount += 1;

            switch (selectCallCount) {
                case 1:
                    return createTenantSelectChain('BUYER');
                case 2:
                    return createAddressSelectChain();
                case 3:
                    return createFarmSelectChain();
                case 4:
                    return createDistanceSelectChain(5000);
                default:
                    throw new Error(`Unexpected select call #${selectCallCount}`);
            }
        },
    };

    const caller = await createLogisticsCaller(db);
    const logisticsNamespace = (caller as Record<string, any>).logistics;

    const result = await logisticsNamespace.calculateFreight({
        farmId: '22222222-2222-4222-8222-222222222222',
        addressId: '11111111-1111-4111-8111-111111111111',
        subtotal: 30,
    });

    assert.deepEqual(result, {
        freightCost: 18,
        baseFreightCost: 18,
        distanceKm: 5,
        minOrderValue: 50,
        freeShippingThreshold: 120,
        hasReachedMinimumOrder: false,
        remainingForMinimumOrder: 20,
        hasReachedFreeShipping: false,
        remainingForFreeShipping: 90,
    });
});
