import assert from "node:assert/strict";
import test from "node:test";

import {
  STRIPE_METADATA_VALUE_LIMIT,
  readChunkedMetadata,
  writeChunkedMetadata,
} from "./stripe-metadata";

test("short values keep their plain key (old sessions read the same)", () => {
  assert.deepEqual(writeChunkedMetadata("items", "[1,2]"), { items: "[1,2]" });
  assert.equal(readChunkedMetadata({ items: "[1,2]" }, "items"), "[1,2]");
  assert.deepEqual(writeChunkedMetadata("items", ""), {});
  assert.deepEqual(writeChunkedMetadata("items", undefined), {});
});

test("a cart too long for one Stripe metadata value round-trips in parts", () => {
  const cart = JSON.stringify(
    Array.from({ length: 12 }, (_, index) => ({
      lotId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      qty: 3,
      pt: "UNIT",
      name: "Tomate italiano organico selecionado",
      price: 12.9,
    })),
  );
  assert.ok(cart.length > STRIPE_METADATA_VALUE_LIMIT * 2);

  const metadata = writeChunkedMetadata("items", cart);
  for (const value of Object.values(metadata)) {
    assert.ok(value.length <= STRIPE_METADATA_VALUE_LIMIT);
  }
  assert.equal(metadata.items, undefined);
  assert.equal(readChunkedMetadata(metadata, "items"), cart);
});

test("a missing part reads as absent, never as a truncated value", () => {
  const metadata = writeChunkedMetadata("items", "x".repeat(1200));
  delete metadata.items__1;
  assert.equal(readChunkedMetadata(metadata, "items"), undefined);
});
