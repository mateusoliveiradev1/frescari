import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { withRlsMockDb } from "./test-db";

process.env.ENABLE_LEGACY_DIRECT_ORDER_MUTATION = "true";

type BuyerContextUser = {
  id: string;
  tenantId: string;
  role: "buyer";
  name: string;
};

type OrderCaller = {
  order: {
    createOrder: (input: unknown) => Promise<unknown>;
  };
};

type CreateOrderResult = {
  success: true;
  orderIds: string[];
};

const originalFetch = globalThis.fetch;

function createThenableChain(result: unknown) {
  const chain = {
    from() {
      return chain;
    },
    innerJoin() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    limit() {
      return Promise.resolve(result);
    },
    then(
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  return chain;
}

function createTenantSelectChain() {
  return createThenableChain([
    {
      id: "buyer-tenant-1",
      type: "BUYER",
    },
  ]);
}

async function createOrderCaller(db: unknown, user?: BuyerContextUser) {
  const [{ createTRPCRouter }, { orderRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/order"),
  ]);

  const testRouter = createTRPCRouter({ order: orderRouter });

  return testRouter.createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: user?.id ?? "buyer-user-1" } },
    user: user ?? {
      id: "buyer-user-1",
      tenantId: "buyer-tenant-1",
      role: "buyer",
      name: "Comprador Teste",
    },
  });
}

beforeEach(() => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          lat: "-23.55",
          lon: "-46.63",
        },
      ]),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )) as typeof fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

test("order.createOrder rejects legacy client financial fields under strict input validation", async () => {
  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain();
    },
  });

  const caller = await createOrderCaller(db);

  await assert.rejects(
    () =>
      (caller as OrderCaller).order.createOrder({
        deliveryStreet: "Rua das Flores",
        deliveryNumber: "123",
        deliveryCep: "01010-000",
        deliveryCity: "Sao Paulo",
        deliveryState: "SP",
        deliveryFee: 0,
        items: [
          {
            lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            quantity: 3,
          },
        ],
      }),
    /Unrecognized|unexpected/i,
  );
});

test("order.createOrder recalculates delivery fee on the backend for the legacy flow", async () => {
  let selectCallCount = 0;

  const state = {
    orderInsertValues: null as Record<string, unknown> | null,
    orderItemInsertValues: null as Array<Record<string, unknown>> | null,
  };

  const db = withRlsMockDb({
    select() {
      selectCallCount += 1;

      switch (selectCallCount) {
        case 1:
          return createTenantSelectChain();
        case 2:
          return createThenableChain([
            {
              lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              sellerTenantId: "producer-tenant-1",
              farmId: "22222222-2222-4222-8222-222222222222",
              availableQty: "10.000",
              expiryDate: new Date("2030-01-01T00:00:00.000Z"),
              priceOverride: null,
              pricePerUnit: 10,
              lotUnit: "unit",
              pricingType: "UNIT",
              masterPricingType: "UNIT",
              saleUnit: "unit",
            },
          ]);
        case 3:
          return createThenableChain([
            {
              id: "22222222-2222-4222-8222-222222222222",
              location: [-46.61, -23.54] as [number, number],
              baseDeliveryFee: "8.00",
              pricePerKm: "2.00",
              maxDeliveryRadiusKm: "20.00",
              minOrderValue: "20.00",
              freeShippingThreshold: null,
              distanceMeters: 5000,
            },
          ]);
        default:
          throw new Error(`Unexpected select call #${selectCallCount}`);
      }
    },
    insert() {
      return {
        values(
          values: Record<string, unknown> | Array<Record<string, unknown>>,
        ) {
          if (Array.isArray(values)) {
            state.orderItemInsertValues = values;
            return Promise.resolve(values);
          }

          state.orderInsertValues = values;

          return {
            returning: async () => [
              {
                id: "order-1",
              },
            ],
          };
        },
      };
    },
    update() {
      return {
        set() {
          return {
            where: async () => undefined,
          };
        },
      };
    },
  });

  const caller = await createOrderCaller(db);
  const result = (await (caller as OrderCaller).order.createOrder({
    deliveryStreet: "Rua das Flores",
    deliveryNumber: "123",
    deliveryCep: "01010-000",
    deliveryCity: "Sao Paulo",
    deliveryState: "SP",
    items: [
      {
        lotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        quantity: 3,
      },
    ],
  })) as CreateOrderResult;

  assert.deepEqual(result, { success: true, orderIds: ["order-1"] });
  assert.ok(state.orderInsertValues);
  assert.ok(state.orderItemInsertValues);
  assert.equal(state.orderInsertValues.deliveryFee, "18.00");
  assert.equal(state.orderInsertValues.totalAmount, "48.0000");
  assert.equal(state.orderInsertValues.sellerTenantId, "producer-tenant-1");
  assert.equal(state.orderItemInsertValues?.length, 1);
});
