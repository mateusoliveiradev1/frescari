import { notificationTypeEnum, type AppDb } from '@frescari/db';
import { buildLotNotificationContent, buildOrderNotificationContent } from './payloads';
import { emitNotificationsForRole } from './service';

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
type OrderNotificationType = Extract<
    NotificationType,
    | 'order_awaiting_weight'
    | 'order_confirmed'
    | 'order_cancelled'
    | 'order_ready_for_dispatch'
    | 'delivery_in_transit'
    | 'delivery_delayed'
    | 'delivery_delivered'
>;
type LotNotificationType = Extract<NotificationType, 'lot_expiring_soon' | 'lot_expired'>;

export function buildNotificationDedupeKey(type: NotificationType, entityId: string) {
    switch (type) {
        case 'lot_expiring_soon':
            return `lot.expiring_soon:${entityId}`;
        case 'lot_expired':
            return `lot.expired:${entityId}`;
        case 'order_awaiting_weight':
            return `order.awaiting_weight:${entityId}`;
        case 'order_confirmed':
            return `order.confirmed:${entityId}`;
        case 'order_cancelled':
            return `order.cancelled:${entityId}`;
        case 'order_ready_for_dispatch':
            return `order.ready_for_dispatch:${entityId}`;
        case 'delivery_in_transit':
            return `delivery.in_transit:${entityId}`;
        case 'delivery_delayed':
            return `delivery.delayed:${entityId}`;
        case 'delivery_delivered':
            return `delivery.delivered:${entityId}`;
    }
}

export async function emitOrderNotifications({
    tx,
    type,
    orderId,
    buyerTenantId,
    sellerTenantId,
    actorUserId,
    metadata,
}: {
    tx: AppDb;
    type: OrderNotificationType;
    orderId: string;
    buyerTenantId: string;
    sellerTenantId: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
}) {
    const dedupeKey = buildNotificationDedupeKey(type, orderId);
    const producerContent = buildOrderNotificationContent(type, orderId, 'producer');

    await emitNotificationsForRole({
        tenantId: sellerTenantId,
        role: 'producer',
        actorUserId,
        type,
        scope: producerContent.scope,
        severity: producerContent.severity,
        entityType: 'order',
        entityId: orderId,
        title: producerContent.title,
        body: producerContent.body,
        href: producerContent.href,
        metadata,
        dedupeKey,
        tx,
    });

    if (type === 'order_awaiting_weight') {
        return;
    }

    const buyerContent = buildOrderNotificationContent(type, orderId, 'buyer');

    await emitNotificationsForRole({
        tenantId: buyerTenantId,
        role: 'buyer',
        type,
        scope: buyerContent.scope,
        severity: buyerContent.severity,
        entityType: 'order',
        entityId: orderId,
        title: buyerContent.title,
        body: buyerContent.body,
        href: buyerContent.href,
        metadata,
        dedupeKey,
        tx,
    });
}

export async function emitLotNotificationToProducerUsers({
    tx,
    type,
    lotId,
    tenantId,
    lotCode,
    freshnessScore,
    metadata,
}: {
    tx: AppDb;
    type: LotNotificationType;
    lotId: string;
    tenantId: string;
    lotCode: string;
    freshnessScore?: number | null;
    metadata?: Record<string, unknown>;
}) {
    const content = buildLotNotificationContent(type, {
        lotCode,
        lotId,
        freshnessScore,
    });

    await emitNotificationsForRole({
        tenantId,
        role: 'producer',
        type,
        scope: content.scope,
        severity: content.severity,
        entityType: 'lot',
        entityId: lotId,
        title: content.title,
        body: content.body,
        href: content.href,
        metadata,
        dedupeKey: buildNotificationDedupeKey(type, lotId),
        tx,
    });
}
