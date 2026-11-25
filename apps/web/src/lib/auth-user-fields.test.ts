import assert from "node:assert/strict";
import test from "node:test";

import { parseUserInput } from "better-auth/db";

import { userAdditionalFields } from "@/lib/auth-user-fields";

// Runs Better Auth's own input parser (the one sign-up and update-user call)
// with our field config, so a change to the config or a library upgrade that
// lets a client set its own role or tenant fails here.
const options = { user: { additionalFields: userAdditionalFields } };

test("sign-up ignores a client-sent role and tenantId", () => {
  assert.throws(
    () =>
      parseUserInput(
        options,
        { email: "a@example.com", name: "A", tenantId: "victim-tenant" },
        "create",
      ),
    /tenantId is not allowed/,
  );

  const parsed = parseUserInput(
    options,
    { email: "a@example.com", name: "A", role: "admin" },
    "create",
  ) as Record<string, unknown>;
  assert.equal(parsed.role, "buyer");
});

test("update-user rejects role and tenantId", () => {
  assert.throws(
    () => parseUserInput(options, { role: "admin" }, "update"),
    /role is not allowed/,
  );
  assert.throws(
    () =>
      parseUserInput(
        options,
        { role: "producer", tenantId: "victim-tenant" },
        "update",
      ),
    /not allowed/,
  );
});
