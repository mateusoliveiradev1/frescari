import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategoryRegionCommercialSnapshot,
  buildFaqPageJsonLd,
  buildProductCommercialSnapshot,
  buildSupplierRegionCommercialSnapshot,
} from "./catalog-commercial";

test("buildProductCommercialSnapshot converts live lots into commercial metrics and FAQs", () => {
  const snapshot = buildProductCommercialSnapshot(
    [
      {
        deliveryRadiusKm: 18,
        farmCity: "Campinas",
        farmName: "Sitio Primavera",
        farmState: "SP",
        finalPrice: 6.5,
        freshnessScore: 91,
        pricingType: "WEIGHT",
        saleUnit: "kg",
        status: "fresco",
        unit: "kg",
      },
      {
        deliveryRadiusKm: 25,
        farmCity: "Jaguariuna",
        farmName: "Vale Verde",
        farmState: "SP",
        finalPrice: 7.2,
        freshnessScore: 77,
        pricingType: "WEIGHT",
        saleUnit: "kg",
        status: "last_chance",
        unit: "kg",
      },
    ],
    {
      productName: "Tomate cereja",
    },
  );

  assert.equal(snapshot.metrics.length, 4);
  assert.equal(snapshot.metrics[0]?.label, "Faixa ativa");
  assert.match(snapshot.metrics[0]?.value ?? "", /R\$/);
  assert.equal(snapshot.metrics[1]?.value, "por peso");
  assert.match(snapshot.metrics[1]?.detail ?? "", /0,5 kg/);
  assert.match(snapshot.metrics[2]?.value ?? "", /2 produtores/);
  assert.equal(snapshot.metrics[3]?.value, "84/100");
  assert.equal(snapshot.faqItems.length, 4);
  assert.match(snapshot.faqItems[0]?.question ?? "", /Tomate cereja/);
  assert.match(snapshot.faqItems[2]?.answer ?? "", /2 rotas locais/);
  assert.match(snapshot.faqItems[3]?.answer ?? "", /84\/100/);
});

test("buildProductCommercialSnapshot falls back when freshness and delivery metadata are missing", () => {
  const snapshot = buildProductCommercialSnapshot(
    [
      {
        deliveryRadiusKm: null,
        farmCity: "Campinas",
        farmName: "Sitio Primavera",
        farmState: "SP",
        finalPrice: 4.4,
        freshnessScore: null,
        pricingType: "UNIT",
        saleUnit: "unit",
        status: "last_chance",
        unit: "unit",
      },
    ],
    {
      productName: "Alface americana",
      regionName: "Campinas, SP",
    },
  );

  assert.equal(snapshot.metrics[3]?.value, "1 alerta");
  assert.match(snapshot.faqItems[1]?.answer ?? "", /por unidade/);
  assert.match(snapshot.faqItems[2]?.answer ?? "", /nesta rota/);
  assert.match(snapshot.faqItems[3]?.answer ?? "", /janela final/);
});

test("buildSupplierRegionCommercialSnapshot summarises local supplier density", () => {
  const snapshot = buildSupplierRegionCommercialSnapshot(
    [
      {
        categoryName: "Folhosos",
        deliveryRadiusKm: 14,
        farmName: "Sitio Primavera",
        finalPrice: 4.4,
        freshnessScore: 89,
        pricingType: "UNIT",
        productName: "Alface americana",
        saleUnit: "unit",
        status: "fresco",
        unit: "unit",
      },
      {
        categoryName: "Frutas",
        deliveryRadiusKm: 22,
        farmName: "Vale Verde",
        finalPrice: 8.1,
        freshnessScore: 76,
        pricingType: "BOX",
        productName: "Morango",
        saleUnit: "box",
        status: "last_chance",
        unit: "box",
      },
      {
        categoryName: "Frutas",
        deliveryRadiusKm: 18,
        farmName: "Vale Verde",
        finalPrice: 7.4,
        freshnessScore: 82,
        pricingType: "BOX",
        productName: "Manga tommy",
        saleUnit: "box",
        status: "fresco",
        unit: "box",
      },
    ],
    {
      regionName: "Campinas, SP",
    },
  );

  assert.equal(snapshot.metrics.length, 4);
  assert.equal(snapshot.metrics[0]?.label, "Entrada de preco");
  assert.match(snapshot.metrics[0]?.value ?? "", /R\$/);
  assert.equal(snapshot.metrics[1]?.value, "2 produtores");
  assert.equal(snapshot.metrics[2]?.value, "2 categorias");
  assert.equal(snapshot.metrics[3]?.value, "82/100");
  assert.equal(snapshot.faqItems.length, 4);
  assert.match(snapshot.faqItems[1]?.answer ?? "", /Folhosos/);
  assert.match(snapshot.faqItems[1]?.answer ?? "", /Morango/);
  assert.match(snapshot.faqItems[2]?.answer ?? "", /Campinas, SP/);
});

test("buildCategoryRegionCommercialSnapshot summarises category supply by region", () => {
  const snapshot = buildCategoryRegionCommercialSnapshot(
    [
      {
        categoryName: "Frutas",
        deliveryRadiusKm: 20,
        farmName: "Santo Pomar",
        finalPrice: 10.2,
        freshnessScore: 90,
        pricingType: "BOX",
        productName: "Manga palmer",
        saleUnit: "box",
        status: "fresco",
        unit: "box",
      },
      {
        categoryName: "Frutas",
        deliveryRadiusKm: 28,
        farmName: "Vale Dourado",
        finalPrice: 12.5,
        freshnessScore: 84,
        pricingType: "BOX",
        productName: "Manga tommy",
        saleUnit: "box",
        status: "last_chance",
        unit: "box",
      },
    ],
    {
      categoryName: "Frutas",
      regionName: "Jundiai, SP",
    },
  );

  assert.equal(snapshot.metrics.length, 4);
  assert.equal(snapshot.metrics[0]?.label, "Faixa local");
  assert.match(snapshot.metrics[0]?.value ?? "", /R\$/);
  assert.equal(snapshot.metrics[1]?.value, "2 produtos");
  assert.equal(snapshot.metrics[2]?.value, "2 produtores / 2 lotes");
  assert.equal(snapshot.metrics[3]?.value, "87/100");
  assert.equal(snapshot.faqItems.length, 4);
  assert.match(snapshot.faqItems[1]?.answer ?? "", /Manga palmer/);
  assert.match(snapshot.faqItems[2]?.answer ?? "", /2 produtores ativos/);
  assert.match(snapshot.faqItems[3]?.answer ?? "", /24 km/);
});

test("buildFaqPageJsonLd emits a valid FAQPage payload", () => {
  const payload = buildFaqPageJsonLd([
    {
      answer: "Resposta curta.",
      question: "Pergunta curta?",
    },
  ]);

  assert.equal(payload["@type"], "FAQPage");
  assert.equal(payload.mainEntity.length, 1);
  assert.equal(payload.mainEntity[0]?.["@type"], "Question");
  assert.equal(payload.mainEntity[0]?.acceptedAnswer?.["@type"], "Answer");
});
