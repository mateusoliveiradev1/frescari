import Stripe from "stripe";
import {
  authDb,
  enableRlsBypassContext,
  orderItems,
  orders,
  productLots,
} from "@frescari/db";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { emitOrderNotifications } from "@frescari/api/notifications/domain-events";
import {
  releaseExpiredWeighedHolds,
  type HeldOrder,
} from "@frescari/api/workers/expired-weighed-holds";

import { sanitizeEnvValue } from "@/lib/env";

const HELD_STATUSES = ["awaiting_weight", "payment_authorized"] as const;

let stripeClient: Stripe | null = null;

function getStripeClient() {
  const key = sanitizeEnvValue(process.env.STRIPE_SECRET_KEY);
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

async function findHeldOrders(createdBefore: Date): Promise<HeldOrder[]> {
  return authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);

    return tx
      .select({
        id: orders.id,
        paymentIntentId: orders.paymentIntentId,
        buyerTenantId: orders.buyerTenantId,
        sellerTenantId: orders.sellerTenantId,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.status, [...HELD_STATUSES]),
          lt(orders.createdAt, createdBefore),
        ),
      );
  });
}

async function cancelExpiredOrder(order: HeldOrder) {
  return authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);

    // Only from a held status: a producer capturing at the same moment wins.
    const cancelled = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(orders.id, order.id),
          inArray(orders.status, [...HELD_STATUSES]),
        ),
      )
      .returning({ id: orders.id });

    if (cancelled.length === 0) {
      return false;
    }

    const items = await tx
      .select({ lotId: orderItems.lotId, qty: orderItems.qty })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    for (const item of items) {
      if (!item.lotId) continue;
      await tx
        .update(productLots)
        .set({
          availableQty: sql`${productLots.availableQty} + ${item.qty}::numeric`,
        })
        .where(eq(productLots.id, item.lotId));
    }

    await emitOrderNotifications({
      tx,
      type: "order_cancelled",
      orderId: order.id,
      buyerTenantId: order.buyerTenantId,
      sellerTenantId: order.sellerTenantId,
      metadata: {
        orderId: order.id,
        cancelledBy: "system",
        reason: "authorization_expired",
        // Nothing was charged: the card authorization expired uncaptured.
        payment: "none",
      },
    });

    return true;
  });
}

export function runExpiredWeighedHolds(now = new Date()) {
  return releaseExpiredWeighedHolds({
    now,
    findHeldOrders,
    getPaymentIntentStatus: async (paymentIntentId) =>
      (await getStripeClient().paymentIntents.retrieve(paymentIntentId)).status,
    cancelExpiredOrder,
  });
}
