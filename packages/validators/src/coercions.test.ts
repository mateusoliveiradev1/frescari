import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    coercedPositiveNumber,
    insertProductLotSchema,
    insertProductSchema,
    moneyFromLocale,
    trimmedString,
    updateLotInventorySchema,
} from './index';

test('trimmedString trims surrounding whitespace before validating', () => {
    const schema = trimmedString('Nome', 2);
    const result = schema.safeParse('  Fazenda Frescari  ');

    assert.equal(result.success, true);

    if (result.success) {
        assert.equal(result.data, 'Fazenda Frescari');
    }
});

test('moneyFromLocale parses comma decimals and rejects negative values', () => {
    const schema = moneyFromLocale('Preço');

    const valid = schema.safeParse(' 12,50 ');
    assert.equal(valid.success, true);

    if (valid.success) {
        assert.equal(valid.data, 12.5);
    }

    const invalid = schema.safeParse('-3,00');
    assert.equal(invalid.success, false);
});

test('coercedPositiveNumber accepts locale decimals and rejects zero', () => {
    const schema = coercedPositiveNumber('Quantidade');

    const valid = schema.safeParse('1,25');
    assert.equal(valid.success, true);

    if (valid.success) {
        assert.equal(valid.data, 1.25);
    }

    const invalid = schema.safeParse('0');
    assert.equal(invalid.success, false);
});

test('product stock and price schemas coerce locale-aware numeric strings', () => {
    const productResult = insertProductSchema
        .pick({
            pricePerUnit: true,
            minOrderQty: true,
        })
        .safeParse({
            pricePerUnit: '19,90',
            minOrderQty: '1,5',
        });

    assert.equal(productResult.success, true);

    if (productResult.success) {
        assert.deepEqual(productResult.data, {
            pricePerUnit: 19.9,
            minOrderQty: 1.5,
        });
    }

    const lotResult = insertProductLotSchema
        .pick({
            availableQty: true,
            priceOverride: true,
        })
        .safeParse({
            availableQty: '42,75',
            priceOverride: '8,30',
        });

    assert.equal(lotResult.success, true);

    if (lotResult.success) {
        assert.deepEqual(lotResult.data, {
            availableQty: 42.75,
            priceOverride: 8.3,
        });
    }
});

test('updateLotInventorySchema keeps positive coercion at the API boundary', () => {
    const result = updateLotInventorySchema.safeParse({
        lotId: '550e8400-e29b-41d4-a716-446655440000',
        newAvailableQty: '10,5',
    });

    assert.equal(result.success, true);

    if (result.success) {
        assert.equal(result.data.newAvailableQty, 10.5);
    }
});
