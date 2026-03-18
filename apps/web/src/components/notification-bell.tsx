"use client";

import type { ButtonHTMLAttributes } from "react";
import { Bell, BellDot } from "lucide-react";

type NotificationBellProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    totalUnread: number;
    criticalUnread: number;
    isLoading?: boolean;
};

function formatUnreadCount(totalUnread: number) {
    if (totalUnread > 9) {
        return "9+";
    }

    return String(totalUnread);
}

export function NotificationBell({
    totalUnread,
    criticalUnread,
    isLoading = false,
    className,
    ...props
}: NotificationBellProps) {
    const hasCriticalUnread = criticalUnread > 0;
    const Icon = hasCriticalUnread ? BellDot : Bell;
    const ariaLabel = totalUnread > 0
        ? `Abrir notificacoes, ${totalUnread} nao lidas`
        : "Abrir notificacoes";

    return (
        <button
            aria-label={ariaLabel}
            className={[
                "group relative flex items-center justify-center rounded-sm p-2",
                "transition-[color,background-color] focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                hasCriticalUnread
                    ? "text-ember hover:bg-ember/10"
                    : "text-bark hover:bg-forest/5 hover:text-forest",
                className,
            ].filter(Boolean).join(" ")}
            data-testid="notification-bell"
            type="button"
            {...props}
        >
            <Icon className="h-5 w-5" />
            {isLoading ? (
                <span className="sr-only">Carregando notificacoes</span>
            ) : null}
            {totalUnread > 0 ? (
                <span
                    className={[
                        "absolute right-0 top-0 -mr-1 -mt-1 flex h-4 min-w-4 items-center justify-center",
                        "rounded-full px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-cream",
                        hasCriticalUnread ? "bg-ember" : "bg-forest",
                    ].join(" ")}
                    data-testid="notification-bell-badge"
                >
                    {formatUnreadCount(totalUnread)}
                </span>
            ) : null}
        </button>
    );
}
