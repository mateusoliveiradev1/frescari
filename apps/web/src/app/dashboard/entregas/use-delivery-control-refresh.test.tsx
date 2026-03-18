import assert from "node:assert/strict";
import test from "node:test";

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import { useDeliveryControlRefresh } from "./use-delivery-control-refresh";

type QueueDeliveryFixture = {
    orderId: string;
    status: string;
    activeOverride: {
        action: string;
    } | null;
    dispatch: null;
    recommendation: {
        priorityScore: number;
        confidence: string;
        suggestedVehicleType: string;
        suggestedVehicle: null;
        externalContext: null;
    };
};

function createDelivery(orderId: string, priorityScore: number): QueueDeliveryFixture {
    return {
        orderId,
        status: "confirmed",
        activeOverride: null,
        dispatch: null,
        recommendation: {
            priorityScore,
            confidence: "medium",
            suggestedVehicleType: "pickup",
            suggestedVehicle: null,
            externalContext: null,
        },
    };
}

function clickElement(element: Element, MouseEventCtor: typeof MouseEvent) {
    element.dispatchEvent(new MouseEventCtor("click", { bubbles: true }));
}

function RecommendationContractHarness({
    initialDeliveries,
    reorderedDeliveries,
}: {
    initialDeliveries: QueueDeliveryFixture[];
    reorderedDeliveries: QueueDeliveryFixture[];
}) {
    const [incomingDeliveries, setIncomingDeliveries] = useState(initialDeliveries);
    const {
        deliveries,
        hasPendingRecommendationUpdate,
        applyLatestRecommendation,
        clearManualOverrideLock,
        registerManualOverride,
    } = useDeliveryControlRefresh(incomingDeliveries);

    return (
        <div>
            <output data-testid="visible-order">{deliveries.map((delivery) => delivery.orderId).join(",")}</output>
            <button onClick={() => registerManualOverride()} type="button">
                ativar override
            </button>
            <button onClick={() => setIncomingDeliveries(reorderedDeliveries)} type="button">
                receber nova recomendacao
            </button>
            <button onClick={() => setIncomingDeliveries(initialDeliveries)} type="button">
                restaurar recomendacao
            </button>

            {hasPendingRecommendationUpdate ? (
                <div>
                    <p>Nova recomendacao disponivel</p>
                    <button
                        onClick={() => {
                            applyLatestRecommendation();
                            clearManualOverrideLock();
                        }}
                        type="button"
                    >
                        Aplicar nova recomendacao
                    </button>
                </div>
            ) : null}
        </div>
    );
}

test("blocks silent reorder while a manual override lock is active and releases the queue after operator approval", async (context) => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost",
    });
    const { window } = dom;

    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    globalThis.window = window as unknown as typeof globalThis.window;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.MouseEvent = window.MouseEvent;
    globalThis.Node = window.Node;
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: window.navigator,
    });

    const container = window.document.createElement("div");
    window.document.body.appendChild(container);

    const root: Root = createRoot(container);
    const initialDeliveries = [
        createDelivery("order-1", 80),
        createDelivery("order-2", 70),
    ];
    const reorderedDeliveries = [
        createDelivery("order-2", 96),
        createDelivery("order-1", 68),
    ];

    const getVisibleOrder = () =>
        container.querySelector("[data-testid='visible-order']")?.textContent ?? "";

    context.after(async () => {
        await act(async () => {
            root.unmount();
        });
        dom.window.close();
    });

    await act(async () => {
        root.render(
            <RecommendationContractHarness
                initialDeliveries={initialDeliveries}
                reorderedDeliveries={reorderedDeliveries}
            />,
        );
    });

    assert.equal(getVisibleOrder(), "order-1,order-2");

    const activateOverrideButton = container.querySelector("button");

    assert.ok(activateOverrideButton);

    await act(async () => {
        clickElement(activateOverrideButton, window.MouseEvent as unknown as typeof MouseEvent);
    });

    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("receber nova recomendacao"),
    );

    assert.ok(refreshButton);

    await act(async () => {
        clickElement(refreshButton, window.MouseEvent as unknown as typeof MouseEvent);
    });

    assert.equal(getVisibleOrder(), "order-1,order-2");
    assert.match(container.textContent ?? "", /Nova recomendacao disponivel/);

    const applyLatestButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Aplicar nova recomendacao"),
    );

    assert.ok(applyLatestButton);

    await act(async () => {
        clickElement(applyLatestButton, window.MouseEvent as unknown as typeof MouseEvent);
    });

    assert.equal(getVisibleOrder(), "order-2,order-1");
    assert.doesNotMatch(container.textContent ?? "", /Nova recomendacao disponivel/);

    const restoreButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("restaurar recomendacao"),
    );

    assert.ok(restoreButton);

    await act(async () => {
        clickElement(restoreButton, window.MouseEvent as unknown as typeof MouseEvent);
    });

    assert.equal(getVisibleOrder(), "order-1,order-2");
    assert.doesNotMatch(container.textContent ?? "", /Nova recomendacao disponivel/);
});
