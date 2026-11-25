import assert from "node:assert/strict";
import test from "node:test";

import {
  releaseExpiredWeighedHolds,
  type HeldOrder,
} from "./expired-weighed-holds";

const now = new Date("2026-12-10T12:00:00Z");
const order = (id: string, paymentIntentId: string | null): HeldOrder => ({
  id,
  paymentIntentId,
  buyerTenantId: "buyer-1",
  sellerTenantId: "seller-1",
  createdAt: new Date("2026-12-02T12:00:00Z"),
});

test("cancels only orders whose authorization Stripe has cancelled", async () => {
  const cancelled: string[] = [];
  let cutoff: Date | null = null;

  const summary = await releaseExpiredWeighedHolds({
    now,
    findHeldOrders: async (createdBefore) => {
      cutoff = createdBefore;
      return [
        order("expired", "pi_1"),
        order("still-valid", "pi_2"),
        order("no-pi", null),
      ];
    },
    getPaymentIntentStatus: async (id) =>
      id === "pi_1" ? "canceled" : "requires_capture",
    cancelExpiredOrder: async (held) => {
      cancelled.push(held.id);
      return true;
    },
  });

  assert.deepEqual(cancelled, ["expired"]);
  assert.deepEqual(summary, {
    checked: 3,
    cancelled: 1,
    stillHeld: 2,
    failed: 0,
  });
  // Only orders at least 6 days old are looked at.
  assert.equal(cutoff!.toISOString(), "2026-12-04T12:00:00.000Z");
});

test("an order weighed at the same moment is not counted as cancelled", async () => {
  const summary = await releaseExpiredWeighedHolds({
    now,
    findHeldOrders: async () => [order("raced", "pi_1")],
    getPaymentIntentStatus: async () => "canceled",
    // The guarded UPDATE matched nothing: the producer captured first.
    cancelExpiredOrder: async () => false,
  });

  assert.equal(summary.cancelled, 0);
});

test("one failing order does not stop the others", async () => {
  const cancelled: string[] = [];
  const summary = await releaseExpiredWeighedHolds({
    now,
    findHeldOrders: async () => [
      order("broken", "pi_err"),
      order("ok", "pi_ok"),
    ],
    getPaymentIntentStatus: async (id) => {
      if (id === "pi_err") throw new Error("stripe down");
      return "canceled";
    },
    cancelExpiredOrder: async (held) => {
      cancelled.push(held.id);
      return true;
    },
  });

  assert.deepEqual(cancelled, ["ok"]);
  assert.equal(summary.failed, 1);
  assert.equal(summary.cancelled, 1);
});
