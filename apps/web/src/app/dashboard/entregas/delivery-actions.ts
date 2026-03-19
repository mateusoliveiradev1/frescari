import type { PendingDelivery } from "./delivery-map.types";

export type DeliveryActionStatus = "ready_for_dispatch" | "in_transit" | "delivered";

export type DeliveryPrimaryAction =
    | {
        kind: "dispatch";
        label: "Confirmar saida";
    }
    | {
        kind: "status";
        label: "Saiu para entrega" | "Confirmar entrega";
        nextStatus: Exclude<DeliveryActionStatus, "ready_for_dispatch">;
    };

type DeliveryOperationalStatus = PendingDelivery["status"];

export function canMarkDelivered(status: DeliveryOperationalStatus) {
    return status === "ready_for_dispatch" || status === "in_transit";
}

export function getDeliveryPrimaryAction(status: DeliveryOperationalStatus): DeliveryPrimaryAction | null {
    switch (status) {
        case "payment_authorized":
        case "confirmed":
        case "picking":
            return {
                kind: "dispatch",
                label: "Confirmar saida",
            };
        case "ready_for_dispatch":
            return {
                kind: "status",
                label: "Saiu para entrega",
                nextStatus: "in_transit",
            };
        case "in_transit":
            return {
                kind: "status",
                label: "Confirmar entrega",
                nextStatus: "delivered",
            };
        default:
            return null;
    }
}
