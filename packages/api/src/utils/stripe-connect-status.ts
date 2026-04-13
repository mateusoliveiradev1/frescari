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
      actionLabel: "Ativar recebimento",
      badgeLabel: "Nao iniciado",
      description:
        "Conclua a verificacao de recebimento para liberar vendas no catalogo.",
      headline: "Recebimentos ainda nao configurados",
      needsAction: true,
    },
    pending_information: {
      actionLabel: "Continuar verificacao",
      badgeLabel: "Pendente",
      description:
        currentlyDue.length > 0
          ? `Ainda faltam ${currentlyDue.length} dado(s) para liberar o recebimento.`
          : "Complete a verificacao de recebimento para continuar.",
      headline: "Faltam dados de recebimento",
      needsAction: true,
    },
    under_review: {
      actionLabel: "Acompanhar recebimento",
      badgeLabel: "Em analise",
      description:
        "Os dados ja foram enviados e podem estar em analise antes da liberacao dos recebimentos.",
      headline: "Recebimento enviado para analise",
      needsAction: false,
    },
    ready: {
      actionLabel: "Gerenciar recebimento",
      badgeLabel: "Pronto para receber",
      description:
        eventuallyDue.length > 0
          ? "Recebimentos ativos. Acompanhe futuras exigencias para evitar bloqueios."
          : "Recebimentos ativos e conta pronta para operar.",
      headline: "Recebimento pronto para operar",
      needsAction: false,
    },
    restricted: {
      actionLabel: "Resolver recebimento",
      badgeLabel: "Bloqueado",
      description:
        pastDue.length > 0
          ? `Existem ${pastDue.length} pendencia(s) critica(s) bloqueando o recebimento.`
          : "Existe um bloqueio operacional que precisa ser resolvido.",
      headline: "Recebimentos bloqueados",
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
