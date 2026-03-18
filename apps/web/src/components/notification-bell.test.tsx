import assert from "node:assert/strict";
import test from "node:test";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import { NotificationBell } from "./notification-bell";

function setupDom() {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "http://localhost",
    });
    const { window } = dom;

    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    globalThis.window = window as unknown as typeof globalThis.window;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.HTMLButtonElement = window.HTMLButtonElement;
    globalThis.Element = window.Element;
    globalThis.Node = window.Node;
    globalThis.SVGElement = window.SVGElement;
    globalThis.getComputedStyle = window.getComputedStyle.bind(window);
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: window.navigator,
    });

    return dom;
}

test("renders a capped unread badge and critical styling when there are critical alerts", async (context) => {
    const dom = setupDom();
    const { window } = dom;
    const container = window.document.createElement("div");
    window.document.body.appendChild(container);
    const root: Root = createRoot(container);

    context.after(async () => {
        await act(async () => {
            root.unmount();
        });
        dom.window.close();
    });

    await act(async () => {
        root.render(
            <NotificationBell criticalUnread={2} totalUnread={12} />,
        );
    });

    const button = container.querySelector("[data-testid='notification-bell']");
    const badge = container.querySelector("[data-testid='notification-bell-badge']");

    assert.ok(button);
    assert.equal(button.getAttribute("aria-label"), "Abrir notificacoes, 12 nao lidas");
    assert.match(button.className, /text-ember/);
    assert.ok(badge);
    assert.equal(badge.textContent, "9+");
});

test("hides the unread badge when there are no pending notifications", async (context) => {
    const dom = setupDom();
    const { window } = dom;
    const container = window.document.createElement("div");
    window.document.body.appendChild(container);
    const root: Root = createRoot(container);

    context.after(async () => {
        await act(async () => {
            root.unmount();
        });
        dom.window.close();
    });

    await act(async () => {
        root.render(
            <NotificationBell criticalUnread={0} totalUnread={0} />,
        );
    });

    const button = container.querySelector("[data-testid='notification-bell']");
    const badge = container.querySelector("[data-testid='notification-bell-badge']");

    assert.ok(button);
    assert.equal(button.getAttribute("aria-label"), "Abrir notificacoes");
    assert.equal(badge, null);
});
