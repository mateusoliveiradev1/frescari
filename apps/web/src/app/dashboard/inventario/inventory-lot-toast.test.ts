import assert from "node:assert/strict";
import test from "node:test";

import { getCreateLotSuccessDescription } from "./inventory-lot-toast";

test("mantem a promessa de catalogo apenas quando a conta Stripe pode receber pagamentos", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: true,
      state: "ready",
    }),
    "O novo lote ja esta disponivel no catalogo.",
  );
});

test("explica que o lote aguarda analise quando a conta Stripe ainda nao foi liberada", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: false,
      state: "under_review",
    }),
    "O lote foi salvo, mas so aparecera no catalogo quando a Stripe concluir a analise da sua conta.",
  );
});

test("usa uma mensagem segura quando a conta Stripe ainda nao foi conectada", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: false,
      state: "not_started",
    }),
    "O lote foi salvo, mas so aparecera no catalogo quando sua conta Stripe estiver conectada e habilitada para receber pagamentos.",
  );
});
