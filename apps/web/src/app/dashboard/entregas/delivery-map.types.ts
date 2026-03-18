import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@frescari/api';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type PendingDelivery = RouterOutputs['logistics']['getPendingDeliveries'][number];
export type DeliveryMapWaveContext = NonNullable<PendingDelivery["mapWaveContext"]>;
export type DispatchWaveCandidate = NonNullable<PendingDelivery["dispatchSuggestion"]>;

export type DeliveryMapProps = {
    deliveries: PendingDelivery[];
    selectedOrderId: string | null;
    waveContext: DeliveryMapWaveContext | null;
    onSelect: (orderId: string) => void;
};
