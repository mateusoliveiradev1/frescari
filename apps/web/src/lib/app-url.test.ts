import test from "node:test";
import assert from "node:assert/strict";

import { getAppUrl, getConfiguredUrl, getVercelDeploymentUrl } from "./app-url";

const env = process.env as Record<string, string | undefined>;

const resetEnv = () => {
  delete env.NEXT_PUBLIC_APP_URL;
  delete env.NEXT_PUBLIC_BETTER_AUTH_URL;
  delete env.VERCEL_BRANCH_URL;
  delete env.VERCEL_URL;
  delete env.NODE_ENV;
};

test.afterEach(() => {
  resetEnv();
});

test("getAppUrl prefers NEXT_PUBLIC_APP_URL when configured", () => {
  env.NEXT_PUBLIC_APP_URL = "https://frescari.com.br/";
  env.VERCEL_BRANCH_URL = "preview.example.vercel.app";
  env.NODE_ENV = "production";

  assert.equal(getAppUrl(), "https://frescari.com.br");
});

test("getVercelDeploymentUrl normalizes preview hostnames", () => {
  env.VERCEL_BRANCH_URL = "frescari-git-feature-preview.vercel.app";

  assert.equal(
    getVercelDeploymentUrl(),
    "https://frescari-git-feature-preview.vercel.app",
  );
});

test("getConfiguredUrl trims preview values pulled with CRLF", () => {
  assert.equal(
    getConfiguredUrl("https://frescari-staging-git-feature.vercel.app\r\n"),
    "https://frescari-staging-git-feature.vercel.app",
  );
});

test("getConfiguredUrl unwraps quoted preview values before normalizing", () => {
  assert.equal(
    getConfiguredUrl('"https://frescari-staging-git-feature.vercel.app"\r\n'),
    "https://frescari-staging-git-feature.vercel.app",
  );
});

test("getAppUrl falls back to the current Vercel deployment in production", () => {
  env.NODE_ENV = "production";
  env.VERCEL_URL = "frescari-staging-preview.vercel.app";

  assert.equal(getAppUrl(), "https://frescari-staging-preview.vercel.app");
});

test("getAppUrl falls back to localhost during local development", () => {
  env.NODE_ENV = "development";

  assert.equal(getAppUrl(), "http://localhost:3000");
});
