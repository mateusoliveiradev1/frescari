import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import Module from "node:module";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

type SummaryData = {
    totalUnread: number;
    criticalUnread: number;
    byScope: {
        inventory: number;
        sales: number;
        orders: number;
        deliveries: number;
        platform: number;
    };
    criticalByScope: {
        inventory: number;
        sales: number;
        orders: number;
        deliveries: number;
        platform: number;
    };
    latestCreatedAt: Date | null;
};

type InboxNotification = {
    id: string;
    type: string;
    scope: "inventory" | "sales" | "orders" | "deliveries" | "platform";
    severity: "info" | "warning" | "critical";
    title: string;
    body: string;
    href: string;
    entityType: "lot" | "order";
    entityId: string;
    metadata: Record<string, unknown>;
    readAt: Date | null;
    createdAt: Date;
};

const trpcState = {
    summaryData: null as SummaryData | null,
    summaryLoading: false,
    inboxData: [] as InboxNotification[],
    inboxLoading: false,
    lastSummaryOptions: null as Record<string, unknown> | null,
    lastInboxInput: null as Record<string, unknown> | null,
    lastInboxOptions: null as Record<string, unknown> | null,
    markReadCalls: [] as Array<{ ids: string[] }>,
    markAllReadCalls: [] as Array<{ scope?: string }>,
    prefetchCalls: [] as Array<Record<string, unknown>>,
    invalidations: {
        summary: 0,
        inbox: 0,
    },
};

const trpcMock = {
    useUtils() {
        return {
            notification: {
                getUnreadSummary: {
                    invalidate: async () => {
                        trpcState.invalidations.summary += 1;
                    },
                    cancel: async () => {},
                    setData: (_input: unknown, updater: (current: SummaryData | null) => SummaryData | null) => {
                        trpcState.summaryData = updater(trpcState.summaryData);
                    },
                },
                listInbox: {
                    invalidate: async () => {
                        trpcState.invalidations.inbox += 1;
                    },
                    cancel: async () => {},
                    prefetch: async (input: Record<string, unknown>) => {
                        trpcState.prefetchCalls.push(input);
                    },
                    setData: (
                        input: Record<string, unknown>,
                        updater: (current: InboxNotification[]) => InboxNotification[],
                    ) => {
                        const currentScope = trpcState.lastInboxInput?.scope;
                        const currentUnreadOnly = trpcState.lastInboxInput?.unreadOnly ?? false;

                        if (
                            input.scope === currentScope
                            && (input.unreadOnly ?? false) === currentUnreadOnly
                        ) {
                            trpcState.inboxData = updater(trpcState.inboxData);
                        }
                    },
                },
            },
        };
    },
    notification: {
        getUnreadSummary: {
            useQuery: (_input: unknown, options?: Record<string, unknown>) => {
                trpcState.lastSummaryOptions = options ?? null;

                return {
                    data: trpcState.summaryData,
                    isLoading: trpcState.summaryLoading,
                };
            },
        },
        listInbox: {
            useQuery: (input: Record<string, unknown>, options?: Record<string, unknown>) => {
                trpcState.lastInboxInput = input;
                trpcState.lastInboxOptions = options ?? null;

                return {
                    data: trpcState.inboxData,
                    isLoading: trpcState.inboxLoading,
                };
            },
        },
        markRead: {
            useMutation: (options?: {
                onMutate?: (input: { ids: string[] }) => Promise<unknown> | unknown;
                onSettled?: () => Promise<unknown> | unknown;
            }) => ({
                isPending: false,
                mutateAsync: async (input: { ids: string[] }) => {
                    trpcState.markReadCalls.push(input);
                    await options?.onMutate?.(input);
                    await options?.onSettled?.();
                    return { updatedCount: input.ids.length };
                },
            }),
        },
        markAllRead: {
            useMutation: (options?: {
                onMutate?: (input: { scope?: string }) => Promise<unknown> | unknown;
                onSettled?: () => Promise<unknown> | unknown;
            }) => ({
                isPending: false,
                mutateAsync: async (input: { scope?: string }) => {
                    trpcState.markAllReadCalls.push(input);
                    await options?.onMutate?.(input);
                    await options?.onSettled?.();
                    return { updatedCount: 1 };
                },
            }),
        },
    },
};

const originalModuleLoad = (Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
})._load;

function resetTrpcState() {
    trpcState.summaryData = {
        totalUnread: 3,
        criticalUnread: 1,
        byScope: {
            inventory: 1,
            sales: 0,
            orders: 1,
            deliveries: 1,
            platform: 0,
        },
        criticalByScope: {
            inventory: 0,
            sales: 0,
            orders: 1,
            deliveries: 0,
            platform: 0,
        },
        latestCreatedAt: new Date("2026-03-18T11:00:00.000Z"),
    };
    trpcState.summaryLoading = false;
    trpcState.inboxData = [
        {
            id: "notification-1",
            type: "order_confirmed",
            scope: "orders",
            severity: "critical",
            title: "Pedido confirmado",
            body: "O pedido foi confirmado e aguarda acompanhamento.",
            href: "/dashboard/pedidos",
            entityType: "order",
            entityId: "order-1",
            metadata: { orderId: "order-1" },
            readAt: null,
            createdAt: new Date("2026-03-18T11:00:00.000Z"),
        },
        {
            id: "notification-2",
            type: "delivery_in_transit",
            scope: "deliveries",
            severity: "info",
            title: "Entrega em rota",
            body: "O pedido saiu para entrega.",
            href: "/dashboard/entregas",
            entityType: "order",
            entityId: "order-2",
            metadata: { orderId: "order-2" },
            readAt: new Date("2026-03-18T10:30:00.000Z"),
            createdAt: new Date("2026-03-18T10:00:00.000Z"),
        },
    ];
    trpcState.inboxLoading = false;
    trpcState.lastSummaryOptions = null;
    trpcState.lastInboxInput = null;
    trpcState.lastInboxOptions = null;
    trpcState.markReadCalls = [];
    trpcState.markAllReadCalls = [];
    trpcState.prefetchCalls = [];
    trpcState.invalidations.summary = 0;
    trpcState.invalidations.inbox = 0;
}

function setupDom() {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost",
    });
    const { window } = dom;

    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    globalThis.window = window as unknown as typeof globalThis.window;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.HTMLInputElement = window.HTMLInputElement;
    globalThis.Element = window.Element;
    globalThis.Node = window.Node;
    globalThis.SVGElement = window.SVGElement;
    globalThis.MouseEvent = window.MouseEvent;
    globalThis.MutationObserver = window.MutationObserver;
    globalThis.getComputedStyle = window.getComputedStyle.bind(window);
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
        setTimeout(callback, 0)) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) =>
        clearTimeout(handle)) as typeof globalThis.cancelAnimationFrame;
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: window.navigator,
    });
    Object.defineProperty(window.document, "visibilityState", {
        configurable: true,
        value: "visible",
    });
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({
            matches: false,
            addEventListener() {},
            addListener() {},
            dispatchEvent() {
                return false;
            },
            media: "",
            onchange: null,
            removeEventListener() {},
            removeListener() {},
        }),
    });

    return dom;
}

function clickElement(element: Element, MouseEventCtor: typeof MouseEvent) {
    element.dispatchEvent(new MouseEventCtor("click", { bubbles: true }));
}

before(() => {
    (Module as typeof Module & {
        _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    })._load = function patchedModuleLoad(request: string, parent: unknown, isMain: boolean) {
        if (request === "@/trpc/react") {
            return {
                trpc: trpcMock,
            };
        }

        if (request === "@frescari/ui") {
            const SheetContext = React.createContext<{
                open: boolean;
                onOpenChange?: (open: boolean) => void;
            } | null>(null);

            return {
                Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
                Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
                    <button type="button" {...props}>
                        {children}
                    </button>
                ),
                Sheet: ({
                    children,
                    open = false,
                    onOpenChange,
                }: {
                    children: React.ReactNode;
                    open?: boolean;
                    onOpenChange?: (open: boolean) => void;
                }) => (
                    <SheetContext.Provider value={{ open, onOpenChange }}>
                        <div>{children}</div>
                    </SheetContext.Provider>
                ),
                SheetContent: ({ children }: { children: React.ReactNode }) => {
                    const sheet = React.useContext(SheetContext);

                    if (!sheet?.open) {
                        return null;
                    }

                    return <section>{children}</section>;
                },
                SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
                SheetHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
                SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
                SheetTrigger: ({ children }: { children: React.ReactNode }) => {
                    const sheet = React.useContext(SheetContext);

                    if (!React.isValidElement(children)) {
                        return <>{children}</>;
                    }

                    const child = children as React.ReactElement<{
                        onClick?: (event: React.MouseEvent<HTMLElement>) => void;
                    }>;

                    return React.cloneElement(
                        child,
                        {
                            onClick: (event: React.MouseEvent<HTMLElement>) => {
                                child.props.onClick?.(event);
                                sheet?.onOpenChange?.(true);
                            },
                        },
                    );
                },
            };
        }

        return originalModuleLoad.call(this, request, parent, isMain);
    };
});

after(() => {
    (Module as typeof Module & {
        _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    })._load = originalModuleLoad;
});

beforeEach(() => {
    resetTrpcState();
});

test("polling helper only enables the 15 second interval for visible tabs", async () => {
    const { getNotificationPollingInterval } = await import("./notification-inbox-sheet");

    assert.equal(getNotificationPollingInterval(true), 15_000);
    assert.equal(getNotificationPollingInterval(false), false);
});

test("renders the inbox, applies filters, and wires read mutations to query invalidation", async (context) => {
    const dom = setupDom();
    const { window } = dom;
    const container = window.document.createElement("div");
    window.document.body.appendChild(container);
    const root: Root = createRoot(container);
    const { NotificationInboxSheet } = await import("./notification-inbox-sheet");

    context.after(async () => {
        await act(async () => {
            root.unmount();
        });
        dom.window.close();
    });

    await act(async () => {
        root.render(<NotificationInboxSheet />);
    });

    assert.equal(trpcState.lastSummaryOptions?.refetchInterval, 15_000);
    assert.equal(trpcState.lastInboxInput?.scope, undefined);
    assert.equal(trpcState.lastInboxInput?.unreadOnly, false);
    assert.equal(trpcState.lastInboxOptions?.enabled, false);
    assert.deepEqual(trpcState.prefetchCalls, [
        { limit: 20, unreadOnly: false, scope: undefined },
    ]);

    const bellButton = window.document.querySelector("[data-testid='notification-bell']");
    assert.ok(bellButton);

    await act(async () => {
        bellButton.dispatchEvent(new window.MouseEvent("mouseenter", { bubbles: true }));
        clickElement(bellButton, window.MouseEvent as unknown as typeof MouseEvent);
        await Promise.resolve();
        await Promise.resolve();
    });

    assert.equal(trpcState.lastInboxOptions?.enabled, true);
    assert.equal(trpcState.lastInboxOptions?.refetchInterval, 15_000);
    assert.deepEqual(trpcState.prefetchCalls, [
        { limit: 20, unreadOnly: false, scope: undefined },
        { limit: 20, unreadOnly: false, scope: undefined },
    ]);
    assert.match(window.document.body.textContent ?? "", /Notificacoes/);
    assert.match(window.document.body.textContent ?? "", /3 nao lidas/);

    const deliveriesFilter = Array.from(window.document.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Entregas (1)"),
    );
    assert.ok(deliveriesFilter);

    await act(async () => {
        clickElement(deliveriesFilter, window.MouseEvent as unknown as typeof MouseEvent);
    });

    assert.equal(trpcState.lastInboxInput?.scope, "deliveries");

    const unreadOnlyCheckbox = window.document.querySelector("input[type='checkbox']");
    assert.ok(unreadOnlyCheckbox);

    await act(async () => {
        clickElement(unreadOnlyCheckbox, window.MouseEvent as unknown as typeof MouseEvent);
    });

    assert.equal(trpcState.lastInboxInput?.unreadOnly, true);

    const markReadButton = window.document.querySelector(
        "[data-testid='notification-mark-read-notification-1']",
    );
    assert.ok(markReadButton);

    await act(async () => {
        clickElement(markReadButton, window.MouseEvent as unknown as typeof MouseEvent);
        await Promise.resolve();
        await Promise.resolve();
    });

    assert.deepEqual(trpcState.markReadCalls, [
        { ids: ["notification-1"] },
    ]);
    assert.equal(trpcState.invalidations.summary, 1);
    assert.equal(trpcState.invalidations.inbox, 1);

    const markAllReadButton = window.document.querySelector(
        "[data-testid='notification-mark-all-read']",
    );
    assert.ok(markAllReadButton);

    await act(async () => {
        clickElement(markAllReadButton, window.MouseEvent as unknown as typeof MouseEvent);
        await Promise.resolve();
        await Promise.resolve();
    });

    assert.deepEqual(trpcState.markAllReadCalls, [
        { scope: "deliveries" },
    ]);
    assert.equal(trpcState.invalidations.summary, 2);
    assert.equal(trpcState.invalidations.inbox, 2);
});
