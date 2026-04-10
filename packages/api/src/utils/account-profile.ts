import { z } from "zod";

import {
  createNormalizedTextSchema,
  isValidBrazilPhoneDigits,
  isValidCnpj,
  isValidCpf,
  normalizeBrazilPhone,
  normalizeDigits,
  producerLegalEntityTypeSchema,
} from "./producer-profile";

export type AccountOverviewFlags = {
  canAccessAddresses: boolean;
  canManageRegistration: boolean;
  hasTenant: boolean;
  isAdmin: boolean;
  isBuyer: boolean;
  isProducer: boolean;
};

const baseAccountRegistrationUpdateSchema = z.discriminatedUnion("type", [
  z.object({
    companyName: createNormalizedTextSchema(2, 120),
    type: z.literal("buyer"),
  }),
  z.object({
    contactName: createNormalizedTextSchema(2, 120),
    documentId: z.string().transform(normalizeDigits),
    legalEntityType: producerLegalEntityTypeSchema,
    legalName: createNormalizedTextSchema(2, 160),
    phone: z.string().transform(normalizeBrazilPhone),
    publicName: createNormalizedTextSchema(2, 120),
    type: z.literal("producer"),
  }),
]);

export const accountRegistrationUpdateSchema =
  baseAccountRegistrationUpdateSchema.superRefine((input, ctx) => {
    if (input.type !== "producer") {
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
  });

export type AccountRegistrationUpdateInput = z.infer<
  typeof accountRegistrationUpdateSchema
>;

export function buildAccountOverviewFlags(
  role: string | null | undefined,
  tenantId: string | null | undefined,
): AccountOverviewFlags {
  const isAdmin = role === "admin";
  const isBuyer = role === "buyer";
  const isProducer = role === "producer";

  return {
    canAccessAddresses: isBuyer,
    canManageRegistration: isBuyer || isProducer,
    hasTenant: typeof tenantId === "string" && tenantId.length > 0,
    isAdmin,
    isBuyer,
    isProducer,
  };
}

export function buildTenantRegistrationUpdate(
  input: AccountRegistrationUpdateInput,
) {
  if (input.type === "buyer") {
    return {
      name: input.companyName,
    };
  }

  return {
    name: input.publicName,
    producerContactName: input.contactName,
    producerDocumentId: input.documentId,
    producerLegalEntityType: input.legalEntityType,
    producerLegalName: input.legalName,
    producerPhone: input.phone,
    producerProfileCompletedAt: new Date(),
  };
}

export function registrationPayloadMatchesRole(
  role: string | null | undefined,
  input: AccountRegistrationUpdateInput,
) {
  return (
    (role === "buyer" && input.type === "buyer") ||
    (role === "producer" && input.type === "producer")
  );
}
