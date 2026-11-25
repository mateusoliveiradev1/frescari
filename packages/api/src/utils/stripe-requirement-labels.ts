// Stripe lists what a producer's payout account still needs as technical
// field paths ("individual.verification.document", "external_account",
// "individual.dob.day"...). This turns them into the few plain-Portuguese
// items a producer (or the team helping them on WhatsApp) can act on.
// Labels only: no personal data is ever read here.

type RequirementRule = { test: (field: string) => boolean; label: string };

const has =
  (...parts: string[]) =>
  (field: string) =>
    parts.some((part) => field.includes(part));

// Ordered as the producer meets them in Stripe's form.
const RULES: RequirementRule[] = [
  {
    test: has("business_type"),
    label: "Tipo de cadastro (pessoa fisica ou empresa)",
  },
  {
    test: has("first_name", "last_name", "full_name_aliases"),
    label: "Nome completo",
  },
  { test: has(".dob"), label: "Data de nascimento" },
  { test: has("company.tax_id"), label: "CNPJ" },
  { test: has("id_number"), label: "CPF" },
  { test: has("company.name"), label: "Razao social" },
  { test: has(".email"), label: "E-mail" },
  { test: has(".phone", "support_phone"), label: "Telefone" },
  { test: has(".address"), label: "Endereco" },
  {
    test: has("political_exposure"),
    label: "Declaracao de pessoa politicamente exposta",
  },
  {
    test: (field) =>
      field.startsWith("business_profile") ||
      field.startsWith("settings.payments.statement_descriptor"),
    label: "Dados do negocio (atividade, site ou descricao)",
  },
  {
    test: has(
      "owners",
      "directors",
      "executives",
      "representative",
      "relationship.",
      "person_",
    ),
    label: "Dados dos socios ou do responsavel",
  },
  {
    test: has("proof_of_liveness"),
    label: "Verificacao de identidade (selfie)",
  },
  {
    test: has("verification.document", "verification.additional_document"),
    label: "Foto de um documento (RG ou CNH)",
  },
  { test: has("external_account"), label: "Conta bancaria para receber" },
  { test: has("tos_acceptance"), label: "Aceitar os termos do Stripe" },
];

const FALLBACK_LABEL = "Outros dados no formulario do Stripe";

/** Distinct plain-language items, in form order; unknown fields collapse to one generic item. */
export function describeStripeRequirements(
  fields: readonly string[] | null | undefined,
) {
  const matched = new Set<number>();
  let hasUnknown = false;

  for (const raw of fields ?? []) {
    const field = raw.trim().toLowerCase();
    if (!field) continue;
    // Each field maps to its first matching rule, in RULES order.
    const index = RULES.findIndex((rule) => rule.test(field));
    if (index === -1) {
      hasUnknown = true;
    } else {
      matched.add(index);
    }
  }

  const labels = [...matched]
    .sort((a, b) => a - b)
    .map((index) => RULES[index]!.label);
  if (hasUnknown) labels.push(FALLBACK_LABEL);
  return labels;
}

/** Why Stripe has the account disabled, when it says so. */
export function describeStripeDisabledReason(
  reason: string | null | undefined,
) {
  if (!reason) return null;
  if (reason === "requirements.pending_verification") {
    return "O Stripe esta conferindo os dados enviados.";
  }
  if (reason === "requirements.past_due") {
    return "Ha dados vencidos que precisam ser enviados de novo.";
  }
  if (reason === "under_review" || reason === "listed") {
    return "A conta esta em analise pelo Stripe.";
  }
  if (reason.startsWith("rejected")) {
    return "O Stripe recusou a conta. Fale com o suporte da Frescari.";
  }
  if (reason === "platform_paused") {
    return "Recebimento pausado pela Frescari.";
  }
  return "O Stripe bloqueou o recebimento ate a conta ser revisada.";
}
