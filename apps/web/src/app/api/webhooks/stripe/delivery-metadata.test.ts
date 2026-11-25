import assert from "node:assert/strict";
import test from "node:test";

import { parseDeliveryDetailsMetadata } from "./delivery-metadata";

test("a valid window and notes are kept", () => {
  const details = parseDeliveryDetailsMetadata({
    delivery_window_start: "2026-11-26T11:00:00.000Z",
    delivery_window_end: "2026-11-26T15:00:00.000Z",
    delivery_notes: "  Portao azul, tocar a campainha  ",
  });

  assert.equal(
    details.deliveryWindowStart?.toISOString(),
    "2026-11-26T11:00:00.000Z",
  );
  assert.equal(
    details.deliveryWindowEnd?.toISOString(),
    "2026-11-26T15:00:00.000Z",
  );
  assert.equal(details.deliveryNotes, "Portao azul, tocar a campainha");
});

test("missing, malformed or reversed windows become null", () => {
  assert.deepEqual(parseDeliveryDetailsMetadata(undefined), {
    deliveryWindowStart: null,
    deliveryWindowEnd: null,
    deliveryNotes: null,
  });

  const reversed = parseDeliveryDetailsMetadata({
    delivery_window_start: "2026-11-26T15:00:00.000Z",
    delivery_window_end: "2026-11-26T11:00:00.000Z",
  });
  assert.equal(reversed.deliveryWindowStart, null);

  const garbage = parseDeliveryDetailsMetadata({
    delivery_window_start: "amanha",
    delivery_window_end: "2026-11-26T15:00:00.000Z",
    delivery_notes: "   ",
  });
  assert.equal(garbage.deliveryWindowStart, null);
  assert.equal(garbage.deliveryNotes, null);
});
