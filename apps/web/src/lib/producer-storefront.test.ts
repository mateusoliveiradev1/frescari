import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProducerStorefrontPath,
  buildStorefrontShareText,
  buildStorefrontShareUrl,
  buildWhatsAppShareUrl,
  pickStorefrontHighlights,
} from "./producer-storefront";

const formatPrice = (value: number) => `R$ ${value.toFixed(2)}`;

test("storefront path keeps the slug as a single segment", () => {
  assert.equal(
    buildProducerStorefrontPath("sitio-boa-vista-m1x2"),
    "/produtor/sitio-boa-vista-m1x2",
  );
  assert.equal(buildProducerStorefrontPath("a/b"), "/produtor/a%2Fb");
});

test("share URL tags the channel without touching the path", () => {
  const url = new URL(
    buildStorefrontShareUrl(
      "https://frescari.com.br/produtor/sitio-boa-vista",
      "whatsapp",
    ),
  );

  assert.equal(url.pathname, "/produtor/sitio-boa-vista");
  assert.equal(url.searchParams.get("utm_source"), "whatsapp");
  assert.equal(url.searchParams.get("utm_medium"), "share");
  assert.equal(url.searchParams.get("utm_campaign"), "vitrine");
});

test("highlights keep one entry per product, at its cheapest lot", () => {
  const { highlights, productCount } = pickStorefrontHighlights(
    [
      { productName: "Tomate", finalPrice: 9, saleUnit: "kg" },
      { productName: "Alface", finalPrice: 3, saleUnit: "unit" },
      { productName: "Tomate", finalPrice: 7.5, saleUnit: "kg" },
      { productName: "Batata", finalPrice: 5, saleUnit: "kg" },
    ],
    formatPrice,
    2,
  );

  assert.equal(productCount, 3);
  assert.deepEqual(highlights, [
    { name: "Tomate", priceLabel: "R$ 7.50/kg" },
    { name: "Alface", priceLabel: "R$ 3.00/un" },
  ]);
});

test("share text lists the products, the remainder and ends with the link", () => {
  const url =
    "https://frescari.com.br/produtor/sitio-boa-vista?utm_source=whatsapp";
  const text = buildStorefrontShareText({
    producerName: "Sítio Boa Vista",
    place: "Pirangi - SP",
    highlights: [
      { name: "Tomate", priceLabel: "R$ 7,50/kg" },
      { name: "Alface", priceLabel: "R$ 3,00/un" },
    ],
    productCount: 5,
    url,
  });

  assert.match(text, /^\*Sítio Boa Vista\* · Pirangi - SP/);
  // Emoji (astral characters) arrive as "?" on WhatsApp Web via wa.me.
  assert.doesNotMatch(text, /[\u{10000}-\u{10FFFF}]/u);
  assert.match(text, /• Tomate: R\$ 7,50\/kg/);
  assert.match(text, /…e mais 3 produtos/);
  assert.equal(text.split("\n").at(-1), url);
});

test("share text without products still ends with the link", () => {
  const text = buildStorefrontShareText({
    producerName: "Sítio Boa Vista",
    url: "https://frescari.com.br/produtor/x",
    fromProducer: true,
  });

  assert.doesNotMatch(text, /•/);
  assert.equal(text.split("\n").at(-1), "https://frescari.com.br/produtor/x");
});

test("WhatsApp share link carries the encoded text and no phone number", () => {
  const text = "*Sítio & Filhos*\nhttps://frescari.com.br/produtor/x";
  const url = new URL(buildWhatsAppShareUrl(text));

  assert.equal(url.origin + url.pathname, "https://wa.me/");
  assert.equal(url.searchParams.get("text"), text);
});

test("initials skip connectors and fall back to a placeholder", async () => {
  const { getProducerInitials } = await import("./producer-storefront");

  assert.equal(getProducerInitials("Sítio da Serra Verde"), "SS");
  assert.equal(getProducerInitials("DANIEL"), "D");
  assert.equal(getProducerInitials("Zé e Maria"), "ZM");
  assert.equal(getProducerInitials("   "), "?");
});

test("lots are grouped by category, keeping their order", async () => {
  const { groupLotsByCategory } = await import("./producer-storefront");
  const groups = groupLotsByCategory([
    { id: 1, categorySlug: "folhas", categoryName: "Folhas" },
    { id: 2, categorySlug: "raizes", categoryName: "Raízes" },
    { id: 3, categorySlug: "folhas", categoryName: "Folhas" },
  ]);

  assert.deepEqual(
    groups.map((group) => [group.slug, group.lots.map((lot) => lot.id)]),
    [
      ["folhas", [1, 3]],
      ["raizes", [2]],
    ],
  );
});
