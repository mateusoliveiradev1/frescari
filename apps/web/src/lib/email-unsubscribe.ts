import { createHmac, timingSafeEqual } from "node:crypto";

import { sanitizeEnvValue } from "@/lib/env";

/**
 * Unsubscribe links for reminder and news emails.
 *
 * The link carries the user id and an HMAC of it, so it works without login
 * and cannot be forged for someone else. It never expires: an unsubscribe
 * link from an old email must keep working. Account emails (verification,
 * orders, payment status) are not affected by the opt-out.
 */

const TOKEN_PURPOSE = "frescari-email-unsubscribe-v1";

function getSigningKey(secretOverride?: string) {
  const secret =
    secretOverride ??
    (sanitizeEnvValue(process.env.EMAIL_UNSUBSCRIBE_SECRET) ||
      sanitizeEnvValue(process.env.BETTER_AUTH_SECRET));
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for unsubscribe links.");
  }
  // A key derived for this purpose only, so the token never doubles as
  // anything signed with the auth secret.
  return createHmac("sha256", secret).update(TOKEN_PURPOSE).digest();
}

function sign(userId: string, secret?: string) {
  return createHmac("sha256", getSigningKey(secret))
    .update(userId)
    .digest("base64url")
    .slice(0, 32);
}

export function createUnsubscribeToken(userId: string, secret?: string) {
  return `${Buffer.from(userId).toString("base64url")}.${sign(userId, secret)}`;
}

export function verifyUnsubscribeToken(
  token: string | null | undefined,
  secret?: string,
): string | null {
  if (!token || token.length > 512) return null;
  const [encodedId, signature] = token.split(".");
  if (!encodedId || !signature) return null;

  const userId = Buffer.from(encodedId, "base64url").toString("utf8");
  if (!userId) return null;

  const expected = Buffer.from(sign(userId, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return null;
  return timingSafeEqual(expected, received) ? userId : null;
}

function base(appUrl: string) {
  return appUrl.replace(/\/$/, "");
}

// Page where a person confirms (or undoes) the unsubscribe.
export function buildUnsubscribePageUrl(appUrl: string, userId: string) {
  return `${base(appUrl)}/descadastro?t=${createUnsubscribeToken(userId)}`;
}

/**
 * RFC 8058 one-click headers. Gmail and Yahoo show their own "unsubscribe"
 * button with these and POST to the URL directly, with no page in between.
 */
export function buildUnsubscribeHeaders(appUrl: string, userId: string) {
  const oneClickUrl = `${base(appUrl)}/api/email/unsubscribe?t=${createUnsubscribeToken(userId)}`;
  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// Footer appended to reminder and news emails.
export function buildUnsubscribeFooter(unsubscribeUrl: string) {
  const safeUrl = unsubscribeUrl
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  return {
    text: `Não quer mais receber estes lembretes? Descadastre-se: ${unsubscribeUrl}`,
    html: `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8a8076;text-align:center;">Não quer mais receber estes lembretes? <a href="${safeUrl}" style="color:#8a8076;">Descadastrar</a></p>`,
  };
}
