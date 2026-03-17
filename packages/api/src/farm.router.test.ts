import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRlsMockDb } from './test-db';
import { farmVehicles, tenants } from '@frescari/db';

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

type VehicleRecord = {
    id: string;
    tenantId: string;
    farmId: string;
    label: string;
    vehicleType:
        | 'motorcycle'
        | 'car'
        | 'pickup'
        | 'van'
        | 'refrigerated_van'
        | 'truck'
        | 'refrigerated_truck';
    capacityKg: string | number;
    refrigeration: boolean;
    availabilityStatus: 'available' | 'in_use' | 'maintenance' | 'offline';
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
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

function createFleetMockDb(
    existingFarm: FarmRecord | null,
    initialVehicles: VehicleRecord[] = [],
) {
    const state = {
        farm: existingFarm,
        vehicles: [...initialVehicles],
        insertedVehicles: 0,
        updatedVehicles: 0,
        deletedVehicles: 0,
    };

    const db = withRlsMockDb({
        query: {
            farms: {
                findFirst: async () => state.farm,
            },
            farmVehicles: {
                findMany: async () =>
                    [...state.vehicles].sort((left, right) =>
                        left.label.localeCompare(right.label),
                    ),
            },
            deliveryDispatchWaves: {
                findFirst: async () => null,
            },
        },
        select: () => ({
            from(table: unknown) {
                if (table !== tenants) {
                    throw new Error('Unexpected select table in farm router test.');
                }

                return {
                    where() {
                        return {
                            limit: async () => [{ id: 'tenant-1', type: 'PRODUCER' }],
                        };
                    },
                };
            },
        }),
        insert: (table: unknown) => {
            if (table !== farmVehicles) {
                throw new Error('Unexpected insert table in farm router test.');
            }

            return {
                values: (value: Record<string, unknown>) => ({
                    returning: async () => {
                        state.insertedVehicles += 1;

                        const createdVehicle: VehicleRecord = {
                            id: `vehicle-created-${state.insertedVehicles}`,
                            tenantId: String(value.tenantId),
                            farmId: String(value.farmId),
                            label: String(value.label),
                            vehicleType: value.vehicleType as VehicleRecord['vehicleType'],
                            capacityKg: value.capacityKg as string | number,
                            refrigeration: Boolean(value.refrigeration),
                            availabilityStatus:
                                value.availabilityStatus as VehicleRecord['availabilityStatus'],
                            notes: (value.notes as string | null | undefined) ?? null,
                            createdAt: new Date('2026-03-13T00:00:00.000Z'),
                            updatedAt: new Date('2026-03-13T00:00:00.000Z'),
                        };

                        state.vehicles.push(createdVehicle);

                        return [createdVehicle];
                    },
                }),
            };
        },
        update: (table: unknown) => {
            if (table !== farmVehicles) {
                throw new Error('Unexpected update table in farm router test.');
            }

            return {
                set: (value: Record<string, unknown>) => ({
                    where: () => ({
                        returning: async () => {
                            const currentVehicle = state.vehicles[0];

                            if (!currentVehicle) {
                                return [];
                            }

                            state.updatedVehicles += 1;

                            const updatedVehicle: VehicleRecord = {
                                ...currentVehicle,
                                label: String(value.label ?? currentVehicle.label),
                                vehicleType:
                                    (value.vehicleType as VehicleRecord['vehicleType'] | undefined)
                                    ?? currentVehicle.vehicleType,
                                capacityKg:
                                    (value.capacityKg as string | number | undefined)
                                    ?? currentVehicle.capacityKg,
                                refrigeration:
                                    (value.refrigeration as boolean | undefined)
                                    ?? currentVehicle.refrigeration,
                                availabilityStatus:
                                    (value.availabilityStatus as VehicleRecord['availabilityStatus'] | undefined)
                                    ?? currentVehicle.availabilityStatus,
                                notes:
                                    (value.notes as string | null | undefined)
                                    ?? currentVehicle.notes,
                                updatedAt: new Date('2026-03-14T00:00:00.000Z'),
                            };

                            state.vehicles[0] = updatedVehicle;

                            return [updatedVehicle];
                        },
                    }),
                }),
            };
        },
        delete: (table: unknown) => {
            if (table !== farmVehicles) {
                throw new Error('Unexpected delete table in farm router test.');
            }

            return {
                where: () => ({
                    returning: async () => {
                        const [deletedVehicle] = state.vehicles.splice(0, 1);

                        if (!deletedVehicle) {
                            return [];
                        }

                        state.deletedVehicles += 1;

                        return [{ id: deletedVehicle.id }];
                    },
                }),
            };
        },
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

test('farm router lists fleet vehicles with normalized capacities', async () => {
    const { db } = createFleetMockDb(
        {
            id: 'farm-1',
            tenantId: 'tenant-1',
            name: 'Sitio Vista Alegre',
            address: null,
            location: [-47.4251, -23.7112],
            createdAt: new Date('2026-03-12T00:00:00.000Z'),
        },
        [
            {
                id: '22222222-2222-4222-8222-222222222222',
                tenantId: 'tenant-1',
                farmId: 'farm-1',
                label: 'Van Refrigerada',
                vehicleType: 'refrigerated_van',
                capacityKg: '850.000',
                refrigeration: true,
                availabilityStatus: 'available',
                notes: 'Carga perecivel',
                createdAt: new Date('2026-03-13T00:00:00.000Z'),
                updatedAt: new Date('2026-03-13T00:00:00.000Z'),
            },
            {
                id: '11111111-1111-4111-8111-111111111111',
                tenantId: 'tenant-1',
                farmId: 'farm-1',
                label: 'Moto Expressa',
                vehicleType: 'motorcycle',
                capacityKg: '35.500',
                refrigeration: false,
                availabilityStatus: 'available',
                notes: null,
                createdAt: new Date('2026-03-13T00:00:00.000Z'),
                updatedAt: new Date('2026-03-13T00:00:00.000Z'),
            },
        ],
    );

    const caller = await createFarmCaller(db);
    const farmNamespace = (caller as Record<string, any>).farm;
    const result = await farmNamespace.listVehicles();

    assert.equal(result.length, 2);
    assert.equal(result[0].label, 'Moto Expressa');
    assert.equal(result[0].capacityKg, 35.5);
    assert.equal(result[1].label, 'Van Refrigerada');
    assert.equal(result[1].capacityKg, 850);
});

test('farm router upsertVehicle creates fleet entries bound to the current farm', async () => {
    const { db, state } = createFleetMockDb({
        id: 'farm-1',
        tenantId: 'tenant-1',
        name: 'Sitio Vista Alegre',
        address: null,
        location: [-47.4251, -23.7112],
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
    });

    const caller = await createFarmCaller(db);
    const farmNamespace = (caller as Record<string, any>).farm;
    const result = await farmNamespace.upsertVehicle({
        label: 'Pickup Principal',
        vehicleType: 'pickup',
        capacityKg: 620,
        refrigeration: false,
        availabilityStatus: 'available',
        notes: 'Saidas urbanas',
    });

    assert.equal(state.insertedVehicles, 1);
    assert.equal(result.label, 'Pickup Principal');
    assert.equal(result.farmId, 'farm-1');
    assert.equal(result.capacityKg, 620);
    assert.equal(state.vehicles[0]?.capacityKg, '620.000');
});

test('farm router upsertVehicle updates an existing fleet record', async () => {
    const { db, state } = createFleetMockDb(
        {
            id: 'farm-1',
            tenantId: 'tenant-1',
            name: 'Sitio Vista Alegre',
            address: null,
            location: [-47.4251, -23.7112],
            createdAt: new Date('2026-03-12T00:00:00.000Z'),
        },
        [
            {
                id: '11111111-1111-4111-8111-111111111111',
                tenantId: 'tenant-1',
                farmId: 'farm-1',
                label: 'Van Antiga',
                vehicleType: 'van',
                capacityKg: '700.000',
                refrigeration: false,
                availabilityStatus: 'maintenance',
                notes: null,
                createdAt: new Date('2026-03-13T00:00:00.000Z'),
                updatedAt: new Date('2026-03-13T00:00:00.000Z'),
            },
        ],
    );

    const caller = await createFarmCaller(db);
    const farmNamespace = (caller as Record<string, any>).farm;
    const result = await farmNamespace.upsertVehicle({
        vehicleId: '11111111-1111-4111-8111-111111111111',
        label: 'Van Revisada',
        vehicleType: 'refrigerated_van',
        capacityKg: 780,
        refrigeration: true,
        availabilityStatus: 'available',
        notes: 'Pronta para pereciveis',
    });

    assert.equal(state.updatedVehicles, 1);
    assert.equal(result.id, '11111111-1111-4111-8111-111111111111');
    assert.equal(result.label, 'Van Revisada');
    assert.equal(result.vehicleType, 'refrigerated_van');
    assert.equal(result.capacityKg, 780);
    assert.equal(result.refrigeration, true);
});

test('farm router deleteVehicle removes a fleet record from the tenant catalog', async () => {
    const { db, state } = createFleetMockDb(
        {
            id: 'farm-1',
            tenantId: 'tenant-1',
            name: 'Sitio Vista Alegre',
            address: null,
            location: [-47.4251, -23.7112],
            createdAt: new Date('2026-03-12T00:00:00.000Z'),
        },
        [
            {
                id: '11111111-1111-4111-8111-111111111111',
                tenantId: 'tenant-1',
                farmId: 'farm-1',
                label: 'Caminhao Leve',
                vehicleType: 'truck',
                capacityKg: '1500.000',
                refrigeration: false,
                availabilityStatus: 'offline',
                notes: null,
                createdAt: new Date('2026-03-13T00:00:00.000Z'),
                updatedAt: new Date('2026-03-13T00:00:00.000Z'),
            },
        ],
    );

    const caller = await createFarmCaller(db);
    const farmNamespace = (caller as Record<string, any>).farm;
    const result = await farmNamespace.deleteVehicle({
        vehicleId: '11111111-1111-4111-8111-111111111111',
    });

    assert.deepEqual(result, {
        success: true,
        vehicleId: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(state.deletedVehicles, 1);
    assert.equal(state.vehicles.length, 0);
});
