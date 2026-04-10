import { defineConfig, devices } from "@playwright/test";

import { loadWebEnv } from "./e2e/support/web-env";

const PORT = 3100;
const webServerEnv = Object.fromEntries(
  Object.entries(loadWebEnv({ ...process.env })).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);
webServerEnv.PLAYWRIGHT_TEST = "true";
const BASE_URL = webServerEnv.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const shouldUseExternalServer = Boolean(webServerEnv.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: shouldUseExternalServer
    ? undefined
    : {
        command: `pnpm build && pnpm exec next start --hostname 127.0.0.1 --port ${PORT}`,
        cwd: __dirname,
        env: webServerEnv,
        reuseExistingServer: false,
        timeout: 120_000,
        url: BASE_URL,
      },
  workers: 1,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
