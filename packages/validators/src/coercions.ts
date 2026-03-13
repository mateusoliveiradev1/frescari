import { z } from 'zod';

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

const preprocessLocaleNumber = (value: unknown): unknown => {
    if (typeof value === 'number') {
        return value;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return undefined;
    }

    const normalized = normalizeLocaleNumberString(trimmed);

    if (!normalized) {
        return Number.NaN;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const buildFiniteNumberSchema = (fieldLabel: string) =>
    z
        .number({
            required_error: `${fieldLabel} é obrigatório.`,
            invalid_type_error: `${fieldLabel} deve ser um número válido.`,
        })
        .finite(`${fieldLabel} deve ser um número válido.`);

export const trimmedString = (fieldLabel: string, minLength = 1) =>
    z.string().trim().min(minLength, `${fieldLabel} é obrigatório.`);

export const decimalFromLocale = (fieldLabel: string) =>
    z.preprocess(preprocessLocaleNumber, buildFiniteNumberSchema(fieldLabel));

export const moneyFromLocale = (fieldLabel: string) =>
    z.preprocess(
        preprocessLocaleNumber,
        buildFiniteNumberSchema(fieldLabel).min(0, `${fieldLabel} não pode ser negativo.`),
    );

export const coercedPositiveNumber = (fieldLabel: string) =>
    z.preprocess(
        preprocessLocaleNumber,
        buildFiniteNumberSchema(fieldLabel).positive(`${fieldLabel} deve ser maior que zero.`),
    );
