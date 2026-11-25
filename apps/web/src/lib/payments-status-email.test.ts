import assert from "node:assert/strict";
import test from "node:test";

import { buildPaymentsStatusEmail } from "./payments-status-email";

const APP = "https://frescari.com.br/";

test("active email points to the next missing step", () => {
  const noFarm = buildPaymentsStatusEmail(
    {
      kind: "active",
      producerName: "Ana Souza",
      farmLocated: false,
      hasActiveLot: false,
    },
    APP,
  );
  assert.match(noFarm.subject, /marcar a fazenda/);
  assert.match(noFarm.text, /https:\/\/frescari\.com\.br\/dashboard\/fazenda/);
  assert.match(noFarm.text, /^Oi, Ana!/);

  const noLot = buildPaymentsStatusEmail(
    {
      kind: "active",
      producerName: "Ana",
      farmLocated: true,
      hasActiveLot: false,
    },
    APP,
  );
  assert.match(noLot.text, /\/dashboard\/inventario/);

  const selling = buildPaymentsStatusEmail(
    {
      kind: "active",
      producerName: "Ana",
      farmLocated: true,
      hasActiveLot: true,
    },
    APP,
  );
  assert.match(selling.subject, /já estão no catálogo/);
});

test("blocked email asks for action and escapes the name in HTML", () => {
  const email = buildPaymentsStatusEmail(
    {
      kind: "blocked",
      producerName: "<script>x</script>",
      farmLocated: true,
      hasActiveLot: true,
    },
    APP,
  );
  assert.match(email.subject, /Ação necessária/);
  assert.doesNotMatch(email.html, /<script>/);
});
