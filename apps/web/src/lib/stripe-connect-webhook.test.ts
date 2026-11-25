import assert from "node:assert/strict";
import test from "node:test";

import type { StripeConnectState } from "@frescari/api/utils/stripe-connect-status";

import {
  getConnectEventAccountId,
  processConnectWebhookEvent,
  type ConnectTenant,
  type ConnectWebhookDeps,
  type ConnectWebhookEvent,
} from "./stripe-connect-webhook";

function tenantIn(state: "ready" | "pending" | "none"): ConnectTenant {
  const ready = state === "ready";
  return {
    id: "tenant-1",
    stripeAccountId: state === "none" ? null : "acct_123",
    stripeChargesEnabled: ready,
    stripeDetailsSubmitted: ready,
    stripePayoutsEnabled: ready,
    stripeRequirementsCurrentlyDue: ready ? [] : ["external_account"],
    stripeRequirementsDisabledReason: null,
    stripeRequirementsEventuallyDue: [],
    stripeRequirementsPastDue: [],
    stripeStatusSyncedAt: null,
  };
}

function accountUpdated(account = "acct_123"): ConnectWebhookEvent {
  return {
    id: "evt_1",
    type: "account.updated",
    account,
    data: { object: { id: account } },
  };
}

function createDeps(
  tenant: ConnectTenant | null,
  nextState: StripeConnectState,
) {
  const calls = {
    synced: [] as Array<{ accountId: string; tenantId: string }>,
    active: [] as string[],
    blocked: [] as string[],
    revalidated: 0,
  };
  const deps: ConnectWebhookDeps = {
    findTenantByAccountId: async () => tenant,
    syncTenant: async (args) => {
      calls.synced.push(args);
      return { status: { state: nextState } };
    },
    notifyPaymentsActive: async (tenantId) => {
      calls.active.push(tenantId);
    },
    notifyPaymentsBlocked: async (tenantId) => {
      calls.blocked.push(tenantId);
    },
    revalidateCatalog: () => {
      calls.revalidated += 1;
    },
  };
  return { deps, calls };
}

test("account id comes from event.account, else from an acct_ payload", () => {
  assert.equal(getConnectEventAccountId(accountUpdated("acct_9")), "acct_9");
  assert.equal(
    getConnectEventAccountId({
      id: "evt",
      type: "account.updated",
      data: { object: { id: "acct_7" } },
    }),
    "acct_7",
  );
  assert.equal(
    getConnectEventAccountId({
      id: "evt",
      type: "account.updated",
      data: { object: { id: "pi_1" } },
    }),
    null,
  );
});

test("becoming ready syncs, revalidates the catalog and emails once", async () => {
  const { deps, calls } = createDeps(tenantIn("pending"), "ready");

  const result = await processConnectWebhookEvent(accountUpdated(), deps);

  assert.equal(result.outcome, "synced");
  assert.deepEqual(calls.synced, [
    { accountId: "acct_123", tenantId: "tenant-1" },
  ]);
  assert.equal(calls.revalidated, 1);
  assert.deepEqual(calls.active, ["tenant-1"]);
  assert.deepEqual(calls.blocked, []);
});

test("a redelivered event for an already-ready account sends nothing", async () => {
  const { deps, calls } = createDeps(tenantIn("ready"), "ready");

  await processConnectWebhookEvent(accountUpdated(), deps);

  assert.equal(calls.synced.length, 1);
  assert.equal(calls.revalidated, 0);
  assert.deepEqual(calls.active, []);
  assert.deepEqual(calls.blocked, []);
});

test("losing ready revalidates and warns the producer", async () => {
  const { deps, calls } = createDeps(tenantIn("ready"), "restricted");

  const result = await processConnectWebhookEvent(accountUpdated(), deps);

  assert.equal(result.outcome, "synced");
  assert.equal(calls.revalidated, 1);
  assert.deepEqual(calls.blocked, ["tenant-1"]);
  assert.deepEqual(calls.active, []);
});

test("a failing email does not fail the webhook", async () => {
  const { deps } = createDeps(tenantIn("pending"), "ready");
  deps.notifyPaymentsActive = async () => {
    throw new Error("resend down");
  };
  const originalError = console.error;
  console.error = () => {};

  try {
    const result = await processConnectWebhookEvent(accountUpdated(), deps);
    assert.equal(result.outcome, "synced");
  } finally {
    console.error = originalError;
  }
});

test("unknown accounts and other event types are ignored without syncing", async () => {
  const unknown = createDeps(null, "ready");
  const unknownResult = await processConnectWebhookEvent(
    accountUpdated(),
    unknown.deps,
  );
  assert.equal(unknownResult.outcome, "unknown_account");
  assert.equal(unknown.calls.synced.length, 0);

  const other = createDeps(tenantIn("pending"), "ready");
  const otherResult = await processConnectWebhookEvent(
    { ...accountUpdated(), type: "payout.paid" },
    other.deps,
  );
  assert.equal(otherResult.outcome, "ignored_event");
  assert.equal(other.calls.synced.length, 0);
});
