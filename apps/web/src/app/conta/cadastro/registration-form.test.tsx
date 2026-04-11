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
          isLoading,
          isPending,
          type = "button",
          ...props
        }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
          isLoading?: boolean;
          isPending?: boolean;
        }) => {
          void isLoading;
          void isPending;

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
            updateRegistration: {
              useMutation: () => ({
                isPending: false,
                mutateAsync: async () => undefined,
              }),
            },
          },
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

test("renders the buyer registration form with user-facing company copy", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { RegistrationFormView } = await import("./registration-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <RegistrationFormView
        flags={{
          canAccessAddresses: true,
          canManageRegistration: true,
          hasTenant: true,
          isAdmin: false,
          isBuyer: true,
          isProducer: false,
        }}
        isLoading={false}
        loadError={null}
        tenant={{
          id: "tenant_buyer_123",
          name: "Mercado Central",
          producerContactName: null,
          producerDocumentId: null,
          producerLegalEntityType: null,
          producerLegalName: null,
          producerPhone: null,
          type: "BUYER",
        }}
        user={{
          email: "comprador@frescari.test",
          id: "user_buyer_123",
          image: null,
          name: "Mateus",
          role: "buyer",
          tenantId: "tenant_buyer_123",
        }}
      />,
    );
  });

  const companyNameInput = container.querySelector(
    "#registration-company-name",
  ) as HTMLInputElement | null;

  assert.ok(companyNameInput);
  assert.equal(companyNameInput.value, "Mercado Central");
  assert.equal(container.querySelector("#registration-public-name"), null);
  assert.match(container.textContent ?? "", /Use o nome que identifica/i);
  assert.equal(container.textContent?.includes("Resumo"), false);
  assert.equal(container.textContent?.includes("Dados comerciais"), false);
  assert.equal(container.textContent?.includes("Escopo desta fase"), false);
  assert.equal(container.textContent?.includes("Perfil autenticado"), false);
  assert.equal(container.textContent?.includes("tenant"), false);
  assert.equal(
    container.textContent?.includes("account.updateRegistration"),
    false,
  );
});

test("submits the producer registration payload with normalized tenant fields", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const saves: unknown[] = [];
  const { RegistrationFormView } = await import("./registration-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <RegistrationFormView
        flags={{
          canAccessAddresses: false,
          canManageRegistration: true,
          hasTenant: true,
          isAdmin: false,
          isBuyer: false,
          isProducer: true,
        }}
        isLoading={false}
        loadError={null}
        onSave={async (payload) => {
          saves.push(payload);
        }}
        tenant={{
          id: "tenant_producer_123",
          name: "Sitio da Ana",
          producerContactName: "Ana Maria",
          producerDocumentId: "52998224725",
          producerLegalEntityType: "PF",
          producerLegalName: "Ana Maria de Souza",
          producerPhone: "11998765432",
          type: "PRODUCER",
        }}
        user={{
          email: "produtor@frescari.test",
          id: "user_producer_123",
          image: null,
          name: "Ana Maria",
          role: "producer",
          tenantId: "tenant_producer_123",
        }}
      />,
    );
  });

  const publicNameInput = container.querySelector(
    "#registration-public-name",
  ) as HTMLInputElement | null;
  const legalNameInput = container.querySelector(
    "#registration-legal-name",
  ) as HTMLInputElement | null;
  const documentInput = container.querySelector(
    "#registration-document-id",
  ) as HTMLInputElement | null;
  const contactNameInput = container.querySelector(
    "#registration-contact-name",
  ) as HTMLInputElement | null;
  const phoneInput = container.querySelector(
    "#registration-phone",
  ) as HTMLInputElement | null;
  const form = container.querySelector("form") as HTMLFormElement | null;
  const submitButton = container.querySelector(
    "button[type='submit']",
  ) as HTMLButtonElement | null;

  assert.ok(publicNameInput);
  assert.ok(legalNameInput);
  assert.ok(documentInput);
  assert.ok(contactNameInput);
  assert.ok(phoneInput);
  assert.ok(form);
  assert.ok(submitButton);
  assert.match(container.textContent ?? "", /Negocio/);
  assert.match(container.textContent ?? "", /Visivel para compradores/);
  assert.equal(container.textContent?.includes("Empresa"), false);
  assert.equal(container.textContent?.includes("Nome da empresa"), false);

  await act(async () => {
    setInputValue(publicNameInput, "  Sitio da Ana Premium  ", window);
    setInputValue(legalNameInput, "  Ana Maria de Souza  ", window);
    setInputValue(documentInput, "529.982.247-25", window);
    setInputValue(contactNameInput, "  Ana   Maria  ", window);
    setInputValue(phoneInput, "+55 (11) 99876-5432", window);
  });

  assert.equal(submitButton.disabled, false);

  await submitForm(form, window);

  assert.deepEqual(saves, [
    {
      contactName: "Ana Maria",
      documentId: "52998224725",
      legalEntityType: "PF",
      legalName: "Ana Maria de Souza",
      phone: "11998765432",
      publicName: "Sitio da Ana Premium",
      type: "producer",
    },
  ]);
});

test("shows a blocked state when the authenticated role cannot manage registration", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { RegistrationFormView } = await import("./registration-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <RegistrationFormView
        flags={{
          canAccessAddresses: false,
          canManageRegistration: false,
          hasTenant: false,
          isAdmin: true,
          isBuyer: false,
          isProducer: false,
        }}
        isLoading={false}
        loadError={null}
        tenant={null}
        user={{
          email: "admin@frescari.test",
          id: "user_admin_123",
          image: null,
          name: "Administrador",
          role: "admin",
          tenantId: null,
        }}
      />,
    );
  });

  assert.match(container.textContent ?? "", /dados da conta indisponiveis/i);
  assert.equal(container.textContent?.includes("Empresa"), false);
  assert.equal(container.querySelector("form"), null);
});

test("uses neutral account copy while registration data is loading", async (context) => {
  const dom = setupDom();
  const { window } = dom;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root: Root = createRoot(container);
  const { RegistrationFormView } = await import("./registration-form");

  context.after(async () => {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  });

  await act(async () => {
    root.render(
      <RegistrationFormView
        flags={null}
        isLoading
        loadError={null}
        tenant={null}
        user={null}
      />,
    );
  });

  assert.match(container.textContent ?? "", /Conta/);
  assert.match(container.textContent ?? "", /Preparando seus dados/);
  assert.equal(container.textContent?.includes("Empresa"), false);
});
