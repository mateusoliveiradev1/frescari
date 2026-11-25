import { test } from "node:test";
import assert from "node:assert/strict";

import { withRlsMockDb } from "./test-db";

process.env.STRIPE_SECRET_KEY ??= "sk_test_mocked";

type OrderCaller = {
  order: {
    createOrder: (input: unknown) => Promise<unknown>;
    updateOrderStatus: (input: unknown) => Promise<unknown>;
  };
};

function createTenantSelectChain(type: "PRODUCER" | "BUYER") {
  return {
    from() {
      return this;
    },
    where() {
      return this;
    },
    limit: async () => [
      { id: type === "BUYER" ? "buyer-tenant-1" : "producer-tenant-1", type },
    ],
  };
}

async function createOrderCaller(
  db: unknown,
  user: {
    id: string;
    tenantId: string;
    role: "buyer" | "producer";
    name: string;
  },
) {
  const [{ createTRPCRouter }, { orderRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/order"),
  ]);

  const testRouter = createTRPCRouter({ order: orderRouter });

  return testRouter.createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: user.id } },
    user,
  });
}

test("order.createOrder rejects the legacy direct-order path", async () => {
  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain("BUYER");
    },
  });

  const caller = await createOrderCaller(db, {
    id: "buyer-user-1",
    tenantId: "buyer-tenant-1",
    role: "buyer",
    name: "Comprador Teste",
  });

  await assert.rejects(
    () =>
      (caller as OrderCaller).order.createOrder({
        deliveryStreet: "Rua das Flores",
        deliveryNumber: "123",
        deliveryCep: "01010-000",
        deliveryCity: "Sao Paulo",
        deliveryState: "SP",
        items: [
          {
            lotId: "11111111-1111-4111-8111-111111111111",
            quantity: 2,
          },
        ],
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /checkout\.createFarmCheckoutSession/i);
      return true;
    },
  );
});

test("order.updateOrderStatus blocks invalid backwards transitions", async () => {
  const state = {
    order: {
      id: "22222222-2222-4222-8222-222222222222",
      sellerTenantId: "producer-tenant-1",
      status: "delivered",
    },
    updatedStatus: null as string | null,
  };

  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain("PRODUCER");
    },
    query: {
      orders: {
        findFirst: async () => state.order,
      },
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: async () => {
              state.updatedStatus = String(values.status);
            },
          };
        },
      };
    },
  });

  const caller = await createOrderCaller(db, {
    id: "producer-user-1",
    tenantId: "producer-tenant-1",
    role: "producer",
    name: "Produtor Teste",
  });

  await assert.rejects(
    () =>
      (caller as OrderCaller).order.updateOrderStatus({
        orderId: state.order.id,
        status: "in_transit",
      }),
    /Nao e possivel/i,
  );

  assert.equal(state.updatedStatus, null);
});

test("order.updateOrderStatus blocks skipping dispatch before delivery transitions", async () => {
  const state = {
    order: {
      id: "33333333-3333-4333-8333-333333333333",
      buyerTenantId: "buyer-tenant-1",
      sellerTenantId: "producer-tenant-1",
      status: "confirmed",
    },
    updatedStatus: null as string | null,
  };

  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain("PRODUCER");
    },
    query: {
      orders: {
        findFirst: async () => state.order,
      },
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: async () => {
              state.updatedStatus = String(values.status);
            },
          };
        },
      };
    },
  });

  const caller = await createOrderCaller(db, {
    id: "producer-user-1",
    tenantId: "producer-tenant-1",
    role: "producer",
    name: "Produtor Teste",
  });

  await assert.rejects(
    () =>
      (caller as OrderCaller).order.updateOrderStatus({
        orderId: state.order.id,
        status: "in_transit",
      }),
    /Nao e possivel/i,
  );

  assert.equal(state.updatedStatus, null);
});

function createStatusUpdateDb(
  order: Record<string, unknown>,
  updatedRows: Array<{ id: string }>,
) {
  const state = { attemptedStatus: null as string | null };
  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain("PRODUCER");
    },
    query: {
      orders: {
        findFirst: async () => order,
      },
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          return {
            where() {
              state.attemptedStatus = String(values.status);
              return { returning: async () => updatedRows };
            },
          };
        },
      };
    },
  });
  return { db, state };
}

const producerUser = {
  id: "producer-user-1",
  tenantId: "producer-tenant-1",
  role: "producer" as const,
  name: "Produtor Teste",
};

test("order.updateOrderStatus cannot cancel: cancelling must refund (cancelOrderAsSeller)", async () => {
  const { db, state } = createStatusUpdateDb(
    {
      id: "44444444-4444-4444-8444-444444444444",
      buyerTenantId: "buyer-tenant-1",
      sellerTenantId: "producer-tenant-1",
      status: "confirmed",
    },
    [],
  );
  const caller = await createOrderCaller(db, producerUser);

  await assert.rejects(
    () =>
      (caller as OrderCaller).order.updateOrderStatus({
        orderId: "44444444-4444-4444-8444-444444444444",
        status: "cancelled",
      }),
    /Nao e possivel/i,
  );
  assert.equal(state.attemptedStatus, null);
});

test("order.updateOrderStatus cannot confirm a weighed order without capturing it", async () => {
  const { db, state } = createStatusUpdateDb(
    {
      id: "55555555-5555-4555-8555-555555555555",
      buyerTenantId: "buyer-tenant-1",
      sellerTenantId: "producer-tenant-1",
      status: "awaiting_weight",
    },
    [],
  );
  const caller = await createOrderCaller(db, producerUser);

  await assert.rejects(
    () =>
      (caller as OrderCaller).order.updateOrderStatus({
        orderId: "55555555-5555-4555-8555-555555555555",
        status: "confirmed",
      }),
    /Nao e possivel/i,
  );
  assert.equal(state.attemptedStatus, null);
});

test("order.updateOrderStatus refuses when the order changed meanwhile (e.g. buyer cancelled)", async () => {
  const { db, state } = createStatusUpdateDb(
    {
      id: "66666666-6666-4666-8666-666666666666",
      buyerTenantId: "buyer-tenant-1",
      sellerTenantId: "producer-tenant-1",
      status: "confirmed",
    },
    // The conditional UPDATE ... WHERE status = 'confirmed' matched nothing.
    [],
  );
  const caller = await createOrderCaller(db, producerUser);

  await assert.rejects(
    () =>
      (caller as OrderCaller).order.updateOrderStatus({
        orderId: "66666666-6666-4666-8666-666666666666",
        status: "picking",
      }),
    /mudou enquanto voce atualizava/i,
  );
  assert.equal(state.attemptedStatus, "picking");
});
