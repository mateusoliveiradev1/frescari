import assert from "node:assert/strict";
import test from "node:test";

import { parseStripeConnectBackfillCliArgs } from "./stripe-connect-backfill-cli";

test("parseStripeConnectBackfillCliArgs supports limit, tenant filters and include-synced mode", () => {
  const args = parseStripeConnectBackfillCliArgs([
    "--limit",
    "12",
    "--tenant-id",
    "tenant-a",
    "--tenant-id=tenant-b",
    "--include-synced",
    "--fail-fast",
  ]);

  assert.deepEqual(args, {
    continueOnError: false,
    limit: 12,
    onlyUnsynced: false,
    tenantIds: ["tenant-a", "tenant-b"],
  });
});
