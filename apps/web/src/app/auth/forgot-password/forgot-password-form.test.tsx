import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Module from "node:module";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

const originalModuleLoad = (
  Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;
type TestWindow = JSDOM["window"];

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
  globalThis.HTMLButtonElement = window.HTMLButtonElement;
  globalThis.HTMLFormElement = window.HTMLFormElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.Event = window.Event;
  globalThis.FormData =
    window.FormData as unknown as typeof globalThis.FormData;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.SVGElement = window.SVGElement;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: window.navigator,
  });

  return dom;
}

function setInputValue(
  input: HTMLInputElement,
  value: string,
  window: TestWindow,
) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

async function submitForm(form: HTMLFormElement, window: TestWindow) {
  await act(async () => {
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

before(() => {
  (
    Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    }
  )._load = function patchedModuleLoad(
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === "@frescari/ui") {
      return {
        Button: ({
          children,
          type = "button",
          ...props
        }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
          <button type={type} {...props}>
            {children}
          </button>
        ),
      };
    }

    if (request === "next/link") {
      const NextLinkMock = ({
        children,
        href,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
      }) => (
        <a href={href} {...props}>
          {children}
        </a>
      );

      NextLinkMock.displayName = "NextLinkMock";

      return NextLinkMock;
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };
});

after(() => {
  (
    Module as typeof Module & {
      _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    }
  )._load = originalModuleLoad;
});

test("submits the email with redirectTo and shows generic success copy", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const calls: Array<{ email: string; redirectTo: string }> = [];
  const { ForgotPasswordForm } = await import("./forgot-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ForgotPasswordForm
        requestPasswordReset={async (payload, callbacks) => {
          calls.push(payload);
          callbacks?.onSuccess?.();
        }}
        resetPasswordRedirectUrl="https://app.frescari.com/auth/reset-password"
      />,
    );
  });

  const emailInput = container.querySelector(
    "#forgot-password-email",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(emailInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(emailInput, "buyer@example.com", window);
  });

  await submitForm(form, window);

  assert.deepEqual(calls, [
    {
      email: "buyer@example.com",
      redirectTo: "https://app.frescari.com/auth/reset-password",
    },
  ]);
  assert.match(
    container.textContent ?? "",
    /Se o email informado puder receber acesso, enviaremos um link para redefinir sua senha\./i,
  );
  assert.equal(container.querySelectorAll('a[href="/auth/login"]').length, 1);
});

test("shows a local-log message when email delivery is unavailable", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { ForgotPasswordForm } = await import("./forgot-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ForgotPasswordForm
        emailDeliveryConfigured={false}
        requestPasswordReset={async (_payload, callbacks) => {
          callbacks?.onSuccess?.();
        }}
      />,
    );
  });

  const emailInput = container.querySelector(
    "#forgot-password-email",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(emailInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(emailInput, "buyer@example.com", window);
  });

  await submitForm(form, window);

  assert.match(container.textContent ?? "", /Ambiente local/i);
  assert.match(
    container.textContent ?? "",
    /O envio por e-mail nao esta configurado neste ambiente\./i,
  );
  assert.doesNotMatch(
    container.textContent ?? "",
    /Se o email informado puder receber acesso, enviaremos um link para redefinir sua senha\./i,
  );
});

test("maps invalid email errors without breaking the generic flow", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { ForgotPasswordForm } = await import("./forgot-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ForgotPasswordForm
        requestPasswordReset={async (_payload, callbacks) => {
          callbacks?.onError?.({
            error: {
              code: "INVALID_EMAIL",
            },
          });
        }}
        resetPasswordRedirectUrl="https://app.frescari.com/auth/reset-password"
      />,
    );
  });

  const emailInput = container.querySelector(
    "#forgot-password-email",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(emailInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(emailInput, "email-invalido", window);
  });

  await submitForm(form, window);

  assert.match(
    container.textContent ?? "",
    /Use um email valido para receber o link\./i,
  );
});
