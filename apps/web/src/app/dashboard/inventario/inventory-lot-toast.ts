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
    return "O novo lote já esta disponível no catálogo.";
  }

  switch (connectStatus?.state) {
    case "under_review":
      return "O lote foi salvo, mas so aparecera no catálogo quando a análise do recebimento for concluída.";
    case "restricted":
      return "O lote foi salvo, mas o recebimento precisa ser regularizado para liberar a publicação no catálogo.";
    case "pending_information":
      return "O lote foi salvo, mas so aparecera no catálogo depois que você concluir a verificação de recebimento.";
    case "not_started":
    default:
      return "O lote foi salvo, mas so aparecera no catálogo quando sua conta estiver pronta para receber pagamentos.";
  }
}
