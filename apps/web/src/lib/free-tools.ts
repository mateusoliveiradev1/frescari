// Math behind the free tools (/ferramentas). Pure functions, so the pages and
// the tests share exactly the same numbers.

/**
 * "12,50", "12.5", "3.000", "R$ 1.234,56" -> number; empty or invalid -> null.
 * Read the Brazilian way: a comma is the decimal mark, and a dot followed by
 * groups of exactly three digits is a thousands separator ("3.000" = 3000).
 */
export function parseBrazilianNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  let normalized: string;
  if (cleaned.includes(",")) {
    // "1.234,56" -> "1234.56"; "12,5" -> "12.5".
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // "3.000", "1.250.000" -> thousands.
    normalized = cleaned.replace(/\./g, "");
  } else {
    // "12.5" -> decimal typed with a dot.
    normalized = cleaned;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const roundCents = (value: number) => Math.round(value * 100) / 100;

export type SellingPriceInput = {
  purchaseCost: number; // what you pay per kg / box / unit
  lossPercent: number; // what spoils or is trimmed before selling (quebra)
  extraCostPerUnit: number; // packaging, transport, labour per unit
  marginPercent: number; // share of the selling price you keep
};

export type SellingPriceResult = {
  effectiveCost: number; // cost of each unit that actually gets sold
  sellingPrice: number;
  profitPerUnit: number;
  markupPercent: number; // over the purchase cost
};

/**
 * Selling price that keeps the desired margin after the loss: if 10% spoils,
 * the 90% that sells has to pay for all of it. Margin is on the selling price
 * (what "margem" usually means at the till), not a markup on cost.
 */
export function calculateSellingPrice(
  input: SellingPriceInput,
): SellingPriceResult | null {
  const { purchaseCost, lossPercent, extraCostPerUnit, marginPercent } = input;
  if (
    !(purchaseCost > 0) ||
    lossPercent < 0 ||
    lossPercent >= 100 ||
    extraCostPerUnit < 0 ||
    marginPercent < 0 ||
    marginPercent >= 100
  ) {
    return null;
  }

  const effectiveCost =
    (purchaseCost + extraCostPerUnit) / (1 - lossPercent / 100);
  const sellingPrice = effectiveCost / (1 - marginPercent / 100);

  return {
    effectiveCost: roundCents(effectiveCost),
    sellingPrice: roundCents(sellingPrice),
    profitPerUnit: roundCents(sellingPrice - effectiveCost),
    markupPercent: Math.round((sellingPrice / purchaseCost - 1) * 1000) / 10,
  };
}

export type WasteInput = {
  weeklyPurchases: number; // R$ spent on produce per week
  lossPercent: number; // share thrown away today
  targetLossPercent: number; // share you aim for
};

export type WasteResult = {
  weeklyLoss: number;
  monthlyLoss: number;
  yearlyLoss: number;
  yearlySavingsAtTarget: number;
};

const WEEKS_PER_YEAR = 52;

export function simulateWaste(input: WasteInput): WasteResult | null {
  const { weeklyPurchases, lossPercent, targetLossPercent } = input;
  if (
    !(weeklyPurchases > 0) ||
    lossPercent < 0 ||
    lossPercent > 100 ||
    targetLossPercent < 0 ||
    targetLossPercent > 100
  ) {
    return null;
  }

  const weeklyLoss = (weeklyPurchases * lossPercent) / 100;
  const yearlyLoss = weeklyLoss * WEEKS_PER_YEAR;
  const yearlyAtTarget =
    ((weeklyPurchases * Math.min(targetLossPercent, lossPercent)) / 100) *
    WEEKS_PER_YEAR;

  return {
    weeklyLoss: roundCents(weeklyLoss),
    monthlyLoss: roundCents(yearlyLoss / 12),
    yearlyLoss: roundCents(yearlyLoss),
    yearlySavingsAtTarget: roundCents(yearlyLoss - yearlyAtTarget),
  };
}
