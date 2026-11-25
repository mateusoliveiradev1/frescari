import assert from "node:assert/strict";
import test from "node:test";

import {
  readCheckoutReturn,
  stripCheckoutReturnParams,
} from "./checkout-return";

const FARM = "e76d90f1-4913-4471-867b-7fa1edf13e32";

test("a successful return names the paid farm", () => {
  assert.deepEqual(readCheckoutReturn(`?session_id=cs_test_1&farm=${FARM}`), {
    farmId: FARM,
    cancelled: false,
  });
});

test("a cancelled return keeps the farm and flags the cancel", () => {
  assert.deepEqual(readCheckoutReturn(`?checkout=cancelled&farm=${FARM}`), {
    farmId: FARM,
    cancelled: true,
  });
});

test("an older link without farm, or a forged value, clears nothing", () => {
  assert.equal(readCheckoutReturn("?session_id=cs_test_1").farmId, null);
  assert.equal(readCheckoutReturn("?farm=../../x").farmId, null);
  assert.equal(readCheckoutReturn("").cancelled, false);
});

test("the notice removes its own parameters from the address bar", () => {
  assert.equal(
    stripCheckoutReturnParams(
      `https://frescari.com.br/catalogo?checkout=cancelled&farm=${FARM}&q=tomate`,
    ),
    "/catalogo?q=tomate",
  );
});
