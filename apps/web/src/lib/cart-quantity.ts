import { isWeighableSaleUnit, resolveEffectiveSaleUnit } from "@/lib/sale-units";

export type QuantityRuleItem = {
    pricingType: 'UNIT' | 'WEIGHT' | 'BOX';
    saleUnit?: string | null;
    unit?: string | null;
    availableQty?: number;
};

export const roundQuantity = (value: number) => Math.round(value * 100) / 100;

export const isWeightBasedQuantityItem = (
    item: Pick<QuantityRuleItem, 'saleUnit' | 'unit'>
) => {
    return isWeighableSaleUnit(resolveEffectiveSaleUnit(item.saleUnit, item.unit));
};

export const getQuantityStep = (item: Pick<QuantityRuleItem, 'pricingType' | 'saleUnit' | 'unit'>) =>
    isWeightBasedQuantityItem(item) ? 0.5 : 1;

export const getQuantityMin = (item: Pick<QuantityRuleItem, 'pricingType' | 'saleUnit' | 'unit'>) =>
    isWeightBasedQuantityItem(item) ? 0.5 : 1;

export const getQuantityMinLabel = (item: Pick<QuantityRuleItem, 'pricingType' | 'saleUnit' | 'unit'>) =>
    isWeightBasedQuantityItem(item) ? '0,5' : '1';

export const getQuantityInputPattern = (item: Pick<QuantityRuleItem, 'pricingType' | 'saleUnit' | 'unit'>) =>
    isWeightBasedQuantityItem(item) ? /^\d*(?:[.,]?\d{0,2})?$/ : /^\d*$/;

export const formatQuantityInput = (
    item: Pick<QuantityRuleItem, 'pricingType' | 'saleUnit' | 'unit'>,
    value: number
) => {
    if (isWeightBasedQuantityItem(item)) {
        return String(roundQuantity(value)).replace('.', ',');
    }

    return String(Math.trunc(value));
};

export const getMaximumQuantity = (item: QuantityRuleItem) => {
    if (typeof item.availableQty !== 'number') {
        return Number.POSITIVE_INFINITY;
    }

    return isWeightBasedQuantityItem(item)
        ? roundQuantity(item.availableQty)
        : Math.floor(item.availableQty);
};

export const normalizeQuantity = (
    item: QuantityRuleItem,
    quantity: number,
    options: { clampMin?: boolean } = {}
) => {
    const { clampMin = true } = options;

    if (!Number.isFinite(quantity)) {
        return 0;
    }

    const minQuantity = getQuantityMin(item);
    const maximumQuantity = getMaximumQuantity(item);

    if (maximumQuantity < minQuantity) {
        return 0;
    }

    const normalizedQuantity = isWeightBasedQuantityItem(item)
        ? roundQuantity(quantity)
        : Math.trunc(quantity);

    if (normalizedQuantity <= 0) {
        return clampMin ? minQuantity : 0;
    }

    const clampedQuantity = Math.min(normalizedQuantity, maximumQuantity);

    if (clampedQuantity < minQuantity) {
        return clampMin ? minQuantity : 0;
    }

    return clampedQuantity;
};

export const getDefaultAddQuantity = (item: Pick<QuantityRuleItem, 'pricingType' | 'saleUnit' | 'unit'>) =>
    getQuantityStep(item);

export const getDefaultDetailsQuantity = (item: QuantityRuleItem) => {
    const maximumQuantity = getMaximumQuantity(item);

    if (maximumQuantity <= 0) {
        return 0;
    }

    return normalizeQuantity(item, Math.min(1, maximumQuantity));
};
