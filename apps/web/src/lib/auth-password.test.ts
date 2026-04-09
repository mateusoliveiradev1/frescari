import assert from "node:assert/strict";
import test from "node:test";

import { createEmailAndPasswordConfig } from "@/lib/auth-password";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

test("createEmailAndPasswordConfig enables password reset delivery and session revocation", async () => {
  let captured: {
    url: string;
    user: {
      email: string;
      name: string;
    };
  } | null = null;

  const config = createEmailAndPasswordConfig({
    sendPasswordResetEmail: async (input) => {
      captured = input;
    },
  });

  assert.equal(config.enabled, true);
  assert.equal(config.minPasswordLength, PASSWORD_MIN_LENGTH);
  assert.equal(config.requireEmailVerification, true);
  assert.equal(config.resetPasswordTokenExpiresIn, 60 * 60);
  assert.equal(config.revokeSessionsOnPasswordReset, true);

  await config.sendResetPassword?.({
    user: {
      email: "buyer@example.com",
      name: "",
    },
    url: "https://app.frescari.com/auth/reset-password?token=abc123",
    token: "abc123",
  });

  assert.deepEqual(captured, {
    url: "https://app.frescari.com/auth/reset-password?token=abc123",
    user: {
      email: "buyer@example.com",
      name: "cliente Frescari",
    },
  });
});
