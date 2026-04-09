import { expect, test } from "@playwright/test";

test("user can request a password reset from the login screen", async ({
  page,
}) => {
  let capturedRequestBody = "";

  await page.route("**/api/auth/request-password-reset*", async (route) => {
    capturedRequestBody = route.request().postData() ?? "";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/auth/login");
  await page.getByRole("link", { name: /esqueci minha senha/i }).click();
  await page
    .getByLabel(/e-mail para recuperar acesso/i)
    .fill("buyer@example.com");
  const requestPromise = page.waitForResponse(
    "**/api/auth/request-password-reset*",
  );
  await page
    .getByRole("button", { name: /enviar link de redefinicao/i })
    .click();
  await requestPromise;

  await expect(
    page.getByText(
      /Se o email informado puder receber acesso, enviaremos um link para redefinir sua senha\.|O envio por e-mail nao esta configurado neste ambiente\./i,
    ),
  ).toBeVisible();
  expect(capturedRequestBody).toContain("/auth/reset-password");
});

test("user can define a new password from a valid reset token", async ({
  page,
}) => {
  await page.route("**/api/auth/reset-password*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/auth/reset-password?token=e2e-token");
  await page.locator("#reset-password-new").fill("NovaSenha123");
  await page.locator("#reset-password-confirm").fill("NovaSenha123");
  const resetPromise = page.waitForResponse("**/api/auth/reset-password*");
  await page.getByRole("button", { name: /redefinir senha/i }).click();
  await resetPromise;

  await expect(page.getByText(/Senha atualizada com sucesso\./i)).toBeVisible();
});
