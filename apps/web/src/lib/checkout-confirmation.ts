import Stripe from "stripe";

import { sanitizeEnvValue } from "@/lib/env";

// What the buyer sees after Stripe Checkout, decided by Stripe's own record
// of the session, not by having reached the page: the success URL can be
// opened by anyone, before a Pix is paid, or after a payment failed.
export type CheckoutConfirmation =
  | "paid" // money in (card or Pix)
  | "authorized" // card held for weighed items, charged after weighing
  | "pix_pending" // Pix QR shown, not paid yet
  | "not_paid" // expired or failed, nothing charged
  | "unknown"; // no/invalid session or Stripe unreachable

type SessionLike = {
  status?: string | null;
  payment_status?: string | null;
  payment_intent?: { status?: string | null } | string | null;
};

export function resolveCheckoutConfirmation(
  session: SessionLike | null,
): CheckoutConfirmation {
  if (!session) return "unknown";

  if (session.payment_status === "paid") return "paid";

  const intentStatus =
    session.payment_intent && typeof session.payment_intent === "object"
      ? session.payment_intent.status
      : null;

  if (intentStatus === "requires_capture") return "authorized";
  if (session.status === "expired" || intentStatus === "canceled") {
    return "not_paid";
  }
  if (
    intentStatus === "requires_action" ||
    intentStatus === "processing" ||
    session.status === "open"
  ) {
    return "pix_pending";
  }
  if (intentStatus === "requires_payment_method") return "not_paid";
  return "unknown";
}

const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

/** Reads the session from Stripe; any problem yields "unknown", never a claim. */
export async function getCheckoutConfirmation(
  sessionId: string | null | undefined,
): Promise<CheckoutConfirmation> {
  if (!sessionId || !CHECKOUT_SESSION_ID.test(sessionId)) return "unknown";

  const key = sanitizeEnvValue(process.env.STRIPE_SECRET_KEY);
  if (!key) return "unknown";

  try {
    const session = await new Stripe(key).checkout.sessions.retrieve(
      sessionId,
      { expand: ["payment_intent"] },
    );
    return resolveCheckoutConfirmation(session as unknown as SessionLike);
  } catch (error) {
    console.error("[SUCESSO] Nao foi possivel consultar a sessao", error);
    return "unknown";
  }
}
