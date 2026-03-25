export type InventoryStripeConnectState =
  | "not_started"
  | "pending_information"
  | "under_review"
  | "ready"
  | "restricted";

export type InventoryStripeConnectStatus =
  | {
      canReceivePayments: boolean;
      state: InventoryStripeConnectState;
    }
  | null
  | undefined;

export function getCreateLotSuccessDescription(
  connectStatus: InventoryStripeConnectStatus,
) {
  if (connectStatus?.canReceivePayments) {
    return "O novo lote ja esta disponivel no catalogo.";
  }

  switch (connectStatus?.state) {
    case "under_review":
      return "O lote foi salvo, mas so aparecera no catalogo quando a Stripe concluir a analise da sua conta.";
    case "restricted":
      return "O lote foi salvo, mas a sua conta Stripe precisa ser regularizada para liberar a publicacao no catalogo.";
    case "pending_information":
      return "O lote foi salvo, mas so aparecera no catalogo depois que voce concluir o onboarding da Stripe.";
    case "not_started":
    default:
      return "O lote foi salvo, mas so aparecera no catalogo quando sua conta Stripe estiver conectada e habilitada para receber pagamentos.";
  }
}
