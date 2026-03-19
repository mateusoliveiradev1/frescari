import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate as runMigrate } from "drizzle-orm/neon-serverless/migrator";

import {
  addresses,
  farms,
  orderStatusEnum,
  orders,
  pricingTypeEnum,
  productCategories,
  productLots,
  products,
  saleUnitEnum,
  tenants,
} from "./schema";
import { enableRlsBypassContext, enableTenantRlsContext } from "./rls-scope";

const rootDir = fileURLToPath(new URL("../../../", import.meta.url));
const migrationsFolder = path.resolve(rootDir, "packages/db/drizzle");

config({ override: true, path: path.resolve(rootDir, ".env") });

const databaseUrl = process.env.DATABASE_URL;
const adminDatabaseUrl =
  process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
const hasDatabaseConfig = Boolean(databaseUrl && adminDatabaseUrl);

const appPool = hasDatabaseConfig
  ? new Pool({ connectionString: databaseUrl })
  : null;
const adminPool = hasDatabaseConfig
  ? new Pool({ connectionString: adminDatabaseUrl })
  : null;
const appDb = appPool ? drizzle(appPool) : null;
const adminDb = adminPool ? drizzle(adminPool) : null;

type FixtureSet = {
  addressA: string;
  addressB: string;
  blockedAddressInsert: string;
  blockedFarmInsert: string;
  blockedLotInsert: string;
  blockedOrderInsert: string;
  blockedProductInsert: string;
  category: string;
  farmA: string;
  farmB: string;
  lotA: string;
  lotB: string;
  orderBC: string;
  productA: string;
  productB: string;
  tenantA: string;
  tenantB: string;
  tenantC: string;
};

function readPgBool(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "t" || value === "true";
  }

  return false;
}

function isRlsViolation(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const causeMessage =
    typeof (error as Error & { cause?: { message?: unknown } }).cause
      ?.message === "string"
      ? (error as Error & { cause?: { message?: string } }).cause?.message
      : "";

  return /row-level security/i.test(`${error.message} ${causeMessage}`);
}

function createFixtures(): FixtureSet {
  return {
    addressA: randomUUID(),
    addressB: randomUUID(),
    blockedAddressInsert: randomUUID(),
    blockedFarmInsert: randomUUID(),
    blockedLotInsert: randomUUID(),
    blockedOrderInsert: randomUUID(),
    blockedProductInsert: randomUUID(),
    category: randomUUID(),
    farmA: randomUUID(),
    farmB: randomUUID(),
    lotA: randomUUID(),
    lotB: randomUUID(),
    orderBC: randomUUID(),
    productA: randomUUID(),
    productB: randomUUID(),
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    tenantC: randomUUID(),
  };
}

const fixtures = createFixtures();
const fixtureTag = randomUUID().slice(0, 8);

before(async () => {
  if (!adminDb) {
    return;
  }

  await runMigrate(adminDb, {
    migrationsFolder,
    migrationsSchema: "drizzle",
    migrationsTable: "__drizzle_migrations",
  });
});

after(async () => {
  await Promise.allSettled([appPool?.end(), adminPool?.end()]);
});

test(
  "postgres RLS blocks raw cross-tenant access for core multi-tenant tables",
  { skip: !hasDatabaseConfig },
  async () => {
    assert.ok(adminDb, "DATABASE_ADMIN_URL or DATABASE_URL is required");
    assert.ok(appDb, "DATABASE_URL is required");

    await adminDb.transaction(async (tx) => {
      await enableRlsBypassContext(tx);

      await tx.insert(tenants).values([
        {
          id: fixtures.tenantA,
          name: `RLS Tenant A ${fixtureTag}`,
          plan: "free",
          slug: `rls-tenant-a-${fixtureTag}`,
        },
        {
          id: fixtures.tenantB,
          name: `RLS Tenant B ${fixtureTag}`,
          plan: "free",
          slug: `rls-tenant-b-${fixtureTag}`,
        },
        {
          id: fixtures.tenantC,
          name: `RLS Tenant C ${fixtureTag}`,
          plan: "free",
          slug: `rls-tenant-c-${fixtureTag}`,
        },
      ]);

      await tx.insert(productCategories).values({
        id: fixtures.category,
        name: `RLS Category ${fixtureTag}`,
        slug: `rls-category-${fixtureTag}`,
      });

      await tx.insert(farms).values([
        {
          id: fixtures.farmA,
          tenantId: fixtures.tenantA,
          name: `Farm A ${fixtureTag}`,
          location: [-46.6333, -23.5505],
        },
        {
          id: fixtures.farmB,
          tenantId: fixtures.tenantB,
          name: `Farm B ${fixtureTag}`,
          location: [-43.1729, -22.9068],
        },
      ]);

      await tx.insert(addresses).values([
        {
          id: fixtures.addressA,
          city: "Sao Paulo",
          country: "BR",
          formattedAddress: `Rua A, 10 - Sao Paulo/SP ${fixtureTag}`,
          isDefault: true,
          location: [-46.6333, -23.5505],
          number: "10",
          state: "SP",
          street: "Rua A",
          tenantId: fixtures.tenantA,
          title: "Endereco A",
          zipcode: "01000-000",
        },
        {
          id: fixtures.addressB,
          city: "Rio de Janeiro",
          country: "BR",
          formattedAddress: `Rua B, 20 - Rio de Janeiro/RJ ${fixtureTag}`,
          isDefault: true,
          location: [-43.1729, -22.9068],
          number: "20",
          state: "RJ",
          street: "Rua B",
          tenantId: fixtures.tenantB,
          title: "Endereco B",
          zipcode: "20000-000",
        },
      ]);

      await tx.insert(products).values([
        {
          categoryId: fixtures.category,
          farmId: fixtures.farmA,
          id: fixtures.productA,
          minOrderQty: "1.000",
          name: `Product A ${fixtureTag}`,
          pricePerUnit: "10.5000",
          saleUnit: saleUnitEnum.enumValues[2],
          tenantId: fixtures.tenantA,
        },
        {
          categoryId: fixtures.category,
          farmId: fixtures.farmB,
          id: fixtures.productB,
          minOrderQty: "1.000",
          name: `Product B ${fixtureTag}`,
          pricePerUnit: "12.0000",
          saleUnit: saleUnitEnum.enumValues[2],
          tenantId: fixtures.tenantB,
        },
      ]);

      await tx.insert(productLots).values([
        {
          availableQty: "5.000",
          expiryDate: "2026-03-30",
          harvestDate: "2026-03-10",
          id: fixtures.lotA,
          lotCode: `LOT-A-${fixtureTag}`,
          pricingType: pricingTypeEnum.enumValues[0],
          productId: fixtures.productA,
          tenantId: fixtures.tenantA,
          unit: "un",
        },
        {
          availableQty: "8.000",
          expiryDate: "2026-03-31",
          harvestDate: "2026-03-11",
          id: fixtures.lotB,
          lotCode: `LOT-B-${fixtureTag}`,
          pricingType: pricingTypeEnum.enumValues[0],
          productId: fixtures.productB,
          tenantId: fixtures.tenantB,
          unit: "un",
        },
      ]);

      await tx.insert(orders).values({
        buyerTenantId: fixtures.tenantB,
        deliveryAddress: `Rua C, 30 - Belo Horizonte/MG ${fixtureTag}`,
        deliveryCep: "30000-000",
        deliveryCity: "Belo Horizonte",
        deliveryNumber: "30",
        deliveryState: "MG",
        deliveryStreet: "Rua C",
        id: fixtures.orderBC,
        sellerTenantId: fixtures.tenantC,
        status: orderStatusEnum.enumValues[0],
        totalAmount: "50.0000",
      });
    });

    try {
      const rlsState = await adminDb.execute(sql`
                select
                    relname,
                    relforcerowsecurity,
                    relrowsecurity
                from pg_class
                where relname in ('addresses', 'farms', 'orders', 'product_lots', 'products')
                order by relname
            `);

      const tableState = new Map(
        rlsState.rows.map((row) => [
          String(row.relname),
          {
            force: readPgBool(row.relforcerowsecurity),
            enabled: readPgBool(row.relrowsecurity),
          },
        ]),
      );

      for (const tableName of [
        "addresses",
        "farms",
        "orders",
        "product_lots",
        "products",
      ]) {
        assert.deepEqual(tableState.get(tableName), {
          enabled: true,
          force: true,
        });
      }

      const appRoleState = await appDb.execute(sql`
                select
                    current_user as rolname,
                    rolbypassrls
                from pg_roles
                where rolname = current_user
            `);

      assert.equal(
        readPgBool(appRoleState.rows[0]?.rolbypassrls),
        false,
        "DATABASE_URL must use a role without BYPASSRLS",
      );

      const runtimeDbModule = await import("./index");

      try {
        const authRoleState = await runtimeDbModule.authDb.execute(sql`
                    select
                        current_user as rolname,
                        rolbypassrls
                    from pg_roles
                    where rolname = current_user
                `);

        assert.equal(
          String(authRoleState.rows[0]?.rolname),
          String(appRoleState.rows[0]?.rolname),
          "authDb must use the same restricted runtime role as db",
        );
        assert.equal(
          readPgBool(authRoleState.rows[0]?.rolbypassrls),
          false,
          "authDb must not use a role with BYPASSRLS",
        );
      } finally {
        await runtimeDbModule.closeDbPools();
      }

      const policyState = await adminDb.execute(sql`
                select
                    tablename,
                    policyname,
                    cmd,
                    coalesce(qual, '') as qual
                from pg_policies
                where schemaname = 'public'
                  and tablename in ('addresses', 'farms', 'orders', 'product_lots', 'products')
                order by tablename, cmd, policyname
            `);

      const policyCommands = new Map<string, Set<string>>();

      for (const row of policyState.rows) {
        const tableName = String(row.tablename);
        const cmd = String(row.cmd).toUpperCase();
        const knownCommands =
          policyCommands.get(tableName) ?? new Set<string>();
        knownCommands.add(cmd);
        policyCommands.set(tableName, knownCommands);
      }

      for (const tableName of [
        "addresses",
        "farms",
        "orders",
        "product_lots",
        "products",
      ]) {
        assert.deepEqual(
          policyCommands.get(tableName),
          new Set(["DELETE", "INSERT", "SELECT", "UPDATE"]),
        );
      }

      const productLotsDeletePolicy = policyState.rows.find(
        (row) =>
          String(row.tablename) === "product_lots" &&
          String(row.policyname) === "product_lots_delete_policy",
      );
      assert.match(String(productLotsDeletePolicy?.qual), /tenant_id/i);
      assert.match(
        String(productLotsDeletePolicy?.qual),
        /app\.current_tenant/i,
      );

      const ordersDeletePolicy = policyState.rows.find(
        (row) =>
          String(row.tablename) === "orders" &&
          String(row.policyname) === "orders_delete_policy",
      );
      assert.match(String(ordersDeletePolicy?.qual), /buyer_tenant_id/i);
      assert.match(String(ordersDeletePolicy?.qual), /seller_tenant_id/i);
      assert.match(String(ordersDeletePolicy?.qual), /app\.current_tenant/i);

      await appDb.transaction(async (tx) => {
        await enableTenantRlsContext(tx, fixtures.tenantA);

        const selectResults = [
          [
            "farms",
            await tx.execute(
              sql`select id from "farms" where id = ${fixtures.farmB}`,
            ),
          ],
          [
            "addresses",
            await tx.execute(
              sql`select id from "addresses" where id = ${fixtures.addressB}`,
            ),
          ],
          [
            "products",
            await tx.execute(
              sql`select id from "products" where id = ${fixtures.productB}`,
            ),
          ],
          [
            "product_lots",
            await tx.execute(
              sql`select id from "product_lots" where id = ${fixtures.lotB}`,
            ),
          ],
          [
            "orders",
            await tx.execute(
              sql`select id from "orders" where id = ${fixtures.orderBC}`,
            ),
          ],
        ] as const;

        for (const [tableName, result] of selectResults) {
          assert.equal(
            result.rowCount,
            0,
            `${tableName} should be unreadable cross-tenant`,
          );
        }

        const updateResults = [
          [
            "farms",
            await tx.execute(
              sql`update "farms" set "name" = ${`tampered-farm-${fixtureTag}`} where id = ${fixtures.farmB}`,
            ),
          ],
          [
            "addresses",
            await tx.execute(
              sql`update "addresses" set "title" = ${`tampered-address-${fixtureTag}`} where id = ${fixtures.addressB}`,
            ),
          ],
          [
            "products",
            await tx.execute(
              sql`update "products" set "name" = ${`tampered-product-${fixtureTag}`} where id = ${fixtures.productB}`,
            ),
          ],
          [
            "product_lots",
            await tx.execute(
              sql`update "product_lots" set "lot_code" = ${`tampered-lot-${fixtureTag}`} where id = ${fixtures.lotB}`,
            ),
          ],
          [
            "orders",
            await tx.execute(
              sql`update "orders" set "status" = ${"cancelled"} where id = ${fixtures.orderBC}`,
            ),
          ],
        ] as const;

        for (const [tableName, result] of updateResults) {
          assert.equal(
            result.rowCount,
            0,
            `${tableName} should be immutable cross-tenant`,
          );
        }

        const deleteResults = [
          [
            "farms",
            await tx.execute(
              sql`delete from "farms" where id = ${fixtures.farmB}`,
            ),
          ],
          [
            "addresses",
            await tx.execute(
              sql`delete from "addresses" where id = ${fixtures.addressB}`,
            ),
          ],
          [
            "products",
            await tx.execute(
              sql`delete from "products" where id = ${fixtures.productB}`,
            ),
          ],
          [
            "product_lots",
            await tx.execute(
              sql`delete from "product_lots" where id = ${fixtures.lotB}`,
            ),
          ],
          [
            "orders",
            await tx.execute(
              sql`delete from "orders" where id = ${fixtures.orderBC}`,
            ),
          ],
        ] as const;

        for (const [tableName, result] of deleteResults) {
          assert.equal(
            result.rowCount,
            0,
            `${tableName} should be undeletable cross-tenant`,
          );
        }
      });

      await assert.rejects(
        () =>
          appDb.transaction(async (tx) => {
            await enableTenantRlsContext(tx, fixtures.tenantA);
            await tx.execute(sql`
                            insert into "farms" ("id", "tenant_id", "name")
                            values (${fixtures.blockedFarmInsert}, ${fixtures.tenantB}, ${`blocked-farm-${fixtureTag}`})
                        `);
          }),
        isRlsViolation,
      );

      await assert.rejects(
        () =>
          appDb.transaction(async (tx) => {
            await enableTenantRlsContext(tx, fixtures.tenantA);
            await tx.execute(sql`
                            insert into "addresses" (
                                "id",
                                "tenant_id",
                                "title",
                                "zipcode",
                                "street",
                                "number",
                                "city",
                                "state",
                                "country",
                                "formatted_address",
                                "location"
                            )
                            values (
                                ${fixtures.blockedAddressInsert},
                                ${fixtures.tenantB},
                                ${`blocked-address-${fixtureTag}`},
                                '22000-000',
                                'Rua Bloqueada',
                                '99',
                                'Rio de Janeiro',
                                'RJ',
                                'BR',
                                ${`Rua Bloqueada, 99 - RJ ${fixtureTag}`},
                                ST_SetSRID(ST_MakePoint(-43.2, -22.9), 4326)
                            )
                        `);
          }),
        isRlsViolation,
      );

      await assert.rejects(
        () =>
          appDb.transaction(async (tx) => {
            await enableTenantRlsContext(tx, fixtures.tenantA);
            await tx.execute(sql`
                            insert into "products" (
                                "id",
                                "tenant_id",
                                "farm_id",
                                "category_id",
                                "name",
                                "sale_unit",
                                "price_per_unit",
                                "min_order_qty"
                            )
                            values (
                                ${fixtures.blockedProductInsert},
                                ${fixtures.tenantB},
                                ${fixtures.farmB},
                                ${fixtures.category},
                                ${`blocked-product-${fixtureTag}`},
                                'unit',
                                '9.9000',
                                '1.000'
                            )
                        `);
          }),
        isRlsViolation,
      );

      await assert.rejects(
        () =>
          appDb.transaction(async (tx) => {
            await enableTenantRlsContext(tx, fixtures.tenantA);
            await tx.execute(sql`
                            insert into "product_lots" (
                                "id",
                                "tenant_id",
                                "product_id",
                                "lot_code",
                                "harvest_date",
                                "expiry_date",
                                "available_qty"
                            )
                            values (
                                ${fixtures.blockedLotInsert},
                                ${fixtures.tenantB},
                                ${fixtures.productB},
                                ${`blocked-lot-${fixtureTag}`},
                                '2026-03-12',
                                '2026-03-29',
                                '4.000'
                            )
                        `);
          }),
        isRlsViolation,
      );

      await assert.rejects(
        () =>
          appDb.transaction(async (tx) => {
            await enableTenantRlsContext(tx, fixtures.tenantA);
            await tx.execute(sql`
                            insert into "orders" (
                                "id",
                                "buyer_tenant_id",
                                "seller_tenant_id",
                                "delivery_street",
                                "delivery_number",
                                "delivery_cep",
                                "delivery_city",
                                "delivery_state",
                                "delivery_address",
                                "total_amount"
                            )
                            values (
                                ${fixtures.blockedOrderInsert},
                                ${fixtures.tenantB},
                                ${fixtures.tenantC},
                                'Rua Invadida',
                                '77',
                                '30100-000',
                                'Belo Horizonte',
                                'MG',
                                ${`Rua Invadida, 77 - MG ${fixtureTag}`},
                                '18.0000'
                            )
                        `);
          }),
        isRlsViolation,
      );

      const integrityCheck = await adminDb.transaction(async (tx) => {
        await enableRlsBypassContext(tx);

        const farmCheck = await tx.execute(
          sql`select "name" from "farms" where id = ${fixtures.farmB}`,
        );
        const addressCheck = await tx.execute(
          sql`select "title" from "addresses" where id = ${fixtures.addressB}`,
        );
        const productCheck = await tx.execute(
          sql`select "name" from "products" where id = ${fixtures.productB}`,
        );
        const lotCheck = await tx.execute(
          sql`select "lot_code" from "product_lots" where id = ${fixtures.lotB}`,
        );
        const orderCheck = await tx.execute(
          sql`select "status" from "orders" where id = ${fixtures.orderBC}`,
        );
        const blockedInsertCheck = await tx.execute(sql`
                    select id
                    from (
                        select ${fixtures.blockedFarmInsert}::uuid as id
                        union all select ${fixtures.blockedAddressInsert}::uuid
                        union all select ${fixtures.blockedProductInsert}::uuid
                        union all select ${fixtures.blockedLotInsert}::uuid
                        union all select ${fixtures.blockedOrderInsert}::uuid
                    ) attempted
                    where exists (
                        select 1 from "farms" where "id" = attempted.id
                    )
                       or exists (
                        select 1 from "addresses" where "id" = attempted.id
                    )
                       or exists (
                        select 1 from "products" where "id" = attempted.id
                    )
                       or exists (
                        select 1 from "product_lots" where "id" = attempted.id
                    )
                       or exists (
                        select 1 from "orders" where "id" = attempted.id
                    )
                `);

        return {
          addressTitle: String(addressCheck.rows[0]?.title),
          blockedRows: blockedInsertCheck.rowCount,
          farmName: String(farmCheck.rows[0]?.name),
          lotCode: String(lotCheck.rows[0]?.lot_code),
          orderStatus: String(orderCheck.rows[0]?.status),
          productName: String(productCheck.rows[0]?.name),
        };
      });

      assert.equal(integrityCheck.farmName, `Farm B ${fixtureTag}`);
      assert.equal(integrityCheck.addressTitle, "Endereco B");
      assert.equal(integrityCheck.productName, `Product B ${fixtureTag}`);
      assert.equal(integrityCheck.lotCode, `LOT-B-${fixtureTag}`);
      assert.equal(integrityCheck.orderStatus, "draft");
      assert.equal(integrityCheck.blockedRows, 0);
    } finally {
      await adminDb.transaction(async (tx) => {
        await enableRlsBypassContext(tx);

        await tx.execute(sql`
                    delete from "orders"
                    where id in (${fixtures.orderBC}, ${fixtures.blockedOrderInsert})
                `);
        await tx.execute(sql`
                    delete from "product_lots"
                    where id in (${fixtures.lotA}, ${fixtures.lotB}, ${fixtures.blockedLotInsert})
                `);
        await tx.execute(sql`
                    delete from "products"
                    where id in (${fixtures.productA}, ${fixtures.productB}, ${fixtures.blockedProductInsert})
                `);
        await tx.execute(sql`
                    delete from "addresses"
                    where id in (${fixtures.addressA}, ${fixtures.addressB}, ${fixtures.blockedAddressInsert})
                `);
        await tx.execute(sql`
                    delete from "farms"
                    where id in (${fixtures.farmA}, ${fixtures.farmB}, ${fixtures.blockedFarmInsert})
                `);
        await tx.execute(sql`
                    delete from "product_categories"
                    where id = ${fixtures.category}
                `);
        await tx.execute(sql`
                    delete from "tenants"
                    where id in (${fixtures.tenantA}, ${fixtures.tenantB}, ${fixtures.tenantC})
                `);
      });
    }
  },
);
