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
    (link) => link.textContent?.trim() === "Empresa",
  );
  const shellRoot = container.firstElementChild as HTMLElement | null;
  const layoutGrid = container.querySelector("main > div");
  const nav = container.querySelector("nav");
  const aside = container.querySelector("aside");
  const contentPanel = container.querySelector("section");

  assert.deepEqual(links, ["Perfil", "Empresa", "Enderecos", "Seguranca"]);
  assert.ok(cadastroLink);
  assert.ok(shellRoot);
  assert.ok(layoutGrid);
  assert.ok(nav);
  assert.ok(aside);
  assert.ok(contentPanel);
  assert.match(shellRoot.className, /bg-background/);
  assert.equal(shellRoot.className.includes("radial-gradient"), false);
  assert.match(layoutGrid.className, /\bmin-w-0\b/);
  assert.match(nav.className, /\bflex-wrap\b/);
  assert.equal(nav.className.includes("overflow-x-auto"), false);
  assert.match(aside.className, /\bmin-w-0\b/);
  assert.match(contentPanel.className, /\bmin-w-0\b/);
  assert.equal(cadastroLink.getAttribute("aria-current"), "page");
  assert.ok(container.querySelector("[data-testid='content']"));
});

test("uses a business label for producer registration", async (context) => {
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
        role="producer"
      >
        <div>produtor</div>
      </AccountShellView>,
    );
  });

  const links = Array.from(container.querySelectorAll("a")).map((link) =>
    link.textContent?.trim(),
  );
  const businessLink = Array.from(container.querySelectorAll("a")).find(
    (link) => link.textContent?.trim() === "Negocio",
  );

  assert.deepEqual(links, ["Perfil", "Negocio", "Seguranca"]);
  assert.ok(businessLink);
  assert.equal(businessLink.getAttribute("aria-current"), "page");
});

test("uses a customer-facing account header instead of an internal card", async (context) => {
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
        pathname="/conta/perfil"
        role="buyer"
        userName="Mateus Oliveira Lopes"
      >
        <div>perfil</div>
      </AccountShellView>,
    );
  });

  const header = container.querySelector("header");

  assert.ok(header);
  assert.match(container.textContent ?? "", /Area Frescari/);
  assert.match(container.textContent ?? "", /Oi, Mateus\./);
  assert.match(
    container.textContent ?? "",
    /Seu espaco para manter a Frescari do seu jeito\./,
  );
  assert.match(
    container.textContent ?? "",
    /perfil, empresa, enderecos e seguranca ficam juntos/,
  );
  assert.equal(container.textContent?.includes("Minha Conta"), false);
  assert.equal(container.textContent?.includes("Conta de"), false);
  assert.equal(container.textContent?.includes("sem burocracia"), false);
  assert.equal(container.textContent?.includes("resolver rapido"), false);
  assert.equal(header.className.includes("surface-panel"), false);
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
