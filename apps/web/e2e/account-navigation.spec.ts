import { expect, test, type Page } from "@playwright/test";

import {
  createBuyerJourneyFixture,
  type BuyerJourneyFixture,
} from "./support/buyer-session";
import { createAdminSessionCookie } from "./support/admin-session";
import { createProducerDashboardFixture } from "./support/producer-session";
import { authenticateWithSessionHeader } from "./support/session-header";

async function authenticateWithCookie(page: Page, cookie: string) {
  await authenticateWithSessionHeader(page.context(), cookie);
}

async function openPersonalMenu(page: Page) {
  const profileMenuTrigger = page.locator('button[aria-haspopup="menu"]');

  await expect(profileMenuTrigger).toBeVisible();
  await profileMenuTrigger.click();
}

function getAccountNavigation(page: Page) {
  return page.getByRole("navigation", {
    name: "Navegacao interna de Minha Conta",
  });
}

test.describe.serial("navegacao da area Minha Conta", () => {
  let buyerFixture: BuyerJourneyFixture;
  let producerCookie: string;
  let adminCookie: string;

  test.beforeAll(async () => {
    test.setTimeout(120_000);

    const [buyer, producerFixture, admin] = await Promise.all([
      createBuyerJourneyFixture(),
      createProducerDashboardFixture({
        seedConfirmedDispatch: false,
        seedFarm: false,
        seedPendingDelivery: false,
        seedVehicle: false,
      }),
      createAdminSessionCookie(),
    ]);

    buyerFixture = buyer;
    producerCookie = producerFixture.cookie;
    adminCookie = admin;
  });

  test("menu pessoal mostra Minha Conta e leva o comprador para a nova area", async ({
    page,
  }) => {
    await authenticateWithCookie(page, buyerFixture.cookie);

    await page.goto("/dashboard");
    await openPersonalMenu(page);

    const accountMenuItem = page.getByRole("menuitem", { name: "Minha Conta" });

    await expect(accountMenuItem).toBeVisible();
    await accountMenuItem.click();

    await expect(page).toHaveURL(/\/conta\/perfil$/i);
    await expect(getAccountNavigation(page)).toBeVisible();
  });

  test("comprador ve as secoes corretas e navega entre perfil, cadastro e seguranca", async ({
    page,
  }) => {
    await authenticateWithCookie(page, buyerFixture.cookie);

    await page.goto("/conta");

    const navigation = getAccountNavigation(page);

    await expect(page).toHaveURL(/\/conta\/perfil$/i);
    await expect(navigation.getByRole("link")).toHaveCount(4);
    await expect(
      navigation.getByRole("link", { name: "Perfil" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      navigation.getByRole("link", { name: "Cadastro" }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Enderecos" }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Seguranca" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Ajuste os dados que representam voce\./i,
      }),
    ).toBeVisible();

    await navigation.getByRole("link", { name: "Cadastro" }).click();

    await expect(page).toHaveURL(/\/conta\/cadastro$/i);
    await expect(
      page.getByRole("heading", { name: "Cadastro principal do tenant" }),
    ).toBeVisible();

    await getAccountNavigation(page)
      .getByRole("link", { name: "Seguranca" })
      .click();

    await expect(page).toHaveURL(/\/conta\/seguranca$/i);
    await expect(
      page.getByRole("heading", { name: "Nova senha da conta" }),
    ).toBeVisible();
  });

  test("rota legada /dashboard/perfil redireciona comprador para /conta/enderecos", async ({
    page,
  }) => {
    await authenticateWithCookie(page, buyerFixture.cookie);

    await page.goto("/dashboard/perfil");

    const navigation = getAccountNavigation(page);

    await expect(page).toHaveURL(/\/conta\/enderecos$/i);
    await expect(
      navigation.getByRole("link", { name: "Enderecos" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: /^Enderecos$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: buyerFixture.addressTitle }).first(),
    ).toBeVisible();
  });

  test("produtor nao ve Enderecos e acessos proibidos voltam para uma secao valida", async ({
    page,
  }) => {
    await authenticateWithCookie(page, producerCookie);

    await page.goto("/conta");

    const navigation = getAccountNavigation(page);

    await expect(page).toHaveURL(/\/conta\/perfil$/i);
    await expect(navigation.getByRole("link")).toHaveCount(3);
    await expect(
      navigation.getByRole("link", { name: "Perfil" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      navigation.getByRole("link", { name: "Cadastro" }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Seguranca" }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Enderecos" }),
    ).toHaveCount(0);

    await page.goto("/conta/enderecos");

    await expect(page).toHaveURL(/\/conta\/perfil$/i);
    await expect(
      page.getByRole("heading", {
        name: /Ajuste os dados que representam voce\./i,
      }),
    ).toBeVisible();
  });

  test("admin cai sempre em uma secao permitida e nao recebe links de buyer ou producer", async ({
    page,
  }) => {
    await authenticateWithCookie(page, adminCookie);

    await page.goto("/conta");

    const navigation = getAccountNavigation(page);

    await expect(page).toHaveURL(/\/conta\/perfil$/i);
    await expect(navigation.getByRole("link")).toHaveCount(2);
    await expect(
      navigation.getByRole("link", { name: "Perfil" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      navigation.getByRole("link", { name: "Seguranca" }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Cadastro" }),
    ).toHaveCount(0);
    await expect(
      navigation.getByRole("link", { name: "Enderecos" }),
    ).toHaveCount(0);

    await page.goto("/conta/cadastro");
    await expect(page).toHaveURL(/\/conta\/perfil$/i);

    await page.goto("/conta/enderecos");
    await expect(page).toHaveURL(/\/conta\/perfil$/i);
  });
});
