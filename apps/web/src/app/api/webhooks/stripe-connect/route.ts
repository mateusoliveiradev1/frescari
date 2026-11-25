import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import {
  activeProductLotWhere,
  authDb,
  enableRlsBypassContext,
  farms,
  productLots,
  tenants,
  users,
  type AppDb,
} from "@frescari/db";
import { syncTenantStripeConnectStatus } from "@frescari/api/stripe-connect";
import { and, eq, isNotNull } from "drizzle-orm";

import { sanitizeEnvValue } from "@/lib/env";
import { sendPaymentsStatusEmails } from "@/lib/payments-status-email";
import {
  processConnectWebhookEvent,
  type ConnectWebhookEvent,
} from "@/lib/stripe-connect-webhook";

// Events about producers' connected accounts arrive on a separate Stripe
// endpoint ("Events on connected accounts"), which has its own signing secret.
const connectWebhookSecret = sanitizeEnvValue(
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
);

function withBypass<T>(callback: (database: AppDb) => Promise<T>) {
  return authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);
    return callback(tx as AppDb);
  });
}

async function notifyProducers(tenantId: string, kind: "active" | "blocked") {
  const { recipients, farmLocated, hasActiveLot } = await withBypass(
    async (database) => {
      const recipients = await database
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, "producer")));
      const [farm] = await database
        .select({ id: farms.id })
        .from(farms)
        .where(and(eq(farms.tenantId, tenantId), isNotNull(farms.location)))
        .limit(1);
      const [lot] = await database
        .select({ id: productLots.id })
        .from(productLots)
        .where(activeProductLotWhere(eq(productLots.tenantId, tenantId)))
        .limit(1);
      return {
        recipients,
        farmLocated: Boolean(farm),
        hasActiveLot: Boolean(lot),
      };
    },
  );

  const sent = await sendPaymentsStatusEmails(recipients, {
    kind,
    farmLocated,
    hasActiveLot,
  });
  console.log(
    `[CONNECT_WEBHOOK] Email payments-${kind} para o tenant ${tenantId}: ${sent}/${recipients.length}`,
  );
}

export async function POST(req: NextRequest) {
  if (!connectWebhookSecret) {
    console.error("[CONNECT_WEBHOOK] STRIPE_CONNECT_WEBHOOK_SECRET ausente.");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    // constructEvent only verifies the signature; no API key is needed.
    event = Stripe.webhooks.constructEvent(
      body,
      signature,
      connectWebhookSecret,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CONNECT_WEBHOOK] Assinatura invalida:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await processConnectWebhookEvent(
      event as unknown as ConnectWebhookEvent,
      {
        findTenantByAccountId: (accountId) =>
          withBypass(async (database) => {
            const [tenant] = await database
              .select({
                id: tenants.id,
                stripeAccountId: tenants.stripeAccountId,
                stripeChargesEnabled: tenants.stripeChargesEnabled,
                stripeDetailsSubmitted: tenants.stripeDetailsSubmitted,
                stripePayoutsEnabled: tenants.stripePayoutsEnabled,
                stripeRequirementsCurrentlyDue:
                  tenants.stripeRequirementsCurrentlyDue,
                stripeRequirementsDisabledReason:
                  tenants.stripeRequirementsDisabledReason,
                stripeRequirementsEventuallyDue:
                  tenants.stripeRequirementsEventuallyDue,
                stripeRequirementsPastDue: tenants.stripeRequirementsPastDue,
                stripeStatusSyncedAt: tenants.stripeStatusSyncedAt,
              })
              .from(tenants)
              .where(eq(tenants.stripeAccountId, accountId))
              .limit(1);
            return tenant ?? null;
          }),
        syncTenant: (args) =>
          withBypass((database) =>
            syncTenantStripeConnectStatus(database, args),
          ),
        notifyPaymentsActive: (tenantId) => notifyProducers(tenantId, "active"),
        notifyPaymentsBlocked: (tenantId) =>
          notifyProducers(tenantId, "blocked"),
        revalidateCatalog: () => {
          revalidatePath("/catalogo", "layout");
          revalidatePath("/produtor", "layout");
        },
      },
    );

    console.log(
      `[CONNECT_WEBHOOK] ${event.type} ${event.id}: ${JSON.stringify(result)}`,
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 makes Stripe retry later, e.g. after a transient DB or API error.
    console.error(`[CONNECT_WEBHOOK] Falha ao processar ${event.id}:`, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
