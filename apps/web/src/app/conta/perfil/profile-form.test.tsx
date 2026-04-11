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

async function clickElement(
  element: HTMLButtonElement | HTMLAnchorElement,
  window: TestWindow,
) {
  await act(async () => {
    element.dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
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
          isLoading,
          type = "button",
          ...props
        }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
          isLoading?: boolean;
        }) => {
          void isLoading;

          return (
            <button type={type} {...props}>
              {children}
            </button>
          );
        },
        Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => (
          <div {...props} />
        ),
        SkeletonText: ({
          lines = 3,
          ...props
        }: React.HTMLAttributes<HTMLDivElement> & {
          lines?: number;
        }) => (
          <div {...props}>
            {Array.from({ length: lines }).map((_, index) => (
              <span key={index}>loading</span>
            ))}
          </div>
        ),
      };
    }

    if (request === "@/trpc/react") {
      return {
        trpc: {
          useUtils: () => ({
            account: {
              getOverview: {
                invalidate: async () => undefined,
              },
            },
          }),
          account: {
            getOverview: {
              useQuery: () => ({
                data: null,
                error: null,
                isLoading: false,
                refetch: async () => undefined,
              }),
            },
          },
        },
      };
    }

    if (request === "@/lib/auth-client") {
      return {
        authClient: {
          updateUser: async () => ({ data: null, error: null }),
        },
      };
    }

    if (request === "next/navigation") {
      return {
        useRouter: () => ({
          refresh: () => undefined,
        }),
      };
    }

    if (request === "sonner") {
      return {
        toast: {
          error: () => undefined,
          success: () => undefined,
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

test("renders a loading state while the account overview is pending", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { ProfileFormView } = await import("./profile-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(<ProfileFormView isLoading loadError={null} user={null} />);
  });

  assert.match(
    container.textContent ?? "",
    /Carregando os dados principais da sua conta\./i,
  );
});

test("shows an error state with retry when the profile cannot be loaded", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  let retries = 0;
  const { ProfileFormView } = await import("./profile-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ProfileFormView
        isLoading={false}
        loadError="Falha ao carregar."
        onRetry={async () => {
          retries += 1;
        }}
        user={null}
      />,
    );
  });

  const retryButton = container.querySelector(
    "button",
  ) as HTMLButtonElement | null;

  assert.ok(retryButton);
  assert.match(
    container.textContent ?? "",
    /Nao foi possivel carregar o perfil agora\./i,
  );

  await clickElement(retryButton, window);

  assert.equal(retries, 1);
});

test("prefills the current name, keeps email read-only, and saves only after a real change", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const saves: Array<{ name: string }> = [];
  const { ProfileFormView } = await import("./profile-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ProfileFormView
        isLoading={false}
        loadError={null}
        onSave={async (payload) => {
          saves.push(payload);
        }}
        user={{
          email: "mateus@frescari.com",
          id: "user_123",
          image: null,
          name: "Mateus Oliveira",
          role: "buyer",
          tenantId: "tenant_123",
        }}
      />,
    );
  });

  const nameInput = container.querySelector(
    "#profile-name",
  ) as HTMLInputElement | null;
  const emailInput = container.querySelector(
    "#profile-email",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;
  const submitButton = container.querySelector(
    "button[type='submit']",
  ) as HTMLButtonElement | null;

  assert.ok(nameInput);
  assert.ok(emailInput);
  assert.ok(form);
  assert.ok(submitButton);

  assert.equal(nameInput.value, "Mateus Oliveira");
  assert.equal(emailInput.value, "mateus@frescari.com");
  assert.equal(emailInput.disabled, true);
  assert.equal(submitButton.disabled, true);
  assert.match(container.textContent ?? "", /Seu email fica visivel/i);
  assert.equal(container.textContent?.includes("Resumo da conta"), false);
  assert.equal(container.textContent?.includes("Avatar da conta"), false);
  assert.equal(container.textContent?.includes("Dados de acesso"), false);
  assert.equal(container.textContent?.includes("Escopo desta fase"), false);
  assert.equal(container.textContent?.includes("papel"), false);
  assert.equal(container.textContent?.includes("fase"), false);

  await act(async () => {
    setInputValue(nameInput, "Mateus Oliveira Junior", window);
  });

  assert.equal(submitButton.disabled, false);

  await submitForm(form, window);

  assert.deepEqual(saves, [{ name: "Mateus Oliveira Junior" }]);
  assert.match(container.textContent ?? "", /Perfil atualizado com sucesso\./i);
  assert.equal(submitButton.disabled, true);
});

test("keeps the form interactive and surfaces the save error when the update fails", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { ProfileFormView } = await import("./profile-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <ProfileFormView
        isLoading={false}
        loadError={null}
        onSave={async () => {
          throw new Error("Nao foi possivel atualizar seu perfil.");
        }}
        user={{
          email: "mateus@frescari.com",
          id: "user_123",
          image: null,
          name: "Mateus Oliveira",
          role: "buyer",
          tenantId: "tenant_123",
        }}
      />,
    );
  });

  const nameInput = container.querySelector(
    "#profile-name",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;
  const submitButton = container.querySelector(
    "button[type='submit']",
  ) as HTMLButtonElement | null;

  assert.ok(nameInput);
  assert.ok(form);
  assert.ok(submitButton);

  await act(async () => {
    setInputValue(nameInput, "Mateus O.", window);
  });

  await submitForm(form, window);

  assert.match(
    container.textContent ?? "",
    /Nao foi possivel atualizar seu perfil\./i,
  );
  assert.equal(submitButton.disabled, false);
});
