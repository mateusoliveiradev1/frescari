import assert from "node:assert/strict";
import test from "node:test";

import { buildProducerNewOrderEmail } from "./order-email";

test("new-order email tells a producer to weigh items when the order is by weight", () => {
  const email = buildProducerNewOrderEmail(
    {
      producerName: "Michele Souza",
      orderId: "abcd1234-0000-4000-8000-000000000000",
      totalAmount: 152.5,
      awaitingWeight: true,
    },
    "https://frescari.com.br/",
  );

  assert.match(email.subject, /#ABCD1234/);
  assert.match(email.subject, /peso/);
  assert.match(email.text, /Oi, Michele!/);
  assert.match(email.text, /R\$\s?152,50/);
  assert.match(email.text, /https:\/\/frescari\.com\.br\/dashboard\/vendas/);
});

test("new-order email escapes producer names in HTML", () => {
  const email = buildProducerNewOrderEmail(
    {
      producerName: "<script>x</script>",
      orderId: "abcd1234-0000-4000-8000-000000000000",
      totalAmount: 10,
      awaitingWeight: false,
    },
    "https://frescari.com.br",
  );

  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.subject, /^Novo pedido #ABCD1234/);
});
