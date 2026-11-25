export type SupportedSaleUnit = "kg" | "g" | "unit" | "box" | "dozen" | "bunch";

export function normalizeSaleUnit(saleUnit?: string | null) {
  return saleUnit?.trim().toLowerCase() ?? "";
}

const LOT_UNIT_TO_SALE_UNIT: Record<string, SupportedSaleUnit> = {
  kg: "kg",
  g: "g",
  unit: "unit",
  un: "unit",
  box: "box",
  cx: "box",
  dozen: "dozen",
  dz: "dozen",
  bunch: "bunch",
  maco: "bunch",
  "ma\u00E7o": "bunch",
};

function toSupportedSaleUnit(value: string): SupportedSaleUnit | null {
  if (
    value === "kg" ||
    value === "g" ||
    value === "unit" ||
    value === "box" ||
    value === "dozen" ||
    value === "bunch"
  ) {
    return value;
  }

  return null;
}

// The lot's unit decides how it is sold: the producer picks it per lot, and
// one product (e.g. "Tomate") can have a lot by kg and another by box. The
// product's sale unit is only a fallback for a lot with no usable unit; it
// used to win, so a box lot of a product first created by kg was sold (and
// weighed, with manual capture) by kg.
export function resolveEffectiveSaleUnit(
  saleUnit?: string | null,
  unit?: string | null,
): SupportedSaleUnit {
  const derivedSaleUnit = LOT_UNIT_TO_SALE_UNIT[normalizeSaleUnit(unit)];

  if (derivedSaleUnit) {
    return derivedSaleUnit;
  }

  return toSupportedSaleUnit(normalizeSaleUnit(saleUnit)) ?? "unit";
}

export function isWeighableSaleUnit(saleUnit?: string | null) {
  const normalizedSaleUnit = normalizeSaleUnit(saleUnit);
  return normalizedSaleUnit === "kg" || normalizedSaleUnit === "g";
}
