export type OrderStatus =
    | 'draft'
    | 'confirmed'
    | 'payment_authorized'
    | 'awaiting_weight'
    | 'picking'
    | 'in_transit'
    | 'delivered'
    | 'cancelled';

const terminalOrDeliveryStatuses = new Set<OrderStatus>([
    'confirmed',
    'picking',
    'in_transit',
    'delivered',
    'cancelled',
]);

export function resolveAuthorizedOrderStatus(currentStatus: OrderStatus): OrderStatus {
    if (terminalOrDeliveryStatuses.has(currentStatus)) {
        return currentStatus;
    }

    if (currentStatus === 'awaiting_weight') {
        return 'awaiting_weight';
    }

    return 'payment_authorized';
}
