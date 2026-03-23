import assert from "node:assert/strict";
import test from "node:test";

import {
  filterStripeConnectBackfillCandidates,
  runStripeConnectStatusBackfill,
  syncStripeConnectStatusBatch,
  syncTenantStripeConnectStatus,
  type StripeConnectBackfillCandidate,
} from "./stripe-connect";

type SyncTenantStatusResult = Awaited<
  ReturnType<typeof syncTenantStripeConnectStatus>
>;

function createSelectChain<T>(result: T[]) {
  const chain = {
    from() {
      return chain;
    },
    where() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    then(
      onFulfilled: (value: T[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  return chain;
}

function createCandidate(
  overrides: Partial<StripeConnectBackfillCandidate> & {
    id: string;
    name: string;
  },
): StripeConnectBackfillCandidate {
  return {
    id: overrides.id,
    name: overrides.name,
    stripeAccountId: overrides.stripeAccountId ?? null,
    stripeStatusSyncedAt: overrides.stripeStatusSyncedAt ?? null,
    type: overrides.type ?? "PRODUCER",
    createdAt: overrides.createdAt ?? new Date("2026-03-22T10:00:00.000Z"),
  };
}

test("filterStripeConnectBackfillCandidates keeps only producer accounts missing the first sync by default", () => {
  const candidates = filterStripeConnectBackfillCandidates(
    [
      createCandidate({
        id: "producer-unsynced",
        name: "Produtor legado",
        stripeAccountId: "acct_legacy",
        stripeStatusSyncedAt: null,
      }),
      createCandidate({
        id: "producer-synced",
        name: "Produtor sincronizado",
        stripeAccountId: "acct_synced",
        stripeStatusSyncedAt: new Date("2026-03-22T09:00:00.000Z"),
      }),
      createCandidate({
        id: "buyer-unsynced",
        name: "Buyer legado",
        stripeAccountId: "acct_buyer",
        type: "BUYER",
      }),
      createCandidate({
        id: "producer-no-account",
        name: "Produtor sem Stripe",
      }),
    ],
    {
      limit: 10,
    },
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.id),
    ["producer-unsynced"],
  );
});

test("runStripeConnectStatusBackfill reports synced and failed tenants without aborting the batch", async () => {
  const syncedAt = new Date("2026-03-22T14:00:00.000Z");
  const syncCalls: string[] = [];

  const result = await runStripeConnectStatusBackfill({
    candidates: [
      createCandidate({
        id: "tenant-ok",
        name: "Produtor ok",
        stripeAccountId: "acct_ok",
      }),
      createCandidate({
        id: "tenant-fail",
        name: "Produtor fail",
        stripeAccountId: "acct_fail",
      }),
    ],
    db: {} as never,
    syncTenantStatus: async (_db, args) => {
      syncCalls.push(args.tenantId);

      if (args.tenantId === "tenant-fail") {
        throw new Error("stripe timeout");
      }

      return {
        status: {
          state: "ready",
          canReceivePayments: true,
          description: "Conta Stripe pronta para operar",
          syncedAt,
        },
      } as SyncTenantStatusResult;
    },
  });

  assert.deepEqual(syncCalls, ["tenant-ok", "tenant-fail"]);
  assert.equal(result.attempted, 2);
  assert.equal(result.synced, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(
    result.items.map((item) => item.outcome),
    ["synced", "failed"],
  );
  assert.equal(result.items[0]?.state, "ready");
  assert.equal(result.items[1]?.error, "stripe timeout");
});

test("syncStripeConnectStatusBatch reads candidates from the database and syncs only the filtered producer set", async () => {
  const syncCalls: string[] = [];
  const db = {
    select() {
      return createSelectChain([
        createCandidate({
          id: "producer-unsynced",
          name: "Produtor legado",
          stripeAccountId: "acct_legacy",
          stripeStatusSyncedAt: null,
        }),
        createCandidate({
          id: "producer-synced",
          name: "Produtor sincronizado",
          stripeAccountId: "acct_synced",
          stripeStatusSyncedAt: new Date("2026-03-22T09:00:00.000Z"),
        }),
        createCandidate({
          id: "buyer-unsynced",
          name: "Buyer legado",
          stripeAccountId: "acct_buyer",
          type: "BUYER",
          stripeStatusSyncedAt: null,
        }),
      ]);
    },
  };

  const result = await syncStripeConnectStatusBatch(db as never, {
    limit: 10,
    syncTenantStatus: async (_db, args) => {
      syncCalls.push(args.tenantId);

      return {
        status: {
          state: "ready",
          canReceivePayments: true,
          description: "Conta Stripe pronta para operar",
          syncedAt: new Date("2026-03-22T14:00:00.000Z"),
        },
      } as SyncTenantStatusResult;
    },
  });

  assert.deepEqual(syncCalls, ["producer-unsynced"]);
  assert.equal(result.attempted, 1);
  assert.equal(result.synced, 1);
  assert.equal(result.failed, 0);
});
