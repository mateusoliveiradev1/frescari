import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCategoryRegionPath,
  buildCategoryRegionSummaries,
  buildOfferAreaServed,
  buildProductRegionPath,
  buildProductRegionSummaries,
  buildSupplierRegionPath,
  buildSupplierRegionSummaries,
} from "./catalog-pseo";

test("buildSupplierRegionPath nests supplier regions under the catalog", () => {
  assert.equal(
    buildSupplierRegionPath("sp", "sao-paulo"),
    "/catalogo/fornecedores/sp/sao-paulo",
  );
});

test("buildCategoryRegionPath nests local category pages under the category", () => {
  assert.equal(
    buildCategoryRegionPath("folhosas", "sp", "campinas"),
    "/catalogo/folhosas/em/sp/campinas",
  );
});

test("buildProductRegionPath nests local product pages under the product", () => {
  assert.equal(
    buildProductRegionPath("folhosas", "alface", "sp", "campinas"),
    "/catalogo/folhosas/alface/em/sp/campinas",
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

test("buildCategoryRegionSummaries groups by category and filters thin local pages", () => {
  const summaries = buildCategoryRegionSummaries([
    {
      categorySlug: "folhosas",
      categoryName: "Folhosas",
      farmName: "Sitio Primavera",
      productName: "Alface",
      finalPrice: 3.49,
      farmCity: "Campinas",
      farmState: "SP",
    },
    {
      categorySlug: "folhosas",
      categoryName: "Folhosas",
      farmName: "Vale Verde",
      productName: "Couve",
      finalPrice: 2.99,
      farmCity: "Campinas",
      farmState: "SP",
    },
    {
      categorySlug: "raizes",
      categoryName: "Raizes",
      farmName: "Sitio Primavera",
      productName: "Beterraba",
      finalPrice: 4.89,
      farmCity: "Campinas",
      farmState: "SP",
    },
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.categorySlug, "folhosas");
  assert.equal(summaries[0]?.categoryName, "Folhosas");
  assert.equal(summaries[0]?.categoryPath, "/catalogo/folhosas");
  assert.equal(summaries[0]?.stateSlug, "sp");
  assert.equal(summaries[0]?.citySlug, "campinas");
  assert.equal(summaries[0]?.stateName, "SP");
  assert.equal(summaries[0]?.cityName, "Campinas");
  assert.equal(summaries[0]?.regionName, "Campinas, SP");
  assert.equal(summaries[0]?.name, "Folhosas em Campinas, SP");
  assert.equal(summaries[0]?.path, "/catalogo/folhosas/em/sp/campinas");
  assert.equal(summaries[0]?.farmCount, 2);
  assert.equal(summaries[0]?.productCount, 2);
  assert.equal(summaries[0]?.lotCount, 2);
  assert.equal(summaries[0]?.lowestPrice, 2.99);
  assert.match(summaries[0]?.description ?? "", /folhosas em Campinas, SP/i);
  assert.match(summaries[0]?.description ?? "", /2 lotes ativos/i);
});

test("buildProductRegionSummaries groups by product and filters thin local pages", () => {
  const summaries = buildProductRegionSummaries([
    {
      categorySlug: "folhosas",
      categoryName: "Folhosas",
      productSlug: "alface",
      productName: "Alface",
      saleUnit: "kg",
      imageUrl: "https://example.com/alface.jpg",
      farmName: "Sitio Primavera",
      finalPrice: 3.49,
      farmCity: "Campinas",
      farmState: "SP",
    },
    {
      categorySlug: "folhosas",
      categoryName: "Folhosas",
      productSlug: "alface",
      productName: "Alface",
      saleUnit: "kg",
      imageUrl: null,
      farmName: "Vale Verde",
      finalPrice: 3.99,
      farmCity: "Campinas",
      farmState: "SP",
    },
    {
      categorySlug: "folhosas",
      categoryName: "Folhosas",
      productSlug: "rucula",
      productName: "Rucula",
      saleUnit: "maco",
      imageUrl: null,
      farmName: "Sitio Primavera",
      finalPrice: 2.59,
      farmCity: "Campinas",
      farmState: "SP",
    },
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.categorySlug, "folhosas");
  assert.equal(summaries[0]?.productSlug, "alface");
  assert.equal(summaries[0]?.productName, "Alface");
  assert.equal(summaries[0]?.productPath, "/catalogo/folhosas/alface");
  assert.equal(summaries[0]?.path, "/catalogo/folhosas/alface/em/sp/campinas");
  assert.equal(summaries[0]?.imageUrl, "https://example.com/alface.jpg");
  assert.equal(summaries[0]?.saleUnit, "kg");
  assert.equal(summaries[0]?.farmCount, 2);
  assert.equal(summaries[0]?.lotCount, 2);
  assert.equal(summaries[0]?.offerCount, 2);
  assert.equal(summaries[0]?.lowestPrice, 3.49);
  assert.equal(summaries[0]?.highestPrice, 3.99);
  assert.deepEqual(summaries[0]?.farmNames, ["Sitio Primavera", "Vale Verde"]);
  assert.match(summaries[0]?.description ?? "", /Alface em Campinas, SP/i);
  assert.match(summaries[0]?.description ?? "", /2 ofertas ativas/i);
});
