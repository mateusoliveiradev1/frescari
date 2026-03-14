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

export function normalizeSaleUnit(saleUnit?: string | null) {
    return saleUnit?.trim().toLowerCase() ?? "";
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
