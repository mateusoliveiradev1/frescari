import { sendTransactionalEmail } from "@/lib/auth-email";
import { getAppUrl } from "@/lib/app-url";

export type PaymentsStatusEmailKind = "active" | "blocked";

export type PaymentsStatusEmailInput = {
  kind: PaymentsStatusEmailKind;
  producerName: string;
  // Only used for "active": what is still missing before lots show up.
  farmLocated: boolean;
  hasActiveLot: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function buildActiveContent(input: PaymentsStatusEmailInput, base: string) {
  if (!input.farmLocated) {
    return {
      subject: "Recebimento ativo: falta marcar a fazenda",
      headline: "Seu recebimento esta ativo",
      body: "O Stripe liberou sua conta e você já pode receber pela Frescari. Falta so marcar a localização da fazenda no mapa para o comprador conseguir calcular o frete.",
      cta: "Marcar a fazenda",
      url: `${base}/dashboard/fazenda`,
    };
  }

  if (!input.hasActiveLot) {
    return {
      subject: "Recebimento ativo: publique seu primeiro lote",
      headline: "Seu recebimento esta ativo",
      body: "O Stripe liberou sua conta e você já pode receber pela Frescari. Agora e so publicar o primeiro lote: leva cerca de 1 minuto.",
      cta: "Publicar um lote",
      url: `${base}/dashboard/inventario`,
    };
  }

  return {
    subject: "Recebimento ativo: seus lotes já estão no catálogo",
    headline: "Seus lotes já estão a venda",
    body: "O Stripe liberou sua conta e seus lotes já aparecem no catálogo e na sua vitrine. Compartilhe o link da vitrine com seus clientes.",
    cta: "Abrir o painel",
    url: `${base}/dashboard`,
  };
}

function buildBlockedContent(base: string) {
  return {
    subject: "Ação necessária: seu recebimento foi pausado",
    headline: "O Stripe precisa de mais informações",
    body: "O Stripe pausou o recebimento da sua conta até você atualizar alguns dados. Enquanto isso, seus lotes ficam fora do catálogo. Entre no painel e clique no botão de recebimento para ver o que falta.",
    cta: "Ver o que falta",
    url: `${base}/dashboard`,
  };
}

export function buildPaymentsStatusEmail(
  input: PaymentsStatusEmailInput,
  appUrl: string,
) {
  const base = appUrl.replace(/\/$/, "");
  const name = firstName(input.producerName);
  const greeting = name ? `Oi, ${name}!` : "Oi!";
  const content =
    input.kind === "active"
      ? buildActiveContent(input, base)
      : buildBlockedContent(base);

  const text = [
    greeting,
    "",
    content.body,
    "",
    `${content.cta}: ${content.url}`,
  ].join("\n");

  const html = `
    <div style="background:#f9f6f0;padding:32px;font-family:Arial,sans-serif;color:#231f1b;">
      <div style="margin:0 auto;max-width:560px;border-radius:24px;background:#ffffff;padding:32px;border:1px solid rgba(35,31,27,0.08);">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0d3321;">
          Frescari
        </p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#0d3321;">
          ${escapeHtml(content.headline)}
        </h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">${escapeHtml(content.body)}</p>
        <a href="${escapeHtml(content.url)}" style="display:inline-block;border-radius:16px;background:#0d3321;color:#f9f6f0;padding:14px 22px;font-size:15px;font-weight:700;text-decoration:none;">
          ${escapeHtml(content.cta)}
        </a>
      </div>
    </div>
  `.trim();

  return { subject: content.subject, text, html };
}

/** Never throws; returns how many emails were accepted by the provider. */
export async function sendPaymentsStatusEmails(
  recipients: Array<{ email: string; name: string }>,
  input: Omit<PaymentsStatusEmailInput, "producerName">,
) {
  const appUrl = getAppUrl();
  let sent = 0;

  for (const recipient of recipients) {
    const email = buildPaymentsStatusEmail(
      { ...input, producerName: recipient.name },
      appUrl,
    );
    const ok = await sendTransactionalEmail({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      logLabel: `payments-${input.kind} email`,
    });
    if (ok) sent += 1;
  }

  return sent;
}
