import assert from "node:assert/strict";
import test from "node:test";

import { resolveEffectiveDeliveryRadiusKm } from "./routers/logistics";

test("resolveEffectiveDeliveryRadiusKm keeps explicit farm coverage when configured", () => {
  assert.equal(resolveEffectiveDeliveryRadiusKm("42.5"), 42.5);
});

// No radius means no delivery (the quote is refused), never "anywhere".
test("resolveEffectiveDeliveryRadiusKm treats a missing radius as no coverage", () => {
  assert.equal(resolveEffectiveDeliveryRadiusKm("0"), 0);
  assert.equal(resolveEffectiveDeliveryRadiusKm(null), 0);
  assert.equal(resolveEffectiveDeliveryRadiusKm("-10"), 0);
});
