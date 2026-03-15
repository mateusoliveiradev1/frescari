type NumericInput = number | string | null | undefined;

type BaseFormatOptions = {
    fallback?: string;
    locale?: string;
};

type NumberFormatOptions = BaseFormatOptions & {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
};

type CurrencyFormatOptions = BaseFormatOptions & {
    currency?: string;
};

const localeNumberishPattern = /^[+-]?[\d.,\s]+$/;

const normalizeLocaleNumberString = (value: string): string | null => {
    const compact = value.replace(/\s+/g, '');

    if (!localeNumberishPattern.test(compact)) {
        return null;
    }

    const decimalIndex = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'));

    if (decimalIndex === -1) {
        return compact;
    }

    const integerPart = compact.slice(0, decimalIndex).replace(/[,.]/g, '');
    const fractionalPart = compact.slice(decimalIndex + 1).replace(/[,.]/g, '');

    if (integerPart.length === 0 && fractionalPart.length === 0) {
        return null;
    }

    if (fractionalPart.length === 0) {
        return integerPart || '0';
    }

    return `${integerPart || '0'}.${fractionalPart}`;
};

const parseNumericInput = (value: NumericInput): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return null;
    }

    const normalized = normalizeLocaleNumberString(trimmed);

    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

export const formatCurrencyBRL = (
    value: NumericInput,
    options: CurrencyFormatOptions = {},
): string => {
    const parsed = parseNumericInput(value);

    if (parsed === null) {
        return options.fallback ?? '--';
    }

    return new Intl.NumberFormat(options.locale ?? 'pt-BR', {
        style: 'currency',
        currency: options.currency ?? 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(parsed);
};

export const formatQuantity = (
    value: NumericInput,
    options: NumberFormatOptions = {},
): string => {
    const parsed = parseNumericInput(value);

    if (parsed === null) {
        return options.fallback ?? '--';
    }

    return new Intl.NumberFormat(options.locale ?? 'pt-BR', {
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
        maximumFractionDigits:
            options.maximumFractionDigits ?? (Number.isInteger(parsed) ? 0 : 3),
    }).format(parsed);
};

export const formatMass = (
    value: NumericInput,
    unit: 'kg' | 'g' = 'kg',
    options: NumberFormatOptions = {},
): string => {
    const parsed = parseNumericInput(value);

    if (parsed === null) {
        return options.fallback ?? '--';
    }

    const formatted = new Intl.NumberFormat(options.locale ?? 'pt-BR', {
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
        maximumFractionDigits: options.maximumFractionDigits ?? (unit === 'g' ? 0 : 2),
    }).format(parsed);

    return `${formatted} ${unit}`;
};

export const formatDistanceKm = (
    value: NumericInput,
    options: NumberFormatOptions = {},
): string => {
    const parsed = parseNumericInput(value);

    if (parsed === null) {
        return options.fallback ?? 'distância indisponível';
    }

    const formatted = new Intl.NumberFormat(options.locale ?? 'pt-BR', {
        minimumFractionDigits: options.minimumFractionDigits ?? 2,
        maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(parsed);

    return `${formatted} km`;
};
