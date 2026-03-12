import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as validators from './index';

const validFarmPayload = {
    name: 'Fazenda Boa Esperanca',
    address: {
        street: 'Estrada Municipal',
        number: '100',
        neighborhood: 'Zona Rural',
        city: 'Ibiuna',
        state: 'SP',
        postalCode: '18150-000',
        country: 'BR',
        complement: 'Galpao 2',
    },
    location: {
        latitude: -23.6567,
        longitude: -47.2223,
    },
};

test('upsertFarmInputSchema accepts a valid structured farm payload', () => {
    const schema = (validators as Record<string, any>).upsertFarmInputSchema;

    assert.ok(schema, 'upsertFarmInputSchema should be exported');

    const result = schema.safeParse(validFarmPayload);
    assert.equal(result.success, true);

    if (result.success) {
        assert.equal(result.data.location.latitude, validFarmPayload.location.latitude);
        assert.equal(result.data.address.city, validFarmPayload.address.city);
    }
});

test('saveFarmLocationInputSchema rejects invalid coordinates and malformed address data', () => {
    const schema = (validators as Record<string, any>).saveFarmLocationInputSchema;

    assert.ok(schema, 'saveFarmLocationInputSchema should be exported');

    const result = schema.safeParse({
        name: '',
        address: {
            street: '',
            number: '',
            city: '',
            state: 'Sao Paulo',
            postalCode: 'abc',
        },
        location: {
            latitude: -120,
            longitude: 240,
        },
    });

    assert.equal(result.success, false);

    if (!result.success) {
        const issuePaths = result.error.issues.map((issue: { path: Array<string | number> }) => issue.path.join('.'));
        assert.ok(issuePaths.includes('name'));
        assert.ok(issuePaths.includes('address.street'));
        assert.ok(issuePaths.includes('address.city'));
        assert.ok(issuePaths.includes('location.latitude'));
        assert.ok(issuePaths.includes('location.longitude'));
    }
});
