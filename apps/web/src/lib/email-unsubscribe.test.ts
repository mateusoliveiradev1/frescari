import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnsubscribeFooter,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./email-unsubscribe";

const SECRET = "test-secret-not-real";

test("a token round-trips to its user id", () => {
  const token = createUnsubscribeToken("user_abc123", SECRET);
  assert.equal(verifyUnsubscribeToken(token, SECRET), "user_abc123");
});

test("tampered, foreign or malformed tokens are rejected", () => {
  const token = createUnsubscribeToken("user_abc123", SECRET);
  const [, signature] = token.split(".");
  const otherUser = `${Buffer.from("user_other").toString("base64url")}.${signature}`;

  assert.equal(verifyUnsubscribeToken(otherUser, SECRET), null);
  assert.equal(verifyUnsubscribeToken(token, "another-secret"), null);
  assert.equal(verifyUnsubscribeToken(`${token}x`, SECRET), null);
  assert.equal(verifyUnsubscribeToken("nodot", SECRET), null);
  assert.equal(verifyUnsubscribeToken("", SECRET), null);
  assert.equal(verifyUnsubscribeToken(null, SECRET), null);
});

test("footer escapes the URL in HTML", () => {
  const footer = buildUnsubscribeFooter(
    'https://frescari.com.br/descadastro?t=a"b&c',
  );
  assert.match(footer.html, /t=a&quot;b&amp;c/);
  assert.match(footer.text, /Descadastre-se: https:\/\/frescari/);
});
