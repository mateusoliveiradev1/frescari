import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    formatCurrencyBRL,
    formatDistanceKm,
    formatMass,
    formatQuantity,
} from '../src/lib/formatters';

test('formatCurrencyBRL formats numbers and locale-aware strings in pt-BR', () => {
    assert.equal(formatCurrencyBRL(12.5), 'R$ 12,50');
    assert.equal(formatCurrencyBRL('1.234,56'), 'R$ 1.234,56');
});

test('formatQuantity preserves readable decimals without forcing trailing zeros', () => {
    assert.equal(formatQuantity(10), '10');
    assert.equal(formatQuantity('10,25'), '10,25');
});

test('formatMass appends units and handles invalid inputs with fallback', () => {
    assert.equal(formatMass('2,5', 'kg'), '2,5 kg');
    assert.equal(formatMass(750, 'g'), '750 g');
    assert.equal(formatMass(null), '--');
});

test('formatDistanceKm keeps fixed precision and resilient fallback', () => {
    assert.equal(formatDistanceKm('12,345'), '12,35 km');
    assert.equal(formatDistanceKm(undefined), 'distância indisponível');
});
