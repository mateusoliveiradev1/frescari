import assert from 'node:assert/strict';
import test from 'node:test';
import { notifications } from '@frescari/db';
import { emitNotificationsForRole } from './service';

function createMockTx({
    recipients,
    insertedRows = [],
}: {
    recipients: Array<{ userId: string }>;
    insertedRows?: Array<{ id: string }>;
}) {
    const state = {
        executeCalls: 0,
        selectedRecipients: recipients,
        insertedValues: null as Array<Record<string, unknown>> | null,
        conflictTarget: null as unknown,
    };

    const tx = {
        async execute() {
            state.executeCalls += 1;
            return [];
        },
        select() {
            return {
                from() {
                    return this;
                },
                async where() {
                    return state.selectedRecipients;
                },
            };
        },
        insert() {
            return {
                values(values: Array<Record<string, unknown>>) {
                    state.insertedValues = values;
                    return this;
                },
                onConflictDoNothing(options: { target: unknown }) {
                    state.conflictTarget = options.target;
                    return this;
                },
                async returning() {
                    return insertedRows;
                },
            };
        },
    };

    return { tx, state };
}

test('emitNotificationsForRole resolves tenant recipients, excludes actor, and deduplicates per user', async () => {
    const { tx, state } = createMockTx({
        recipients: [
            { userId: 'user-buyer-1' },
            { userId: 'user-buyer-2' },
        ],
        insertedRows: [
            { id: 'notification-1' },
            { id: 'notification-2' },
        ],
    });

    const result = await emitNotificationsForRole({
        tenantId: 'tenant-buyer',
        role: 'buyer',
        actorUserId: 'user-buyer-actor',
        type: 'order_confirmed',
        scope: 'orders',
        severity: 'info',
        entityType: 'order',
        entityId: 'order-1',
        title: 'Pedido confirmado',
        body: 'Seu pedido foi confirmado e sera preparado para envio.',
        href: '/dashboard/pedidos',
        metadata: { orderId: 'order-1' },
        dedupeKey: 'order.confirmed:order-1',
        tx: tx as never,
    });

    assert.equal(state.executeCalls, 1);
    assert.deepEqual(result, {
        insertedCount: 2,
        recipientUserIds: ['user-buyer-1', 'user-buyer-2'],
    });
    assert.equal(state.insertedValues?.length, 2);
    assert.deepEqual(state.insertedValues?.map((row) => row.userId), ['user-buyer-1', 'user-buyer-2']);
    assert.deepEqual(state.insertedValues?.map((row) => row.dedupeKey), [
        'order.confirmed:order-1',
        'order.confirmed:order-1',
    ]);
    assert.deepEqual(state.insertedValues?.map((row) => row.tenantId), ['tenant-buyer', 'tenant-buyer']);
    assert.deepEqual(state.conflictTarget, [notifications.userId, notifications.dedupeKey]);
});

test('emitNotificationsForRole skips insert when no recipients match the tenant and role', async () => {
    const { tx, state } = createMockTx({
        recipients: [],
    });

    const result = await emitNotificationsForRole({
        tenantId: 'tenant-producer',
        role: 'producer',
        type: 'lot_expired',
        scope: 'inventory',
        severity: 'critical',
        entityType: 'lot',
        entityId: 'lot-1',
        title: 'Lote expirado',
        body: 'O lote expirou e precisa de tratativa imediata.',
        href: '/dashboard/inventario',
        dedupeKey: 'lot.expired:lot-1',
        tx: tx as never,
    });

    assert.deepEqual(result, {
        insertedCount: 0,
        recipientUserIds: [],
    });
    assert.equal(state.insertedValues, null);
});
