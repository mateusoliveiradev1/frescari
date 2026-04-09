import assert from "node:assert/strict";
import test from "node:test";

import {
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  buildResetPasswordRedirectUrl,
  readPasswordResetPageState,
} from "@/lib/password-reset";

test("password reset helpers expose the expected auth paths", () => {
  assert.equal(FORGOT_PASSWORD_PATH, "/auth/forgot-password");
  assert.equal(RESET_PASSWORD_PATH, "/auth/reset-password");
});

test("buildResetPasswordRedirectUrl joins the app url and reset path", () => {
  assert.equal(
    buildResetPasswordRedirectUrl("https://app.frescari.com"),
    "https://app.frescari.com/auth/reset-password",
  );
  assert.equal(
    buildResetPasswordRedirectUrl("https://app.frescari.com/"),
    "https://app.frescari.com/auth/reset-password",
  );
});

test("readPasswordResetPageState extracts token and invalid-token errors", () => {
  assert.deepEqual(
    readPasswordResetPageState(
      new URLSearchParams("token=abc123&error=INVALID_TOKEN"),
    ),
    {
      error: "INVALID_TOKEN",
      token: "abc123",
    },
  );
});

test("readPasswordResetPageState normalizes missing values and unsupported errors", () => {
  assert.deepEqual(readPasswordResetPageState(new URLSearchParams("")), {
    error: null,
    token: null,
  });

  assert.deepEqual(
    readPasswordResetPageState(
      new URLSearchParams("token=%20%20%20&error=SOMETHING_ELSE"),
    ),
    {
      error: null,
      token: null,
    },
  );
});
