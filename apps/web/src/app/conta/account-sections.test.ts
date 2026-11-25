import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessAccountSection,
  getAccountSectionFromPathname,
  getAccountSectionsForRole,
  getDefaultAccountPathForRole,
} from "./account-sections";

test("buyer sees perfil, cadastro, endereços e segurança", () => {
  const sections = getAccountSectionsForRole("buyer");

  assert.deepEqual(
    sections.map((section) => section.key),
    ["perfil", "cadastro", "enderecos", "seguranca"],
  );
  assert.deepEqual(
    sections.map((section) => section.label),
    ["Perfil", "Empresa", "Endereços", "Segurança"],
  );
  assert.equal(getDefaultAccountPathForRole("buyer"), "/conta/perfil");
  assert.equal(canAccessAccountSection("buyer", "enderecos"), true);
});

test("producer does not see endereços", () => {
  const sections = getAccountSectionsForRole("producer");

  assert.deepEqual(
    sections.map((section) => section.key),
    ["perfil", "cadastro", "seguranca"],
  );
  assert.deepEqual(
    sections.map((section) => section.label),
    ["Perfil", "Negócio", "Segurança"],
  );
  assert.equal(canAccessAccountSection("producer", "enderecos"), false);
});

test("admin sees only perfil e segurança", () => {
  const sections = getAccountSectionsForRole("admin");

  assert.deepEqual(
    sections.map((section) => section.key),
    ["perfil", "seguranca"],
  );
  assert.equal(canAccessAccountSection("admin", "cadastro"), false);
});

test("maps pathname to account section key", () => {
  assert.equal(getAccountSectionFromPathname("/conta/perfil"), "perfil");
  assert.equal(getAccountSectionFromPathname("/conta/cadastro"), "cadastro");
  assert.equal(getAccountSectionFromPathname("/conta/enderecos"), "enderecos");
  assert.equal(getAccountSectionFromPathname("/conta/seguranca"), "seguranca");
  assert.equal(getAccountSectionFromPathname("/conta"), null);
  assert.equal(getAccountSectionFromPathname("/dashboard"), null);
});
