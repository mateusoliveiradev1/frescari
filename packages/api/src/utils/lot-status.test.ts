import assert from "node:assert/strict";
import test from "node:test";

import { calculateLotPriceAndStatus } from "./lot-status";

test("marks an expired lot as blocked", () => {
  const result = calculateLotPriceAndStatus(
    { expiryDate: "2026-03-13" },
    25,
    new Date(2026, 2, 14, 10, 0, 0, 0),
  );

  assert.equal(result.status, "vencido");
  assert.equal(result.isExpired, true);
  assert.equal(result.isLastChance, false);
  assert.equal(result.originalPrice, 25);
  assert.equal(result.finalPrice, 25);
});

test("applies the expiring-lot discount inside the 24 hour window", () => {
  const result = calculateLotPriceAndStatus(
    { expiryDate: "2026-03-14" },
    20,
    new Date(2026, 2, 14, 12, 0, 0, 0),
  );

  assert.equal(result.status, "last_chance");
  assert.equal(result.isExpired, false);
  assert.equal(result.isLastChance, true);
  assert.equal(result.originalPrice, 20);
  assert.equal(result.finalPrice, 12);
});

test("respects a manual price override without stacking the discount", () => {
  const result = calculateLotPriceAndStatus(
    { expiryDate: "2026-03-14", priceOverride: 12 },
    20,
    new Date(2026, 2, 14, 12, 0, 0, 0),
  );

  assert.equal(result.status, "last_chance");
  assert.equal(result.isExpired, false);
  assert.equal(result.isLastChance, true);
  assert.equal(result.originalPrice, 12);
  assert.equal(result.finalPrice, 12);
});

test("keeps the base price for a normal lot outside the urgency window", () => {
  const result = calculateLotPriceAndStatus(
    { expiryDate: "2026-03-16" },
    18.5,
    new Date(2026, 2, 14, 10, 0, 0, 0),
  );

  assert.equal(result.status, "fresco");
  assert.equal(result.isExpired, false);
  assert.equal(result.isLastChance, false);
  assert.equal(result.originalPrice, 18.5);
  assert.equal(result.finalPrice, 18.5);
});
