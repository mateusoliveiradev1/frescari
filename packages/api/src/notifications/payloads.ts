import {
    notificationScopeEnum,
    notificationSeverityEnum,
    notificationTypeEnum,
} from '@frescari/db';

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
type NotificationScope = (typeof notificationScopeEnum.enumValues)[number];
type NotificationSeverity = (typeof notificationSeverityEnum.enumValues)[number];
type NotificationAudienceRole = 'producer' | 'buyer';

export type NotificationContent = {
    type: NotificationType;
    scope: NotificationScope;
    severity: NotificationSeverity;
    title: string;
    body: string;
    href: string;
};

function formatOrderReference(orderId: string) {
    return `#${orderId.slice(0, 8).toUpperCase()}`;
}

function formatLotReference(lotCode: string, lotId: string) {
    return lotCode.trim() ? lotCode : `Lote ${lotId.slice(0, 8).toUpperCase()}`;
}

export function buildOrderNotificationContent(
    type: Extract<
        NotificationType,
        | 'order_awaiting_weight'
        | 'order_confirmed'
        | 'order_cancelled'
        | 'order_ready_for_dispatch'
        | 'delivery_in_transit'
        | 'delivery_delayed'
        | 'delivery_delivered'
    >,
    orderId: string,
    role: NotificationAudienceRole,
): NotificationContent {
    const orderRef = formatOrderReference(orderId);

    switch (type) {
        case 'order_awaiting_weight':
            return {
                type,
                scope: 'sales',
                severity: 'warning',
                title: 'Pedido aguardando pesagem',
                body: `O pedido ${orderRef} aguarda confirmacao do peso final para seguir no fluxo.`,
                href: '/dashboard/vendas',
            };
        case 'order_confirmed':
            return {
                type,
                scope: role === 'producer' ? 'sales' : 'orders',
                severity: 'info',
                title: 'Pedido confirmado',
                body: role === 'producer'
                    ? `O pedido ${orderRef} foi confirmado e entrou na fila operacional.`
                    : `Seu pedido ${orderRef} foi confirmado e esta sendo preparado.`,
                href: role === 'producer' ? '/dashboard/vendas' : '/dashboard/pedidos',
            };
        case 'order_cancelled':
            return {
                type,
                scope: role === 'producer' ? 'sales' : 'orders',
                severity: 'critical',
                title: 'Pedido cancelado',
                body: role === 'producer'
                    ? `O pedido ${orderRef} foi cancelado e saiu da operacao ativa.`
                    : `Seu pedido ${orderRef} foi cancelado. Confira os detalhes no historico.`,
                href: role === 'producer' ? '/dashboard/vendas' : '/dashboard/pedidos',
            };
        case 'order_ready_for_dispatch':
            return {
                type,
                scope: role === 'producer' ? 'deliveries' : 'orders',
                severity: 'info',
                title: 'Pedido pronto para expedicao',
                body: role === 'producer'
                    ? `O pedido ${orderRef} foi confirmado na onda de despacho.`
                    : `Seu pedido ${orderRef} esta pronto para seguir para entrega.`,
                href: role === 'producer' ? '/dashboard/entregas' : '/dashboard/pedidos',
            };
        case 'delivery_in_transit':
            return {
                type,
                scope: role === 'producer' ? 'deliveries' : 'orders',
                severity: 'info',
                title: 'Entrega em transito',
                body: role === 'producer'
                    ? `O pedido ${orderRef} saiu para entrega.`
                    : `Seu pedido ${orderRef} esta em rota de entrega.`,
                href: role === 'producer' ? '/dashboard/entregas' : '/dashboard/pedidos',
            };
        case 'delivery_delayed':
            return {
                type,
                scope: role === 'producer' ? 'deliveries' : 'orders',
                severity: 'warning',
                title: 'Entrega com atraso',
                body: role === 'producer'
                    ? `O pedido ${orderRef} ultrapassou a janela prevista de entrega.`
                    : `Seu pedido ${orderRef} esta com atraso na entrega prevista.`,
                href: role === 'producer' ? '/dashboard/entregas' : '/dashboard/pedidos',
            };
        case 'delivery_delivered':
            return {
                type,
                scope: role === 'producer' ? 'deliveries' : 'orders',
                severity: 'info',
                title: 'Entrega concluida',
                body: role === 'producer'
                    ? `O pedido ${orderRef} foi marcado como entregue.`
                    : `Seu pedido ${orderRef} foi entregue com sucesso.`,
                href: role === 'producer' ? '/dashboard/entregas' : '/dashboard/pedidos',
            };
    }
}

export function buildLotNotificationContent(
    type: Extract<NotificationType, 'lot_expiring_soon' | 'lot_expired'>,
    input: {
        lotCode: string;
        lotId: string;
        freshnessScore?: number | null;
    },
): NotificationContent {
    const lotRef = formatLotReference(input.lotCode, input.lotId);

    if (type === 'lot_expiring_soon') {
        const freshnessSuffix = typeof input.freshnessScore === 'number'
            ? ` Freshness estimada: ${input.freshnessScore}%.`
            : '';

        return {
            type,
            scope: 'inventory',
            severity: 'warning',
            title: 'Lote perto do vencimento',
            body: `${lotRef} esta se aproximando do vencimento e precisa de acao operacional.${freshnessSuffix}`,
            href: '/dashboard/inventario',
        };
    }

    return {
        type,
        scope: 'inventory',
        severity: 'critical',
        title: 'Lote expirado',
        body: `${lotRef} expirou e deve ser tratado imediatamente no inventario.`,
        href: '/dashboard/inventario',
    };
}
