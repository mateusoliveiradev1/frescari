import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { notifications } from '@frescari/db';
import { createTRPCRouter, tenantProcedure } from '../trpc';

const notificationScopeSchema = z.enum([
    'inventory',
    'sales',
    'orders',
    'deliveries',
    'platform',
]);

function createEmptyScopeSummary() {
    return {
        inventory: 0,
        sales: 0,
        orders: 0,
        deliveries: 0,
        platform: 0,
    };
}

export const notificationRouter = createTRPCRouter({
    getUnreadSummary: tenantProcedure.query(async ({ ctx }) => {
        const unreadRows = await ctx.db
            .select({
                scope: notifications.scope,
                severity: notifications.severity,
                count: sql<number>`count(*)::int`,
                latestCreatedAt: sql<Date | null>`max(${notifications.createdAt})`,
            })
            .from(notifications)
            .where(
                and(
                    eq(notifications.tenantId, ctx.tenantId),
                    eq(notifications.userId, ctx.user.id),
                    isNull(notifications.readAt),
                ),
            )
            .groupBy(notifications.scope, notifications.severity);

        const byScope = createEmptyScopeSummary();
        const criticalByScope = createEmptyScopeSummary();
        let totalUnread = 0;
        let criticalUnread = 0;
        let latestCreatedAt: Date | null = null;

        for (const row of unreadRows) {
            const count = Number(row.count);
            byScope[row.scope] += count;
            totalUnread += count;

            if (row.severity === 'critical') {
                criticalUnread += count;
                criticalByScope[row.scope] += count;
            }

            if (row.latestCreatedAt && (!latestCreatedAt || row.latestCreatedAt > latestCreatedAt)) {
                latestCreatedAt = row.latestCreatedAt;
            }
        }

        return {
            totalUnread,
            criticalUnread,
            byScope,
            criticalByScope,
            latestCreatedAt,
        };
    }),

    listInbox: tenantProcedure
        .input(z.object({
            unreadOnly: z.boolean().optional(),
            scope: notificationScopeSchema.optional(),
            limit: z.number().int().min(1).max(20).default(20),
        }).optional())
        .query(async ({ ctx, input }) => {
            const filters = [
                eq(notifications.tenantId, ctx.tenantId),
                eq(notifications.userId, ctx.user.id),
            ];

            if (input?.unreadOnly) {
                filters.push(isNull(notifications.readAt));
            }

            if (input?.scope) {
                filters.push(eq(notifications.scope, input.scope));
            }

            return ctx.db
                .select({
                    id: notifications.id,
                    type: notifications.type,
                    scope: notifications.scope,
                    severity: notifications.severity,
                    title: notifications.title,
                    body: notifications.body,
                    href: notifications.href,
                    entityType: notifications.entityType,
                    entityId: notifications.entityId,
                    metadata: notifications.metadata,
                    readAt: notifications.readAt,
                    createdAt: notifications.createdAt,
                })
                .from(notifications)
                .where(and(...filters))
                .orderBy(desc(notifications.createdAt))
                .limit(input?.limit ?? 20);
        }),

    markRead: tenantProcedure
        .input(z.object({
            ids: z.array(z.string().uuid()).min(1),
        }))
        .mutation(async ({ ctx, input }) => {
            const updatedRows = await ctx.db
                .update(notifications)
                .set({ readAt: new Date() })
                .where(
                    and(
                        eq(notifications.tenantId, ctx.tenantId),
                        eq(notifications.userId, ctx.user.id),
                        inArray(notifications.id, input.ids),
                        isNull(notifications.readAt),
                    ),
                )
                .returning({
                    id: notifications.id,
                });

            return {
                updatedCount: updatedRows.length,
            };
        }),

    markAllRead: tenantProcedure
        .input(z.object({
            scope: notificationScopeSchema.optional(),
        }).optional())
        .mutation(async ({ ctx, input }) => {
            const filters = [
                eq(notifications.tenantId, ctx.tenantId),
                eq(notifications.userId, ctx.user.id),
                isNull(notifications.readAt),
            ];

            if (input?.scope) {
                filters.push(eq(notifications.scope, input.scope));
            }

            const updatedRows = await ctx.db
                .update(notifications)
                .set({ readAt: new Date() })
                .where(and(...filters))
                .returning({
                    id: notifications.id,
                });

            return {
                updatedCount: updatedRows.length,
            };
        }),
});
