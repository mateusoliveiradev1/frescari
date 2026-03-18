import { useEffect, useRef, useState } from "react";

import {
    reconcileRecommendationQueue,
    type QueueDeliveryLike,
} from "./delivery-control-refresh";

type QueueSyncState<TDelivery extends QueueDeliveryLike> = {
    visibleDeliveries: TDelivery[];
    stagedDeliveries: TDelivery[] | null;
};

export function useDeliveryControlRefresh<TDelivery extends QueueDeliveryLike>(
    incomingDeliveries: TDelivery[],
) {
    const forceApplyIncomingQueueRef = useRef(false);
    const [hasManualOverrideLock, setHasManualOverrideLock] = useState(false);
    const [queueSync, setQueueSync] = useState<QueueSyncState<TDelivery>>({
        visibleDeliveries: [],
        stagedDeliveries: null,
    });

    useEffect(() => {
        setQueueSync((current) => {
            const next = reconcileRecommendationQueue({
                visibleDeliveries: current.visibleDeliveries,
                incomingDeliveries,
                forceApplyIncoming: forceApplyIncomingQueueRef.current,
                lockIncomingUpdates: hasManualOverrideLock,
            });

            forceApplyIncomingQueueRef.current = false;

            return {
                visibleDeliveries: next.visibleDeliveries,
                stagedDeliveries: next.stagedDeliveries,
            };
        });
    }, [hasManualOverrideLock, incomingDeliveries]);

    return {
        deliveries: queueSync.visibleDeliveries,
        hasManualOverrideLock,
        hasPendingRecommendationUpdate: queueSync.stagedDeliveries !== null,
        applyLatestRecommendation() {
            setQueueSync((current) => {
                if (!current.stagedDeliveries) {
                    return current;
                }

                return {
                    visibleDeliveries: current.stagedDeliveries,
                    stagedDeliveries: null,
                };
            });
            setHasManualOverrideLock(false);
        },
        clearManualOverrideLock() {
            setHasManualOverrideLock(false);
        },
        forceApplyNextIncomingQueue() {
            forceApplyIncomingQueueRef.current = true;
        },
        registerManualOverride() {
            setHasManualOverrideLock(true);
        },
    };
}
