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
          isLoading: _isLoading,
          type = "button",
          ...props
        }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
          isLoading?: boolean;
        }) => {
          void _isLoading;

          return (
            <button type={type} {...props}>
              {children}
            </button>
          );
        },
      };
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

test("blocks submit when the new password confirmation does not match", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const calls: Array<unknown> = [];
  const { default: ChangePasswordForm } =
    await import("./change-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ChangePasswordForm
        changePassword={async (payload) => {
          calls.push(payload);
        }}
      />,
    );
  });

  assert.match(container.textContent ?? "", /Proteja seu acesso/i);
  assert.equal(
    container.textContent?.includes("Atualizacao autenticada"),
    false,
  );
  assert.equal(container.textContent?.includes("Antes de confirmar"), false);
  assert.equal(container.textContent?.includes("Boas praticas"), false);
  assert.equal(container.textContent?.includes("Seguro"), false);
  assert.equal(container.textContent?.includes("Checklist"), false);
  assert.equal(container.textContent?.includes("01"), false);

  const currentInput = container.querySelector(
    "#change-password-current",
  ) as HTMLInputElement | null;
  const passwordInput = container.querySelector(
    "#change-password-new",
  ) as HTMLInputElement | null;
  const confirmInput = container.querySelector(
    "#change-password-confirm",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(currentInput);
  assert.ok(passwordInput);
  assert.ok(confirmInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(currentInput, "SenhaAtual123", window);
    setInputValue(passwordInput, "NovaSenha123", window);
    setInputValue(confirmInput, "OutraSenha123", window);
  });

  await submitForm(form, window);

  assert.deepEqual(calls, []);
  assert.match(container.textContent ?? "", /as senhas precisam ser iguais/i);
});

test("submits a strong password with session revocation and shows success state", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const calls: Array<{
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: boolean;
  }> = [];
  const { default: ChangePasswordForm } =
    await import("./change-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ChangePasswordForm
        changePassword={async (payload, callbacks) => {
          calls.push(payload);
          callbacks?.onSuccess?.();
        }}
      />,
    );
  });

  const currentInput = container.querySelector(
    "#change-password-current",
  ) as HTMLInputElement | null;
  const passwordInput = container.querySelector(
    "#change-password-new",
  ) as HTMLInputElement | null;
  const confirmInput = container.querySelector(
    "#change-password-confirm",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(currentInput);
  assert.ok(passwordInput);
  assert.ok(confirmInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(currentInput, "SenhaAtual123", window);
    setInputValue(passwordInput, "NovaSenha123", window);
    setInputValue(confirmInput, "NovaSenha123", window);
  });

  await submitForm(form, window);

  assert.deepEqual(calls, [
    {
      currentPassword: "SenhaAtual123",
      newPassword: "NovaSenha123",
      revokeOtherSessions: true,
    },
  ]);
  assert.match(container.textContent ?? "", /senha atualizada com sucesso/i);
});

test("shows an explicit message when the current password is incorrect", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { default: ChangePasswordForm } =
    await import("./change-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ChangePasswordForm
        changePassword={async (_payload, callbacks) => {
          callbacks?.onError?.({
            error: {
              code: "INVALID_PASSWORD",
            },
          });
        }}
      />,
    );
  });

  const currentInput = container.querySelector(
    "#change-password-current",
  ) as HTMLInputElement | null;
  const passwordInput = container.querySelector(
    "#change-password-new",
  ) as HTMLInputElement | null;
  const confirmInput = container.querySelector(
    "#change-password-confirm",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(currentInput);
  assert.ok(passwordInput);
  assert.ok(confirmInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(currentInput, "SenhaAtual123", window);
    setInputValue(passwordInput, "NovaSenha123", window);
    setInputValue(confirmInput, "NovaSenha123", window);
  });

  await submitForm(form, window);

  assert.match(container.textContent ?? "", /senha atual incorreta/i);
});

test("surfaces session freshness errors separately from generic failures", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { default: ChangePasswordForm } =
    await import("./change-password-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ChangePasswordForm
        changePassword={async (_payload, callbacks) => {
          callbacks?.onError?.({
            error: {
              code: "SESSION_NOT_FRESH",
            },
          });
        }}
      />,
    );
  });

  const currentInput = container.querySelector(
    "#change-password-current",
  ) as HTMLInputElement | null;
  const passwordInput = container.querySelector(
    "#change-password-new",
  ) as HTMLInputElement | null;
  const confirmInput = container.querySelector(
    "#change-password-confirm",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;

  assert.ok(currentInput);
  assert.ok(passwordInput);
  assert.ok(confirmInput);
  assert.ok(form);

  await act(async () => {
    setInputValue(currentInput, "SenhaAtual123", window);
    setInputValue(passwordInput, "NovaSenha123", window);
    setInputValue(confirmInput, "NovaSenha123", window);
  });

  await submitForm(form, window);

  assert.match(container.textContent ?? "", /sessao precisa ser revalidada/i);
});
