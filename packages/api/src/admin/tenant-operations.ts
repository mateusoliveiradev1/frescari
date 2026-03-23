import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  addresses,
  farms,
  orders,
  productLots,
  products,
  tenants,
  type AppDb,
  users,
} from "@frescari/db";
import { isStripeConnectReady } from "../utils/stripe-connect-status";

const activeOrderStatuses = [
  "confirmed",
  "payment_authorized",
  "awaiting_weight",
  "picking",
  "ready_for_dispatch",
  "in_transit",
  "delivered",
] as const;

const operationalOrderStatuses = [
  "payment_authorized",
  "awaiting_weight",
  "picking",
  "ready_for_dispatch",
  "in_transit",
] as const;

export const tenantOperationsFilterSchema = z.object({
  activityWindowDays: z.union([z.literal(30), z.literal(90)]).default(30),
  cursor: z.string().optional(),
  health: z
    .enum(["ALL", "inactive", "needs_setup", "operating"])
    .default("ALL"),
  limit: z.number().int().min(1).max(24).default(6),
  type: z.enum(["ALL", "BUYER", "PRODUCER"]).default("ALL"),
});

export const tenantOperationDetailSchema = z.object({
  activityWindowDays: z.union([z.literal(30), z.literal(90)]).default(30),
  tenantId: z.string().uuid(),
});

export const tenantOperationPageSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(12).default(4),
  tenantId: z.string().uuid(),
});

type TenantOperationsFilters = z.infer<typeof tenantOperationsFilterSchema>;
type TenantHealthCode = Exclude<TenantOperationsFilters["health"], "ALL">;
type TenantOperationDetailInput = z.infer<typeof tenantOperationDetailSchema>;
type TenantOperationPageInput = z.infer<typeof tenantOperationPageSchema>;
type PaginationCursorValue = {
  createdAt: Date | string;
  id: string;
  priority?: number;
};

const paginationCursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  priority: z.number().int().optional(),
});

function getWindowStart(activityWindowDays: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (activityWindowDays - 1));
  return date;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function countDoneSteps(values: boolean[]) {
  return values.filter(Boolean).length;
}

function createCountMap<T extends string>(
  rows: Array<{ count: string; key: T | null }>,
) {
  return new Map(
    rows
      .filter((row): row is { count: string; key: T } => Boolean(row.key))
      .map((row) => [row.key, toNumber(row.count)]),
  );
}

function encodePaginationCursor(value: PaginationCursorValue) {
  return Buffer.from(
    JSON.stringify({
      createdAt: new Date(value.createdAt).toISOString(),
      id: value.id,
      priority: value.priority ?? 0,
    }),
    "utf8",
  ).toString("base64url");
}

function decodePaginationCursor(cursor?: string) {
  if (!cursor) {
    return null;
  }

  try {
    const decodedValue = Buffer.from(cursor, "base64url").toString("utf8");
    return paginationCursorSchema.parse(JSON.parse(decodedValue));
  } catch {
    return null;
  }
}

function comparePaginationCursorValues(
  left: PaginationCursorValue,
  right: PaginationCursorValue,
) {
  const leftPriority = left.priority ?? 0;
  const rightPriority = right.priority ?? 0;

  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  const leftTime = new Date(left.createdAt).getTime();
  const rightTime = new Date(right.createdAt).getTime();

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id > right.id ? -1 : 1;
}

export function paginateByCreatedAtCursor<T>(
  rows: T[],
  args: {
    cursor?: string;
    getCursorValue: (row: T) => PaginationCursorValue;
    limit: number;
  },
) {
  const decodedCursor = decodePaginationCursor(args.cursor);
  const sortedRows = [...rows].sort((left, right) =>
    comparePaginationCursorValues(
      args.getCursorValue(left),
      args.getCursorValue(right),
    ),
  );
  const visibleRows = decodedCursor
    ? sortedRows.filter(
        (row) =>
          comparePaginationCursorValues(
            args.getCursorValue(row),
            decodedCursor,
          ) > 0,
      )
    : sortedRows;
  const items = visibleRows.slice(0, args.limit);
  const lastItem = items.at(-1);
  const nextCursor =
    visibleRows.length > args.limit && lastItem
      ? encodePaginationCursor(args.getCursorValue(lastItem))
      : null;

  return {
    items,
    nextCursor,
  };
}

function buildHealthRecord(args: {
  activeLotCount: number;
  addressCount: number;
  buyerOrderCount: number;
  farmCount: number;
  productCount: number;
  sellerOperationalOrderCount: number;
  stripeConnected: boolean;
  tenant: typeof tenants.$inferSelect;
  userCount: number;
}) {
  if (args.tenant.type !== "PRODUCER" && args.tenant.type !== "BUYER") {
    const checklist = [{ done: false, label: "classificacao" }];

    return {
      activeLotCount: 0,
      addressCount: 0,
      buyerOrderCount: 0,
      checklist,
      farmCount: 0,
      health: "needs_setup" as const,
      healthLabel: "Sem tipo",
      productCount: 0,
      progressPercent: 0,
      sellerOperationalOrderCount: 0,
      stripeConnected: false,
      tenant: args.tenant,
      userCount: args.userCount,
    };
  }

  if (args.tenant.type === "PRODUCER") {
    const checklist = [
      { done: args.farmCount > 0, label: "fazenda" },
      { done: args.stripeConnected, label: "stripe" },
      {
        done: args.activeLotCount > 0 || args.productCount > 0,
        label: "catalogo",
      },
    ];
    const health: TenantHealthCode =
      args.farmCount === 0 || !args.stripeConnected
        ? "needs_setup"
        : args.activeLotCount === 0
          ? "inactive"
          : "operating";
    const healthLabel =
      args.farmCount === 0
        ? "Sem fazenda"
        : !args.stripeConnected
          ? "Sem Stripe"
          : args.activeLotCount === 0
            ? "Sem lote ativo"
            : "Operando";

    return {
      activeLotCount: args.activeLotCount,
      addressCount: 0,
      buyerOrderCount: 0,
      checklist,
      farmCount: args.farmCount,
      health,
      healthLabel,
      productCount: args.productCount,
      progressPercent: Math.round(
        (countDoneSteps(checklist.map((item) => item.done)) / 3) * 100,
      ),
      sellerOperationalOrderCount: args.sellerOperationalOrderCount,
      stripeConnected: args.stripeConnected,
      tenant: args.tenant,
      userCount: args.userCount,
    };
  }

  const checklist = [
    { done: args.addressCount > 0, label: "endereco" },
    { done: args.buyerOrderCount > 0, label: "pedido recente" },
  ];
  const health: TenantHealthCode =
    args.addressCount === 0
      ? "needs_setup"
      : args.buyerOrderCount === 0
        ? "inactive"
        : "operating";
  const healthLabel =
    args.addressCount === 0
      ? "Sem endereco"
      : args.buyerOrderCount === 0
        ? "Sem pedido recente"
        : "Comprando";

  return {
    activeLotCount: 0,
    addressCount: args.addressCount,
    buyerOrderCount: args.buyerOrderCount,
    checklist,
    farmCount: 0,
    health,
    healthLabel,
    productCount: 0,
    progressPercent: Math.round(
      (countDoneSteps(checklist.map((item) => item.done)) / 2) * 100,
    ),
    sellerOperationalOrderCount: 0,
    stripeConnected: false,
    tenant: args.tenant,
    userCount: args.userCount,
  };
}

export type TenantHealthRecord = ReturnType<typeof buildHealthRecord>;

function matchesFilters(
  tenantRecord: TenantHealthRecord,
  filters: TenantOperationsFilters,
) {
  if (filters.type !== "ALL" && tenantRecord.tenant.type !== filters.type) {
    return false;
  }

  if (filters.health !== "ALL" && tenantRecord.health !== filters.health) {
    return false;
  }

  return true;
}

export function buildTenantOperationsOverviewFromRecords(args: {
  allTenants: TenantHealthRecord[];
  filters: TenantOperationsFilters;
  windowStart: Date;
}) {
  const visibleTenants = args.allTenants.filter((tenant) =>
    matchesFilters(tenant, args.filters),
  );
  const totalUsers = visibleTenants.reduce(
    (total, currentValue) => total + currentValue.userCount,
    0,
  );
  const paginatedVisibleTenants = paginateByCreatedAtCursor(visibleTenants, {
    cursor: args.filters.cursor,
    getCursorValue: (tenant) => ({
      createdAt: tenant.tenant.createdAt,
      id: tenant.tenant.id,
    }),
    limit: args.filters.limit,
  });

  return {
    activityWindowDays: args.filters.activityWindowDays,
    nextCursor: paginatedVisibleTenants.nextCursor,
    queues: {
      buyersWithoutAddress: visibleTenants
        .filter(
          (tenant) =>
            tenant.tenant.type === "BUYER" && tenant.addressCount === 0,
        )
        .slice(0, 5),
      producersWithoutFarm: visibleTenants
        .filter(
          (tenant) =>
            tenant.tenant.type === "PRODUCER" && tenant.farmCount === 0,
        )
        .slice(0, 5),
      producersWithoutStripe: visibleTenants
        .filter(
          (tenant) =>
            tenant.tenant.type === "PRODUCER" &&
            tenant.farmCount > 0 &&
            !tenant.stripeConnected,
        )
        .slice(0, 5),
    },
    summary: {
      buyersActive: visibleTenants.filter(
        (tenant) =>
          tenant.tenant.type === "BUYER" && tenant.health === "operating",
      ).length,
      buyersWithoutAddress: visibleTenants.filter(
        (tenant) => tenant.tenant.type === "BUYER" && tenant.addressCount === 0,
      ).length,
      newTenantsInWindow: visibleTenants.filter(
        (tenant) => new Date(tenant.tenant.createdAt) >= args.windowStart,
      ).length,
      producersWithoutFarm: visibleTenants.filter(
        (tenant) => tenant.tenant.type === "PRODUCER" && tenant.farmCount === 0,
      ).length,
      producersNeedingSetup: visibleTenants.filter(
        (tenant) =>
          tenant.tenant.type === "PRODUCER" && tenant.health === "needs_setup",
      ).length,
      producersOperating: visibleTenants.filter(
        (tenant) =>
          tenant.tenant.type === "PRODUCER" && tenant.health === "operating",
      ).length,
      producersWithoutStripe: visibleTenants.filter(
        (tenant) =>
          tenant.tenant.type === "PRODUCER" &&
          tenant.farmCount > 0 &&
          !tenant.stripeConnected,
      ).length,
      totalTenants: visibleTenants.length,
      totalUsers,
    },
    tenants: paginatedVisibleTenants.items,
  };
}

export async function getTenantOperationsOverview(
  db: AppDb,
  filters: TenantOperationsFilters,
) {
  const windowStart = getWindowStart(filters.activityWindowDays);
  const activeLotFilter = and(
    isNull(productLots.deletedAt),
    eq(productLots.isExpired, false),
    gt(productLots.availableQty, "0"),
  );
  const recentBuyerOrderFilter = and(
    gte(orders.createdAt, windowStart),
    inArray(orders.status, activeOrderStatuses),
  );
  const baseTenants = await db
    .select()
    .from(tenants)
    .orderBy(desc(tenants.createdAt));
  const userCounts = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: users.tenantId })
      .from(users)
      .where(isNotNull(users.tenantId))
      .groupBy(users.tenantId),
  );
  const farmCounts = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: farms.tenantId })
      .from(farms)
      .groupBy(farms.tenantId),
  );
  const addressCounts = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: addresses.tenantId })
      .from(addresses)
      .groupBy(addresses.tenantId),
  );
  const productCounts = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: products.tenantId })
      .from(products)
      .where(eq(products.isActive, true))
      .groupBy(products.tenantId),
  );
  const activeLotCounts = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: productLots.tenantId })
      .from(productLots)
      .where(activeLotFilter)
      .groupBy(productLots.tenantId),
  );
  const buyerOrderCounts = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: orders.buyerTenantId })
      .from(orders)
      .where(recentBuyerOrderFilter)
      .groupBy(orders.buyerTenantId),
  );
  const sellerOperationalOrderCounts = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: orders.sellerTenantId })
      .from(orders)
      .where(inArray(orders.status, operationalOrderStatuses))
      .groupBy(orders.sellerTenantId),
  );

  const allTenants = baseTenants.map((tenant) =>
    buildHealthRecord({
      activeLotCount: activeLotCounts.get(tenant.id) ?? 0,
      addressCount: addressCounts.get(tenant.id) ?? 0,
      buyerOrderCount: buyerOrderCounts.get(tenant.id) ?? 0,
      farmCount: farmCounts.get(tenant.id) ?? 0,
      productCount: productCounts.get(tenant.id) ?? 0,
      sellerOperationalOrderCount:
        sellerOperationalOrderCounts.get(tenant.id) ?? 0,
      stripeConnected: isStripeConnectReady(tenant),
      tenant,
      userCount: userCounts.get(tenant.id) ?? 0,
    }),
  );
  return buildTenantOperationsOverviewFromRecords({
    allTenants,
    filters,
    windowStart,
  });
}

export async function getTenantOperationDetail(
  db: AppDb,
  input: TenantOperationDetailInput,
) {
  const windowStart = getWindowStart(input.activityWindowDays);
  const activeLotFilter = and(
    isNull(productLots.deletedAt),
    eq(productLots.isExpired, false),
    gt(productLots.availableQty, "0"),
  );
  const recentBuyerOrderFilter = and(
    eq(orders.buyerTenantId, input.tenantId),
    gte(orders.createdAt, windowStart),
    inArray(orders.status, activeOrderStatuses),
  );

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    return null;
  }

  const [userCountRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(users)
    .where(eq(users.tenantId, input.tenantId));
  const [farmCountRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(farms)
    .where(eq(farms.tenantId, input.tenantId));
  const [addressCountRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(addresses)
    .where(eq(addresses.tenantId, input.tenantId));
  const [productCountRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(products)
    .where(
      and(eq(products.tenantId, input.tenantId), eq(products.isActive, true)),
    );
  const [activeLotCountRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(productLots)
    .where(and(eq(productLots.tenantId, input.tenantId), activeLotFilter));
  const [buyerOrderCountRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(orders)
    .where(recentBuyerOrderFilter);
  const [sellerOperationalOrderCountRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.sellerTenantId, input.tenantId),
        inArray(orders.status, operationalOrderStatuses),
      ),
    );

  const userCount = toNumber(userCountRow?.count);
  const farmCount = toNumber(farmCountRow?.count);
  const addressCount = toNumber(addressCountRow?.count);
  const productCount = toNumber(productCountRow?.count);
  const activeLotCount = toNumber(activeLotCountRow?.count);
  const buyerOrderCount = toNumber(buyerOrderCountRow?.count);
  const sellerOperationalOrderCount = toNumber(
    sellerOperationalOrderCountRow?.count,
  );

  const health = buildHealthRecord({
    activeLotCount,
    addressCount,
    buyerOrderCount,
    farmCount,
    productCount,
    sellerOperationalOrderCount,
    stripeConnected: isStripeConnectReady(tenant),
    tenant,
    userCount,
  });

  return {
    activityWindowDays: input.activityWindowDays,
    health,
    summary: {
      activeLotCount,
      addressCount,
      buyerOrderCount,
      farmCount,
      productCount,
      sellerOperationalOrderCount,
      stripeConnected: isStripeConnectReady(tenant),
      userCount,
    },
    tenant,
  };
}

export async function getTenantUsersPage(
  db: AppDb,
  input: TenantOperationPageInput,
) {
  const userRows = await db
    .select({
      createdAt: users.createdAt,
      email: users.email,
      id: users.id,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.tenantId, input.tenantId));
  const paginatedUsers = paginateByCreatedAtCursor(userRows, {
    cursor: input.cursor,
    getCursorValue: (user) => ({
      createdAt: user.createdAt,
      id: user.id,
    }),
    limit: input.limit,
  });

  return {
    items: paginatedUsers.items,
    nextCursor: paginatedUsers.nextCursor,
  };
}

export async function getTenantFarmsPage(
  db: AppDb,
  input: TenantOperationPageInput,
) {
  const farmRows = await db
    .select({
      address: farms.address,
      createdAt: farms.createdAt,
      id: farms.id,
      name: farms.name,
    })
    .from(farms)
    .where(eq(farms.tenantId, input.tenantId));
  const paginatedFarms = paginateByCreatedAtCursor(farmRows, {
    cursor: input.cursor,
    getCursorValue: (farm) => ({
      createdAt: farm.createdAt,
      id: farm.id,
    }),
    limit: input.limit,
  });

  return {
    items: paginatedFarms.items,
    nextCursor: paginatedFarms.nextCursor,
  };
}

export async function getTenantAddressesPage(
  db: AppDb,
  input: TenantOperationPageInput,
) {
  const addressRows = await db
    .select({
      city: addresses.city,
      createdAt: addresses.createdAt,
      formattedAddress: addresses.formattedAddress,
      id: addresses.id,
      isDefault: addresses.isDefault,
      state: addresses.state,
      title: addresses.title,
    })
    .from(addresses)
    .where(eq(addresses.tenantId, input.tenantId));
  const paginatedAddresses = paginateByCreatedAtCursor(addressRows, {
    cursor: input.cursor,
    getCursorValue: (address) => ({
      createdAt: address.createdAt,
      id: address.id,
      priority: address.isDefault ? 1 : 0,
    }),
    limit: input.limit,
  });

  return {
    items: paginatedAddresses.items,
    nextCursor: paginatedAddresses.nextCursor,
  };
}

export async function getTenantProductsPage(
  db: AppDb,
  input: TenantOperationPageInput,
) {
  const activeLotCountsByProduct = createCountMap(
    await db
      .select({ count: sql<string>`count(*)`, key: productLots.productId })
      .from(productLots)
      .where(
        and(
          eq(productLots.tenantId, input.tenantId),
          isNull(productLots.deletedAt),
          eq(productLots.isExpired, false),
          gt(productLots.availableQty, "0"),
        ),
      )
      .groupBy(productLots.productId),
  );
  const productRows = await db
    .select({
      createdAt: products.createdAt,
      id: products.id,
      isActive: products.isActive,
      name: products.name,
    })
    .from(products)
    .where(eq(products.tenantId, input.tenantId));
  const paginatedProducts = paginateByCreatedAtCursor(productRows, {
    cursor: input.cursor,
    getCursorValue: (product) => ({
      createdAt: product.createdAt,
      id: product.id,
    }),
    limit: input.limit,
  });

  return {
    items: paginatedProducts.items.map((product) => ({
      ...product,
      activeLotCount: activeLotCountsByProduct.get(product.id) ?? 0,
    })),
    nextCursor: paginatedProducts.nextCursor,
  };
}

export async function getTenantLotsPage(
  db: AppDb,
  input: TenantOperationPageInput,
) {
  const lotRows = await db
    .select({
      availableQty: productLots.availableQty,
      createdAt: productLots.createdAt,
      expiryDate: productLots.expiryDate,
      id: productLots.id,
      isExpired: productLots.isExpired,
      lotCode: productLots.lotCode,
      productName: products.name,
    })
    .from(productLots)
    .innerJoin(products, eq(productLots.productId, products.id))
    .where(eq(productLots.tenantId, input.tenantId));
  const paginatedLots = paginateByCreatedAtCursor(lotRows, {
    cursor: input.cursor,
    getCursorValue: (lot) => ({
      createdAt: lot.createdAt,
      id: lot.id,
    }),
    limit: input.limit,
  });

  return {
    items: paginatedLots.items,
    nextCursor: paginatedLots.nextCursor,
  };
}

async function getTenantOrdersPage(
  db: AppDb,
  input: TenantOperationPageInput & {
    side: "buyer" | "seller";
  },
) {
  const orderRows = await db
    .select({
      counterpartyTenantId:
        input.side === "buyer" ? orders.sellerTenantId : orders.buyerTenantId,
      createdAt: orders.createdAt,
      deliveryCity: orders.deliveryCity,
      deliveryState: orders.deliveryState,
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
    })
    .from(orders)
    .where(
      input.side === "buyer"
        ? eq(orders.buyerTenantId, input.tenantId)
        : eq(orders.sellerTenantId, input.tenantId),
    );
  const paginatedOrders = paginateByCreatedAtCursor(orderRows, {
    cursor: input.cursor,
    getCursorValue: (order) => ({
      createdAt: order.createdAt,
      id: order.id,
    }),
    limit: input.limit,
  });
  const counterpartyIds = Array.from(
    new Set(
      paginatedOrders.items
        .map((order) => order.counterpartyTenantId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const counterparties =
    counterpartyIds.length > 0
      ? await db
          .select({
            id: tenants.id,
            name: tenants.name,
          })
          .from(tenants)
          .where(inArray(tenants.id, counterpartyIds))
      : [];
  const counterpartyNames = new Map(
    counterparties.map((tenantRow) => [tenantRow.id, tenantRow.name]),
  );

  return {
    items: paginatedOrders.items.map((order) => ({
      ...order,
      counterpartyName:
        order.counterpartyTenantId != null
          ? (counterpartyNames.get(order.counterpartyTenantId) ?? null)
          : null,
    })),
    nextCursor: paginatedOrders.nextCursor,
  };
}

export async function getTenantOrdersAsBuyerPage(
  db: AppDb,
  input: TenantOperationPageInput,
) {
  return getTenantOrdersPage(db, {
    ...input,
    side: "buyer",
  });
}

export async function getTenantOrdersAsSellerPage(
  db: AppDb,
  input: TenantOperationPageInput,
) {
  return getTenantOrdersPage(db, {
    ...input,
    side: "seller",
  });
}
