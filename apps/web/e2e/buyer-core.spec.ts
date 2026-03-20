import {
  expect,
  test,
  type BrowserContext,
  type Route,
} from "@playwright/test";

import {
  createBuyerJourneyFixture,
  type BuyerJourneyFixture,
} from "./support/buyer-session";

async function authenticateBuyer(
  context: BrowserContext,
  fixture: BuyerJourneyFixture,
) {
  await context.addCookies([
    {
      domain: "127.0.0.1",
      httpOnly: true,
      name: "better-auth.session_token",
      path: "/",
      sameSite: "Lax",
      value: fixture.cookie,
    },
  ]);
}

function reserveButtonName(productName: string) {
  return `Reservar lote de ${productName}`;
}

async function fulfillCheckoutRedirect(
  route: Route,
  checkoutUrl: string,
): Promise<string> {
  const requestBody = route.request().postData() ?? "";

  await route.fulfill({
    body: JSON.stringify([
      {
        result: {
          data: {
            json: {
              url: checkoutUrl,
            },
          },
        },
      },
    ]),
    contentType: "application/json",
    status: 200,
  });

  return requestBody;
}

test.describe.configure({ timeout: 60_000 });

test.describe.serial("fluxo core do comprador", () => {
  let fixture: BuyerJourneyFixture;

  test.beforeAll(async () => {
    fixture = await createBuyerJourneyFixture();
  });

  test.beforeEach(async ({ context }) => {
    await authenticateBuyer(context, fixture);
  });

  test("comprador navega no catalogo e visualiza os lotes publicados", async ({
    page,
  }) => {
    await page.goto("/catalogo");

    await expect(page).toHaveURL(/\/catalogo$/i);
    await expect(
      page.getByRole("heading", { name: "Catalogo Frescari" }),
    ).toBeVisible();
    await expect(page.getByText("Lotes publicados hoje")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: reserveButtonName(fixture.primaryProductName),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: reserveButtonName(fixture.secondaryProductName),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Abrir carrinho" }),
    ).toBeVisible();
  });

  test("comprador adiciona itens no carrinho, fecha checkout por fazenda e ve a tela de sucesso", async ({
    page,
  }) => {
    let checkoutRequestBody = "";
    const checkoutUrl = "http://127.0.0.1:3000/sucesso?session_id=e2e-buyer";

    await page.route(
      /\/api\/trpc\/checkout\.createFarmCheckoutSession\?batch=1/,
      async (route) => {
        checkoutRequestBody = await fulfillCheckoutRedirect(route, checkoutUrl);
      },
    );

    await page.goto("/catalogo");

    await page
      .getByRole("button", {
        name: reserveButtonName(fixture.primaryProductName),
      })
      .click();

    const cartDialog = page.getByRole("dialog");
    await expect(cartDialog).toBeVisible();
    await expect(cartDialog).toContainText(fixture.primaryFarmName);

    await cartDialog
      .getByRole("button", { exact: true, name: "Fechar" })
      .click();
    await expect(cartDialog).toBeHidden();

    await page
      .getByRole("button", {
        name: reserveButtonName(fixture.secondaryProductName),
      })
      .click();

    await expect(cartDialog).toBeVisible();
    await expect(cartDialog).toContainText(fixture.primaryFarmName);
    await expect(cartDialog).toContainText(fixture.secondaryFarmName);
    await expect(cartDialog).toContainText(fixture.primaryProductName);
    await expect(cartDialog).toContainText(fixture.secondaryProductName);

    const checkoutButtons = cartDialog.getByRole("button", {
      name: "Fechar Pedido desta Fazenda",
    });

    await expect(checkoutButtons).toHaveCount(2);
    await expect(checkoutButtons.first()).toBeEnabled();

    await checkoutButtons.first().click();

    await expect(page).toHaveURL(/\/sucesso\?session_id=e2e-buyer$/i);
    await expect(
      page.getByRole("heading", { name: "Pedido Recebido!" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver Meus Pedidos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Continuar Comprando" }),
    ).toBeVisible();

    expect(checkoutRequestBody).toContain(fixture.primaryFarmId);
    expect(checkoutRequestBody).toContain(fixture.primaryLotId);
    expect(checkoutRequestBody).not.toContain(fixture.secondaryFarmId);
    expect(checkoutRequestBody).not.toContain(fixture.secondaryLotId);
  });

  test("comprador acessa perfil e historico de pedidos nas rotas privadas", async ({
    page,
  }) => {
    await page.goto("/dashboard/perfil");

    await expect(page).toHaveURL(/\/dashboard\/perfil$/i);
    await expect(
      page.getByRole("heading", { name: /Enderecos de entrega de/i }),
    ).toBeVisible();
    await expect(
      page.getByText("Endereco padrao do checkout").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: fixture.addressTitle }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(fixture.formattedAddress).first(),
    ).toBeVisible();

    await page.goto("/dashboard/pedidos");

    await expect(page).toHaveURL(/\/dashboard\/pedidos$/i);
    await expect(
      page.getByRole("heading", { name: "Meus Pedidos" }),
    ).toBeVisible();
    await expect(page.getByText(fixture.sellerName)).toBeVisible();
    await expect(page.getByText(fixture.primaryProductName)).toBeVisible();

    await page.getByRole("button", { name: "Ver Detalhes" }).first().click();

    const orderDialog = page.getByRole("dialog");
    await expect(orderDialog).toBeVisible();
    await expect(orderDialog).toContainText(fixture.primaryProductName);
    await expect(orderDialog).toContainText(fixture.sellerName);
  });
});
