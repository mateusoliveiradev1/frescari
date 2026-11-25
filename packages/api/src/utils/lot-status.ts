export type LotStatus = "fresco" | "last_chance" | "vencido";

const LAST_CHANCE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LAST_CHANCE_DISCOUNT_MULTIPLIER = 0.6;

type LotDateInput = string | Date;
type LotPriceInput = string | number | null | undefined;

type LotPricingInput = {
  expiryDate: LotDateInput;
  priceOverride?: LotPriceInput;
};

export type LotPriceAndStatus = {
  status: LotStatus;
  isExpired: boolean;
  isLastChance: boolean;
  originalPrice: number;
  finalPrice: number;
  expiryDate: Date;
};

const isDateOnlyString = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

// Lots expire at the end of the day in Brasília, whatever the server's
// timezone is (Vercel runs in UTC, which made lots expire at 21:00 BRT).
// Brazil has had no daylight saving since 2019, so the offset is fixed.
const BRASILIA_UTC_OFFSET_HOURS = 3;

export const brasiliaDayBoundary = (
  year: number,
  month: number,
  day: number,
  boundary: "start" | "end",
) => {
  const utcMidnight = Date.UTC(year, month - 1, day);
  const check = new Date(utcMidnight);

  if (
    Number.isNaN(utcMidnight) ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${year}-${month}-${day}`);
  }

  const startOfDay = utcMidnight + BRASILIA_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(
    boundary === "start" ? startOfDay : startOfDay + 24 * 60 * 60 * 1000 - 1,
  );
};

const parseLocalDateOnly = (value: string, endOfDay: boolean) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid local date string: ${value}`);
  }

  return brasiliaDayBoundary(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    endOfDay ? "end" : "start",
  );
};

const normalizeExpiryDate = (value: LotDateInput) => {
  if (typeof value === "string" && isDateOnlyString(value)) {
    return parseLocalDateOnly(value, true);
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid expiry date: ${String(value)}`);
  }

  // A date-only column read as a Date is midnight UTC of that calendar day.
  return brasiliaDayBoundary(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth() + 1,
    parsedDate.getUTCDate(),
    "end",
  );
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

const normalizePrice = (value: LotPriceInput) => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsedPrice = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedPrice)) {
    throw new Error(`Invalid price value: ${String(value)}`);
  }

  return parsedPrice;
};

export function calculateLotPriceAndStatus(
  lot: LotPricingInput,
  basePriceInput: LotPriceInput,
  referenceDate = new Date(),
): LotPriceAndStatus {
  const expiryDate = normalizeExpiryDate(lot.expiryDate);
  const overridePrice = normalizePrice(lot.priceOverride);
  const basePrice = normalizePrice(basePriceInput) ?? 0;
  const originalPrice = overridePrice ?? basePrice;
  const timeUntilExpiry = expiryDate.getTime() - referenceDate.getTime();
  const isExpired = timeUntilExpiry < 0;
  const isLastChance = !isExpired && timeUntilExpiry < LAST_CHANCE_WINDOW_MS;

  // The last-chance discount applies to the price the producer set for
  // the lot too (the inventory form always sets one). Rounded to cents:
  // Stripe charges whole cents, and the order total must match the charge.
  const finalPrice = roundToCents(
    isLastChance
      ? originalPrice * LAST_CHANCE_DISCOUNT_MULTIPLIER
      : originalPrice,
  );

  return {
    status: isExpired ? "vencido" : isLastChance ? "last_chance" : "fresco",
    isExpired,
    isLastChance,
    originalPrice,
    finalPrice,
    expiryDate,
  };
}
