import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const shouldUseExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

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
              command: `pnpm exec next dev --hostname 127.0.0.1 --port ${PORT}`,
              cwd: __dirname,
              reuseExistingServer: !process.env.CI,
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
