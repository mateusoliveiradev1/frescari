import { z } from "zod";

export const producerLegalEntityTypeSchema = z.enum(["PF", "PJ"]);

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeBrazilPhone(value: string) {
  const digits = normalizeDigits(value);

  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
  ) {
    return digits.slice(2);
  }

  return digits;
}

export function isValidBrazilPhoneDigits(value: string) {
  return value.length === 10 || value.length === 11;
}

export function toE164BrazilPhone(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const digits = normalizeBrazilPhone(value);
  if (!isValidBrazilPhoneDigits(digits)) {
    return null;
  }

  return `+55${digits}`;
}

export function splitFullName(fullName: string) {
  const normalizedName = normalizeWhitespace(fullName);
  const parts = normalizedName.split(" ").filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;

  return {
    firstName,
    lastName,
  };
}

export function isValidCpf(value: string) {
  const digits = normalizeDigits(value);

  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }

  let firstCheckDigit = 11 - (sum % 11);
  if (firstCheckDigit >= 10) {
    firstCheckDigit = 0;
  }

  if (firstCheckDigit !== Number(digits[9])) {
    return false;
  }

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * (11 - index);
  }

  let secondCheckDigit = 11 - (sum % 11);
  if (secondCheckDigit >= 10) {
    secondCheckDigit = 0;
  }

  return secondCheckDigit === Number(digits[10]);
}

export function isValidCnpj(value: string) {
  const digits = normalizeDigits(value);

  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let index = 0; index < firstWeights.length; index += 1) {
    sum += Number(digits[index]) * firstWeights[index]!;
  }

  let firstCheckDigit = sum % 11;
  firstCheckDigit = firstCheckDigit < 2 ? 0 : 11 - firstCheckDigit;

  if (firstCheckDigit !== Number(digits[12])) {
    return false;
  }

  sum = 0;
  for (let index = 0; index < secondWeights.length; index += 1) {
    sum += Number(digits[index]) * secondWeights[index]!;
  }

  let secondCheckDigit = sum % 11;
  secondCheckDigit = secondCheckDigit < 2 ? 0 : 11 - secondCheckDigit;

  return secondCheckDigit === Number(digits[13]);
}

function createNormalizedTextSchema(min: number, max: number) {
  return z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(min, `Informe ao menos ${min} caracteres.`)
        .max(max, `Use no maximo ${max} caracteres.`),
    );
}

const buyerOnboardingSchema = z.object({
  type: z.literal("BUYER"),
  companyName: createNormalizedTextSchema(2, 120),
});

const producerOnboardingSchema = z.object({
  type: z.literal("PRODUCER"),
  publicName: createNormalizedTextSchema(2, 120),
  legalEntityType: producerLegalEntityTypeSchema,
  documentId: z.string().transform(normalizeDigits),
  legalName: createNormalizedTextSchema(2, 160),
  contactName: createNormalizedTextSchema(2, 120),
  phone: z.string().transform(normalizeBrazilPhone),
});

const baseOnboardingSetupSchema = z.discriminatedUnion("type", [
  buyerOnboardingSchema,
  producerOnboardingSchema,
]);

export const onboardingSetupSchema = baseOnboardingSetupSchema.superRefine(
  (input, ctx) => {
    if (input.type !== "PRODUCER") {
      return;
    }

    const isValidDocument =
      input.legalEntityType === "PF"
        ? isValidCpf(input.documentId)
        : isValidCnpj(input.documentId);

    if (!isValidDocument) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          input.legalEntityType === "PF"
            ? "Informe um CPF valido."
            : "Informe um CNPJ valido.",
        path: ["documentId"],
      });
    }

    if (!isValidBrazilPhoneDigits(input.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe um telefone brasileiro valido com DDD.",
        path: ["phone"],
      });
    }
  },
);
