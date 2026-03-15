export function normalizeSaleUnit(saleUnit?: string | null) {
    return saleUnit?.trim().toLowerCase() ?? "";
}

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
