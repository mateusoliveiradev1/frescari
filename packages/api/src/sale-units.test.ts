import assert from "node:assert/strict";
import test from "node:test";

import { isWeighableSaleUnit, normalizeSaleUnit } from "./sale-units";

test("isWeighableSaleUnit only accepts kg and g", () => {
    assert.equal(isWeighableSaleUnit("kg"), true);
    assert.equal(isWeighableSaleUnit("g"), true);
    assert.equal(isWeighableSaleUnit("unit"), false);
    assert.equal(isWeighableSaleUnit("box"), false);
    assert.equal(isWeighableSaleUnit("dozen"), false);
    assert.equal(isWeighableSaleUnit("bunch"), false);
});

test("normalizeSaleUnit trims and lowercases values", () => {
    assert.equal(normalizeSaleUnit(" KG "), "kg");
    assert.equal(normalizeSaleUnit(" Box "), "box");
    assert.equal(normalizeSaleUnit(null), "");
});
