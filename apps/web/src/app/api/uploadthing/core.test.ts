import assert from "node:assert/strict";
import test from "node:test";

import { assertProducerUploadActor } from "./core";

test("assertProducerUploadActor returns the authenticated producer actor", () => {
  const actor = assertProducerUploadActor({
    id: "user_123",
    role: "producer",
    tenantId: "tenant_123",
  });

  assert.deepEqual(actor, {
    userId: "user_123",
    tenantId: "tenant_123",
    role: "producer",
  });
});

test("assertProducerUploadActor rejects anonymous uploads", () => {
  assert.throws(
    () => assertProducerUploadActor(null),
    /Acesso nao autenticado/,
  );
});

test("assertProducerUploadActor rejects users outside producer scope", () => {
  assert.throws(
    () =>
      assertProducerUploadActor({
        id: "user_123",
        role: "buyer",
        tenantId: "tenant_123",
      }),
    /Apenas produtores/,
  );
});

test("assertProducerUploadActor requires commercial account membership", () => {
  assert.throws(
    () =>
      assertProducerUploadActor({
        id: "user_123",
        role: "producer",
        tenantId: null,
      }),
    /conta comercial/,
  );
});
