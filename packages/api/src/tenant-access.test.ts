import { test } from "node:test";
import { strict as assert } from "node:assert";

import {
  getTenantTypeMismatchMessage,
  isTenantTypeCompatibleWithRole,
} from "./tenant-access";

test("producer requires a PRODUCER tenant", () => {
  assert.equal(isTenantTypeCompatibleWithRole("producer", "PRODUCER"), true);
  assert.equal(isTenantTypeCompatibleWithRole("producer", "BUYER"), false);
  assert.equal(isTenantTypeCompatibleWithRole("producer", null), false);
});

test("buyer requires a BUYER tenant", () => {
  assert.equal(isTenantTypeCompatibleWithRole("buyer", "BUYER"), true);
  assert.equal(isTenantTypeCompatibleWithRole("buyer", "PRODUCER"), false);
  assert.equal(isTenantTypeCompatibleWithRole("buyer", undefined), false);
});

test("mismatch message includes role and tenant type", () => {
  assert.equal(
    getTenantTypeMismatchMessage("producer", "BUYER"),
    "Conta inconsistente: perfil produtor vinculado a conta comercial BUYER.",
  );
});
