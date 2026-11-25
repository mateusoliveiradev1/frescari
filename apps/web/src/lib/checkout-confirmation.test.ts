import assert from "node:assert/strict";
import test from "node:test";

import {
  getCheckoutConfirmation,
  resolveCheckoutConfirmation,
} from "./checkout-confirmation";

test("card or Pix paid is a confirmed order", () => {
  assert.equal(
    resolveCheckoutConfirmation({
      status: "complete",
      payment_status: "paid",
      payment_intent: { status: "succeeded" },
    }),
    "paid",
  );
});

test("a card held for weighed items is authorized, not paid", () => {
  assert.equal(
    resolveCheckoutConfirmation({
      status: "complete",
      payment_status: "unpaid",
      payment_intent: { status: "requires_capture" },
    }),
    "authorized",
  );
});

test("a Pix QR not paid yet is pending", () => {
  assert.equal(
    resolveCheckoutConfirmation({
      status: "open",
      payment_status: "unpaid",
      payment_intent: { status: "requires_action" },
    }),
    "pix_pending",
  );
});

test("an expired or cancelled session charged nothing", () => {
  assert.equal(
    resolveCheckoutConfirmation({
      status: "expired",
      payment_status: "unpaid",
    }),
    "not_paid",
  );
  assert.equal(
    resolveCheckoutConfirmation({
      status: "complete",
      payment_status: "unpaid",
      payment_intent: { status: "canceled" },
    }),
    "not_paid",
  );
});

test("no session, a forged id or no Stripe key never claims an order", async () => {
  assert.equal(resolveCheckoutConfirmation(null), "unknown");
  assert.equal(await getCheckoutConfirmation(undefined), "unknown");
  assert.equal(await getCheckoutConfirmation("cs_test_<script>"), "unknown");
  assert.equal(await getCheckoutConfirmation("not-a-session"), "unknown");
});
