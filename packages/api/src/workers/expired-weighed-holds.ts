// Orders with items sold by weight are paid with a card authorization that
// the producer captures after weighing. If nobody weighs before the
// authorization expires (7 days), Stripe cancels it and the producer can no
// longer be paid: the order would sit in "aguardando pesagem" forever with
// its stock taken. This job finds those orders, cancels them and returns the
// stock. It acts only on what Stripe reports ("canceled"), never on age
// alone, so a producer can still weigh until the very last moment.

export type HeldOrder = {
  id: string;
  paymentIntentId: string | null;
  buyerTenantId: string;
  sellerTenantId: string;
  createdAt: Date;
};

export type ExpiredHoldsDeps = {
  /** Orders still awaiting weight / capture, created before `createdBefore`. */
  findHeldOrders(createdBefore: Date): Promise<HeldOrder[]>;
  /** Current Stripe status of the payment ("requires_capture", "canceled", ...). */
  getPaymentIntentStatus(paymentIntentId: string): Promise<string>;
  /**
   * Cancels the order and restocks its lots, only if it is still in a held
   * status (a producer weighing at the same moment wins). Returns whether
   * this call cancelled it.
   */
  cancelExpiredOrder(order: HeldOrder): Promise<boolean>;
  now: Date;
};

// Authorizations last 7 days; nothing younger than this can have expired.
const MIN_AGE_MS = 6 * 24 * 60 * 60 * 1000;

export async function releaseExpiredWeighedHolds(deps: ExpiredHoldsDeps) {
  const candidates = await deps.findHeldOrders(
    new Date(deps.now.getTime() - MIN_AGE_MS),
  );
  const summary = {
    checked: candidates.length,
    cancelled: 0,
    stillHeld: 0,
    failed: 0,
  };

  for (const order of candidates) {
    if (!order.paymentIntentId) {
      summary.stillHeld += 1;
      continue;
    }

    try {
      const status = await deps.getPaymentIntentStatus(order.paymentIntentId);

      if (status !== "canceled") {
        summary.stillHeld += 1;
        continue;
      }

      if (await deps.cancelExpiredOrder(order)) {
        summary.cancelled += 1;
      }
    } catch (error) {
      // One bad order must not stop the others; the next run retries it.
      summary.failed += 1;
      console.error(
        `[expired-weighed-holds] failed for order ${order.id}`,
        error,
      );
    }
  }

  return summary;
}
