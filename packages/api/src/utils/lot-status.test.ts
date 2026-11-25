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

test("applies the last-chance discount to the producer's lot price too", () => {
  const result = calculateLotPriceAndStatus(
    { expiryDate: "2026-03-14", priceOverride: 12 },
    20,
    new Date(2026, 2, 14, 12, 0, 0, 0),
  );

  assert.equal(result.status, "last_chance");
  assert.equal(result.isExpired, false);
  assert.equal(result.isLastChance, true);
  assert.equal(result.originalPrice, 12);
  assert.equal(result.finalPrice, 7.2);
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

test("a lot is valid until the end of its day in Brasilia, on any server timezone", () => {
  // 2026-11-25 21:30 BRT = 2026-11-26 00:30 UTC: a UTC server used to call
  // this lot expired from 21:00 BRT on.
  const lateEvening = calculateLotPriceAndStatus(
    { expiryDate: "2026-11-25" },
    10,
    new Date("2026-11-26T00:30:00Z"),
  );
  assert.equal(lateEvening.isExpired, false);
  assert.equal(
    lateEvening.expiryDate.toISOString(),
    "2026-11-26T02:59:59.999Z",
  );

  const nextMorning = calculateLotPriceAndStatus(
    { expiryDate: "2026-11-25" },
    10,
    new Date("2026-11-26T03:01:00Z"),
  );
  assert.equal(nextMorning.isExpired, true);

  const fromDateObject = calculateLotPriceAndStatus(
    { expiryDate: new Date("2026-11-25T00:00:00Z") },
    10,
    new Date("2026-11-26T00:30:00Z"),
  );
  assert.equal(fromDateObject.isExpired, false);
});

test("the discounted price is rounded to cents, as Stripe charges it", () => {
  const result = calculateLotPriceAndStatus(
    { expiryDate: "2026-11-25", priceOverride: 4.99 },
    0,
    new Date("2026-11-25T15:00:00Z"),
  );
  // 4.99 * 0.6 = 2.994
  assert.equal(result.finalPrice, 2.99);
});
