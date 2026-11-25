/**
 * WhatsApp outreach to producers who stopped halfway through setup, used by
 * the operations team from the admin panel. Messages speak as "a equipe da
 * Frescari", so anyone on the team can send them.
 */

export type OutreachStage = "payments" | "farm" | "lot" | "ready";

const DASHBOARD_URL = "https://frescari.com.br/dashboard";

// Same order the producer sees in their own dashboard checklist.
export function getOutreachStage(args: {
  stripeConnected: boolean;
  farmCount: number;
  activeLotCount: number;
  productCount: number;
}): OutreachStage {
  if (!args.stripeConnected) return "payments";
  if (args.farmCount === 0) return "farm";
  if (args.activeLotCount === 0 && args.productCount === 0) return "lot";
  return "ready";
}

export const OUTREACH_STAGE_LABELS: Record<OutreachStage, string> = {
  payments: "Falta ativar o recebimento",
  farm: "Falta marcar a fazenda",
  lot: "Falta publicar o primeiro lote",
  ready: "Pronto para vender",
};

/**
 * Brazilian numbers as wa.me expects them: country code + area code +
 * number, digits only. Accepts what people type ("(17) 99123-4567",
 * "017991234567", "+55 17 99123-4567"). Returns null when it cannot be a
 * Brazilian phone, so the panel hides the button instead of opening a chat
 * with a wrong number.
 */
export function normalizeBrazilianPhone(raw: string | null | undefined) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/^0+/, "");
  // Area code (2 digits) + 8-digit landline or 9-digit mobile.
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (digits.startsWith("0")) return null;
  return `55${digits}`;
}

function firstName(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// No emoji: wa.me turns characters outside the Basic Multilingual Plane into
// "?" on WhatsApp Web and Desktop.
export function buildOutreachMessage(args: {
  contactName: string | null | undefined;
  stage: OutreachStage;
}) {
  const name = firstName(args.contactName);
  const greeting = name
    ? `Oi, ${name}! Tudo bem? Aqui é da equipe da Frescari.`
    : "Oi! Tudo bem? Aqui é da equipe da Frescari.";

  const body: Record<OutreachStage, string> = {
    payments:
      "Vi que você criou sua conta de produtor, mas ainda falta ativar o recebimento. É o cadastro no Stripe, que deposita o dinheiro das suas vendas direto na sua conta. Posso te ajudar agora? Leva uns 5 minutos.",
    farm: "Vi que o seu recebimento já está ativo. Falta só marcar a localização da fazenda no mapa, que é o que calcula o frete para o comprador. Quer ajuda? É rapidinho.",
    lot: "Sua conta já está quase pronta: falta só publicar o primeiro lote para os compradores verem seus produtos. Quer que eu te ajude a cadastrar?",
    ready:
      "Sua conta está pronta para vender. Precisa de alguma ajuda para divulgar sua vitrine ou cadastrar mais produtos?",
  };

  return `${greeting}\n\n${body[args.stage]}\n\nSeu painel: ${DASHBOARD_URL}`;
}

export function buildWhatsAppChatUrl(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
