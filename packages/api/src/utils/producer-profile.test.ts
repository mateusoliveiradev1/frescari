import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidCnpj,
  isValidCpf,
  normalizeBrazilPhone,
  normalizeDigits,
  onboardingSetupSchema,
  toE164BrazilPhone,
} from "./producer-profile";

test("validates CPF documents with check digits", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224724"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
});

test("validates CNPJ documents with check digits", () => {
  assert.equal(isValidCnpj("04.252.011/0001-10"), true);
  assert.equal(isValidCnpj("04252011000111"), false);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
});

test("normalizes Brazilian phones and converts them to E.164", () => {
  assert.equal(normalizeDigits("(11) 99876-5432"), "11998765432");
  assert.equal(normalizeBrazilPhone("+55 (11) 99876-5432"), "11998765432");
  assert.equal(toE164BrazilPhone("(11) 99876-5432"), "+5511998765432");
  assert.equal(toE164BrazilPhone("99876"), null);
});

test("parses producer onboarding payloads and normalizes Brazilian identifiers", () => {
  const payload = onboardingSetupSchema.parse({
    type: "PRODUCER",
    publicName: "  Feira da Ana  ",
    legalEntityType: "PF",
    documentId: "529.982.247-25",
    legalName: "  Ana Maria  ",
    contactName: "  Ana Maria Souza  ",
    phone: "+55 (11) 99876-5432",
  });

  assert.deepEqual(payload, {
    type: "PRODUCER",
    publicName: "Feira da Ana",
    legalEntityType: "PF",
    documentId: "52998224725",
    legalName: "Ana Maria",
    contactName: "Ana Maria Souza",
    phone: "11998765432",
  });
});

test("rejects producer onboarding payloads with invalid CNPJ or phone", () => {
  const result = onboardingSetupSchema.safeParse({
    type: "PRODUCER",
    publicName: "Hortifruti Central",
    legalEntityType: "PJ",
    documentId: "04.252.011/0001-11",
    legalName: "Hortifruti Central LTDA",
    contactName: "Maria",
    phone: "9999",
  });

  assert.equal(result.success, false);

  if (result.success) {
    throw new Error("Expected invalid producer onboarding payload.");
  }

  assert.deepEqual(
    result.error.issues.map((issue) => issue.path.join(".")),
    ["documentId", "phone"],
  );
});
