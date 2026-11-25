/**
 * Delivery details the checkout puts in the Stripe session metadata.
 * Anything missing or malformed becomes null instead of failing the order:
 * the payment already happened, and the producer can still see the order.
 */
export function parseDeliveryDetailsMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
) {
  const start = parseIsoDate(metadata?.delivery_window_start);
  const end = parseIsoDate(metadata?.delivery_window_end);
  const hasValidWindow =
    start !== null && end !== null && end.getTime() > start.getTime();
  const notes = metadata?.delivery_notes?.trim().slice(0, 500) || null;

  return {
    deliveryWindowStart: hasValidWindow ? start : null,
    deliveryWindowEnd: hasValidWindow ? end : null,
    deliveryNotes: notes,
  };
}

function parseIsoDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
