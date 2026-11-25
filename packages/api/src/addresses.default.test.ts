import assert from "node:assert/strict";
import { test } from "node:test";

import { withRlsMockDb } from "./test-db";

const ADDRESS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function createBuyerCaller(db: unknown) {
  const [{ createTRPCRouter }, { addressesRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/addresses"),
  ]);
  const router = createTRPCRouter({ addresses: addressesRouter });

  return router.createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: "buyer-user-1" } },
    user: {
      id: "buyer-user-1",
      tenantId: "buyer-tenant-1",
      role: "buyer",
      name: "Restaurante Teste",
    },
  }) as unknown as {
    addresses: {
      setDefaultAddress: (input: { id: string }) => Promise<unknown>;
    };
  };
}

function createDb(target: { id: string; isDefault: boolean } | null) {
  const updates: Array<Record<string, unknown>> = [];
  const db = withRlsMockDb({
    select() {
      return {
        from() {
          return this;
        },
        where() {
          return this;
        },
        limit: async () => [{ id: "buyer-tenant-1", type: "BUYER" }],
      };
    },
    query: {
      addresses: {
        findFirst: async () => target,
      },
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: async () => {
              updates.push({ isDefault: values.isDefault });
            },
          };
        },
      };
    },
  });

  return { db, updates };
}

test("setDefaultAddress clears the old default before setting the new one", async () => {
  const { db, updates } = createDb({ id: ADDRESS, isDefault: false });
  const caller = await createBuyerCaller(db);

  await caller.addresses.setDefaultAddress({ id: ADDRESS });

  // One default per tenant (partial unique index): order matters.
  assert.deepEqual(updates, [{ isDefault: false }, { isDefault: true }]);
});

test("setDefaultAddress on the current default changes nothing", async () => {
  const { db, updates } = createDb({ id: ADDRESS, isDefault: true });
  const caller = await createBuyerCaller(db);

  await caller.addresses.setDefaultAddress({ id: ADDRESS });

  assert.deepEqual(updates, []);
});

test("setDefaultAddress refuses an address the buyer doesn't own", async () => {
  // The lookup is scoped to the buyer's tenant, so another tenant's id finds nothing.
  const { db, updates } = createDb(null);
  const caller = await createBuyerCaller(db);

  await assert.rejects(
    () => caller.addresses.setDefaultAddress({ id: ADDRESS }),
    /nao encontrado/i,
  );
  assert.deepEqual(updates, []);
});
