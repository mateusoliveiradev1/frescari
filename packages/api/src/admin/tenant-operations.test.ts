import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTenantOperationsOverviewFromRecords,
  paginateByCreatedAtCursor,
  type TenantHealthRecord,
} from "./tenant-operations";

function createTenantRecord(
  overrides: Omit<Partial<TenantHealthRecord>, "tenant"> & {
    tenant: { id: string; name: string } & Partial<
      TenantHealthRecord["tenant"]
    >;
  },
): TenantHealthRecord {
  const now = new Date();
  const { tenant: tenantOverrides, ...recordOverrides } = overrides;
  const tenant = {
    createdAt: tenantOverrides.createdAt ?? now,
    geoRegion: tenantOverrides.geoRegion ?? null,
    id: tenantOverrides.id,
    name: tenantOverrides.name,
    plan: tenantOverrides.plan ?? "free",
    producerContactName: tenantOverrides.producerContactName ?? null,
    producerDocumentId: tenantOverrides.producerDocumentId ?? null,
    producerLegalEntityType: tenantOverrides.producerLegalEntityType ?? null,
    producerLegalName: tenantOverrides.producerLegalName ?? null,
    producerPhone: tenantOverrides.producerPhone ?? null,
    producerProfileCompletedAt:
      tenantOverrides.producerProfileCompletedAt ?? null,
    slug: tenantOverrides.slug ?? tenantOverrides.id,
    stripeAccountId: tenantOverrides.stripeAccountId ?? null,
    stripeChargesEnabled: tenantOverrides.stripeChargesEnabled ?? null,
    stripeDetailsSubmitted: tenantOverrides.stripeDetailsSubmitted ?? null,
    stripePayoutsEnabled: tenantOverrides.stripePayoutsEnabled ?? null,
    stripeRequirementsCurrentlyDue:
      tenantOverrides.stripeRequirementsCurrentlyDue ?? null,
    stripeRequirementsDisabledReason:
      tenantOverrides.stripeRequirementsDisabledReason ?? null,
    stripeRequirementsEventuallyDue:
      tenantOverrides.stripeRequirementsEventuallyDue ?? null,
    stripeRequirementsPastDue:
      tenantOverrides.stripeRequirementsPastDue ?? null,
    stripeStatusSyncedAt: tenantOverrides.stripeStatusSyncedAt ?? null,
    type: tenantOverrides.type ?? "PRODUCER",
  };

  return {
    activeLotCount: 0,
    addressCount: 0,
    buyerOrderCount: 0,
    checklist: [],
    farmCount: 0,
    health: "inactive",
    healthLabel: "Sem atividade",
    productCount: 0,
    progressPercent: 0,
    sellerOperationalOrderCount: 0,
    stripeConnected: false,
    tenant,
    userCount: 0,
    ...recordOverrides,
  };
}

test("buildTenantOperationsOverviewFromRecords scopes summary and queues to the active filter set", () => {
  const now = new Date();
  const recentDate = new Date(now);
  recentDate.setDate(now.getDate() - 3);

  const olderDate = new Date(now);
  olderDate.setDate(now.getDate() - 45);

  const records: TenantHealthRecord[] = [
    createTenantRecord({
      farmCount: 0,
      health: "needs_setup",
      healthLabel: "Sem fazenda",
      tenant: {
        createdAt: recentDate,
        id: "producer-setup",
        name: "Produtor em setup",
        type: "PRODUCER",
      },
      userCount: 2,
    }),
    createTenantRecord({
      activeLotCount: 4,
      farmCount: 1,
      health: "operating",
      healthLabel: "Operando",
      sellerOperationalOrderCount: 2,
      stripeConnected: true,
      tenant: {
        createdAt: olderDate,
        id: "producer-live",
        name: "Produtor ativo",
        stripeAccountId: "acct_live",
        type: "PRODUCER",
      },
      userCount: 4,
    }),
    createTenantRecord({
      addressCount: 0,
      health: "needs_setup",
      healthLabel: "Sem endereco",
      tenant: {
        createdAt: recentDate,
        id: "buyer-setup",
        name: "Buyer sem endereco",
        type: "BUYER",
      },
      userCount: 1,
    }),
  ];

  const overview = buildTenantOperationsOverviewFromRecords({
    allTenants: records,
    filters: {
      activityWindowDays: 30,
      cursor: undefined,
      health: "needs_setup",
      limit: 6,
      type: "PRODUCER",
    },
    windowStart: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
  });

  assert.deepEqual(
    overview.tenants.map((tenant) => tenant.tenant.id),
    ["producer-setup"],
  );
  assert.equal(overview.summary.totalTenants, 1);
  assert.equal(overview.summary.totalUsers, 2);
  assert.equal(overview.summary.newTenantsInWindow, 1);
  assert.equal(overview.summary.producersWithoutFarm, 1);
  assert.equal(overview.summary.producersNeedingSetup, 1);
  assert.equal(overview.summary.producersOperating, 0);
  assert.equal(overview.summary.buyersWithoutAddress, 0);
  assert.equal(overview.summary.buyersActive, 0);
  assert.equal(overview.queues.producersWithoutFarm.length, 1);
  assert.equal(overview.queues.producersWithoutStripe.length, 0);
  assert.equal(overview.queues.buyersWithoutAddress.length, 0);
  assert.equal(overview.nextCursor, null);
});

test("buildTenantOperationsOverviewFromRecords keeps cross-type counts when no type filter is applied", () => {
  const now = new Date();

  const records: TenantHealthRecord[] = [
    createTenantRecord({
      activeLotCount: 1,
      farmCount: 1,
      health: "operating",
      healthLabel: "Operando",
      stripeConnected: true,
      tenant: {
        createdAt: now,
        id: "producer-ok",
        name: "Produtor ok",
        stripeAccountId: "acct_ok",
        type: "PRODUCER",
      },
      userCount: 3,
    }),
    createTenantRecord({
      addressCount: 1,
      buyerOrderCount: 2,
      health: "operating",
      healthLabel: "Comprando",
      tenant: {
        createdAt: now,
        id: "buyer-ok",
        name: "Buyer ok",
        type: "BUYER",
      },
      userCount: 5,
    }),
  ];

  const overview = buildTenantOperationsOverviewFromRecords({
    allTenants: records,
    filters: {
      activityWindowDays: 30,
      cursor: undefined,
      health: "ALL",
      limit: 6,
      type: "ALL",
    },
    windowStart: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
  });

  assert.equal(overview.summary.totalTenants, 2);
  assert.equal(overview.summary.totalUsers, 8);
  assert.equal(overview.summary.producersOperating, 1);
  assert.equal(overview.summary.buyersActive, 1);
  assert.equal(overview.tenants.length, 2);
  assert.equal(overview.nextCursor, null);
});

test("buildTenantOperationsOverviewFromRecords paginates tenants without shrinking summary or queues", () => {
  const sharedDate = new Date("2026-03-10T10:00:00.000Z");

  const records: TenantHealthRecord[] = [
    createTenantRecord({
      activeLotCount: 1,
      farmCount: 1,
      health: "operating",
      healthLabel: "Operando",
      stripeConnected: true,
      tenant: {
        createdAt: sharedDate,
        id: "tenant-c",
        name: "Tenant C",
        stripeAccountId: "acct_c",
        type: "PRODUCER",
      },
      userCount: 2,
    }),
    createTenantRecord({
      activeLotCount: 1,
      farmCount: 1,
      health: "operating",
      healthLabel: "Operando",
      stripeConnected: true,
      tenant: {
        createdAt: sharedDate,
        id: "tenant-b",
        name: "Tenant B",
        stripeAccountId: "acct_b",
        type: "PRODUCER",
      },
      userCount: 3,
    }),
    createTenantRecord({
      activeLotCount: 1,
      farmCount: 1,
      health: "operating",
      healthLabel: "Operando",
      stripeConnected: true,
      tenant: {
        createdAt: sharedDate,
        id: "tenant-a",
        name: "Tenant A",
        stripeAccountId: "acct_a",
        type: "PRODUCER",
      },
      userCount: 4,
    }),
  ];

  const firstPage = buildTenantOperationsOverviewFromRecords({
    allTenants: records,
    filters: {
      activityWindowDays: 30,
      cursor: undefined,
      health: "ALL",
      limit: 2,
      type: "PRODUCER",
    },
    windowStart: new Date("2026-02-10T00:00:00.000Z"),
  });

  assert.deepEqual(
    firstPage.tenants.map((tenant) => tenant.tenant.id),
    ["tenant-c", "tenant-b"],
  );
  assert.equal(firstPage.summary.totalTenants, 3);
  assert.equal(firstPage.summary.totalUsers, 9);
  assert.equal(firstPage.summary.producersOperating, 3);
  assert.equal(firstPage.queues.producersWithoutFarm.length, 0);
  assert.notEqual(firstPage.nextCursor, null);

  const secondPage = buildTenantOperationsOverviewFromRecords({
    allTenants: records,
    filters: {
      activityWindowDays: 30,
      cursor: firstPage.nextCursor ?? undefined,
      health: "ALL",
      limit: 2,
      type: "PRODUCER",
    },
    windowStart: new Date("2026-02-10T00:00:00.000Z"),
  });

  assert.deepEqual(
    secondPage.tenants.map((tenant) => tenant.tenant.id),
    ["tenant-a"],
  );
  assert.equal(secondPage.summary.totalTenants, 3);
  assert.equal(secondPage.summary.totalUsers, 9);
  assert.equal(secondPage.summary.producersOperating, 3);
  assert.equal(secondPage.nextCursor, null);
});

test("paginateByCreatedAtCursor preserves priority before createdAt and keeps cursor traversal stable", () => {
  const rows = [
    {
      createdAt: new Date("2026-03-12T10:00:00.000Z"),
      id: "address-recent",
      priority: 0,
    },
    {
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      id: "address-default",
      priority: 1,
    },
    {
      createdAt: new Date("2026-02-20T10:00:00.000Z"),
      id: "address-older",
      priority: 0,
    },
  ];

  const firstPage = paginateByCreatedAtCursor(rows, {
    getCursorValue: (row) => ({
      createdAt: row.createdAt,
      id: row.id,
      priority: row.priority,
    }),
    limit: 2,
  });

  assert.deepEqual(
    firstPage.items.map((row) => row.id),
    ["address-default", "address-recent"],
  );
  assert.notEqual(firstPage.nextCursor, null);

  const secondPage = paginateByCreatedAtCursor(rows, {
    cursor: firstPage.nextCursor ?? undefined,
    getCursorValue: (row) => ({
      createdAt: row.createdAt,
      id: row.id,
      priority: row.priority,
    }),
    limit: 2,
  });

  assert.deepEqual(
    secondPage.items.map((row) => row.id),
    ["address-older"],
  );
  assert.equal(secondPage.nextCursor, null);
});
