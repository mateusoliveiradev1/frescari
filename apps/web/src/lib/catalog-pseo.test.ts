import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOfferAreaServed,
  buildSupplierRegionPath,
  buildSupplierRegionSummaries,
} from "./catalog-pseo";

test("buildSupplierRegionPath nests supplier regions under the catalog", () => {
  assert.equal(
    buildSupplierRegionPath("sp", "sao-paulo"),
    "/catalogo/fornecedores/sp/sao-paulo",
  );
});

test("buildSupplierRegionSummaries groups lots by city and state", () => {
  const summaries = buildSupplierRegionSummaries([
    {
      farmName: "Sitio Primavera",
      productName: "Tomate",
      categoryName: "Hortalicas",
      finalPrice: 4.99,
      farmCity: "Sao Paulo",
      farmState: "SP",
    },
    {
      farmName: "Fazenda Aurora",
      productName: "Alface",
      categoryName: "Folhosas",
      finalPrice: 3.49,
      farmCity: "Sao Paulo",
      farmState: "SP",
    },
    {
      farmName: "Vale Verde",
      productName: "Couve",
      categoryName: "Folhosas",
      finalPrice: 2.99,
      farmCity: "Campinas",
      farmState: "SP",
    },
    {
      farmName: "Sem Endereco",
      productName: "Rucula",
      categoryName: "Folhosas",
      finalPrice: 1.99,
      farmCity: null,
      farmState: "SP",
    },
  ]);

  assert.equal(summaries.length, 2);

  const saoPaulo = summaries.find(
    (summary) => summary.path === "/catalogo/fornecedores/sp/sao-paulo",
  );

  assert.ok(saoPaulo);
  assert.equal(saoPaulo.cityName, "Sao Paulo");
  assert.equal(saoPaulo.stateName, "SP");
  assert.equal(saoPaulo.farmCount, 2);
  assert.equal(saoPaulo.productCount, 2);
  assert.equal(saoPaulo.lotCount, 2);
  assert.equal(saoPaulo.lowestPrice, 3.49);
  assert.match(saoPaulo.description, /sao paulo/i);
  assert.match(saoPaulo.description, /2 lotes/i);
});

test("buildOfferAreaServed returns a GeoCircle when the farm has coordinates", () => {
  assert.deepEqual(
    buildOfferAreaServed({
      farmCity: "Sao Paulo",
      farmState: "SP",
      farmLatitude: -23.55,
      farmLongitude: -46.63,
      deliveryRadiusKm: 18,
    }),
    {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: -23.55,
        longitude: -46.63,
      },
      geoRadius: 18000,
    },
  );
});

test("buildOfferAreaServed falls back to an AdministrativeArea without coordinates", () => {
  assert.deepEqual(
    buildOfferAreaServed({
      farmCity: "Campinas",
      farmState: "SP",
      farmLatitude: null,
      farmLongitude: null,
      deliveryRadiusKm: null,
    }),
    {
      "@type": "AdministrativeArea",
      name: "Campinas, SP",
    },
  );
});
