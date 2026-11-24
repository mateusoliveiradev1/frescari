import Stripe from "stripe";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { tenants, type AppDb } from "@frescari/db";

import { sanitizeEnvValue } from "./env";
import {
  deriveStripeConnectStatus,
  type StripeConnectState,
  type TenantStripeConnectSnapshot,
} from "./utils/stripe-connect-status";

const stripeSecretKey = sanitizeEnvValue(process.env.STRIPE_SECRET_KEY);

if (!stripeSecretKey) {
  console.warn(
    "[STRIPE] STRIPE_SECRET_KEY is not set. Connect status sync will fail at runtime.",
  );
}

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey);
  }

  return stripeClient;
}

type StripeTenantStatusUpdate = Pick<
  typeof tenants.$inferInsert,
  | "stripeChargesEnabled"
  | "stripeDetailsSubmitted"
  | "stripePayoutsEnabled"
  | "stripeRequirementsCurrentlyDue"
  | "stripeRequirementsDisabledReason"
  | "stripeRequirementsEventuallyDue"
  | "stripeRequirementsPastDue"
  | "stripeStatusSyncedAt"
>;

function normalizeRequirements(value: string[] | null | undefined) {
  return (value ?? []).filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export function buildStripeTenantStatusUpdate(
  account: Stripe.Account,
): StripeTenantStatusUpdate {
  return {
    stripeChargesEnabled: account.charges_enabled,
    stripeDetailsSubmitted: account.details_submitted,
    stripePayoutsEnabled: account.payouts_enabled,
    stripeRequirementsCurrentlyDue: normalizeRequirements(
      account.requirements?.currently_due,
    ),
    stripeRequirementsDisabledReason:
      account.requirements?.disabled_reason ?? null,
    stripeRequirementsEventuallyDue: normalizeRequirements(
      account.requirements?.eventually_due,
    ),
    stripeRequirementsPastDue: normalizeRequirements(
      account.requirements?.past_due,
    ),
    stripeStatusSyncedAt: new Date(),
  };
}

export function buildStripeConnectSnapshot(
  accountId: string | null,
  update: StripeTenantStatusUpdate,
): TenantStripeConnectSnapshot {
  return {
    stripeAccountId: accountId,
    stripeChargesEnabled: update.stripeChargesEnabled ?? null,
    stripeDetailsSubmitted: update.stripeDetailsSubmitted ?? null,
    stripePayoutsEnabled: update.stripePayoutsEnabled ?? null,
    stripeRequirementsCurrentlyDue:
      update.stripeRequirementsCurrentlyDue ?? null,
    stripeRequirementsDisabledReason:
      update.stripeRequirementsDisabledReason ?? null,
    stripeRequirementsEventuallyDue:
      update.stripeRequirementsEventuallyDue ?? null,
    stripeRequirementsPastDue: update.stripeRequirementsPastDue ?? null,
    stripeStatusSyncedAt: update.stripeStatusSyncedAt ?? null,
  };
}

export type StripeConnectBackfillCandidate = Pick<
  typeof tenants.$inferSelect,
  | "createdAt"
  | "id"
  | "name"
  | "stripeAccountId"
  | "stripeStatusSyncedAt"
  | "type"
>;

export type StripeConnectBackfillOptions = {
  continueOnError?: boolean;
  limit?: number;
  onlyUnsynced?: boolean;
  syncTenantStatus?: typeof syncTenantStripeConnectStatus;
  tenantIds?: string[];
};

export type StripeConnectBackfillItem = {
  accountId: string;
  canReceivePayments?: boolean;
  description?: string;
  error?: string;
  outcome: "failed" | "synced";
  state?: StripeConnectState;
  syncedAt?: Date | null;
  tenantId: string;
  tenantName: string;
};

export type StripeConnectBackfillResult = {
  attempted: number;
  failed: number;
  items: StripeConnectBackfillItem[];
  synced: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export function filterStripeConnectBackfillCandidates(
  candidates: StripeConnectBackfillCandidate[],
  options: Pick<
    StripeConnectBackfillOptions,
    "limit" | "onlyUnsynced" | "tenantIds"
  >,
) {
  const limit = options.limit ?? 25;
  const onlyUnsynced = options.onlyUnsynced ?? true;
  const tenantIds = options.tenantIds?.length
    ? new Set(options.tenantIds)
    : null;

  return [...candidates]
    .filter((candidate) => candidate.type === "PRODUCER")
    .filter(
      (candidate) =>
        typeof candidate.stripeAccountId === "string" &&
        candidate.stripeAccountId.length > 0,
    )
    .filter((candidate) =>
      onlyUnsynced ? candidate.stripeStatusSyncedAt == null : true,
    )
    .filter((candidate) => (tenantIds ? tenantIds.has(candidate.id) : true))
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() -
        new Date(right.createdAt).getTime(),
    )
    .slice(0, limit);
}

export async function runStripeConnectStatusBackfill(args: {
  candidates: StripeConnectBackfillCandidate[];
  continueOnError?: boolean;
  db: AppDb;
  syncTenantStatus?: typeof syncTenantStripeConnectStatus;
}): Promise<StripeConnectBackfillResult> {
  const syncTenantStatusFn =
    args.syncTenantStatus ?? syncTenantStripeConnectStatus;
  const continueOnError = args.continueOnError ?? true;
  const items: StripeConnectBackfillItem[] = [];

  for (const candidate of args.candidates) {
    if (!candidate.stripeAccountId) {
      continue;
    }

    try {
      const { status } = await syncTenantStatusFn(args.db, {
        accountId: candidate.stripeAccountId,
        tenantId: candidate.id,
      });

      items.push({
        accountId: candidate.stripeAccountId,
        canReceivePayments: status.canReceivePayments,
        description: status.description,
        outcome: "synced",
        state: status.state,
        syncedAt: status.syncedAt,
        tenantId: candidate.id,
        tenantName: candidate.name,
      });
    } catch (error) {
      items.push({
        accountId: candidate.stripeAccountId,
        error: getErrorMessage(error),
        outcome: "failed",
        tenantId: candidate.id,
        tenantName: candidate.name,
      });

      if (!continueOnError) {
        break;
      }
    }
  }

  return {
    attempted: items.length,
    failed: items.filter((item) => item.outcome === "failed").length,
    items,
    synced: items.filter((item) => item.outcome === "synced").length,
  };
}

export async function syncStripeConnectStatusBatch(
  db: AppDb,
  options: StripeConnectBackfillOptions = {},
) {
  const whereClauses = [
    eq(tenants.type, "PRODUCER"),
    isNotNull(tenants.stripeAccountId),
  ];

  if (options.onlyUnsynced ?? true) {
    whereClauses.push(isNull(tenants.stripeStatusSyncedAt));
  }

  if (options.tenantIds?.length) {
    whereClauses.push(inArray(tenants.id, options.tenantIds));
  }

  const rawCandidates = await db
    .select({
      createdAt: tenants.createdAt,
      id: tenants.id,
      name: tenants.name,
      stripeAccountId: tenants.stripeAccountId,
      stripeStatusSyncedAt: tenants.stripeStatusSyncedAt,
      type: tenants.type,
    })
    .from(tenants)
    .where(and(...whereClauses))
    .orderBy(asc(tenants.createdAt));

  const candidates = filterStripeConnectBackfillCandidates(rawCandidates, {
    limit: options.limit,
    onlyUnsynced: options.onlyUnsynced,
    tenantIds: options.tenantIds,
  });

  return runStripeConnectStatusBackfill({
    candidates,
    continueOnError: options.continueOnError,
    db,
    syncTenantStatus: options.syncTenantStatus,
  });
}

export async function syncTenantStripeConnectStatus(
  db: AppDb,
  args: {
    accountId: string;
    tenantId: string;
  },
) {
  const account = await getStripeClient().accounts.retrieve(args.accountId);

  if ("deleted" in account && account.deleted) {
    const deletedSnapshot: TenantStripeConnectSnapshot = {
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripeDetailsSubmitted: false,
      stripePayoutsEnabled: false,
      stripeRequirementsCurrentlyDue: [],
      stripeRequirementsDisabledReason: "account_deleted",
      stripeRequirementsEventuallyDue: [],
      stripeRequirementsPastDue: [],
      stripeStatusSyncedAt: new Date(),
    };

    await db
      .update(tenants)
      .set({
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripeDetailsSubmitted: false,
        stripePayoutsEnabled: false,
        stripeRequirementsCurrentlyDue: [],
        stripeRequirementsDisabledReason: "account_deleted",
        stripeRequirementsEventuallyDue: [],
        stripeRequirementsPastDue: [],
        stripeStatusSyncedAt: deletedSnapshot.stripeStatusSyncedAt,
      })
      .where(eq(tenants.id, args.tenantId));

    return {
      account,
      snapshot: deletedSnapshot,
      status: deriveStripeConnectStatus(deletedSnapshot),
    };
  }

  const update = buildStripeTenantStatusUpdate(account);

  await db.update(tenants).set(update).where(eq(tenants.id, args.tenantId));

  const snapshot = buildStripeConnectSnapshot(args.accountId, update);

  return {
    account,
    snapshot,
    status: deriveStripeConnectStatus(snapshot),
  };
}
