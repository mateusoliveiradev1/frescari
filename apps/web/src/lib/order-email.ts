import { sendTransactionalEmail } from "@/lib/auth-email";
import { getAppUrl } from "@/lib/app-url";

export type ProducerNewOrderEmailInput = {
  producerName: string;
  orderId: string;
  totalAmount: number;
  awaitingWeight: boolean;
  // "Qui, 27/11 · Manhã (8h–12h)", when the buyer picked a window.
  deliveryWindowLabel?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function buildProducerNewOrderEmail(
  input: ProducerNewOrderEmailInput,
  appUrl: string,
) {
  const name = firstName(input.producerName);
  const greeting = name ? `Oi, ${name}!` : "Oi!";
  const shortId = input.orderId.slice(0, 8).toUpperCase();
  const total = formatCurrency(input.totalAmount);
  const salesUrl = `${appUrl.replace(/\/$/, "")}/dashboard/vendas`;
  const nextStep = input.awaitingWeight
    ? "O pedido tem itens vendidos por peso. Pese, informe o peso final no painel e o pagamento e capturado pelo valor real."
    : "O pagamento ja foi aprovado. Separe os itens e prepare a entrega pelo painel.";

  const subject = input.awaitingWeight
    ? `Novo pedido #${shortId}: informe o peso para confirmar`
    : `Novo pedido #${shortId} na Frescari`;

  const deliveryLine = input.deliveryWindowLabel
    ? `Entrega combinada: ${input.deliveryWindowLabel}.`
    : null;

  const text = [
    greeting,
    "",
    `Voce recebeu um novo pedido na Frescari (#${shortId}), no valor estimado de ${total}.`,
    ...(deliveryLine ? [deliveryLine] : []),
    nextStep,
    "",
    `Ver o pedido: ${salesUrl}`,
  ].join("\n");

  const html = `
    <div style="background:#f9f6f0;padding:32px;font-family:Arial,sans-serif;color:#231f1b;">
      <div style="margin:0 auto;max-width:560px;border-radius:24px;background:#ffffff;padding:32px;border:1px solid rgba(35,31,27,0.08);">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0d3321;">
          Frescari
        </p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#0d3321;">
          Voce tem um novo pedido
        </h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">
          Pedido <strong>#${escapeHtml(shortId)}</strong>, valor estimado de <strong>${escapeHtml(total)}</strong>.
        </p>
        ${
          deliveryLine
            ? `<p style="margin:0 0 12px;font-size:16px;line-height:1.7;"><strong>${escapeHtml(deliveryLine)}</strong></p>`
            : ""
        }
        <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">${escapeHtml(nextStep)}</p>
        <a href="${escapeHtml(salesUrl)}" style="display:inline-block;border-radius:16px;background:#0d3321;color:#f9f6f0;padding:14px 22px;font-size:15px;font-weight:700;text-decoration:none;">
          Ver pedido
        </a>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

/**
 * Emails every producer user of the seller about a new order. Never throws:
 * the order is already committed, and a failed email must not fail the
 * Stripe webhook (which would make Stripe retry an already-processed event).
 */
export async function sendProducerNewOrderEmails(
  recipients: Array<{ email: string; name: string }>,
  order: Omit<ProducerNewOrderEmailInput, "producerName">,
) {
  const appUrl = getAppUrl();
  let sent = 0;

  for (const recipient of recipients) {
    const email = buildProducerNewOrderEmail(
      { ...order, producerName: recipient.name },
      appUrl,
    );
    const ok = await sendTransactionalEmail({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      logLabel: `new-order email for order ${order.orderId}`,
    });
    if (ok) {
      sent += 1;
    }
  }

  return sent;
}

export function buildBuyerOutOfStockEmail(
  input: { buyerName: string; payment: "voided" | "refunded" | "none" },
  appUrl: string,
) {
  const name = firstName(input.buyerName) || "cliente";
  const moneyLine =
    input.payment === "voided"
      ? "A reserva no seu cartão foi cancelada: nada foi cobrado."
      : "O valor foi estornado integralmente no seu cartão. Dependendo do banco, o estorno aparece na fatura em até 10 dias úteis.";
  const catalogUrl = `${appUrl}/catalogo`;
  const subject = "Seu pedido não pôde ser concluído: estoque esgotado";
  const text = [
    `Olá, ${name}.`,
    "",
    "Enquanto você finalizava o pagamento, o estoque de um ou mais itens do seu pedido acabou, e o pedido não pôde ser criado.",
    moneyLine,
    "",
    `Veja o que ainda está disponível: ${catalogUrl}`,
    "",
    "Equipe Frescari",
  ].join("\n");
  const html = `<p>Olá, ${escapeHtml(name)}.</p>
<p>Enquanto você finalizava o pagamento, o estoque de um ou mais itens do seu pedido acabou, e o pedido não pôde ser criado.</p>
<p>${escapeHtml(moneyLine)}</p>
<p><a href="${escapeHtml(catalogUrl)}">Ver o que ainda está disponível</a></p>
<p>Equipe Frescari</p>`;
  return { subject, text, html };
}

/** Never throws: the refund already happened, the email is best effort. */
export async function sendBuyerOutOfStockEmails(
  recipients: Array<{ email: string; name: string }>,
  payment: "voided" | "refunded" | "none",
  sessionId: string,
) {
  const appUrl = getAppUrl();
  let sent = 0;
  for (const recipient of recipients) {
    const email = buildBuyerOutOfStockEmail(
      { buyerName: recipient.name, payment },
      appUrl,
    );
    const ok = await sendTransactionalEmail({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      logLabel: `out-of-stock refund email for session ${sessionId}`,
    });
    if (ok) sent += 1;
  }
  return sent;
}
