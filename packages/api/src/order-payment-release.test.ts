import assert from "node:assert/strict";
import test from "node:test";

import {
  PaymentNotReleasableError,
  releaseOrderPayment,
} from "./order-payment-release";

type Call = { method: string; args: unknown[] };

function fakeStripe(paymentIntent: Record<string, unknown>) {
  const calls: Call[] = [];
  const stripe = {
    paymentIntents: {
      retrieve: async (...args: unknown[]) => {
        calls.push({ method: "retrieve", args });
        return paymentIntent;
      },
      cancel: async (...args: unknown[]) => {
        calls.push({ method: "cancel", args });
        return { ...paymentIntent, status: "canceled" };
      },
    },
    refunds: {
      create: async (...args: unknown[]) => {
        calls.push({ method: "refund", args });
        return { id: "re_123" };
      },
    },
  };

  return { stripe: stripe as never, calls };
}

test("no payment intent: nothing to release", async () => {
  const { stripe, calls } = fakeStripe({});
  const result = await releaseOrderPayment({
    stripe,
    orderId: "order-1",
    paymentIntentId: null,
    platformOnly: false,
  });

  assert.deepEqual(result, { action: "none", reason: "no_payment_intent" });
  assert.equal(calls.length, 0);
});

test("authorized but not captured: cancels the authorization, never refunds", async () => {
  const { stripe, calls } = fakeStripe({ status: "requires_capture" });
  const result = await releaseOrderPayment({
    stripe,
    orderId: "order-1",
    paymentIntentId: "pi_1",
    platformOnly: false,
  });

  assert.deepEqual(result, { action: "voided", paymentIntentId: "pi_1" });
  assert.deepEqual(
    calls.map((c) => c.method),
    ["retrieve", "cancel"],
  );
  assert.deepEqual(calls[1]?.args[2], {
    idempotencyKey: "order-cancel-void:order-1",
  });
});

test("captured with Connect: full refund that reverses the transfer and the fee", async () => {
  const { stripe, calls } = fakeStripe({
    status: "succeeded",
    latest_charge: { refunded: false },
  });
  const result = await releaseOrderPayment({
    stripe,
    orderId: "order-1",
    paymentIntentId: "pi_1",
    platformOnly: false,
  });

  assert.deepEqual(result, {
    action: "refunded",
    paymentIntentId: "pi_1",
    refundId: "re_123",
  });
  const [params, options] = calls[1]?.args as [
    Record<string, unknown>,
    unknown,
  ];
  assert.equal(params.payment_intent, "pi_1");
  assert.equal(params.reverse_transfer, true);
  assert.equal(params.refund_application_fee, true);
  assert.deepEqual(options, { idempotencyKey: "order-cancel-refund:order-1" });
});

test("captured in platform-only mode: refund without Connect reversal fields", async () => {
  const { stripe, calls } = fakeStripe({
    status: "succeeded",
    latest_charge: { refunded: false },
  });
  await releaseOrderPayment({
    stripe,
    orderId: "order-1",
    paymentIntentId: "pi_1",
    platformOnly: true,
  });

  const [params] = calls[1]?.args as [Record<string, unknown>];
  assert.equal("reverse_transfer" in params, false);
  assert.equal("refund_application_fee" in params, false);
});

test("already refunded or cancelled: no second Stripe call", async () => {
  const refunded = fakeStripe({
    status: "succeeded",
    latest_charge: { refunded: true },
  });
  assert.deepEqual(
    await releaseOrderPayment({
      stripe: refunded.stripe,
      orderId: "o",
      paymentIntentId: "pi_1",
      platformOnly: false,
    }),
    { action: "none", reason: "already_refunded" },
  );
  assert.equal(refunded.calls.length, 1);

  const canceled = fakeStripe({ status: "canceled" });
  assert.deepEqual(
    await releaseOrderPayment({
      stripe: canceled.stripe,
      orderId: "o",
      paymentIntentId: "pi_1",
      platformOnly: false,
    }),
    { action: "none", reason: "already_canceled" },
  );
});

test("payment still processing: refuses so the order is not cancelled", async () => {
  const { stripe } = fakeStripe({ status: "processing" });
  await assert.rejects(
    releaseOrderPayment({
      stripe,
      orderId: "o",
      paymentIntentId: "pi_1",
      platformOnly: false,
    }),
    PaymentNotReleasableError,
  );
});
