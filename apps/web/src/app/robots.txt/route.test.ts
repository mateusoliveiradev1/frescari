import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Module from "node:module";

const originalModuleLoad = (
  Module as typeof Module & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  }
)._load;

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
    if (request === "@/lib/catalog-seo") {
      return {
        getSiteUrl: () => "https://frescari.com.br",
      };
    }

    if (request === "@/lib/catalog-public") {
      return {
        CATALOG_REVALIDATE_SECONDS: 3600,
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

test("robots.txt blocks internal areas and advertises the sitemap", async () => {
  const { GET } = await import("./route");

  const response = await GET();
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Disallow: \/api\//);
  assert.doesNotMatch(body, /Disallow: \/auth/);
  assert.doesNotMatch(body, /Disallow: \/admin/);
  assert.doesNotMatch(body, /Disallow: \/dashboard/);
  assert.doesNotMatch(body, /Disallow: \/onboarding/);
  assert.doesNotMatch(body, /Disallow: \/_next/);
  assert.match(body, /Sitemap: https:\/\/frescari\.com\.br\/sitemap\.xml/);
});
