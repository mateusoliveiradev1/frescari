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

test("blocks submit when passwords do not match", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { ResetPasswordForm } = await import("./reset-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(<ResetPasswordForm error={null} token="abc123" />);
  });

  const passwordInput = container.querySelector(
    "#reset-password-new",
  ) as HTMLInputElement | null;
  const confirmInput = container.querySelector(
    "#reset-password-confirm",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(passwordInput);
  assert.ok(confirmInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(passwordInput, "NovaSenha123", window);
    setInputValue(confirmInput, "OutraSenha123", window);
  });

  await submitForm(form, window);

  assert.match(container.textContent ?? "", /As senhas precisam ser iguais\./i);
});

test("updates validation feedback while the user types", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { ResetPasswordForm } = await import("./reset-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(<ResetPasswordForm error={null} token="abc123" />);
  });

  const passwordInput = container.querySelector(
    "#reset-password-new",
  ) as HTMLInputElement | null;
  const confirmInput = container.querySelector(
    "#reset-password-confirm",
  ) as HTMLInputElement | null;
  const submitButton = container.querySelector(
    "button[type='submit']",
  ) as HTMLButtonElement | null;

  assert.ok(passwordInput);
  assert.ok(confirmInput);
  assert.ok(submitButton);
  assert.equal(submitButton.disabled, true);
  assert.match(
    container.textContent ?? "",
    /Repita a senha exatamente como foi digitada acima\./i,
  );

  await act(async () => {
    setInputValue(passwordInput, "NovaSenha123", window);
  });

  assert.match(container.textContent ?? "", /Senhas iguais/i);
  assert.equal(
    container.querySelectorAll("[data-met='true']").length,
    4,
    "all password criteria should be marked as satisfied",
  );
  assert.equal(submitButton.disabled, true);

  await act(async () => {
    setInputValue(confirmInput, "OutraSenha123", window);
  });

  assert.equal(confirmInput.getAttribute("aria-invalid"), "true");
  assert.match(container.textContent ?? "", /As senhas precisam ser iguais\./i);
  assert.equal(submitButton.disabled, true);

  await act(async () => {
    setInputValue(confirmInput, "NovaSenha123", window);
  });

  assert.equal(confirmInput.getAttribute("aria-invalid"), "false");
  assert.match(container.textContent ?? "", /As senhas coincidem\./i);
  assert.equal(
    container.querySelectorAll("[data-met='true']").length,
    5,
    "all password and confirmation criteria should be marked as satisfied",
  );
  assert.equal(submitButton.disabled, false);
});

test("submits a strong password and shows success state", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const calls: Array<{ newPassword: string; token: string }> = [];
  const { ResetPasswordForm } = await import("./reset-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ResetPasswordForm
        error={null}
        resetPassword={async (payload, callbacks) => {
          calls.push(payload);
          callbacks?.onSuccess?.();
        }}
        token="abc123"
      />,
    );
  });

  const passwordInput = container.querySelector(
    "#reset-password-new",
  ) as HTMLInputElement | null;
  const confirmInput = container.querySelector(
    "#reset-password-confirm",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(passwordInput);
  assert.ok(confirmInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(passwordInput, "NovaSenha123", window);
    setInputValue(confirmInput, "NovaSenha123", window);
  });

  await submitForm(form, window);

  assert.deepEqual(calls, [
    {
      newPassword: "NovaSenha123",
      token: "abc123",
    },
  ]);
  assert.match(container.textContent ?? "", /Senha atualizada com sucesso\./i);
});

test("shows invalid-link state when the token is missing or invalid", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { ResetPasswordForm } = await import("./reset-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(<ResetPasswordForm error="INVALID_TOKEN" token={null} />);
  });

  assert.match(container.textContent ?? "", /Link invalido ou expirado\./i);
});
