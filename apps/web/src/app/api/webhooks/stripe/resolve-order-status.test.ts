import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAuthorizedOrderStatus } from './resolve-order-status';

test('resolveAuthorizedOrderStatus keeps orders that are already ahead in the fulfillment flow', () => {
    assert.equal(resolveAuthorizedOrderStatus('awaiting_weight'), 'awaiting_weight');
    assert.equal(resolveAuthorizedOrderStatus('confirmed'), 'confirmed');
    assert.equal(resolveAuthorizedOrderStatus('picking'), 'picking');
    assert.equal(resolveAuthorizedOrderStatus('in_transit'), 'in_transit');
    assert.equal(resolveAuthorizedOrderStatus('delivered'), 'delivered');
    assert.equal(resolveAuthorizedOrderStatus('cancelled'), 'cancelled');
});

test('resolveAuthorizedOrderStatus only falls back to payment_authorized for earlier states', () => {
    assert.equal(resolveAuthorizedOrderStatus('draft'), 'payment_authorized');
    assert.equal(resolveAuthorizedOrderStatus('payment_authorized'), 'payment_authorized');
});
