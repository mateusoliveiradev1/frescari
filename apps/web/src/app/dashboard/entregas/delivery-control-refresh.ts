type QueueDeliveryLike = {
    orderId: string;
    status: string;
    activeOverride: {
        action: string;
    } | null;
    dispatch: {
        waveId?: string | null;
        sequence?: number | null;
        status?: string | null;
    } | null;
    recommendation: {
        priorityScore: number;
        confidence: string;
        suggestedVehicleType: string;
        suggestedVehicle: {
            id: string;
        } | null;
        externalContext?: {
            status: string;
        } | null;
    };
};

type ReconcileRecommendationQueueInput<TDelivery extends QueueDeliveryLike> = {
    visibleDeliveries: TDelivery[];
    incomingDeliveries: TDelivery[];
    forceApplyIncoming?: boolean;
};

type ReconcileRecommendationQueueResult<TDelivery extends QueueDeliveryLike> = {
    visibleDeliveries: TDelivery[];
    stagedDeliveries: TDelivery[] | null;
    hasPendingRecommendationUpdate: boolean;
};

export function hasActiveManualOverride<TDelivery extends QueueDeliveryLike>(deliveries: TDelivery[]) {
    return deliveries.some((delivery) => delivery.activeOverride !== null);
}

export function buildDeliveryQueueSignature<TDelivery extends QueueDeliveryLike>(deliveries: TDelivery[]) {
    return deliveries
        .map((delivery) => {
            return [
                delivery.orderId,
                delivery.status,
                delivery.activeOverride?.action ?? "none",
                delivery.dispatch?.waveId ?? "no-wave",
                delivery.dispatch?.sequence ?? "no-sequence",
                delivery.recommendation.priorityScore,
                delivery.recommendation.confidence,
                delivery.recommendation.suggestedVehicleType,
                delivery.recommendation.suggestedVehicle?.id ?? "no-vehicle",
                delivery.recommendation.externalContext?.status ?? "no-external-context",
            ].join(":");
        })
        .join("|");
}

export function reconcileRecommendationQueue<TDelivery extends QueueDeliveryLike>({
    visibleDeliveries,
    incomingDeliveries,
    forceApplyIncoming = false,
}: ReconcileRecommendationQueueInput<TDelivery>): ReconcileRecommendationQueueResult<TDelivery> {
    if (incomingDeliveries.length === 0) {
        return {
            visibleDeliveries: incomingDeliveries,
            stagedDeliveries: null,
            hasPendingRecommendationUpdate: false,
        };
    }

    if (visibleDeliveries.length === 0 || forceApplyIncoming) {
        return {
            visibleDeliveries: incomingDeliveries,
            stagedDeliveries: null,
            hasPendingRecommendationUpdate: false,
        };
    }

    const visibleSignature = buildDeliveryQueueSignature(visibleDeliveries);
    const incomingSignature = buildDeliveryQueueSignature(incomingDeliveries);

    if (visibleSignature === incomingSignature) {
        return {
            visibleDeliveries: incomingDeliveries,
            stagedDeliveries: null,
            hasPendingRecommendationUpdate: false,
        };
    }

    if (!hasActiveManualOverride(visibleDeliveries)) {
        return {
            visibleDeliveries: incomingDeliveries,
            stagedDeliveries: null,
            hasPendingRecommendationUpdate: false,
        };
    }

    return {
        visibleDeliveries,
        stagedDeliveries: incomingDeliveries,
        hasPendingRecommendationUpdate: true,
    };
}
