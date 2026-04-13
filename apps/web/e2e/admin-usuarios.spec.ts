import { expect, test, type Page } from "@playwright/test";

import { createAdminSessionCookie } from "./support/admin-session";
import { authenticateWithSessionHeader } from "./support/session-header";

function requestIncludes(
  request: { postData(): string | null; url(): string },
  needle: string,
) {
  const body = request.postData() ?? "";
  const haystacks = [request.url(), body].map((value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  });

  return haystacks.some((value) => value.includes(needle));
}

function trpcSuccess(json: unknown) {
  return {
    result: {
      data: {
        json,
      },
    },
  };
}

async function mockBuyerTenantDetailPagination(page: Page) {
  const tenant = {
    createdAt: "2026-03-15T12:00:00.000Z",
    geoRegion: null,
    id: "00000000-0000-0000-0000-000000000111",
    name: "Conta comercial paginada",
    plan: "free",
    slug: "tenant-paginado",
    stripeAccountId: null,
    type: "BUYER",
  };
  const firstUsersPage = {
    items: Array.from({ length: 4 }, (_, index) => ({
      createdAt: `2026-03-${String(14 - index).padStart(2, "0")}T12:00:00.000Z`,
      email: `pessoa-${index + 1}@example.com`,
      id: `person-${index + 1}`,
      name: `Pessoa paginada ${index + 1}`,
      role: "buyer",
    })),
    nextCursor: "users-page-2",
  };
  const secondUsersPage = {
    items: [
      {
        createdAt: "2026-03-09T12:00:00.000Z",
        email: "pessoa-5@example.com",
        id: "person-5",
        name: "Pessoa paginada 5",
        role: "buyer",
      },
    ],
    nextCursor: null,
  };
  const emptyPage = {
    items: [],
    nextCursor: null,
  };

  await page.route("**/api/trpc/*", async (route) => {
    const request = route.request();
    const procedurePath =
      new URL(request.url()).pathname.split("/api/trpc/")[1] ?? "";

    if (procedurePath === "admin.getTenantOperationDetail") {
      return route.fulfill({
        body: JSON.stringify([
          trpcSuccess({
            activityWindowDays: 30,
            health: {
              activeLotCount: 0,
              addressCount: 0,
              buyerOrderCount: 0,
              checklist: [
                { done: false, label: "endereco" },
                { done: false, label: "pedido recente" },
              ],
              farmCount: 0,
              health: "needs_setup",
              healthLabel: "Sem endereco",
              productCount: 0,
              progressPercent: 0,
              sellerOperationalOrderCount: 0,
              stripeConnected: false,
              tenant,
              userCount: 5,
            },
            summary: {
              activeLotCount: 0,
              addressCount: 0,
              buyerOrderCount: 0,
              farmCount: 0,
              productCount: 0,
              sellerOperationalOrderCount: 0,
              stripeConnected: false,
              userCount: 5,
            },
            tenant,
          }),
        ]),
        contentType: "application/json",
        status: 200,
      });
    }

    if (
      procedurePath ===
      "admin.getTenantUsersPage,admin.getTenantAddressesPage,admin.getTenantOrdersAsBuyerPage"
    ) {
      return route.fulfill({
        body: JSON.stringify([
          trpcSuccess(firstUsersPage),
          trpcSuccess(emptyPage),
          trpcSuccess(emptyPage),
        ]),
        contentType: "application/json",
        status: 200,
      });
    }

    if (procedurePath === "admin.getTenantUsersPage") {
      return route.fulfill({
        body: JSON.stringify([
          trpcSuccess(
            requestIncludes(request, '"cursor":"users-page-2"')
              ? secondUsersPage
              : firstUsersPage,
          ),
        ]),
        contentType: "application/json",
        status: 200,
      });
    }

    if (
      procedurePath === "admin.getTenantAddressesPage" ||
      procedurePath === "admin.getTenantOrdersAsBuyerPage"
    ) {
      return route.fulfill({
        body: JSON.stringify([trpcSuccess(emptyPage)]),
        contentType: "application/json",
        status: 200,
      });
    }

    return route.continue();
  });
}

async function mockTenantOverviewPagination(page: Page) {
  const createTenantRecord = (index: number) => ({
    activeLotCount: 0,
    addressCount: 0,
    buyerOrderCount: 0,
    checklist: [
      { done: true, label: "fazenda" },
      { done: true, label: "recebimento" },
      { done: index < 7, label: "catalogo" },
    ],
    farmCount: 1,
    health: index < 7 ? "operating" : "inactive",
    healthLabel: index < 7 ? "Operando" : "Sem lote ativo",
    productCount: index < 7 ? 3 : 0,
    progressPercent: index < 7 ? 100 : 67,
    sellerOperationalOrderCount: index < 7 ? 1 : 0,
    stripeConnected: true,
    tenant: {
      createdAt: `2026-03-${String(15 - index).padStart(2, "0")}T12:00:00.000Z`,
      geoRegion: null,
      id: `00000000-0000-0000-0000-00000000010${index}`,
      name: `Conta comercial ${index}`,
      plan: "free",
      slug: `tenant-overview-${index}`,
      stripeAccountId: `acct_overview_${index}`,
      type: "PRODUCER",
    },
    userCount: index,
  });

  const firstPage = {
    activityWindowDays: 30,
    nextCursor: "overview-page-2",
    queues: {
      buyersWithoutAddress: [],
      producersWithoutFarm: [],
      producersWithoutStripe: [],
    },
    summary: {
      buyersActive: 0,
      buyersWithoutAddress: 0,
      newTenantsInWindow: 7,
      producersNeedingSetup: 0,
      producersOperating: 6,
      producersWithoutFarm: 0,
      producersWithoutStripe: 0,
      totalTenants: 7,
      totalUsers: 28,
    },
    tenants: Array.from({ length: 6 }, (_, index) =>
      createTenantRecord(index + 1),
    ),
  };
  const secondPage = {
    ...firstPage,
    nextCursor: null,
    tenants: [createTenantRecord(7)],
  };

  await page.route(
    "**/api/trpc/admin.getTenantOperationsOverview*",
    async (route) => {
      const request = route.request();

      return route.fulfill({
        body: JSON.stringify([
          trpcSuccess(
            requestIncludes(request, '"cursor":"overview-page-2"')
              ? secondPage
              : firstPage,
          ),
        ]),
        contentType: "application/json",
        status: 200,
      });
    },
  );
}

test.beforeEach(async ({ context }) => {
  const sessionCookie = await createAdminSessionCookie();

  await authenticateWithSessionHeader(context, sessionCookie);
});

test("admin usuarios aplica o fix do scroll e envia os filtros corretos", async ({
  page,
}) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });

  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/admin\/usuarios$/i);
  await expect(page.getByRole("button", { name: "Compradores" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-scroll-behavior",
    "smooth",
  );

  const buyerRequestPromise = page.waitForRequest(
    (request) =>
      request.url().includes("admin.getTenantOperationsOverview") &&
      requestIncludes(request, '"type":"BUYER"'),
  );
  await page.getByRole("button", { name: "Compradores" }).click();
  await buyerRequestPromise;

  await expect(
    page.getByRole("heading", { name: "Produtores sem base" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Produtores sem recebimento" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Compradores sem endereco" }),
  ).toBeVisible();

  const producerRequestPromise = page.waitForRequest(
    (request) =>
      request.url().includes("admin.getTenantOperationsOverview") &&
      requestIncludes(request, '"type":"PRODUCER"'),
  );
  await page.getByRole("button", { name: "Produtores" }).click();
  await producerRequestPromise;

  await expect(
    page.getByRole("heading", { name: "Produtores sem base" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Produtores sem recebimento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compradores sem endereco" }),
  ).toHaveCount(0);

  expect(
    consoleMessages.some(
      (message) =>
        message.includes("missing-data-scroll-behavior") ||
        message.includes(
          "Detected `scroll-behavior: smooth` on the `<html>` element",
        ),
    ),
  ).toBe(false);
});

test("admin usuarios abre o drill-down da conta comercial", async ({
  page,
}) => {
  await mockTenantOverviewPagination(page);
  await mockBuyerTenantDetailPagination(page);

  await page.goto("/admin/usuarios");

  const detailLink = page.getByRole("link", { name: "Abrir detalhe" }).first();
  await expect(detailLink).toBeVisible({ timeout: 15_000 });

  await detailLink.click();

  await expect(page).toHaveURL(/\/admin\/usuarios\/[0-9a-f-]+$/i);
  await expect(
    page.getByRole("link", { name: "Voltar para usuarios" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pessoas" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sinais operacionais" }),
  ).toBeVisible();
});

test("admin usuarios carrega mais pessoas no drill-down", async ({ page }) => {
  await mockTenantOverviewPagination(page);
  await mockBuyerTenantDetailPagination(page);

  await page.goto("/admin/usuarios");

  const detailLink = page.getByRole("link", { name: "Abrir detalhe" }).first();
  await expect(detailLink).toBeVisible({ timeout: 15_000 });
  await detailLink.click();

  await expect(page).toHaveURL(/\/admin\/usuarios\/[0-9a-f-]+$/i);
  await expect(
    page.getByRole("button", { name: "Carregar mais" }),
  ).toBeVisible();
  await expect(page.getByText("Pessoa paginada 4")).toBeVisible();

  const nextPageRequest = page.waitForRequest(
    (request) =>
      request.url().includes("admin.getTenantUsersPage") &&
      requestIncludes(request, '"cursor":"users-page-2"'),
  );
  await page.getByRole("button", { name: "Carregar mais" }).click();
  await nextPageRequest;

  await expect(page.getByText("Pessoa paginada 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Carregar mais" })).toHaveCount(
    0,
  );
});

test("admin usuarios carrega mais contas no overview", async ({ page }) => {
  await mockTenantOverviewPagination(page);

  await page.goto("/admin/usuarios");

  await expect(
    page.getByRole("button", { name: "Carregar mais contas" }),
  ).toBeVisible();
  await expect(page.getByText("Conta comercial 6")).toBeVisible();

  const nextPageRequest = page.waitForRequest(
    (request) =>
      request.url().includes("admin.getTenantOperationsOverview") &&
      requestIncludes(request, '"cursor":"overview-page-2"'),
  );
  await page.getByRole("button", { name: "Carregar mais contas" }).click();
  await nextPageRequest;

  await expect(page.getByText("Conta comercial 7")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Carregar mais contas" }),
  ).toHaveCount(0);
});
