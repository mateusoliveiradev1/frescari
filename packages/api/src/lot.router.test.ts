import { test } from "node:test";
import assert from "node:assert/strict";

import { PgDialect } from "drizzle-orm/pg-core";

import { withRlsMockDb } from "./test-db";

const dialect = new PgDialect();

type ProducerContextUser = {
  id: string;
  tenantId: string;
  role: "producer";
  name: string;
};

type LotCaller = {
  lot: {
    create: (input: unknown) => Promise<unknown>;
    getAvailableLots: (input: unknown) => Promise<Array<{ id: string }>>;
  };
};

function createTenantSelectChain() {
  return {
    from() {
      return this;
    },
    where() {
      return this;
    },
    limit: async () => [{ id: "producer-tenant-1", type: "PRODUCER" }],
  };
}

async function createLotCaller(db: unknown, user?: ProducerContextUser) {
  const [{ createTRPCRouter }, { lotRouter }] = await Promise.all([
    import("./trpc"),
    import("./routers/lot"),
  ]);

  const testRouter = createTRPCRouter({ lot: lotRouter });

  return testRouter.createCaller({
    db: db as never,
    req: undefined,
    session: { user: { id: user?.id ?? "producer-user-1" } },
    user: user ?? {
      id: "producer-user-1",
      tenantId: "producer-tenant-1",
      role: "producer",
      name: "Produtor Teste",
    },
  });
}

test("lot.create rejects cross-tenant product references", async () => {
  const foreignProduct = {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "producer-tenant-2",
    masterProductId: null,
    name: "Produto Estrangeiro",
    saleUnit: "unit",
  };

  let insertAttempts = 0;

  const db = withRlsMockDb({
    select() {
      return createTenantSelectChain();
    },
    query: {
      products: {
        findFirst: async (options: { where: unknown }) => {
          const compiledWhere = dialect.sqlToQuery(options.where as never);

          if (compiledWhere.sql.includes('"products"."master_product_id"')) {
            return null;
          }

          if (
            compiledWhere.sql.includes('"products"."id"') &&
            !compiledWhere.sql.includes('"products"."tenant_id"') &&
            compiledWhere.params.includes(foreignProduct.id)
          ) {
            return foreignProduct;
          }

          return null;
        },
      },
      masterProducts: {
        findFirst: async () => null,
      },
    },
    insert() {
      insertAttempts += 1;

      return {
        values() {
          return {
            returning: async () => [
              {
                id: "lot-1",
              },
            ],
          };
        },
      };
    },
  });

  const caller = await createLotCaller(db);

  await assert.rejects(
    () =>
      (caller as LotCaller).lot.create({
        productId: foreignProduct.id,
        lotCode: "LOTE-XTENANT",
        harvestDate: new Date("2026-03-10T12:00:00.000Z"),
        expiryDate: new Date("2026-03-20T12:00:00.000Z"),
        availableQty: 5,
      }),
    /Product not found|produto/i,
  );

  assert.equal(insertAttempts, 0);
});

test("lot.getAvailableLots hides sellers without Stripe Connect when connect mode is enabled", async () => {
  const originalStripeConnectMode = process.env.STRIPE_CONNECT_MODE;
  process.env.STRIPE_CONNECT_MODE = "connect";

  const mockRows = [
    {
      lot: {
        id: "lot-with-connect",
        lotCode: "LOT-CONNECT",
        availableQty: "12",
        expiryDate: "2026-03-30",
        harvestDate: "2026-03-20",
        freshnessScore: 82,
        imageUrl: null,
        priceOverride: null,
        pricingType: "UNIT",
        unit: "kg",
      },
      product: {
        id: "product-1",
        farmId: "farm-1",
        isActive: true,
        name: "Tomate",
        saleUnit: "kg",
        images: [],
        pricePerUnit: "14.90",
        pricingType: "UNIT",
      },
      farmName: "Fazenda Conectada",
      farmAddress: { city: "Sao Paulo", state: "SP" },
      farmLocation: null,
      deliveryRadiusKm: 120,
      categorySlug: "legumes",
      categoryName: "Legumes",
      categoryDescription: null,
      sellerStripeAccountId: "acct_connected_123",
    },
    {
      lot: {
        id: "lot-without-connect",
        lotCode: "LOT-NOCONNECT",
        availableQty: "9",
        expiryDate: "2026-03-28",
        harvestDate: "2026-03-18",
        freshnessScore: 79,
        imageUrl: null,
        priceOverride: null,
        pricingType: "UNIT",
        unit: "kg",
      },
      product: {
        id: "product-2",
        farmId: "farm-2",
        isActive: true,
        name: "Cebola",
        saleUnit: "kg",
        images: [],
        pricePerUnit: "9.90",
        pricingType: "UNIT",
      },
      farmName: "Fazenda Sem Connect",
      farmAddress: { city: "Campinas", state: "SP" },
      farmLocation: null,
      deliveryRadiusKm: 80,
      categorySlug: "hortifruti",
      categoryName: "Hortifruti",
      categoryDescription: null,
      sellerStripeAccountId: null,
    },
  ];

  const db = withRlsMockDb({
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        execute: async () => [],
        select() {
          const chain = {
            from() {
              return chain;
            },
            leftJoin() {
              return chain;
            },
            where: async () => mockRows,
          };

          return chain;
        },
      }),
  });

  try {
    const caller = await createLotCaller(db);
    const result = await (caller as LotCaller).lot.getAvailableLots({});

    assert.deepEqual(
      result.map((lot) => lot.id),
      ["lot-with-connect"],
    );
  } finally {
    if (originalStripeConnectMode === undefined) {
      delete process.env.STRIPE_CONNECT_MODE;
    } else {
      process.env.STRIPE_CONNECT_MODE = originalStripeConnectMode;
    }
  }
});
