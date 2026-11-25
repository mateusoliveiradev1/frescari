import assert from "node:assert/strict";
import test from "node:test";

import {
  isWeighableSaleUnit,
  normalizeSaleUnit,
  resolveEffectiveSaleUnit,
} from "./sale-units";

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

test("resolveEffectiveSaleUnit sells each lot by its own unit", () => {
  assert.equal(resolveEffectiveSaleUnit("unit", "kg"), "kg");
  assert.equal(resolveEffectiveSaleUnit("", "cx"), "box");
  assert.equal(resolveEffectiveSaleUnit(null, "maco"), "bunch");
  assert.equal(resolveEffectiveSaleUnit("unit", "un"), "unit");
  // Same product, lots in different units: each keeps its own.
  assert.equal(resolveEffectiveSaleUnit("kg", "cx"), "box");
  assert.equal(resolveEffectiveSaleUnit("box", "kg"), "kg");
  assert.equal(resolveEffectiveSaleUnit("kg", "un"), "unit");
});

test("resolveEffectiveSaleUnit falls back to the product when the lot unit is unusable", () => {
  assert.equal(resolveEffectiveSaleUnit("kg", ""), "kg");
  assert.equal(resolveEffectiveSaleUnit("box", null), "box");
  assert.equal(resolveEffectiveSaleUnit(null, "saco"), "unit");
});
