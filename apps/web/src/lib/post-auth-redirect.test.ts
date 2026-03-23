import assert from "node:assert/strict";
import test from "node:test";

import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";

test("redirects admins to the admin area", () => {
  assert.equal(
    getPostAuthRedirectPath({
      emailVerified: true,
      role: "admin",
      tenantId: "tenant_123",
    }),
    "/admin",
  );
});

test("redirects unverified sessions to the email confirmation flow", () => {
  assert.equal(
    getPostAuthRedirectPath({
      emailVerified: false,
      role: "buyer",
      tenantId: "tenant_123",
    }),
    "/auth/verify-email",
  );
});

test("redirects authenticated users without tenant to onboarding", () => {
  assert.equal(
    getPostAuthRedirectPath({
      emailVerified: true,
      role: "buyer",
      tenantId: null,
    }),
    "/onboarding",
  );
});

test("redirects authenticated buyers with tenant to dashboard", () => {
  assert.equal(
    getPostAuthRedirectPath({
      emailVerified: true,
      role: "buyer",
      tenantId: "tenant_123",
    }),
    "/dashboard",
  );
});
