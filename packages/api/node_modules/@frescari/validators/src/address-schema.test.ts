import assert from 'node:assert/strict';
import test from 'node:test';

import { createAddressSchema, updateAddressSchema } from './index';

test('createAddressSchema normalizes zipcode casing and blank optional fields', () => {
    const parsed = createAddressSchema.parse({
        title: ' Principal ',
        zipcode: '15820031',
        street: ' Rua Marechal Deodoro ',
        number: ' 923 ',
        neighborhood: '   ',
        city: ' Pirangi ',
        state: 'sp',
        country: 'br',
        complement: '   ',
    });

    assert.equal(parsed.title, 'Principal');
    assert.equal(parsed.zipcode, '15820-031');
    assert.equal(parsed.street, 'Rua Marechal Deodoro');
    assert.equal(parsed.number, '923');
    assert.equal(parsed.city, 'Pirangi');
    assert.equal(parsed.state, 'SP');
    assert.equal(parsed.country, 'BR');
    assert.equal(parsed.neighborhood, undefined);
    assert.equal(parsed.complement, undefined);
});

test('updateAddressSchema accepts partial updates and normalizes address fields', () => {
    const parsed = updateAddressSchema.parse({
        id: '9b8b9c7d-8fb2-4b3f-8d0a-5af8e4d4d7ad',
        zipcode: '15820031',
        state: 'sp',
        neighborhood: '   ',
        complement: ' Sala 2 ',
    });

    assert.equal(parsed.id, '9b8b9c7d-8fb2-4b3f-8d0a-5af8e4d4d7ad');
    assert.equal(parsed.zipcode, '15820-031');
    assert.equal(parsed.state, 'SP');
    assert.equal(parsed.neighborhood, null);
    assert.equal(parsed.complement, 'Sala 2');
});
