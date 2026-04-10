import assert from "node:assert/strict";
import test from "node:test";

import { getPersonalMenuItems } from "./global-nav.model";

test("returns no personal menu entries for anonymous users", () => {
  assert.deepEqual(getPersonalMenuItems(null), []);
});

test("returns Minha Conta for authenticated roles", () => {
  assert.deepEqual(getPersonalMenuItems({ role: "buyer" }), [
    {
      href: "/conta",
      key: "account",
      label: "Minha Conta",
    },
  ]);

  assert.deepEqual(getPersonalMenuItems({ role: "producer" }), [
    {
      href: "/conta",
      key: "account",
      label: "Minha Conta",
    },
  ]);

  assert.deepEqual(getPersonalMenuItems({ role: "admin" }), [
    {
      href: "/conta",
      key: "account",
      label: "Minha Conta",
    },
  ]);
});
