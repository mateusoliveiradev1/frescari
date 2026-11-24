import type Stripe from "stripe";

export type PaymentReleaseResult =
  | {
      action: "none";
      reason: "no_payment_intent" | "already_canceled" | "already_refunded";
    }
  | { action: "voided"; paymentIntentId: string }
  | { action: "refunded"; paymentIntentId: string; refundId: string };

export class PaymentNotReleasableError extends Error {
  constructor(readonly paymentIntentStatus: string) {
    super(
      `Pagamento no estado "${paymentIntentStatus}" ainda nao pode ser devolvido.`,
    );
    this.name = "PaymentNotReleasableError";
  }
}

type StripeLike = {
  paymentIntents: Pick<Stripe["paymentIntents"], "retrieve" | "cancel">;
  refunds: Pick<Stripe["refunds"], "create">;
};

/**
 * Gives the buyer their money back when an order is cancelled.
 *
 * - Authorized but not captured (weighed orders): cancel the authorization,
 *   so the buyer is never charged.
 * - Captured: full refund. With Stripe Connect destination charges the
 *   transfer to the producer and the platform fee are reversed as well, so
 *   the platform does not pay the refund out of its own balance.
 *
 * Both calls use an idempotency key per order, so a retry (double click, a
 * failed DB write after Stripe succeeded) never refunds twice.
 */
export async function releaseOrderPayment({
  stripe,
  orderId,
  paymentIntentId,
  platformOnly,
}: {
  stripe: StripeLike;
  orderId: string;
  paymentIntentId: string | null | undefined;
  platformOnly: boolean;
}): Promise<PaymentReleaseResult> {
  if (!paymentIntentId) {
    return { action: "none", reason: "no_payment_intent" };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  if (paymentIntent.status === "canceled") {
    return { action: "none", reason: "already_canceled" };
  }

  if (paymentIntent.status === "requires_capture") {
    await stripe.paymentIntents.cancel(
      paymentIntentId,
      { cancellation_reason: "requested_by_customer" },
      { idempotencyKey: `order-cancel-void:${orderId}` },
    );
    return { action: "voided", paymentIntentId };
  }

  if (paymentIntent.status === "succeeded") {
    const latestCharge = paymentIntent.latest_charge;
    if (
      latestCharge &&
      typeof latestCharge !== "string" &&
      latestCharge.refunded
    ) {
      return { action: "none", reason: "already_refunded" };
    }

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        metadata: { orderId },
        ...(platformOnly
          ? {}
          : { reverse_transfer: true, refund_application_fee: true }),
      },
      { idempotencyKey: `order-cancel-refund:${orderId}` },
    );
    return { action: "refunded", paymentIntentId, refundId: refund.id };
  }

  throw new PaymentNotReleasableError(paymentIntent.status);
}
