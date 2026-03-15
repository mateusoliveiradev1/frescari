export type LotStatus = 'fresco' | 'last_chance' | 'vencido';

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

const isDateOnlyString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

const parseLocalDateOnly = (value: string, endOfDay: boolean) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

    if (!match) {
        throw new Error(`Invalid local date string: ${value}`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsedDate = endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
    ) {
        throw new Error(`Invalid local date string: ${value}`);
    }

    return parsedDate;
};

const normalizeExpiryDate = (value: LotDateInput) => {
    if (typeof value === 'string' && isDateOnlyString(value)) {
        return parseLocalDateOnly(value, true);
    }

    const parsedDate = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
        throw new Error(`Invalid expiry date: ${String(value)}`);
    }

    return new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        parsedDate.getDate(),
        23,
        59,
        59,
        999,
    );
};

const normalizePrice = (value: LotPriceInput) => {
    if (value === null || value === undefined) {
        return null;
    }

    const parsedPrice = typeof value === 'number' ? value : Number(value);

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

    let finalPrice = originalPrice;
    if (overridePrice === null && isLastChance) {
        finalPrice = basePrice * LAST_CHANCE_DISCOUNT_MULTIPLIER;
    }

    return {
        status: isExpired ? 'vencido' : isLastChance ? 'last_chance' : 'fresco',
        isExpired,
        isLastChance,
        originalPrice,
        finalPrice,
        expiryDate,
    };
}
