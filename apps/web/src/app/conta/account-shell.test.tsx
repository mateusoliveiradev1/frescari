import assert from "node:assert/strict";
import test from "node:test";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import { AccountShellView } from "./account-shell";

function TestLink({
  children,
  className,
  href,
  ...rest
}: React.ComponentPropsWithoutRef<"a">) {
  return (
    <a className={className} href={href} {...rest}>
      {children}
    </a>
  );
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
  globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
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

test("renders buyer sections and marks the current section as active", async (context) => {
  const dom = setupDom();
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root: Root = createRoot(container);

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <AccountShellView
        LinkComponent={TestLink}
        pathname="/conta/cadastro"
        role="buyer"
      >
        <div data-testid="content">conteudo</div>
      </AccountShellView>,
    );
  });

  const links = Array.from(container.querySelectorAll("a")).map((link) =>
    link.textContent?.trim(),
  );
  const cadastroLink = Array.from(container.querySelectorAll("a")).find(
    (link) => link.textContent?.trim() === "Cadastro",
  );

  assert.deepEqual(links, ["Perfil", "Cadastro", "Enderecos", "Seguranca"]);
  assert.ok(cadastroLink);
  assert.equal(cadastroLink.getAttribute("aria-current"), "page");
  assert.ok(container.querySelector("[data-testid='content']"));
});

test("hides buyer-only sections for admin", async (context) => {
  const dom = setupDom();
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root: Root = createRoot(container);

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <AccountShellView
        LinkComponent={TestLink}
        pathname="/conta/seguranca"
        role="admin"
      >
        <div>admin</div>
      </AccountShellView>,
    );
  });

  const links = Array.from(container.querySelectorAll("a")).map((link) =>
    link.textContent?.trim(),
  );

  assert.deepEqual(links, ["Perfil", "Seguranca"]);
  assert.equal(container.textContent?.includes("Enderecos"), false);
  assert.equal(container.textContent?.includes("Cadastro"), false);
});
