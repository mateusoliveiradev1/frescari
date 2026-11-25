import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  decryptPii,
  encryptPii,
  isEncryptedPii,
  maskDocument,
} from "./pii-crypto";

const KEY = randomBytes(32).toString("base64");

test("encrypts to a tagged ciphertext and decrypts back", () => {
  const stored = encryptPii("12345678909", KEY);

  assert.ok(isEncryptedPii(stored));
  assert.doesNotMatch(stored, /12345678909/);
  assert.equal(decryptPii(stored, KEY), "12345678909");
});

test("the same value encrypts differently each time", () => {
  assert.notEqual(
    encryptPii("12345678909", KEY),
    encryptPii("12345678909", KEY),
  );
});

test("legacy plain values and empty values read through", () => {
  assert.equal(decryptPii("12345678909", KEY), "12345678909");
  assert.equal(decryptPii(null, KEY), null);
  assert.equal(decryptPii("", KEY), null);
});

test("a wrong key or a tampered value fails instead of returning garbage", () => {
  const stored = encryptPii("12345678909", KEY);
  const otherKey = randomBytes(32).toString("base64");
  assert.throws(() => decryptPii(stored, otherKey));

  const tampered = `${stored.slice(0, -2)}AA`;
  assert.throws(() => decryptPii(tampered, KEY));
});

test("a missing or short key is refused", () => {
  assert.throws(() => encryptPii("x", ""), /PII_ENCRYPTION_KEY/);
  assert.throws(
    () => encryptPii("x", Buffer.from("short").toString("base64")),
    /32 bytes/,
  );
});

test("documents are masked for display", () => {
  assert.equal(maskDocument("12345678909"), "***.456.789-**");
  assert.equal(maskDocument("12.345.678/0001-95"), "**.***.678/0001-**");
  assert.equal(maskDocument("12.ABC.345/01DE-35"), "**.***.345/01DE-**");
  assert.equal(maskDocument(null), null);
});
