"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@frescari/ui";

import { trpc } from "@/trpc/react";
import { NotificationBell } from "./notification-bell";

type NotificationScope = "inventory" | "sales" | "orders" | "deliveries" | "platform";
type NotificationSeverity = "info" | "warning" | "critical";
type NotificationScopeFilter = "all" | NotificationScope;
type NotificationType =
    | "lot_expiring_soon"
    | "lot_expired"
    | "order_awaiting_weight"
    | "order_confirmed"
    | "order_cancelled"
    | "order_ready_for_dispatch"
    | "delivery_in_transit"
    | "delivery_delayed"
    | "delivery_delivered";

type NotificationSummary = {
    totalUnread: number;
    criticalUnread: number;
    byScope: Record<NotificationScope, number>;
    criticalByScope: Record<NotificationScope, number>;
    latestCreatedAt: Date | null;
};

type InboxNotification = {
    id: string;
    type: NotificationType;
    scope: NotificationScope;
    severity: NotificationSeverity;
    title: string;
    body: string;
    href: string;
    entityType: "lot" | "order";
    entityId: string;
    metadata: Record<string, unknown>;
    readAt: Date | null;
    createdAt: Date;
};

type InboxQueryInput = {
    unreadOnly: boolean;
    scope?: NotificationScope;
    limit: number;
};

const NOTIFICATION_POLLING_INTERVAL_MS = 15_000;
const INBOX_PAGE_SIZE = 20;

const scopeOptions: Array<{
    label: string;
    value: NotificationScopeFilter;
}> = [
    { label: "Todas", value: "all" },
    { label: "Estoque", value: "inventory" },
    { label: "Vendas", value: "sales" },
    { label: "Pedidos", value: "orders" },
    { label: "Entregas", value: "deliveries" },
    { label: "Plataforma", value: "platform" },
];

function createEmptyScopeCounters() {
    return {
        inventory: 0,
        sales: 0,
        orders: 0,
        deliveries: 0,
        platform: 0,
    };
}

export function getNotificationPollingInterval(isPageVisible: boolean) {
    return isPageVisible ? NOTIFICATION_POLLING_INTERVAL_MS : false;
}

function getDefaultInboxInput(): InboxQueryInput {
    return {
        limit: INBOX_PAGE_SIZE,
        unreadOnly: false,
        scope: undefined,
    };
}

function updateInboxNotifications(
    currentNotifications: InboxNotification[] | undefined,
    input: InboxQueryInput,
    shouldMarkAsRead: (notification: InboxNotification) => boolean,
    readAt: Date,
) {
    if (!currentNotifications) {
        return currentNotifications;
    }

    if (input.unreadOnly) {
        const nextNotifications = currentNotifications.filter((notification) => !shouldMarkAsRead(notification));

        return nextNotifications.length === currentNotifications.length
            ? currentNotifications
            : nextNotifications;
    }

    let hasChanged = false;

    const nextNotifications = currentNotifications.map((notification) => {
        if (notification.readAt || !shouldMarkAsRead(notification)) {
            return notification;
        }

        hasChanged = true;
        return {
            ...notification,
            readAt,
        };
    });

    return hasChanged ? nextNotifications : currentNotifications;
}

function applySingleReadToSummary(
    currentSummary: NotificationSummary | undefined,
    notification: InboxNotification | undefined,
) {
    if (!currentSummary || !notification || notification.readAt) {
        return currentSummary;
    }

    const nextByScope = {
        ...currentSummary.byScope,
        [notification.scope]: Math.max(0, currentSummary.byScope[notification.scope] - 1),
    };
    const nextCriticalByScope = { ...currentSummary.criticalByScope };
    let nextCriticalUnread = currentSummary.criticalUnread;

    if (notification.severity === "critical") {
        nextCriticalByScope[notification.scope] = Math.max(
            0,
            currentSummary.criticalByScope[notification.scope] - 1,
        );
        nextCriticalUnread = Math.max(0, currentSummary.criticalUnread - 1);
    }

    return {
        ...currentSummary,
        totalUnread: Math.max(0, currentSummary.totalUnread - 1),
        criticalUnread: nextCriticalUnread,
        byScope: nextByScope,
        criticalByScope: nextCriticalByScope,
    };
}

function applyBulkReadToSummary(
    currentSummary: NotificationSummary | undefined,
    scope: NotificationScope | undefined,
) {
    if (!currentSummary) {
        return currentSummary;
    }

    if (!scope) {
        return {
            ...currentSummary,
            totalUnread: 0,
            criticalUnread: 0,
            byScope: createEmptyScopeCounters(),
            criticalByScope: createEmptyScopeCounters(),
        };
    }

    return {
        ...currentSummary,
        totalUnread: Math.max(0, currentSummary.totalUnread - currentSummary.byScope[scope]),
        criticalUnread: Math.max(
            0,
            currentSummary.criticalUnread - currentSummary.criticalByScope[scope],
        ),
        byScope: {
            ...currentSummary.byScope,
            [scope]: 0,
        },
        criticalByScope: {
            ...currentSummary.criticalByScope,
            [scope]: 0,
        },
    };
}

function getScopeLabel(scope: NotificationScope) {
    switch (scope) {
        case "inventory":
            return "Estoque";
        case "sales":
            return "Vendas";
        case "orders":
            return "Pedidos";
        case "deliveries":
            return "Entregas";
        case "platform":
            return "Plataforma";
    }
}

function getSeverityLabel(severity: NotificationSeverity) {
    switch (severity) {
        case "info":
            return "Info";
        case "warning":
            return "Atencao";
        case "critical":
            return "Critica";
    }
}

function getSeverityVariant(severity: NotificationSeverity) {
    switch (severity) {
        case "info":
            return "secondary" as const;
        case "warning":
            return "outline" as const;
        case "critical":
            return "destructive" as const;
    }
}

function usePageVisibility() {
    const [isPageVisible, setIsPageVisible] = useState(
        () => typeof document === "undefined" || document.visibilityState === "visible",
    );

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        const syncVisibility = () => {
            setIsPageVisible(document.visibilityState === "visible");
        };

        syncVisibility();
        document.addEventListener("visibilitychange", syncVisibility);

        return () => {
            document.removeEventListener("visibilitychange", syncVisibility);
        };
    }, []);

    return isPageVisible;
}

export function NotificationInboxSheet({
    initialOpen = false,
}: {
    initialOpen?: boolean;
}) {
    const [open, setOpen] = useState(initialOpen);
    const [scope, setScope] = useState<NotificationScopeFilter>("all");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const utils = trpc.useUtils();
    const isPageVisible = usePageVisibility();
    const refetchInterval = getNotificationPollingInterval(isPageVisible);
    const inboxInput = useMemo<InboxQueryInput>(() => ({
        unreadOnly,
        scope: scope === "all" ? undefined : scope,
        limit: INBOX_PAGE_SIZE,
    }), [scope, unreadOnly]);

    const unreadSummaryQuery = trpc.notification.getUnreadSummary.useQuery(undefined, {
        refetchInterval,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        staleTime: NOTIFICATION_POLLING_INTERVAL_MS,
    });

    const inboxQuery = trpc.notification.listInbox.useQuery(inboxInput, {
        enabled: open,
        refetchOnWindowFocus: open,
        refetchInterval: open ? refetchInterval : false,
        staleTime: NOTIFICATION_POLLING_INTERVAL_MS,
    });

    const invalidateNotifications = async () => {
        await Promise.all([
            utils.notification.getUnreadSummary.invalidate(),
            utils.notification.listInbox.invalidate(),
        ]);
    };

    const prefetchInbox = async (input = getDefaultInboxInput()) => {
        await utils.notification.listInbox.prefetch(input, {
            staleTime: NOTIFICATION_POLLING_INTERVAL_MS,
        });
    };

    useEffect(() => {
        if (!isPageVisible) {
            return;
        }

        void utils.notification.listInbox.prefetch(getDefaultInboxInput(), {
            staleTime: NOTIFICATION_POLLING_INTERVAL_MS,
        });
    }, [
        isPageVisible,
        unreadSummaryQuery.data?.latestCreatedAt,
        unreadSummaryQuery.data?.totalUnread,
        utils,
    ]);

    const warmInboxCache = () => {
        void prefetchInbox(inboxInput);
    };

    const notifications = inboxQuery.data ?? [];
    const setInboxCacheForInput = (
        input: InboxQueryInput,
        shouldMarkAsRead: (notification: InboxNotification) => boolean,
        readAt: Date,
    ) => {
        utils.notification.listInbox.setData(input, (currentNotifications) =>
            updateInboxNotifications(
                currentNotifications as InboxNotification[] | undefined,
                input,
                shouldMarkAsRead,
                readAt,
            ),
        );
    };

    const syncOptimisticInboxCaches = (
        shouldMarkAsRead: (notification: InboxNotification) => boolean,
        readAt: Date,
    ) => {
        setInboxCacheForInput(inboxInput, shouldMarkAsRead, readAt);

        if (inboxInput.unreadOnly || inboxInput.scope !== undefined) {
            setInboxCacheForInput(getDefaultInboxInput(), shouldMarkAsRead, readAt);
        }
    };

    const markReadMutation = trpc.notification.markRead.useMutation({
        onMutate: async ({ ids }) => {
            const readAt = new Date();
            const targetNotification = notifications.find((notification) => ids.includes(notification.id));

            await Promise.all([
                utils.notification.getUnreadSummary.cancel(),
                utils.notification.listInbox.cancel(),
            ]);

            utils.notification.getUnreadSummary.setData(undefined, (currentSummary) =>
                applySingleReadToSummary(currentSummary as NotificationSummary | undefined, targetNotification),
            );
            syncOptimisticInboxCaches(
                (notification) => ids.includes(notification.id),
                readAt,
            );
        },
        onError: async () => {
            await invalidateNotifications();
        },
        onSettled: async () => {
            void invalidateNotifications();
        },
    });

    const markAllReadMutation = trpc.notification.markAllRead.useMutation({
        onMutate: async (input) => {
            const readAt = new Date();
            const mutationScope = input?.scope;

            await Promise.all([
                utils.notification.getUnreadSummary.cancel(),
                utils.notification.listInbox.cancel(),
            ]);

            utils.notification.getUnreadSummary.setData(undefined, (currentSummary) =>
                applyBulkReadToSummary(currentSummary as NotificationSummary | undefined, mutationScope),
            );
            syncOptimisticInboxCaches(
                (notification) => mutationScope ? notification.scope === mutationScope : true,
                readAt,
            );
        },
        onError: async () => {
            await invalidateNotifications();
        },
        onSettled: async () => {
            void invalidateNotifications();
        },
    });

    const totalUnread = unreadSummaryQuery.data?.totalUnread ?? 0;
    const criticalUnread = unreadSummaryQuery.data?.criticalUnread ?? 0;
    const selectedScopeCount = scope === "all"
        ? totalUnread
        : (unreadSummaryQuery.data?.byScope[scope] ?? 0);

    const handleMarkRead = async (notificationId: string) => {
        await markReadMutation.mutateAsync({
            ids: [notificationId],
        });
    };

    const handleMarkAllRead = async () => {
        await markAllReadMutation.mutateAsync({
            scope: scope === "all" ? undefined : scope,
        });
    };

    return (
        <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger asChild>
                <NotificationBell
                    criticalUnread={criticalUnread}
                    isLoading={unreadSummaryQuery.isLoading}
                    onFocus={warmInboxCache}
                    onMouseEnter={warmInboxCache}
                    onTouchStart={warmInboxCache}
                    totalUnread={totalUnread}
                />
            </SheetTrigger>
            <SheetContent
                className="w-full max-w-[420px] border-l border-forest/10 bg-cream/95 px-0 pt-12 backdrop-blur-xl"
                side="right"
            >
                <SheetHeader className="px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <SheetTitle>Notificacoes</SheetTitle>
                            <SheetDescription>
                                Inbox operacional do seu tenant, atualizado com polling autenticado.
                            </SheetDescription>
                        </div>
                        <Badge className="shrink-0" variant={criticalUnread > 0 ? "destructive" : "secondary"}>
                            {totalUnread} nao lidas
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="mt-6 border-t border-soil/10 px-6 pt-4">
                    <div className="flex flex-wrap gap-2">
                        {scopeOptions.map((option) => {
                            const isActive = scope === option.value;
                            const count = option.value === "all"
                                ? totalUnread
                                : (unreadSummaryQuery.data?.byScope[option.value] ?? 0);

                            return (
                                <button
                                    className={[
                                        "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]",
                                        "transition-[background-color,color,border-color] duration-200",
                                        isActive
                                            ? "border-forest bg-forest text-cream"
                                            : "border-soil/15 bg-cream text-bark hover:border-forest/35 hover:text-forest",
                                    ].join(" ")}
                                    key={option.value}
                                    onClick={() => setScope(option.value)}
                                    type="button"
                                >
                                    {option.label} ({count})
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-bark">
                            <input
                                checked={unreadOnly}
                                className="h-4 w-4 rounded border-soil/20 text-forest focus:ring-forest"
                                onChange={(event) => setUnreadOnly(event.target.checked)}
                                type="checkbox"
                            />
                            Mostrar so nao lidas
                        </label>
                        <Button
                            data-testid="notification-mark-all-read"
                            disabled={selectedScopeCount === 0 || markAllReadMutation.isPending}
                            onClick={() => void handleMarkAllRead()}
                            size="sm"
                            variant="secondary"
                        >
                            Marcar tudo como lido
                        </Button>
                    </div>
                </div>

                <div className="mt-4 max-h-[calc(100vh-240px)] overflow-y-auto px-6 pb-6">
                    {inboxQuery.isLoading && notifications.length === 0 ? (
                        <div className="rounded-sm border border-dashed border-soil/15 bg-cream-dark/35 px-4 py-6 text-sm text-bark">
                            Carregando notificacoes...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="rounded-sm border border-dashed border-soil/15 bg-cream-dark/35 px-4 py-6 text-sm text-bark">
                            Nenhuma notificacao encontrada para este filtro.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map((notification) => {
                                const isUnread = notification.readAt == null;

                                return (
                                    <article
                                        className={[
                                            "rounded-sm border px-4 py-4 shadow-sm transition-[border-color,background-color]",
                                            isUnread
                                                ? "border-forest/15 bg-white"
                                                : "border-soil/10 bg-cream-dark/35",
                                        ].join(" ")}
                                        key={notification.id}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant={getSeverityVariant(notification.severity)}>
                                                        {getSeverityLabel(notification.severity)}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        {getScopeLabel(notification.scope)}
                                                    </Badge>
                                                    {isUnread ? (
                                                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                                                            Nova
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-soil">
                                                        {notification.title}
                                                    </h3>
                                                    <p className="mt-1 text-sm text-bark">
                                                        {notification.body}
                                                    </p>
                                                </div>
                                            </div>
                                            <time className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-bark/70">
                                                {new Date(notification.createdAt).toLocaleString("pt-BR", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </time>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between gap-3">
                                            <a
                                                className="text-xs font-bold uppercase tracking-[0.16em] text-forest underline-offset-4 hover:underline"
                                                href={notification.href}
                                                onClick={() => {
                                                    if (isUnread) {
                                                        void handleMarkRead(notification.id);
                                                    }
                                                }}
                                            >
                                                Abrir contexto
                                            </a>
                                            {isUnread ? (
                                                <button
                                                    className="text-xs font-bold uppercase tracking-[0.16em] text-bark transition-colors hover:text-forest"
                                                    data-testid={`notification-mark-read-${notification.id}`}
                                                    onClick={() => void handleMarkRead(notification.id)}
                                                    type="button"
                                                >
                                                    Marcar como lida
                                                </button>
                                            ) : (
                                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-bark/65">
                                                    Ja lida
                                                </span>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
