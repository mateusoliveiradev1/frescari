import assert from "node:assert/strict";
import test from "node:test";

import { getCreateLotSuccessDescription } from "./inventory-lot-toast";

test("mantem a promessa de catálogo apenas quando o recebimento esta pronto", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: true,
      state: "ready",
    }),
    "O novo lote já esta disponível no catálogo.",
  );
});

test("explica que o lote aguarda análise quando o recebimento ainda não foi liberado", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: false,
      state: "under_review",
    }),
    "O lote foi salvo, mas so aparecera no catálogo quando a análise do recebimento for concluída.",
  );
});

test("usa uma mensagem segura quando o recebimento ainda não foi ativado", () => {
  assert.equal(
    getCreateLotSuccessDescription({
      canReceivePayments: false,
      state: "not_started",
    }),
    "O lote foi salvo, mas so aparecera no catálogo quando sua conta estiver pronta para receber pagamentos.",
  );
});
