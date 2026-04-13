import assert from "node:assert/strict";
import test from "node:test";

import { getCreateLotSuccessDescription } from "./inventory-lot-toast";

test("mantem a promessa de catalogo apenas quando o recebimento esta pronto", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: true,
      state: "ready",
    }),
    "O novo lote ja esta disponivel no catalogo.",
  );
});

test("explica que o lote aguarda analise quando o recebimento ainda nao foi liberado", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: false,
      state: "under_review",
    }),
    "O lote foi salvo, mas so aparecera no catalogo quando a analise do recebimento for concluida.",
  );
});

test("usa uma mensagem segura quando o recebimento ainda nao foi ativado", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: false,
      state: "not_started",
    }),
    "O lote foi salvo, mas so aparecera no catalogo quando sua conta estiver pronta para receber pagamentos.",
  );
});
