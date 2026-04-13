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
      return "O lote foi salvo, mas so aparecera no catalogo quando a analise do recebimento for concluida.";
    case "restricted":
      return "O lote foi salvo, mas o recebimento precisa ser regularizado para liberar a publicacao no catalogo.";
    case "pending_information":
      return "O lote foi salvo, mas so aparecera no catalogo depois que voce concluir a verificacao de recebimento.";
    case "not_started":
    default:
      return "O lote foi salvo, mas so aparecera no catalogo quando sua conta estiver pronta para receber pagamentos.";
  }
}
