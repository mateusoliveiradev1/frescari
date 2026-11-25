import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatCnpj,
  isValidCnpj,
  normalizeProducerDocument,
  normalizeTaxDocument,
} from "./tax-document";

test("alphanumeric CNPJ (Receita example) validates, formatted or not", () => {
  assert.equal(isValidCnpj("12.ABC.345/01DE-35"), true);
  assert.equal(isValidCnpj("12ABC34501DE35"), true);
  assert.equal(isValidCnpj("12.abc.345/01de-35"), true);
});

test("a wrong check digit or a letter in the check digits is rejected", () => {
  assert.equal(isValidCnpj("12.ABC.345/01DE-36"), false);
  assert.equal(isValidCnpj("12.ABC.345/01DE-3A"), false);
  assert.equal(isValidCnpj("12.ABD.345/01DE-35"), false);
});

test("numeric CNPJs validate exactly as before", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11.222.333/0001-82"), false);
  assert.equal(isValidCnpj("00.000.000/0000-00"), false);
  assert.equal(isValidCnpj("AAAAAAAAAAAAAA"), false);
  assert.equal(isValidCnpj("123"), false);
});

test("normalization keeps letters for CNPJ and only digits for CPF", () => {
  assert.equal(normalizeTaxDocument(" 12.abc.345/01de-35 "), "12ABC34501DE35");
  assert.equal(
    normalizeProducerDocument("12.abc.345/01de-35", "PJ"),
    "12ABC34501DE35",
  );
  assert.equal(
    normalizeProducerDocument("123.456.789-09", "PF"),
    "12345678909",
  );
  assert.equal(formatCnpj("12ABC34501DE35"), "12.ABC.345/01DE-35");
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
});
