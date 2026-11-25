import { useState } from "react";

import {
  reconcileRecommendationQueue,
  type QueueDeliveryLike,
} from "./delivery-control-refresh";

type QueueSyncState<TDelivery extends QueueDeliveryLike> = {
  visibleDeliveries: TDelivery[];
  stagedDeliveries: TDelivery[] | null;
  // What the visible queue was last reconciled against.
  syncedIncoming: TDelivery[] | null;
  syncedLock: boolean;
  // "Show the next queue the server sends" (after the producer's own
  // Priorizar/Adiar). Consumed only by new data, never by a lock change:
  // consuming it on the lock change left the producer's own pin staged
  // behind the "nova recomendacao" banner.
  forceApplyNext: boolean;
};

export function useDeliveryControlRefresh<TDelivery extends QueueDeliveryLike>(
  incomingDeliveries: TDelivery[],
) {
  const [hasManualOverrideLock, setHasManualOverrideLock] = useState(false);
  const [queueSync, setQueueSync] = useState<QueueSyncState<TDelivery>>({
    visibleDeliveries: [],
    stagedDeliveries: null,
    syncedIncoming: null,
    syncedLock: false,
    forceApplyNext: false,
  });

  // Reconcile during render when the data or the lock changed (React's
  // "adjust state when props change" pattern, no effect round trip).
  const incomingChanged = queueSync.syncedIncoming !== incomingDeliveries;

  if (incomingChanged || queueSync.syncedLock !== hasManualOverrideLock) {
    const forceApplyIncoming = incomingChanged && queueSync.forceApplyNext;
    const next = reconcileRecommendationQueue({
      visibleDeliveries: queueSync.visibleDeliveries,
      incomingDeliveries,
      forceApplyIncoming,
      lockIncomingUpdates: hasManualOverrideLock,
    });

    setQueueSync({
      visibleDeliveries: next.visibleDeliveries,
      stagedDeliveries: next.stagedDeliveries,
      syncedIncoming: incomingDeliveries,
      syncedLock: hasManualOverrideLock,
      forceApplyNext: forceApplyIncoming ? false : queueSync.forceApplyNext,
    });
  }

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
          ...current,
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
      setQueueSync((current) => ({ ...current, forceApplyNext: true }));
    },
    registerManualOverride() {
      setHasManualOverrideLock(true);
    },
  };
}
