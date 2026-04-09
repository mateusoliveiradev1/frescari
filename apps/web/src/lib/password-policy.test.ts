import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_MIN_LENGTH,
  getPasswordCriteria,
  isStrongPassword,
} from "@/lib/password-policy";

test("password policy exposes the expected criteria", () => {
  assert.deepEqual(getPasswordCriteria("abc"), {
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: true,
    hasNumber: false,
  });

  assert.deepEqual(getPasswordCriteria("Abcd1234"), {
    hasMinLength: true,
    hasUppercase: true,
    hasLowercase: true,
    hasNumber: true,
  });
});

test("password policy requires minimum length, uppercase, lowercase and number", () => {
  assert.equal(isStrongPassword("Abcd1234"), true);
  assert.equal(
    isStrongPassword(`Abc1${"d".repeat(PASSWORD_MIN_LENGTH - 4)}`),
    true,
  );
  assert.equal(isStrongPassword("abcd1234"), false);
  assert.equal(isStrongPassword("ABCD1234"), false);
  assert.equal(isStrongPassword("Abcdefgh"), false);
  assert.equal(isStrongPassword("Abc123"), false);
});
