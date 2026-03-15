import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRlsMockDb } from './test-db';

type FarmRecord = {
    id: string;
    tenantId: string;
    name: string;
    address: Record<string, unknown> | null;
    location: [number, number] | null;
    pricePerKm?: string | number | null;
    maxDeliveryRadiusKm?: string | number | null;
    minOrderValue?: string | number | null;
    freeShippingThreshold?: string | number | null;
    createdAt: Date;
};

function createMockDb(existingFarm: FarmRecord | null = null) {
    const state = {
        farm: existingFarm,
        inserted: 0,
        updated: 0,
    };

    const db = withRlsMockDb({
        query: {
            farms: {
                findFirst: async () => state.farm,
            },
        },
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: async () => [{ id: 'tenant-1', type: 'PRODUCER' }],
                }),
            }),
        }),
        insert: () => ({
            values: (value: Record<string, unknown>) => ({
                returning: async () => {
                    state.inserted += 1;
                    state.farm = {
                        id: 'farm-created',
                        tenantId: String(value.tenantId),
                        name: String(value.name),
                        address: (value.address as Record<string, unknown> | null) ?? null,
                        location: (value.location as [number, number] | null) ?? null,
                        pricePerKm: (value.pricePerKm as string | number | null) ?? null,
                        maxDeliveryRadiusKm:
                            (value.maxDeliveryRadiusKm as string | number | null) ?? null,
                        minOrderValue:
                            (value.minOrderValue as string | number | null) ?? null,
                        freeShippingThreshold:
                            (value.freeShippingThreshold as string | number | null) ?? null,
                        createdAt: new Date('2026-03-12T00:00:00.000Z'),
                    };
                    return [state.farm];
                },
            }),
        }),
        update: () => ({
            set: (value: Record<string, unknown>) => ({
                where: () => ({
                    returning: async () => {
                        state.updated += 1;
                        state.farm = {
                            ...(state.farm as FarmRecord),
                            ...value,
                        };
                        return [state.farm];
                    },
                }),
            }),
        }),
    });

    return { db, state };
}

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

async function createFarmCaller(db: unknown) {
    const [{ createTRPCRouter }, { farmRouter }] = await Promise.all([
        import('./trpc'),
        import('./routers/farm'),
    ]);

    const testRouter = createTRPCRouter({ farm: farmRouter });
    return testRouter.createCaller(createProducerContext(db as never));
}

test('farm router returns the current tenant farm with normalized latitude/longitude', async () => {
    const { db } = createMockDb({
        id: 'farm-1',
        tenantId: 'tenant-1',
        name: 'Sitio Vista Alegre',
        address: {
            street: 'Estrada da Serra',
            number: '45',
            city: 'Piedade',
            state: 'SP',
            postalCode: '18170-000',
        },
        location: [-47.4251, -23.7112],
        pricePerKm: '3.50',
        maxDeliveryRadiusKm: '18',
        minOrderValue: '45.00',
        freeShippingThreshold: '120.00',
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
    });

    const caller = await createFarmCaller(db);
    const farmNamespace = (caller as Record<string, any>).farm;

    assert.ok(farmNamespace, 'farm router should be registered');
    assert.ok(farmNamespace.getCurrent, 'farm.getCurrent should be exposed');

    const result = await farmNamespace.getCurrent();

    assert.equal(result?.id, 'farm-1');
    assert.deepEqual(result?.location, {
        latitude: -23.7112,
        longitude: -47.4251,
    });
    assert.equal(result?.pricePerKm, 3.5);
    assert.equal(result?.deliveryRadiusKm, 18);
    assert.equal(result?.minOrderValue, 45);
    assert.equal(result?.freeShippingThreshold, 120);
});

test('farm router saveLocation upserts coordinates for the logged tenant', async () => {
    const { db, state } = createMockDb(null);
    const caller = await createFarmCaller(db);
    const farmNamespace = (caller as Record<string, any>).farm;

    assert.ok(farmNamespace, 'farm router should be registered');
    assert.ok(farmNamespace.saveLocation, 'farm.saveLocation should be exposed');

    const result = await farmNamespace.saveLocation({
        name: 'Fazenda Mapa Central',
        address: {
            street: 'Rodovia SP-250',
            number: 'Km 89',
            neighborhood: 'Bairro dos Oliveiras',
            city: 'Piedade',
            state: 'SP',
            postalCode: '18170-000',
            country: 'BR',
        },
        location: {
            latitude: -23.7144,
            longitude: -47.4258,
        },
        deliveryRadiusKm: 25,
        pricePerKm: 3.75,
        minOrderValue: 60,
        freeShippingThreshold: 150,
    });

    assert.equal(state.inserted, 1);
    assert.equal(state.updated, 0);
    assert.equal(result.name, 'Fazenda Mapa Central');
    assert.deepEqual(result.location, {
        latitude: -23.7144,
        longitude: -47.4258,
    });
    assert.equal(result.deliveryRadiusKm, 25);
    assert.equal(result.pricePerKm, 3.75);
    assert.equal(result.minOrderValue, 60);
    assert.equal(result.freeShippingThreshold, 150);
    assert.equal(state.farm?.maxDeliveryRadiusKm, '25');
    assert.equal(state.farm?.pricePerKm, '3.75');
    assert.equal(state.farm?.minOrderValue, '60.00');
    assert.equal(state.farm?.freeShippingThreshold, '150.00');
});
