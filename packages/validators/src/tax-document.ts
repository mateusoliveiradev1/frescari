// CPF and CNPJ handling shared by the server and the forms.
//
// Since July 2026 the Receita Federal also issues alphanumeric CNPJs
// (IN RFB 2.229/2024): the first 12 positions may be letters or digits, the
// last 2 (check digits) stay numeric, e.g. 12.ABC.345/01DE-35. Existing
// numeric CNPJs keep working unchanged.

/** Uppercase letters and digits only ("12.abc.345/01de-35" -> "12ABC34501DE35"). */
export function normalizeTaxDocument(value: string) {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** What a producer's document field holds after normalization, per entity type. */
export function normalizeProducerDocument(value: string, type: "PF" | "PJ") {
  return type === "PF" ? value.replace(/\D/g, "") : normalizeTaxDocument(value);
}

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjCheckDigit(values: number[], weights: number[]) {
  const sum = weights.reduce(
    (total, weight, index) => total + values[index]! * weight,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Numeric or alphanumeric CNPJ. Each character counts as its ASCII code
 * minus 48 (0-9 -> 0-9, A -> 17 ... Z -> 42); the check digits use the same
 * modulo-11 weights as always, so a numeric CNPJ validates exactly as before.
 */
export function isValidCnpj(value: string) {
  const document = normalizeTaxDocument(value);

  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(document) || /^(.)\1+$/.test(document)) {
    return false;
  }

  const values = [...document].map((char) => char.charCodeAt(0) - 48);

  return (
    cnpjCheckDigit(values, CNPJ_FIRST_WEIGHTS) === values[12] &&
    cnpjCheckDigit(values, CNPJ_SECOND_WEIGHTS) === values[13]
  );
}

/** "12ABC34501DE35" -> "12.ABC.345/01DE-35" (input already normalized). */
export function formatCnpj(document: string) {
  const value = normalizeTaxDocument(document);
  if (value.length !== 14) return document;
  return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`;
}
