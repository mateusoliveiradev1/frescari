import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProducerStorefrontPath,
  buildStorefrontShareText,
  buildWhatsAppShareUrl,
} from "./producer-storefront";

test("storefront path keeps the slug as a single segment", () => {
  assert.equal(
    buildProducerStorefrontPath("sitio-boa-vista-m1x2"),
    "/produtor/sitio-boa-vista-m1x2",
  );
  assert.equal(buildProducerStorefrontPath("a/b"), "/produtor/a%2Fb");
});

test("WhatsApp share link carries the encoded text and no phone number", () => {
  const text = buildStorefrontShareText({
    producerName: "Sítio Boa Vista & Filhos",
    url: "https://frescari.com.br/produtor/sitio-boa-vista",
  });
  const url = new URL(buildWhatsAppShareUrl(text));

  assert.equal(url.origin + url.pathname, "https://wa.me/");
  assert.equal(url.searchParams.get("text"), text);
  assert.match(text, /Sítio Boa Vista & Filhos/);
  assert.match(text, /https:\/\/frescari\.com\.br\/produtor\/sitio-boa-vista$/);
});
