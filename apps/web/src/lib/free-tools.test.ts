import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSellingPrice,
  parseBrazilianNumber,
  simulateWaste,
} from "./free-tools";

test("Brazilian number input", () => {
  assert.equal(parseBrazilianNumber("12,50"), 12.5);
  assert.equal(parseBrazilianNumber("R$ 1.234,56"), 1234.56);
  assert.equal(parseBrazilianNumber("12.5"), 12.5);
  // A dot before exactly three digits is a thousands separator.
  assert.equal(parseBrazilianNumber("3.000"), 3000);
  assert.equal(parseBrazilianNumber("1.250.000"), 1250000);
  assert.equal(parseBrazilianNumber("0.40"), 0.4);
  assert.equal(parseBrazilianNumber(""), null);
  assert.equal(parseBrazilianNumber("abc"), null);
});

test("selling price pays for the loss and keeps the margin on the price", () => {
  // Tomato at R$ 5/kg, 10% loss, R$ 0,40 extra cost, 30% margin.
  const result = calculateSellingPrice({
    purchaseCost: 5,
    lossPercent: 10,
    extraCostPerUnit: 0.4,
    marginPercent: 30,
  });
  assert.ok(result);
  // (5 + 0.4) / 0.9 = 6.00 ; 6 / 0.7 = 8.571...
  assert.equal(result.effectiveCost, 6);
  assert.equal(result.sellingPrice, 8.57);
  assert.equal(result.profitPerUnit, 2.57);
  assert.equal(result.markupPercent, 71.4);
});

test("impossible inputs give no price instead of a wrong one", () => {
  const base = {
    purchaseCost: 5,
    lossPercent: 10,
    extraCostPerUnit: 0,
    marginPercent: 30,
  };
  assert.equal(calculateSellingPrice({ ...base, purchaseCost: 0 }), null);
  assert.equal(calculateSellingPrice({ ...base, lossPercent: 100 }), null);
  assert.equal(calculateSellingPrice({ ...base, marginPercent: 100 }), null);
  assert.equal(calculateSellingPrice({ ...base, extraCostPerUnit: -1 }), null);
});

test("waste simulator turns a loss rate into money per month and year", () => {
  // R$ 3.000 per week, 12% thrown away, target 5%.
  const result = simulateWaste({
    weeklyPurchases: 3000,
    lossPercent: 12,
    targetLossPercent: 5,
  });
  assert.ok(result);
  assert.equal(result.weeklyLoss, 360);
  assert.equal(result.yearlyLoss, 18720);
  assert.equal(result.monthlyLoss, 1560);
  // (12% - 5%) of 3000 * 52
  assert.equal(result.yearlySavingsAtTarget, 10920);
});

test("a target above today's loss saves nothing (never negative)", () => {
  const result = simulateWaste({
    weeklyPurchases: 1000,
    lossPercent: 5,
    targetLossPercent: 8,
  });
  assert.equal(result?.yearlySavingsAtTarget, 0);
  assert.equal(
    simulateWaste({ weeklyPurchases: 0, lossPercent: 5, targetLossPercent: 2 }),
    null,
  );
});
