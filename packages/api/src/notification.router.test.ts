import assert from 'node:assert/strict';
import test from 'node:test';

import { notifications, tenants, type AppDb } from '@frescari/db';

import { createTRPCRouter } from './trpc';
import { notificationRouter } from './routers/notification';
import { withRlsMockDb } from './test-db';

type NotificationRecord = {
    id: string;
    tenantId: string;
    userId: string;
    scope: 'inventory' | 'sales' | 'orders' | 'deliveries' | 'platform';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
    href: string;
    type: string;
    entityType: 'lot' | 'order';
    entityId: string;
    metadata: Record<string, unknown>;
    readAt: Date | null;
    createdAt: Date;
};

function createTenantContext(db: AppDb) {
    return {
        db,
        req: undefined,
        session: { user: { id: 'user-1' } },
        user: {
            id: 'user-1',
            tenantId: 'tenant-1',
            role: 'buyer',
            name: 'Comprador Teste',
        },
    };
}

function createNotificationDb({
    records,
    listScope,
    listUnreadOnly,
    markReadIds,
    markAllScope,
}: {
    records: NotificationRecord[];
    listScope?: NotificationRecord['scope'];
    listUnreadOnly?: boolean;
    markReadIds?: string[];
    markAllScope?: NotificationRecord['scope'];
}) {
    const state = {
        records: [...records],
    };

    const db = withRlsMockDb({
        select() {
            return {
                from(table: unknown) {
                    if (table === tenants) {
                        return {
                            where() {
                                return {
                                    limit: async () => [{ id: 'tenant-1', type: 'BUSINESS' }],
                                };
                            },
                        };
                    }

                    if (table !== notifications) {
                        throw new Error('Unexpected select table in notification router test.');
                    }

                    return {
                        where() {
                            const currentUserRecords = state.records.filter((record) =>
                                record.tenantId === 'tenant-1' && record.userId === 'user-1',
                            );

                            return {
                                groupBy: async () => {
                                    const unreadRecords = currentUserRecords.filter((record) => record.readAt == null);
                                    const grouped = new Map<string, {
                                        scope: NotificationRecord['scope'];
                                        severity: NotificationRecord['severity'];
                                        count: number;
                                        latestCreatedAt: Date | null;
                                    }>();

                                    for (const record of unreadRecords) {
                                        const key = `${record.scope}:${record.severity}`;
                                        const currentGroup = grouped.get(key);

                                        if (!currentGroup) {
                                            grouped.set(key, {
                                                scope: record.scope,
                                                severity: record.severity,
                                                count: 1,
                                                latestCreatedAt: record.createdAt,
                                            });
                                            continue;
                                        }

                                        currentGroup.count += 1;
                                        if (!currentGroup.latestCreatedAt || record.createdAt > currentGroup.latestCreatedAt) {
                                            currentGroup.latestCreatedAt = record.createdAt;
                                        }
                                    }

                                    return Array.from(grouped.values());
                                },
                                orderBy() {
                                    return {
                                        limit: async (limit: number) => currentUserRecords
                                            .filter((record) => !listUnreadOnly || record.readAt == null)
                                            .filter((record) => !listScope || record.scope === listScope)
                                            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
                                            .slice(0, limit)
                                            .map((record) => ({
                                                id: record.id,
                                                type: record.type,
                                                scope: record.scope,
                                                severity: record.severity,
                                                title: record.title,
                                                body: record.body,
                                                href: record.href,
                                                entityType: record.entityType,
                                                entityId: record.entityId,
                                                metadata: record.metadata,
                                                readAt: record.readAt,
                                                createdAt: record.createdAt,
                                            })),
                                    };
                                },
                            };
                        },
                    };
                },
            };
        },
        update(table: unknown) {
            if (table !== notifications) {
                throw new Error('Unexpected update table in notification router test.');
            }

            return {
                set(value: { readAt: Date }) {
                    return {
                        where() {
                            return {
                                returning: async () => {
                                    const updatedRows: Array<{ id: string }> = [];

                                    for (const record of state.records) {
                                        if (record.tenantId !== 'tenant-1' || record.userId !== 'user-1' || record.readAt != null) {
                                            continue;
                                        }

                                        const matchesMarkRead = Array.isArray(markReadIds)
                                            ? markReadIds.includes(record.id)
                                            : false;
                                        const matchesMarkAll = markAllScope
                                            ? record.scope === markAllScope
                                            : markAllScope === undefined && !markReadIds;

                                        if (!matchesMarkRead && !matchesMarkAll) {
                                            continue;
                                        }

                                        record.readAt = value.readAt;
                                        updatedRows.push({ id: record.id });
                                    }

                                    return updatedRows;
                                },
                            };
                        },
                    };
                },
            };
        },
    });

    return { db: db as unknown as AppDb, state };
}

async function createNotificationCaller(db: AppDb) {
    const testRouter = createTRPCRouter({ notification: notificationRouter });
    return testRouter.createCaller(createTenantContext(db));
}

test('notification router returns unread summary aggregates and the filtered inbox for the authenticated user', async () => {
    const { db } = createNotificationDb({
        listScope: 'orders',
        listUnreadOnly: true,
        records: [
            {
                id: '11111111-1111-4111-8111-111111111111',
                tenantId: 'tenant-1',
                userId: 'user-1',
                scope: 'orders',
                severity: 'critical',
                title: 'Pedido confirmado',
                body: 'O pedido foi confirmado.',
                href: '/dashboard/pedidos',
                type: 'order_confirmed',
                entityType: 'order',
                entityId: '21111111-1111-4111-8111-111111111111',
                metadata: { orderId: 'order-1' },
                readAt: null,
                createdAt: new Date('2026-03-18T11:00:00.000Z'),
            },
            {
                id: '11111111-1111-4111-8111-222222222222',
                tenantId: 'tenant-1',
                userId: 'user-1',
                scope: 'inventory',
                severity: 'info',
                title: 'Lote vencendo',
                body: 'O lote precisa de atencao.',
                href: '/dashboard/inventario',
                type: 'lot_expiring_soon',
                entityType: 'lot',
                entityId: '31111111-1111-4111-8111-111111111111',
                metadata: { lotId: 'lot-1' },
                readAt: null,
                createdAt: new Date('2026-03-18T10:00:00.000Z'),
            },
            {
                id: '11111111-1111-4111-8111-333333333333',
                tenantId: 'tenant-1',
                userId: 'user-1',
                scope: 'orders',
                severity: 'info',
                title: 'Pedido antigo',
                body: 'Ja foi lido.',
                href: '/dashboard/pedidos',
                type: 'order_confirmed',
                entityType: 'order',
                entityId: '21111111-1111-4111-8111-222222222222',
                metadata: { orderId: 'order-2' },
                readAt: new Date('2026-03-18T09:00:00.000Z'),
                createdAt: new Date('2026-03-18T09:00:00.000Z'),
            },
            {
                id: '11111111-1111-4111-8111-444444444444',
                tenantId: 'tenant-1',
                userId: 'user-2',
                scope: 'orders',
                severity: 'critical',
                title: 'Outro usuario',
                body: 'Nao deve aparecer.',
                href: '/dashboard/pedidos',
                type: 'order_confirmed',
                entityType: 'order',
                entityId: '21111111-1111-4111-8111-333333333333',
                metadata: { orderId: 'order-3' },
                readAt: null,
                createdAt: new Date('2026-03-18T12:00:00.000Z'),
            },
            {
                id: '11111111-1111-4111-8111-555555555555',
                tenantId: 'tenant-2',
                userId: 'user-1',
                scope: 'deliveries',
                severity: 'warning',
                title: 'Outro tenant',
                body: 'Nao deve aparecer.',
                href: '/dashboard/entregas',
                type: 'delivery_delayed',
                entityType: 'order',
                entityId: '21111111-1111-4111-8111-444444444444',
                metadata: { orderId: 'order-4' },
                readAt: null,
                createdAt: new Date('2026-03-18T12:30:00.000Z'),
            },
        ],
    });

    const caller = await createNotificationCaller(db);
    const notificationNamespace = (caller as Record<string, any>).notification;
    const summary = await notificationNamespace.getUnreadSummary();
    const inbox = await notificationNamespace.listInbox({
        unreadOnly: true,
        scope: 'orders',
        limit: 20,
    });

    assert.deepEqual(summary, {
        totalUnread: 2,
        criticalUnread: 1,
        byScope: {
            inventory: 1,
            sales: 0,
            orders: 1,
            deliveries: 0,
            platform: 0,
        },
        latestCreatedAt: new Date('2026-03-18T11:00:00.000Z'),
    });
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0]?.id, '11111111-1111-4111-8111-111111111111');
    assert.equal(inbox[0]?.scope, 'orders');
});

test('notification router only marks the authenticated user rows as read for targeted ids and scoped bulk updates', async () => {
    const initialRecords: NotificationRecord[] = [
        {
            id: '11111111-1111-4111-8111-111111111111',
            tenantId: 'tenant-1',
            userId: 'user-1',
            scope: 'orders',
            severity: 'critical',
            title: 'Pedido confirmado',
            body: 'Pedido em acompanhamento.',
            href: '/dashboard/pedidos',
            type: 'order_confirmed',
            entityType: 'order',
            entityId: '21111111-1111-4111-8111-111111111111',
            metadata: {},
            readAt: null,
            createdAt: new Date('2026-03-18T11:00:00.000Z'),
        },
        {
            id: '11111111-1111-4111-8111-222222222222',
            tenantId: 'tenant-1',
            userId: 'user-1',
            scope: 'orders',
            severity: 'info',
            title: 'Pedido pronto',
            body: 'Pedido pronto para despacho.',
            href: '/dashboard/pedidos',
            type: 'order_ready_for_dispatch',
            entityType: 'order',
            entityId: '21111111-1111-4111-8111-222222222222',
            metadata: {},
            readAt: null,
            createdAt: new Date('2026-03-18T10:00:00.000Z'),
        },
        {
            id: '11111111-1111-4111-8111-333333333333',
            tenantId: 'tenant-1',
            userId: 'user-1',
            scope: 'inventory',
            severity: 'warning',
            title: 'Lote vencendo',
            body: 'Lote perto do vencimento.',
            href: '/dashboard/inventario',
            type: 'lot_expiring_soon',
            entityType: 'lot',
            entityId: '31111111-1111-4111-8111-111111111111',
            metadata: {},
            readAt: null,
            createdAt: new Date('2026-03-18T09:00:00.000Z'),
        },
        {
            id: '11111111-1111-4111-8111-444444444444',
            tenantId: 'tenant-1',
            userId: 'user-2',
            scope: 'orders',
            severity: 'critical',
            title: 'Outro usuario',
            body: 'Nao pode ser alterada.',
            href: '/dashboard/pedidos',
            type: 'order_confirmed',
            entityType: 'order',
            entityId: '21111111-1111-4111-8111-444444444444',
            metadata: {},
            readAt: null,
            createdAt: new Date('2026-03-18T08:00:00.000Z'),
        },
    ];

    const targeted = createNotificationDb({
        records: initialRecords.map((record) => ({ ...record })),
        markReadIds: [
            '11111111-1111-4111-8111-111111111111',
            '11111111-1111-4111-8111-444444444444',
        ],
    });
    const targetedCaller = await createNotificationCaller(targeted.db);
    const targetedNamespace = (targetedCaller as Record<string, any>).notification;
    const markReadResult = await targetedNamespace.markRead({
        ids: [
            '11111111-1111-4111-8111-111111111111',
            '11111111-1111-4111-8111-444444444444',
        ],
    });

    assert.deepEqual(markReadResult, { updatedCount: 1 });
    assert.ok(targeted.state.records.find((record) => record.id === '11111111-1111-4111-8111-111111111111')?.readAt);
    assert.equal(targeted.state.records.find((record) => record.id === '11111111-1111-4111-8111-444444444444')?.readAt, null);

    const bulk = createNotificationDb({
        records: initialRecords.map((record) => ({ ...record })),
        markAllScope: 'orders',
    });
    const bulkCaller = await createNotificationCaller(bulk.db);
    const bulkNamespace = (bulkCaller as Record<string, any>).notification;
    const markAllResult = await bulkNamespace.markAllRead({
        scope: 'orders',
    });

    assert.deepEqual(markAllResult, { updatedCount: 2 });
    assert.ok(bulk.state.records.find((record) => record.id === '11111111-1111-4111-8111-111111111111')?.readAt);
    assert.ok(bulk.state.records.find((record) => record.id === '11111111-1111-4111-8111-222222222222')?.readAt);
    assert.equal(bulk.state.records.find((record) => record.id === '11111111-1111-4111-8111-333333333333')?.readAt, null);
    assert.equal(bulk.state.records.find((record) => record.id === '11111111-1111-4111-8111-444444444444')?.readAt, null);
});
