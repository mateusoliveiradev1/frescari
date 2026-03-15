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

const LOT_UNIT_TO_SALE_UNIT: Record<string, string> = {
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

export function normalizeSaleUnit(saleUnit?: string | null) {
    return saleUnit?.trim().toLowerCase() ?? "";
}

export function resolveEffectiveSaleUnit(
    saleUnit?: string | null,
    unit?: string | null,
) {
    const normalizedSaleUnit = normalizeSaleUnit(saleUnit);

    if (normalizedSaleUnit && normalizedSaleUnit !== "unit" && normalizedSaleUnit !== "un") {
        return normalizedSaleUnit;
    }

    const normalizedUnit = normalizeSaleUnit(unit);
    const derivedSaleUnit = LOT_UNIT_TO_SALE_UNIT[normalizedUnit];

    if (derivedSaleUnit) {
        return derivedSaleUnit;
    }

    return normalizedSaleUnit || "unit";
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
