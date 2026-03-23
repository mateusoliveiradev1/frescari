import { tenants } from "@frescari/db";

export type TenantStripeConnectSnapshot = Pick<
  typeof tenants.$inferSelect,
  | "stripeAccountId"
  | "stripeChargesEnabled"
  | "stripeDetailsSubmitted"
  | "stripePayoutsEnabled"
  | "stripeRequirementsCurrentlyDue"
  | "stripeRequirementsDisabledReason"
  | "stripeRequirementsEventuallyDue"
  | "stripeRequirementsPastDue"
  | "stripeStatusSyncedAt"
>;

export type StripeConnectState =
  | "not_started"
  | "pending_information"
  | "under_review"
  | "ready"
  | "restricted";

export type StripeConnectStatus = {
  actionLabel: string;
  badgeLabel: string;
  canReceivePayments: boolean;
  chargesEnabled: boolean;
  description: string;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  eventuallyDueFields: string[];
  hasAccount: boolean;
  headline: string;
  missingFields: string[];
  needsAction: boolean;
  payoutsEnabled: boolean;
  snapshot: TenantStripeConnectSnapshot;
  state: StripeConnectState;
  syncedAt: Date | null;
};

function normalizeRequirements(value: string[] | null | undefined) {
  return (value ?? []).filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export function deriveStripeConnectStatus(
  snapshot: TenantStripeConnectSnapshot,
): StripeConnectStatus {
  const hasAccount = Boolean(snapshot.stripeAccountId);
  const chargesEnabled = Boolean(snapshot.stripeChargesEnabled);
  const payoutsEnabled = Boolean(snapshot.stripePayoutsEnabled);
  const detailsSubmitted = Boolean(snapshot.stripeDetailsSubmitted);
  const currentlyDue = normalizeRequirements(
    snapshot.stripeRequirementsCurrentlyDue,
  );
  const eventuallyDue = normalizeRequirements(
    snapshot.stripeRequirementsEventuallyDue,
  );
  const pastDue = normalizeRequirements(snapshot.stripeRequirementsPastDue);
  const disabledReason = snapshot.stripeRequirementsDisabledReason ?? null;
  const canReceivePayments = hasAccount && chargesEnabled && payoutsEnabled;

  let state: StripeConnectState;

  if (!hasAccount) {
    state = "not_started";
  } else if (canReceivePayments) {
    state = "ready";
  } else if (pastDue.length > 0 || Boolean(disabledReason)) {
    state = "restricted";
  } else if (detailsSubmitted && currentlyDue.length === 0) {
    state = "under_review";
  } else {
    state = "pending_information";
  }

  const stateContent: Record<
    StripeConnectState,
    Pick<
      StripeConnectStatus,
      "actionLabel" | "badgeLabel" | "description" | "headline" | "needsAction"
    >
  > = {
    not_started: {
      actionLabel: "Comecar onboarding Stripe",
      badgeLabel: "Nao iniciado",
      description:
        "Conecte sua conta Stripe para liberar os recebimentos da loja.",
      headline: "Recebimentos ainda nao configurados",
      needsAction: true,
    },
    pending_information: {
      actionLabel: "Continuar onboarding Stripe",
      badgeLabel: "Pendente",
      description:
        currentlyDue.length > 0
          ? `A Stripe ainda precisa de ${currentlyDue.length} dado(s) para liberar sua conta.`
          : "Complete o onboarding da Stripe para continuar.",
      headline: "Faltam dados obrigatorios na Stripe",
      needsAction: true,
    },
    under_review: {
      actionLabel: "Abrir painel Stripe",
      badgeLabel: "Em analise",
      description:
        "Os dados ja foram enviados. Agora a Stripe pode estar revisando a conta antes de liberar os recebimentos.",
      headline: "Conta enviada para analise da Stripe",
      needsAction: false,
    },
    ready: {
      actionLabel: "Abrir painel Stripe",
      badgeLabel: "Pronto para receber",
      description:
        eventuallyDue.length > 0
          ? "Recebimentos ativos. Acompanhe futuras exigencias da Stripe para evitar bloqueios."
          : "Recebimentos ativos e conta pronta para operar.",
      headline: "Conta Stripe pronta para operar",
      needsAction: false,
    },
    restricted: {
      actionLabel: "Resolver pendencias no Stripe",
      badgeLabel: "Bloqueado",
      description:
        pastDue.length > 0
          ? `Existem ${pastDue.length} pendencia(s) critica(s) bloqueando sua conta na Stripe.`
          : "A Stripe sinalizou um bloqueio operacional que precisa ser resolvido.",
      headline: "Recebimentos bloqueados pela Stripe",
      needsAction: true,
    },
  };

  return {
    ...stateContent[state],
    canReceivePayments,
    chargesEnabled,
    detailsSubmitted,
    disabledReason,
    eventuallyDueFields: eventuallyDue,
    hasAccount,
    missingFields: state === "restricted" ? pastDue : currentlyDue,
    payoutsEnabled,
    snapshot,
    state,
    syncedAt: snapshot.stripeStatusSyncedAt ?? null,
  };
}

export function isStripeConnectReady(snapshot: TenantStripeConnectSnapshot) {
  return deriveStripeConnectStatus(snapshot).canReceivePayments;
}

export function hasLegacyUnsyncedStripeConnect(
  snapshot: TenantStripeConnectSnapshot,
) {
  return (
    Boolean(snapshot.stripeAccountId) && snapshot.stripeStatusSyncedAt == null
  );
}

export function isStripeConnectCatalogEligible(
  snapshot: TenantStripeConnectSnapshot,
) {
  return (
    isStripeConnectReady(snapshot) || hasLegacyUnsyncedStripeConnect(snapshot)
  );
}
