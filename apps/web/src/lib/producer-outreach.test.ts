import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOutreachMessage,
  buildWhatsAppChatUrl,
  getOutreachStage,
  normalizeBrazilianPhone,
} from "./producer-outreach";

test("phones are normalized to 55 + area code + number", () => {
  assert.equal(normalizeBrazilianPhone("(17) 99123-4567"), "5517991234567");
  assert.equal(normalizeBrazilianPhone("017991234567"), "5517991234567");
  assert.equal(normalizeBrazilianPhone("+55 17 99123-4567"), "5517991234567");
  assert.equal(normalizeBrazilianPhone("17 3333-4444"), "551733334444");
  assert.equal(normalizeBrazilianPhone("99123-4567"), null); // no area code
  assert.equal(normalizeBrazilianPhone("123"), null);
  assert.equal(normalizeBrazilianPhone(null), null);
});

test("stage follows the producer's own checklist order", () => {
  const base = {
    stripeConnected: true,
    farmCount: 1,
    activeLotCount: 1,
    productCount: 1,
  };
  assert.equal(
    getOutreachStage({ ...base, stripeConnected: false, farmCount: 0 }),
    "payments",
  );
  assert.equal(getOutreachStage({ ...base, farmCount: 0 }), "farm");
  assert.equal(
    getOutreachStage({ ...base, activeLotCount: 0, productCount: 0 }),
    "lot",
  );
  assert.equal(getOutreachStage(base), "ready");
});

test("message greets by first name, fits the stage and has no emoji", () => {
  const text = buildOutreachMessage({
    contactName: "MARIA souza",
    stage: "payments",
  });
  assert.match(text, /^Oi, Maria! Tudo bem\? Aqui é da equipe da Frescari\./);
  assert.match(text, /ativar o recebimento/);
  assert.match(text, /https:\/\/frescari\.com\.br\/dashboard$/);
  assert.doesNotMatch(text, /[\u{10000}-\u{10FFFF}]/u);

  assert.match(
    buildOutreachMessage({ contactName: null, stage: "farm" }),
    /^Oi! Tudo bem\?/,
  );
});

test("chat URL targets the number with the encoded text", () => {
  const url = new URL(
    buildWhatsAppChatUrl("5517991234567", "Oi, Ana!\nTudo bem?"),
  );
  assert.equal(url.pathname, "/5517991234567");
  assert.equal(url.searchParams.get("text"), "Oi, Ana!\nTudo bem?");
});
