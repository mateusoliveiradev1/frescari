export type SupportedSaleUnit = "kg" | "g" | "unit" | "box" | "dozen" | "bunch";

const SALE_UNIT_LABELS: Record<string, string> = {
    kg: "kg",
    g: "g",
    unit: "un",
    un: "un",
    box: "cx",
    cx: "cx",
    dozen: "dz",
    dz: "dz",
    bunch: "m\u00E7",
};

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

export function normalizeSaleUnit(saleUnit?: string | null) {
    return saleUnit?.trim().toLowerCase() ?? "";
}

export function resolveEffectiveSaleUnit(
    saleUnit?: string | null,
    unit?: string | null,
): SupportedSaleUnit {
    const normalizedSaleUnit = normalizeSaleUnit(saleUnit);
    const supportedSaleUnit = toSupportedSaleUnit(normalizedSaleUnit);

    if (supportedSaleUnit && supportedSaleUnit !== "unit") {
        return supportedSaleUnit;
    }

    const normalizedUnit = normalizeSaleUnit(unit);
    const derivedSaleUnit = LOT_UNIT_TO_SALE_UNIT[normalizedUnit];

    if (derivedSaleUnit) {
        return derivedSaleUnit;
    }

    return supportedSaleUnit ?? "unit";
}

export function isWeighableSaleUnit(saleUnit?: string | null) {
    const normalizedSaleUnit = normalizeSaleUnit(saleUnit);
    return normalizedSaleUnit === "kg" || normalizedSaleUnit === "g";
}

export function getSaleUnitLabel(saleUnit?: string | null) {
    const normalizedSaleUnit = normalizeSaleUnit(saleUnit);
    return SALE_UNIT_LABELS[normalizedSaleUnit] ?? (normalizedSaleUnit || "un");
}

export function getSaleUnitSuffix(saleUnit?: string | null) {
    return `/${getSaleUnitLabel(saleUnit)}`;
}
