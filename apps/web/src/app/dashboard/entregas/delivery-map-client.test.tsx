import assert from "node:assert/strict";
import test from "node:test";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

type DeliveryMapClientModule = typeof import("./delivery-map-client");

function setupDom() {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost",
    });
    const { window } = dom;

    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    globalThis.window = window as unknown as typeof globalThis.window;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.SVGElement = window.SVGElement;
    globalThis.Element = window.Element;
    globalThis.Node = window.Node;
    globalThis.getComputedStyle = window.getComputedStyle.bind(window);
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
        setTimeout(callback, 0)) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) =>
        clearTimeout(handle)) as typeof globalThis.cancelAnimationFrame;
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: window.navigator,
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

test("renders the selected wave sequence with a polyline and numbered stop markers", async (context) => {
    const dom = setupDom();
    const { window } = dom;
    const container = window.document.createElement("div");
    window.document.body.appendChild(container);
    const root: Root = createRoot(container);
    const { DeliveryMapClient } = (await import("./delivery-map-client")) as DeliveryMapClientModule;

    const deliveries = [
        {
            orderId: "order-1",
            buyerName: "Mercado Modelo",
            destination: {
                latitude: -23.56,
                longitude: -46.64,
            },
            distanceKm: 12.4,
            origin: {
                farmId: "farm-1",
                farmName: "Fazenda Sol",
                latitude: -23.55,
                longitude: -46.63,
            },
            recommendation: {},
        },
        {
            orderId: "order-2",
            buyerName: "Padaria Central",
            destination: {
                latitude: -23.57,
                longitude: -46.65,
            },
            distanceKm: 14.1,
            origin: {
                farmId: "farm-1",
                farmName: "Fazenda Sol",
                latitude: -23.55,
                longitude: -46.63,
            },
            recommendation: {},
        },
    ] as Parameters<DeliveryMapClientModule["DeliveryMapClient"]>[0]["deliveries"];

    const waveContext = {
        kind: "suggested",
        orderIds: ["order-1", "order-2"],
        primaryOrderId: "order-1",
        stops: [
            { orderId: "order-1", sequence: 1 },
            { orderId: "order-2", sequence: 2 },
        ],
        subtitle: "Wave sugerida com contexto geografico.",
        title: "Wave sugerida selecionada",
    } as Parameters<DeliveryMapClientModule["DeliveryMapClient"]>[0]["waveContext"];

    context.after(async () => {
        await act(async () => {
            root.unmount();
        });
        dom.window.close();
    });

    await act(async () => {
        root.render(
            <DeliveryMapClient
                deliveries={deliveries}
                onSelect={() => {}}
                selectedOrderId="order-1"
                waveContext={waveContext}
            />,
        );
    });

    assert.equal(
        container.querySelectorAll(".delivery-wave-sequence-pin").length,
        2,
    );
    assert.equal(container.querySelectorAll(".delivery-origin-pin").length, 1);
    assert.equal(
        container.querySelectorAll(".delivery-wave-sequence-line").length,
        1,
    );
});
