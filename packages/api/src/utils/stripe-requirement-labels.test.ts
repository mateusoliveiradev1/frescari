import assert from "node:assert/strict";
import test from "node:test";

import {
  describeStripeDisabledReason,
  describeStripeRequirements,
} from "./stripe-requirement-labels";

test("technical Stripe fields become a few plain items, in form order, without repeats", () => {
  assert.deepEqual(
    describeStripeRequirements([
      "external_account",
      "individual.dob.day",
      "individual.dob.month",
      "individual.dob.year",
      "individual.verification.document",
      "individual.id_number",
      "tos_acceptance.date",
      "tos_acceptance.ip",
    ]),
    [
      "Data de nascimento",
      "CPF",
      "Foto de um documento (RG ou CNH)",
      "Conta bancaria para receber",
      "Aceitar os termos do Stripe",
    ],
  );
});

test("company fields name the company items", () => {
  assert.deepEqual(
    describeStripeRequirements([
      "company.tax_id",
      "company.name",
      "company.owners_provided",
      "business_profile.mcc",
    ]),
    [
      "CNPJ",
      "Razao social",
      "Dados do negocio (atividade, site ou descricao)",
      "Dados dos socios ou do responsavel",
    ],
  );
});

test("unknown fields collapse into one generic item; empty means nothing missing", () => {
  assert.deepEqual(describeStripeRequirements(["something.new.from_stripe"]), [
    "Outros dados no formulario do Stripe",
  ]);
  assert.deepEqual(describeStripeRequirements([]), []);
  assert.deepEqual(describeStripeRequirements(null), []);
});

test("disabled reasons read as plain sentences", () => {
  assert.equal(
    describeStripeDisabledReason("requirements.pending_verification"),
    "O Stripe esta conferindo os dados enviados.",
  );
  assert.match(describeStripeDisabledReason("rejected.fraud") ?? "", /recusou/);
  assert.equal(describeStripeDisabledReason(null), null);
});
