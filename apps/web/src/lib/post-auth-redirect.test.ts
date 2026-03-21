import assert from "node:assert/strict";
import test from "node:test";

import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";

test("redirects admins to the admin area", () => {
  assert.equal(
    getPostAuthRedirectPath({
      role: "admin",
      tenantId: "tenant_123",
    }),
    "/admin",
  );
});

test("redirects authenticated users without tenant to onboarding", () => {
  assert.equal(
    getPostAuthRedirectPath({
      role: "buyer",
      tenantId: null,
    }),
    "/onboarding",
  );
});

test("redirects authenticated buyers with tenant to dashboard", () => {
  assert.equal(
    getPostAuthRedirectPath({
      role: "buyer",
      tenantId: "tenant_123",
    }),
    "/dashboard",
  );
});
