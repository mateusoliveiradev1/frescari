import { sanitizeEnvValue } from "@/lib/env";

const RESEND_API_URL = "https://api.resend.com/emails";

type AuthEmailUser = {
  email: string;
  name: string;
};

type SendAuthEmailInput = {
  user: AuthEmailUser;
  url: string;
};

type AuthEmailContent = {
  html: string;
  subject: string;
  text: string;
};

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getResendConfig() {
  return {
    apiKey: sanitizeEnvValue(process.env.RESEND_API_KEY),
    from: sanitizeEnvValue(process.env.AUTH_EMAIL_FROM),
    fromName: sanitizeEnvValue(process.env.AUTH_EMAIL_FROM_NAME) || "Frescari",
    replyTo: sanitizeEnvValue(process.env.AUTH_EMAIL_REPLY_TO),
  };
}

function formatSenderAddress(from: string, fromName: string) {
  if (from.includes("<")) {
    return from;
  }

  return `${fromName} <${from}>`;
}

export function buildAuthVerificationEmail({
  user,
  url,
}: SendAuthEmailInput): AuthEmailContent {
  const safeName = escapeHtml(user.name);
  const safeUrl = escapeHtml(url);

  return {
    subject: "Confirme seu email para entrar na Frescari",
    text: [
      `Oi ${user.name},`,
      "",
      "Recebemos um pedido para confirmar o email da sua conta na Frescari.",
      `Abra este link para liberar seu acesso: ${url}`,
      "",
      "Se voce nao reconhece este cadastro, pode ignorar esta mensagem.",
    ].join("\n"),
    html: `
      <div style="background:#f9f6f0;padding:32px;font-family:Arial,sans-serif;color:#231f1b;">
        <div style="margin:0 auto;max-width:560px;border-radius:24px;background:#ffffff;padding:32px;border:1px solid rgba(35,31,27,0.08);">
          <div style="margin:0 0 18px;">
            <span
              style="display:inline-block;min-width:44px;height:44px;line-height:44px;border-radius:14px;background:#0d3321;color:#f9f6f0;text-align:center;font-size:20px;font-weight:700;"
            >
              F
            </span>
          </div>
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0d3321;">
            Frescari
          </p>
          <h1 style="margin:0 0 16px;font-size:32px;line-height:1.05;color:#0d3321;">
            Confirme seu email
          </h1>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">
            Oi ${safeName},
          </p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
            Recebemos um pedido para liberar seu acesso na Frescari. Clique no botao abaixo para confirmar o email da sua conta.
          </p>
          <a
            href="${safeUrl}"
            style="display:inline-block;border-radius:16px;background:#0d3321;color:#f9f6f0;padding:14px 22px;font-size:15px;font-weight:700;text-decoration:none;"
          >
            Confirmar email
          </a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#5d5248;">
            Se preferir, copie e cole este link no navegador:<br />
            <a href="${safeUrl}" style="color:#0d3321;word-break:break-all;">${safeUrl}</a>
          </p>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#5d5248;">
            Se voce nao reconhece este cadastro, pode ignorar esta mensagem.
          </p>
        </div>
      </div>
    `.trim(),
  };
}

export function isAuthEmailDeliveryConfigured() {
  const { apiKey, from } = getResendConfig();

  return Boolean(apiKey && from);
}

export function buildAuthPasswordResetEmail({
  user,
  url,
}: SendAuthEmailInput): AuthEmailContent {
  const safeName = escapeHtml(user.name);
  const safeUrl = escapeHtml(url);

  return {
    subject: "Redefina sua senha de acesso na Frescari",
    text: [
      `Oi ${user.name},`,
      "",
      "Recebemos um pedido para redefinir a senha da sua conta na Frescari.",
      `Abra este link para cadastrar uma nova senha: ${url}`,
      "",
      "Se voce nao fez essa solicitacao, pode ignorar esta mensagem com seguranca.",
    ].join("\n"),
    html: `
      <div style="background:#f9f6f0;padding:32px;font-family:Arial,sans-serif;color:#231f1b;">
        <div style="margin:0 auto;max-width:560px;border-radius:24px;background:#ffffff;padding:32px;border:1px solid rgba(35,31,27,0.08);">
          <div style="margin:0 0 18px;">
            <span
              style="display:inline-block;min-width:44px;height:44px;line-height:44px;border-radius:14px;background:#0d3321;color:#f9f6f0;text-align:center;font-size:20px;font-weight:700;"
            >
              F
            </span>
          </div>
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0d3321;">
            Frescari
          </p>
          <h1 style="margin:0 0 16px;font-size:32px;line-height:1.05;color:#0d3321;">
            Redefina sua senha
          </h1>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">
            Oi ${safeName},
          </p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
            Recebemos um pedido para redefinir a senha da sua conta na Frescari. Clique no botao abaixo para escolher uma nova senha.
          </p>
          <a
            href="${safeUrl}"
            style="display:inline-block;border-radius:16px;background:#0d3321;color:#f9f6f0;padding:14px 22px;font-size:15px;font-weight:700;text-decoration:none;"
          >
            Redefinir senha
          </a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#5d5248;">
            Se preferir, copie e cole este link no navegador:<br />
            <a href="${safeUrl}" style="color:#0d3321;word-break:break-all;">${safeUrl}</a>
          </p>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#5d5248;">
            Se voce nao fez essa solicitacao, pode ignorar esta mensagem com seguranca.
          </p>
        </div>
      </div>
    `.trim(),
  };
}

async function sendAuthEmail({
  input,
  buildEmail,
  logLabel,
  missingConfigMessage,
  sendFailureLabel,
}: {
  input: SendAuthEmailInput;
  buildEmail: (input: SendAuthEmailInput) => AuthEmailContent;
  logLabel: string;
  missingConfigMessage: string;
  sendFailureLabel: string;
}) {
  const { apiKey, from, fromName, replyTo } = getResendConfig();

  if (!apiKey || !from) {
    if (!isProductionEnvironment()) {
      console.info(
        `[auth-email] ${logLabel} for ${input.user.email}: ${input.url}`,
      );
      return;
    }

    throw new Error(missingConfigMessage);
  }

  const email = buildEmail(input);
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatSenderAddress(from, fromName),
      to: [input.user.email],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (response.ok) {
    return;
  }

  const errorDetails = await response.text().catch(() => "");
  const suffix = errorDetails ? `: ${errorDetails}` : "";

  throw new Error(
    `${sendFailureLabel} (${response.status} ${response.statusText})${suffix}`,
  );
}

export async function sendAuthVerificationEmail(input: SendAuthEmailInput) {
  await sendAuthEmail({
    input,
    buildEmail: buildAuthVerificationEmail,
    logLabel: "Verification link",
    missingConfigMessage:
      "Verification email delivery is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.",
    sendFailureLabel: "Failed to send verification email",
  });
}

export async function sendAuthPasswordResetEmail(input: SendAuthEmailInput) {
  await sendAuthEmail({
    input,
    buildEmail: buildAuthPasswordResetEmail,
    logLabel: "Password reset link",
    missingConfigMessage:
      "Password reset email delivery is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.",
    sendFailureLabel: "Failed to send password reset email",
  });
}
