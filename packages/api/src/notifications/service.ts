import {
    notificationEntityTypeEnum,
    notifications,
    notificationScopeEnum,
    notificationSeverityEnum,
    notificationTypeEnum,
    roleEnum,
    type AppDb,
    users,
} from '@frescari/db';
import { and, eq, ne, sql } from 'drizzle-orm';

type NotificationRole = (typeof roleEnum.enumValues)[number];
type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
type NotificationScope = (typeof notificationScopeEnum.enumValues)[number];
type NotificationSeverity = (typeof notificationSeverityEnum.enumValues)[number];
type NotificationEntityType = (typeof notificationEntityTypeEnum.enumValues)[number];

type NotificationTx = Pick<AppDb, 'execute' | 'select' | 'insert'>;

export type EmitNotificationsForRoleInput = {
    tenantId: string;
    role: NotificationRole;
    actorUserId?: string | null;
    type: NotificationType;
    scope: NotificationScope;
    severity: NotificationSeverity;
    entityType: NotificationEntityType;
    entityId: string;
    title: string;
    body: string;
    href: string;
    metadata?: Record<string, unknown>;
    dedupeKey: string;
    tx: NotificationTx;
};

export type EmitNotificationsForRoleResult = {
    insertedCount: number;
    recipientUserIds: string[];
};

async function setNotificationTenantContext(tx: NotificationTx, tenantId: string) {
    await tx.execute(sql`select set_config('app.current_tenant', ${tenantId}, true)`);
}

export async function emitNotificationsForRole({
    tenantId,
    role,
    actorUserId,
    type,
    scope,
    severity,
    entityType,
    entityId,
    title,
    body,
    href,
    metadata = {},
    dedupeKey,
    tx,
}: EmitNotificationsForRoleInput): Promise<EmitNotificationsForRoleResult> {
    await setNotificationTenantContext(tx, tenantId);

    const recipientFilters = [
        eq(users.tenantId, tenantId),
        eq(users.role, role),
    ];

    if (actorUserId) {
        recipientFilters.push(ne(users.id, actorUserId));
    }

    const recipientRows = await tx
        .select({
            userId: users.id,
        })
        .from(users)
        .where(and(...recipientFilters));

    if (recipientRows.length === 0) {
        return {
            insertedCount: 0,
            recipientUserIds: [],
        };
    }

    const insertedRows = await tx
        .insert(notifications)
        .values(
            recipientRows.map(({ userId }) => ({
                tenantId,
                userId,
                recipientRole: role,
                type,
                scope,
                severity,
                entityType,
                entityId,
                title,
                body,
                href,
                metadata,
                dedupeKey,
            })),
        )
        .onConflictDoNothing({
            target: [notifications.userId, notifications.dedupeKey],
        })
        .returning({
            id: notifications.id,
        });

    return {
        insertedCount: insertedRows.length,
        recipientUserIds: recipientRows.map(({ userId }) => userId),
    };
}
