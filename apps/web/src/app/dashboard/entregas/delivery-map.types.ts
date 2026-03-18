import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@frescari/api';
import type { DeliveryMapWaveContext } from "./delivery-control-summary";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type PendingDelivery = RouterOutputs['logistics']['getPendingDeliveries'][number];

export type DeliveryMapProps = {
    deliveries: PendingDelivery[];
    selectedOrderId: string | null;
    waveContext: DeliveryMapWaveContext | null;
    onSelect: (orderId: string) => void;
};
