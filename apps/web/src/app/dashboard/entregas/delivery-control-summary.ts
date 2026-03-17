import type { PendingDelivery } from "./delivery-map.types";

export type DispatchWaveCandidate = {
    ctaLabel: string;
    deliveries: PendingDelivery[];
    orderIds: string[];
    primaryDelivery: PendingDelivery;
    recommendationSummary: string;
    suggestedVehicleLabel: string;
    subtitle: string;
    title: string;
    totalEstimatedWeightKg: number | null;
    totalOrders: number;
};

function hasConfirmedDispatch(delivery: PendingDelivery) {
    return delivery.dispatch !== null || delivery.status === "ready_for_dispatch";
}

function isDispatchable(delivery: PendingDelivery) {
    return !hasConfirmedDispatch(delivery)
        && delivery.status !== "in_transit"
        && delivery.status !== "delivered";
}

function isAutoActionable(delivery: PendingDelivery) {
    return isDispatchable(delivery)
        && delivery.activeOverride?.action !== "delay";
}

function humanizeVehicleType(value: string) {
    return value.replace(/_/g, " ");
}

function buildCandidate(
    primaryDelivery: PendingDelivery,
    deliveries: PendingDelivery[],
): DispatchWaveCandidate {
    const totalEstimatedWeightKg = deliveries.reduce<number | null>((sum, delivery) => {
        if (delivery.totalEstimatedWeightKg === null) {
            return sum;
        }

        return (sum ?? 0) + delivery.totalEstimatedWeightKg;
    }, null);
    const totalOrders = deliveries.length;
    const suggestedVehicleLabel =
        primaryDelivery.recommendation.suggestedVehicle?.label
        ?? humanizeVehicleType(primaryDelivery.recommendation.suggestedVehicleType);
    const extraOrders = totalOrders - 1;
    const title =
        extraOrders <= 0
            ? `Despachar ${primaryDelivery.buyerName} agora`
            : `Despachar ${primaryDelivery.buyerName} e mais ${extraOrders} pedido${extraOrders > 1 ? "s" : ""}`;
    const subtitle =
        totalOrders === 1
            ? primaryDelivery.recommendation.explanation
            : `Wave sugerida com ${totalOrders} pedidos usando ${suggestedVehicleLabel.toLowerCase()}.`;
    const recommendationSummary =
        totalOrders === 1
            ? primaryDelivery.recommendation.explanation
            : `Consolidar ${totalOrders} pedidos agora. ${primaryDelivery.recommendation.explanation}`;

    return {
        ctaLabel:
            totalOrders === 1
                ? "Confirmar saida"
                : `Confirmar wave (${totalOrders} pedidos)`,
        deliveries,
        orderIds: deliveries.map((delivery) => delivery.orderId),
        primaryDelivery,
        recommendationSummary,
        suggestedVehicleLabel,
        subtitle,
        title,
        totalEstimatedWeightKg,
        totalOrders,
    };
}

function isCompatibleWithPrimary(
    primaryDelivery: PendingDelivery,
    delivery: PendingDelivery,
) {
    if (primaryDelivery.orderId === delivery.orderId || !isAutoActionable(delivery)) {
        return false;
    }

    if ((primaryDelivery.origin?.farmId ?? null) !== (delivery.origin?.farmId ?? null)) {
        return false;
    }

    if (
        primaryDelivery.recommendation.suggestedVehicleType
        !== delivery.recommendation.suggestedVehicleType
    ) {
        return false;
    }

    const primaryVehicleId = primaryDelivery.recommendation.suggestedVehicle?.id ?? null;
    const deliveryVehicleId = delivery.recommendation.suggestedVehicle?.id ?? null;

    if (primaryVehicleId && deliveryVehicleId && primaryVehicleId !== deliveryVehicleId) {
        return false;
    }

    return true;
}

export function buildDispatchWaveCandidate(
    deliveries: PendingDelivery[],
    anchorOrderId: string,
) {
    const primaryDelivery = deliveries.find(
        (delivery) => delivery.orderId === anchorOrderId && isDispatchable(delivery),
    );

    if (!primaryDelivery) {
        return null;
    }

    const groupedDeliveries = [
        primaryDelivery,
        ...deliveries
            .filter((delivery) => isCompatibleWithPrimary(primaryDelivery, delivery))
            .slice(0, 2),
    ];

    return buildCandidate(primaryDelivery, groupedDeliveries);
}

export function buildNextDispatchAction(deliveries: PendingDelivery[]) {
    const primaryDelivery = deliveries.find((delivery) => isAutoActionable(delivery));

    if (!primaryDelivery) {
        return null;
    }

    return buildDispatchWaveCandidate(deliveries, primaryDelivery.orderId);
}
