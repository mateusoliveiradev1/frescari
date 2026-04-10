import type { BrowserContext } from "@playwright/test";

const PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3100";
const SESSION_COOKIE_NAME = "better-auth.session_token";

export async function authenticateWithSessionHeader(
  context: BrowserContext,
  sessionToken: string,
) {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      url: PLAYWRIGHT_BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
