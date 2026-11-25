import {
  deriveStripeConnectStatus,
  type StripeConnectState,
  type TenantStripeConnectSnapshot,
} from "@frescari/api/utils/stripe-connect-status";

/**
 * Handles events Stripe sends about producers' connected accounts.
 *
 * Without this, a producer's Stripe status was only refreshed when they opened
 * the Frescari dashboard. A producer who finished Stripe onboarding and never
 * came back, or whose documents Stripe approved hours later, stayed hidden
 * from the catalog with nobody telling them.
 *
 * The event is only a trigger: the account is re-read from Stripe
 * (syncTenant), so retried or out-of-order deliveries always converge on the
 * account's current state.
 */

export const HANDLED_CONNECT_EVENTS = new Set(["account.updated"]);

export type ConnectWebhookEvent = {
  id: string;
  type: string;
  account?: string | null;
  data: { object: { id?: string | null } };
};

export type ConnectTenant = TenantStripeConnectSnapshot & { id: string };

export type ConnectWebhookDeps = {
  findTenantByAccountId: (accountId: string) => Promise<ConnectTenant | null>;
  syncTenant: (args: {
    accountId: string;
    tenantId: string;
  }) => Promise<{ status: { state: StripeConnectState } }>;
  notifyPaymentsActive: (tenantId: string) => Promise<void>;
  notifyPaymentsBlocked: (tenantId: string) => Promise<void>;
  revalidateCatalog: () => void;
};

export type ConnectWebhookResult =
  | { outcome: "ignored_event" }
  | { outcome: "missing_account" }
  | { outcome: "unknown_account"; accountId: string }
  | {
      outcome: "synced";
      tenantId: string;
      previousState: StripeConnectState;
      state: StripeConnectState;
      becameReady: boolean;
      lostReady: boolean;
    };

export function getConnectEventAccountId(event: ConnectWebhookEvent) {
  // Connect events carry the connected account in event.account; for
  // account.updated the payload object is that same account.
  const fromEvent = event.account?.trim();
  if (fromEvent) return fromEvent;
  const fromObject = event.data.object.id?.trim();
  return fromObject?.startsWith("acct_") ? fromObject : null;
}

export async function processConnectWebhookEvent(
  event: ConnectWebhookEvent,
  deps: ConnectWebhookDeps,
): Promise<ConnectWebhookResult> {
  if (!HANDLED_CONNECT_EVENTS.has(event.type)) {
    return { outcome: "ignored_event" };
  }

  const accountId = getConnectEventAccountId(event);
  if (!accountId) {
    return { outcome: "missing_account" };
  }

  const tenant = await deps.findTenantByAccountId(accountId);
  if (!tenant) {
    // An account created outside Frescari, or one the producer replaced.
    return { outcome: "unknown_account", accountId };
  }

  const previousState = deriveStripeConnectStatus(tenant).state;
  const { status } = await deps.syncTenant({
    accountId,
    tenantId: tenant.id,
  });
  const becameReady = previousState !== "ready" && status.state === "ready";
  const lostReady = previousState === "ready" && status.state !== "ready";

  // Lots appear in (or leave) the catalog when the ready state flips.
  if ((previousState === "ready") !== (status.state === "ready")) {
    deps.revalidateCatalog();
  }

  // The previous state came from our own row, so a redelivered event sees the
  // new state already and does not email twice.
  const notify = becameReady
    ? deps.notifyPaymentsActive
    : lostReady
      ? deps.notifyPaymentsBlocked
      : null;

  if (notify) {
    try {
      await notify(tenant.id);
    } catch (error) {
      // The status is saved; a failed email must not make Stripe retry.
      console.error(
        `[CONNECT_WEBHOOK] Falha ao avisar o tenant ${tenant.id}:`,
        error,
      );
    }
  }

  return {
    outcome: "synced",
    tenantId: tenant.id,
    previousState,
    state: status.state,
    becameReady,
    lostReady,
  };
}
