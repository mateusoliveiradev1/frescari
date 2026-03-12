import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeText,
  serializeJsonLd,
  slugifySegment,
} from "./catalog-seo";

test("slugifySegment normalizes accents and punctuation", () => {
  assert.equal(slugifySegment("Tomate Débora Orgânico"), "tomate-debora-organico");
  assert.equal(slugifySegment("  Alface   Crespa / Hidropônica  "), "alface-crespa-hidroponica");
});

test("sanitizeText removes tags and collapses whitespace", () => {
  assert.equal(
    sanitizeText('  <strong>Tomate</strong>  fresco  direto da <em>horta</em>  '),
    "Tomate fresco direto da horta",
  );
});

test("serializeJsonLd escapes unsafe html characters", () => {
  const payload = serializeJsonLd({
    name: '</script><script>alert("xss")</script>',
    description: "Oferta <especial> & fresca",
  });

  assert.ok(!payload.includes("</script>"));
  assert.ok(!payload.includes("<script>"));
  assert.ok(!payload.includes("<especial>"));
  assert.ok(payload.includes("\\u003c/script\\u003e"));
  assert.ok(payload.includes("\\u003cspecial\\u003e") || payload.includes("\\u003cespecial\\u003e"));
});
