import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createLotInputSchema,
  isAllowedLotImageUrl,
  updateLotInputSchema,
  upsertFarmInputSchema,
} from "./index";

const baseLot = {
  productId: "550e8400-e29b-41d4-a716-446655440000",
  harvestDate: "2026-03-10",
  expiryDate: "2026-03-12",
  availableQty: "4",
  unit: "kg",
  pricingType: "WEIGHT",
  lotCode: "LOTE-1",
};

test("a lot needs a price above zero", () => {
  assert.equal(
    createLotInputSchema.safeParse({ ...baseLot, priceOverride: "0" }).success,
    false,
  );
  assert.equal(
    createLotInputSchema.safeParse({ ...baseLot, priceOverride: "0,00" })
      .success,
    false,
  );
  assert.equal(createLotInputSchema.safeParse(baseLot).success, false);
  assert.equal(
    createLotInputSchema.safeParse({ ...baseLot, priceOverride: "7,90" })
      .success,
    true,
  );

  const id = "550e8400-e29b-41d4-a716-446655440001";
  assert.equal(
    updateLotInputSchema.safeParse({ id, priceOverride: 0 }).success,
    false,
  );
  assert.equal(
    updateLotInputSchema.safeParse({ id, priceOverride: null }).success,
    false,
  );
  assert.equal(
    updateLotInputSchema.safeParse({ id, priceOverride: 3.5 }).success,
    true,
  );
});

test("lot photos come only from our upload storage or the catalog defaults", () => {
  assert.equal(isAllowedLotImageUrl("https://abc123.ufs.sh/f/photo.jpg"), true);
  assert.equal(isAllowedLotImageUrl("https://utfs.io/f/photo.jpg"), true);
  assert.equal(
    isAllowedLotImageUrl("https://images.unsplash.com/photo-1"),
    true,
  );
  assert.equal(isAllowedLotImageUrl("/images/products/tomate.jpg"), true);

  assert.equal(isAllowedLotImageUrl("https://evil.example/tracker.png"), false);
  assert.equal(
    isAllowedLotImageUrl("https://ufs.sh.evil.example/x.png"),
    false,
  );
  assert.equal(isAllowedLotImageUrl("http://utfs.io/f/photo.jpg"), false);
  assert.equal(isAllowedLotImageUrl("//evil.example/x.png"), false);
  assert.equal(isAllowedLotImageUrl("javascript:alert(1)"), false);

  assert.equal(
    createLotInputSchema.safeParse({
      ...baseLot,
      priceOverride: 5,
      imageUrl: "https://evil.example/x.png",
    }).success,
    false,
  );
});

test("a farm must say how far it delivers (1 to 500 km)", () => {
  const farm = {
    name: "Sitio Boa Terra",
    address: {
      street: "Estrada Municipal",
      number: "100",
      city: "Ibiuna",
      state: "SP",
      postalCode: "18150-000",
    },
    location: { latitude: -23.65, longitude: -47.22 },
    pricePerKm: 1.5,
    minOrderValue: 50,
    freeShippingThreshold: null,
  };

  assert.equal(
    upsertFarmInputSchema.safeParse({ ...farm, deliveryRadiusKm: 0 }).success,
    false,
  );
  assert.equal(
    upsertFarmInputSchema.safeParse({ ...farm, deliveryRadiusKm: 501 }).success,
    false,
  );
  assert.equal(
    upsertFarmInputSchema.safeParse({ ...farm, deliveryRadiusKm: 30 }).success,
    true,
  );
});
