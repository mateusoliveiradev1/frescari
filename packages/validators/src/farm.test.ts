import { test } from "node:test";
import assert from "node:assert/strict";

import * as validators from "./index";

const { farmCoordinatesSchema, farmPointSchema, isWithinBrazil } = validators;

const validFarmPayload = {
  name: "Fazenda Boa Esperanca",
  address: {
    street: "Estrada Municipal",
    number: "100",
    neighborhood: "Zona Rural",
    city: "Ibiuna",
    state: "SP",
    postalCode: "18150-000",
    country: "BR",
    complement: "Galpao 2",
  },
  location: {
    latitude: -23.6567,
    longitude: -47.2223,
  },
  deliveryRadiusKm: 35,
  pricePerKm: 4.5,
  minOrderValue: 50,
  freeShippingThreshold: 120,
};

test("upsertFarmInputSchema accepts a valid structured farm payload", () => {
  const schema = validators.upsertFarmInputSchema;

  assert.ok(schema, "upsertFarmInputSchema should be exported");

  const result = schema.safeParse(validFarmPayload);
  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(
      result.data.location.latitude,
      validFarmPayload.location.latitude,
    );
    assert.equal(result.data.address.city, validFarmPayload.address.city);
    assert.equal(
      result.data.deliveryRadiusKm,
      validFarmPayload.deliveryRadiusKm,
    );
    assert.equal(result.data.pricePerKm, validFarmPayload.pricePerKm);
    assert.equal(result.data.minOrderValue, validFarmPayload.minOrderValue);
    assert.equal(
      result.data.freeShippingThreshold,
      validFarmPayload.freeShippingThreshold,
    );
  }
});

test("saveFarmLocationInputSchema rejects invalid coordinates and malformed address data", () => {
  const schema = validators.saveFarmLocationInputSchema;

  assert.ok(schema, "saveFarmLocationInputSchema should be exported");

  const result = schema.safeParse({
    name: "",
    address: {
      street: "",
      number: "",
      city: "",
      state: "Sao Paulo",
      postalCode: "abc",
    },
    location: {
      latitude: -120,
      longitude: 240,
    },
    deliveryRadiusKm: -1,
    pricePerKm: -5,
    minOrderValue: -10,
    freeShippingThreshold: -20,
  });

  assert.equal(result.success, false);

  if (!result.success) {
    const issuePaths = result.error.issues.map(
      (issue: { path: Array<string | number> }) => issue.path.join("."),
    );
    assert.ok(issuePaths.includes("name"));
    assert.ok(issuePaths.includes("address.street"));
    assert.ok(issuePaths.includes("address.city"));
    assert.ok(issuePaths.includes("location.latitude"));
    assert.ok(issuePaths.includes("location.longitude"));
    assert.ok(issuePaths.includes("deliveryRadiusKm"));
    assert.ok(issuePaths.includes("pricePerKm"));
    assert.ok(issuePaths.includes("minOrderValue"));
    assert.ok(issuePaths.includes("freeShippingThreshold"));
  }
});

test("isWithinBrazil accepts Brazilian farms and rejects ocean points", () => {
  assert.equal(isWithinBrazil({ latitude: -17.857, longitude: -41.505 }), true); // Teofilo Otoni, MG
  assert.equal(isWithinBrazil({ latitude: -3.854, longitude: -32.424 }), true); // Fernando de Noronha
  assert.equal(
    isWithinBrazil({ latitude: -17.71435, longitude: -1.145153 }),
    false,
  ); // Atlantic, reported bug
  assert.equal(isWithinBrazil({ latitude: Number.NaN, longitude: -47 }), false);
});

test("farm coordinate schemas refuse points outside Brazil", () => {
  const ocean = { latitude: -17.71435, longitude: -1.145153 };

  assert.equal(farmCoordinatesSchema.safeParse(ocean).success, false);
  assert.equal(
    farmPointSchema.safeParse([ocean.longitude, ocean.latitude]).success,
    false,
  );
  assert.equal(
    farmCoordinatesSchema.safeParse({ latitude: -23.7112, longitude: -47.4251 })
      .success,
    true,
  );
  assert.equal(farmPointSchema.safeParse([-47.4251, -23.7112]).success, true);
});
