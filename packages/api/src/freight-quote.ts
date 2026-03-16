import { TRPCError } from '@trpc/server';

const GENEROUS_MVP_DELIVERY_RADIUS_KM = 5000;

export type FreightQuote = {
    freightCost: number;
    baseFreightCost: number;
    distanceKm: number;
    minOrderValue: number;
    freeShippingThreshold: number | null;
    hasReachedMinimumOrder: boolean;
    remainingForMinimumOrder: number;
    hasReachedFreeShipping: boolean;
    remainingForFreeShipping: number | null;
};

export function resolveEffectiveDeliveryRadiusKm(rawRadiusKm: string | number | null | undefined) {
    const parsedRadiusKm =
        typeof rawRadiusKm === 'number' ? rawRadiusKm : Number(rawRadiusKm);

    if (!Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0) {
        return GENEROUS_MVP_DELIVERY_RADIUS_KM;
    }

    return parsedRadiusKm;
}

export function normalizeCurrencyValue(rawValue: string | number | null | undefined) {
    const parsedValue =
        typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);

    if (!Number.isFinite(parsedValue)) {
        return 0;
    }

    return Math.max(0, Number(parsedValue.toFixed(2)));
}

export function normalizeNullableCurrencyValue(rawValue: string | number | null | undefined) {
    if (rawValue === null || rawValue === undefined) {
        return null;
    }

    const parsedValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
        return null;
    }

    return Math.max(0, Number(parsedValue.toFixed(2)));
}

export function buildFreightQuote(input: {
    hasFarmLocation: boolean;
    hasAddressLocation: boolean;
    distanceMeters: number | null | undefined;
    baseDeliveryFee: string | number | null | undefined;
    pricePerKm: string | number | null | undefined;
    maxDeliveryRadiusKm: string | number | null | undefined;
    subtotal: string | number | null | undefined;
    minOrderValue: string | number | null | undefined;
    freeShippingThreshold: string | number | null | undefined;
}): FreightQuote {
    if (!input.hasFarmLocation || !input.hasAddressLocation) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
                'Nao foi possivel calcular o frete para esta combinacao de origem e destino.',
        });
    }

    const maxDeliveryRadiusKm = resolveEffectiveDeliveryRadiusKm(
        input.maxDeliveryRadiusKm,
    );

    if (!Number.isFinite(maxDeliveryRadiusKm) || maxDeliveryRadiusKm <= 0) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Esta fazenda ainda nao possui cobertura de entrega configurada.',
        });
    }

    const rawDistanceKm = Math.max(0, Number(input.distanceMeters ?? 0)) / 1000;
    const distanceKm = Number(rawDistanceKm.toFixed(2));

    if (rawDistanceKm > maxDeliveryRadiusKm) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Endereco fora da area de cobertura desta fazenda.',
        });
    }

    const baseDeliveryFee = normalizeCurrencyValue(input.baseDeliveryFee);
    const pricePerKm = normalizeCurrencyValue(input.pricePerKm);
    const subtotal = normalizeCurrencyValue(input.subtotal);
    const minOrderValue = normalizeCurrencyValue(input.minOrderValue);
    const freeShippingThreshold = normalizeNullableCurrencyValue(
        input.freeShippingThreshold,
    );
    const hasReachedMinimumOrder = subtotal >= minOrderValue;
    const remainingForMinimumOrder = Number(
        Math.max(0, minOrderValue - subtotal).toFixed(2),
    );
    const baseFreightCost = Number(
        (baseDeliveryFee + (distanceKm * pricePerKm)).toFixed(2),
    );
    const hasReachedFreeShipping =
        freeShippingThreshold !== null && subtotal >= freeShippingThreshold;
    const remainingForFreeShipping =
        freeShippingThreshold !== null
            ? Number(Math.max(0, freeShippingThreshold - subtotal).toFixed(2))
            : null;
    const freightCost = hasReachedFreeShipping ? 0 : baseFreightCost;

    return {
        freightCost,
        baseFreightCost,
        distanceKm,
        minOrderValue,
        freeShippingThreshold,
        hasReachedMinimumOrder,
        remainingForMinimumOrder,
        hasReachedFreeShipping,
        remainingForFreeShipping,
    };
}
