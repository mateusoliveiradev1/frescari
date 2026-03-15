import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@frescari/api';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type PendingDelivery = RouterOutputs['logistics']['getPendingDeliveries'][number];

export type DeliveryMapProps = {
    deliveries: PendingDelivery[];
    selectedOrderId: string | null;
    onSelect: (orderId: string) => void;
};
