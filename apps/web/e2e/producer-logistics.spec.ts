import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
} from "@playwright/test";

import {
  createProducerDashboardFixture,
  type ProducerDashboardFixtureOptions,
} from "./support/producer-session";

async function authenticateProducer(
  context: BrowserContext,
  options: ProducerDashboardFixtureOptions,
) {
  const fixture = await createProducerDashboardFixture(options);

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

  return fixture;
}

test.describe.configure({ timeout: 60_000 });

function waitForTrpcMutation(
  page: Page,
  procedurePath: string,
): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/trpc/${procedurePath}?batch=1`),
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requireFixtureValue(value: string | null, field: string): string {
  if (!value) {
    throw new Error(`Expected seeded fixture value for ${field}.`);
  }

  return value;
}

test("produtor cadastra a fazenda e gerencia a frota operacional", async ({
  context,
  page,
}) => {
  await authenticateProducer(context, {
    seedFarm: false,
    seedVehicle: false,
    seedPendingDelivery: false,
    seedConfirmedDispatch: false,
  });

  await page.goto("/dashboard/fazenda");

  await expect(page).toHaveURL(/\/dashboard\/fazenda$/i);
  await expect(
    page.getByRole("heading", { name: "Minha Fazenda" }),
  ).toBeVisible();

  await page.locator("#farm-name").fill("Fazenda E2E");
  await page.locator("#farm-street").fill("Estrada da Colheita");
  await page.locator("#farm-number").fill("1200");
  await page.locator("#farm-neighborhood").fill("Zona Rural");
  await page.locator("#farm-city").fill("Ibiuna");
  await page.locator("#farm-state").fill("SP");
  await page.locator("#farm-postal-code").fill("18150-000");
  await page.locator("#farm-country").fill("BR");
  await page.locator("#farm-delivery-radius-km").fill("30");
  await page.locator("#farm-price-per-km").fill("4.5");
  await page.locator("#farm-min-order-value").fill("80");
  await page.locator("#farm-free-shipping-threshold").fill("200");

  await page.getByRole("button", { name: "Salvar fazenda" }).click();

  await expect(page.getByText("Dados da fazenda salvos.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cadastrar veiculo" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Cadastrar veiculo" }).click();

  const createVehicleDialog = page.getByRole("dialog");

  await createVehicleDialog.locator("#fleet-vehicle-label").fill("Van E2E");
  await createVehicleDialog
    .locator("#fleet-vehicle-type")
    .selectOption("refrigerated_van");
  await createVehicleDialog.locator("#fleet-vehicle-capacity").fill("850");
  await createVehicleDialog
    .locator("#fleet-vehicle-status")
    .selectOption("available");
  await createVehicleDialog
    .getByLabel("Usa refrigeracao para pereciveis")
    .check();
  await createVehicleDialog
    .locator("#fleet-vehicle-notes")
    .fill("Primeira rota do dia");

  const createVehicleResponse = waitForTrpcMutation(page, "farm.upsertVehicle");

  await createVehicleDialog
    .getByRole("button", { name: "Cadastrar veiculo" })
    .click();

  expect((await createVehicleResponse).ok()).toBeTruthy();
  await expect(createVehicleDialog).toBeHidden();

  await expect(page.getByText("Veiculo cadastrado.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Van E2E/i })).toBeVisible();

  await page.getByRole("button", { name: /Van E2E/i }).click();

  const editVehicleDialog = page.getByRole("dialog");

  await editVehicleDialog.locator("#fleet-vehicle-capacity").fill("900");
  await editVehicleDialog
    .locator("#fleet-vehicle-status")
    .selectOption("maintenance");
  await expect(
    editVehicleDialog.locator("#fleet-vehicle-capacity"),
  ).toHaveValue("900");
  await expect(editVehicleDialog.locator("#fleet-vehicle-status")).toHaveValue(
    "maintenance",
  );

  const updateVehicleResponse = waitForTrpcMutation(page, "farm.upsertVehicle");

  await editVehicleDialog
    .getByRole("button", { name: "Salvar alteracoes" })
    .click();

  expect((await updateVehicleResponse).ok()).toBeTruthy();
  await expect(editVehicleDialog).toBeHidden();
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard\/fazenda$/i);

  const updatedVehicleCard = page.getByRole("button", { name: /^Van E2E/i });

  await expect(updatedVehicleCard).toContainText("900 kg");
  await expect(updatedVehicleCard).toContainText("Manutencao");
});

test("produtor confirma a saida e registra override manual na mesa logistica", async ({
  context,
  page,
}) => {
  const fixture = await authenticateProducer(context, {
    seedFarm: true,
    seedVehicle: true,
    seedPendingDelivery: true,
    seedConfirmedDispatch: false,
  });

  await page.goto("/dashboard/entregas");

  await expect(page).toHaveURL(/\/dashboard\/entregas$/i);
  await expect(page.getByRole("heading", { name: "Entregas" })).toBeVisible();
  const buyerName = requireFixtureValue(fixture.buyerName, "buyerName");
  const vehicleLabel = requireFixtureValue(
    fixture.vehicleLabel,
    "vehicleLabel",
  );

  await expect(
    page.getByRole("button", {
      name: new RegExp(escapeRegex(buyerName), "i"),
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /^Confirmar saida$/ })
    .first()
    .click();

  const dispatchDialog = page.getByRole("dialog");
  const dialogVehicleButton = dispatchDialog.getByRole("button", {
    name: new RegExp(`^${escapeRegex(vehicleLabel)}(?:\\s|$)`, "i"),
  });

  await expect(dialogVehicleButton).toBeVisible();
  await dialogVehicleButton.click();

  const confirmDispatchResponse = waitForTrpcMutation(
    page,
    "logistics.confirmDispatchWave",
  );
  const confirmDispatchButton = dispatchDialog.getByRole("button", {
    name: /^Confirmar (saida|wave)(?: \(\d+ pedidos\))?$/,
  });
  await expect(confirmDispatchButton).toBeVisible();
  await confirmDispatchButton.evaluate((button: HTMLButtonElement) =>
    button.click(),
  );

  expect((await confirmDispatchResponse).ok()).toBeTruthy();
  await expect(
    page.getByText("Saida confirmada com dados operacionais."),
  ).toBeVisible();
  await expect(page.getByText(/Ordem #1/i)).toBeVisible();

  await page
    .getByRole("button", { name: /^Priorizar$/ })
    .first()
    .click();

  const overrideDialog = page.getByRole("dialog");

  await overrideDialog
    .getByRole("button", { name: "Janela combinada" })
    .click();
  await overrideDialog
    .locator("#override-reason-notes")
    .fill("Cliente pediu entrega ate as 10h");

  const applyOverrideResponse = waitForTrpcMutation(
    page,
    "logistics.applyDispatchOverride",
  );
  await overrideDialog.getByRole("button", { name: "Salvar override" }).click();

  expect((await applyOverrideResponse).ok()).toBeTruthy();
  await expect(page.getByText("Pedido priorizado na fila.")).toBeVisible();
  await expect(page.getByText(/Existe override manual ativo/i)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard\/entregas$/i);
  await expect(
    page.getByRole("button", { name: /^Remover prioridade$/ }).first(),
  ).toBeVisible();

  const clearOverrideResponse = waitForTrpcMutation(
    page,
    "logistics.clearDispatchOverride",
  );
  await page
    .getByRole("button", { name: /^Remover prioridade$/ })
    .first()
    .click();

  expect((await clearOverrideResponse).ok()).toBeTruthy();
  await expect(page.getByText("Override manual removido.")).toBeVisible();
});

test("produtor consolida dois pedidos na mesma wave sugerida", async ({
  context,
  page,
}) => {
  const fixture = await authenticateProducer(context, {
    seedFarm: true,
    seedVehicle: true,
    seedPendingDelivery: true,
    seedPendingDeliveryCount: 2,
    seedConfirmedDispatch: false,
  });

  await page.goto("/dashboard/entregas");

  await expect(page).toHaveURL(/\/dashboard\/entregas$/i);
  await expect(page.getByRole("heading", { name: "Entregas" })).toBeVisible();

  const firstOrderId = requireFixtureValue(
    fixture.orderIds[0] ?? null,
    "orderIds[0]",
  );
  const secondOrderId = requireFixtureValue(
    fixture.orderIds[1] ?? null,
    "orderIds[1]",
  );
  const vehicleLabel = requireFixtureValue(
    fixture.vehicleLabel,
    "vehicleLabel",
  );

  await page
    .getByRole("button", { name: /^Confirmar wave \(2 pedidos\)$/ })
    .click();

  const dispatchDialog = page.getByRole("dialog");
  const dialogVehicleButton = dispatchDialog.getByRole("button", {
    name: new RegExp(`^${escapeRegex(vehicleLabel)}(?:\\s|$)`, "i"),
  });

  await expect(dialogVehicleButton).toBeVisible();
  await dialogVehicleButton.click();
  await expect(dispatchDialog.getByText(/^2 pedidos$/)).toBeVisible();

  const confirmDispatchResponse = waitForTrpcMutation(
    page,
    "logistics.confirmDispatchWave",
  );
  const confirmDispatchButton = dispatchDialog.getByRole("button", {
    name: /^Confirmar (saida|wave)(?: \(\d+ pedidos\))?$/,
  });
  await expect(confirmDispatchButton).toBeVisible();
  await confirmDispatchButton.evaluate((button: HTMLButtonElement) =>
    button.click(),
  );

  const response = await confirmDispatchResponse;
  const requestBody = response.request().postData() ?? "";

  expect(response.ok()).toBeTruthy();
  expect(requestBody).toContain(firstOrderId);
  expect(requestBody).toContain(secondOrderId);
});

test("produtor nao consegue excluir um veiculo que ja foi usado em uma saida confirmada", async ({
  context,
  page,
}) => {
  const fixture = await authenticateProducer(context, {
    seedFarm: true,
    seedVehicle: true,
    seedPendingDelivery: true,
    seedConfirmedDispatch: true,
  });

  await page.goto("/dashboard/fazenda");

  await expect(page).toHaveURL(/\/dashboard\/fazenda$/i);
  const vehicleLabel = requireFixtureValue(
    fixture.vehicleLabel,
    "vehicleLabel",
  );

  await page
    .getByRole("button", { name: new RegExp(vehicleLabel, "i") })
    .click();

  const vehicleDialog = page.getByRole("dialog");

  await vehicleDialog.getByRole("button", { name: "Remover veiculo" }).click();

  await expect(
    page.getByText("Nao foi possivel remover o veiculo."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Este veiculo ja aparece em saidas confirmadas. Marque-o como offline em vez de excluir.",
    ),
  ).toBeVisible();
});
