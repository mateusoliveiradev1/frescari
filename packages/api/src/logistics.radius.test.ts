import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEffectiveDeliveryRadiusKm } from './routers/logistics';

test('resolveEffectiveDeliveryRadiusKm keeps explicit farm coverage when configured', () => {
    assert.equal(resolveEffectiveDeliveryRadiusKm('42.5'), 42.5);
});

test('resolveEffectiveDeliveryRadiusKm falls back to generous MVP coverage when farm radius is missing', () => {
    assert.equal(resolveEffectiveDeliveryRadiusKm('0'), 5000);
    assert.equal(resolveEffectiveDeliveryRadiusKm(null), 5000);
    assert.equal(resolveEffectiveDeliveryRadiusKm('-10'), 5000);
});
