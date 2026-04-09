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
    if (request === "@/lib/catalog-public") {
      return {
        CATALOG_REVALIDATE_SECONDS: 3600,
        getCategoryStaticParams: async () => [{ categoria: "frutas" }],
        getProductStaticParams: async () => [
          { categoria: "frutas", produto: "morango-organico" },
        ],
        getSupplierRegionStaticParams: async () => [
          { estado: "sp", cidade: "campinas" },
        ],
      };
    }

    if (request === "@/lib/catalog-seo") {
      return {
        getSiteUrl: () => "https://frescari.com.br",
        buildCategoryPath: (categoria: string) => `/catalogo/${categoria}`,
        buildProductPath: (categoria: string, produto: string) =>
          `/catalogo/${categoria}/${produto}`,
      };
    }

    if (request === "@/lib/catalog-pseo") {
      return {
        buildSupplierRegionPath: (estado: string, cidade: string) =>
          `/catalogo/regioes/${estado}/${cidade}`,
      };
    }

    if (request === "@/lib/legal-documents") {
      return {
        getLegalDocumentLastModifiedIso: () => "2026-04-08",
        legalDocumentLinks: [
          { slug: "termos" },
          { slug: "privacidade" },
          { slug: "cookies" },
        ],
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

test("sitemap.xml includes the catalog surface and legal pages", async () => {
  const { GET } = await import("./route");

  const response = await GET();
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /<loc>https:\/\/frescari\.com\.br\/<\/loc>/);
  assert.match(body, /<loc>https:\/\/frescari\.com\.br\/catalogo<\/loc>/);
  assert.match(body, /<loc>https:\/\/frescari\.com\.br\/termos<\/loc>/);
  assert.match(body, /<loc>https:\/\/frescari\.com\.br\/privacidade<\/loc>/);
  assert.match(body, /<loc>https:\/\/frescari\.com\.br\/cookies<\/loc>/);
  assert.match(
    body,
    /<loc>https:\/\/frescari\.com\.br\/catalogo\/frutas<\/loc>/,
  );
  assert.match(
    body,
    /<loc>https:\/\/frescari\.com\.br\/catalogo\/frutas\/morango-organico<\/loc>/,
  );
  assert.match(
    body,
    /<loc>https:\/\/frescari\.com\.br\/catalogo\/regioes\/sp\/campinas<\/loc>/,
  );
  assert.match(body, /<lastmod>2026-04-08<\/lastmod>/);
  assert.doesNotMatch(body, /<changefreq>/);
  assert.doesNotMatch(body, /<priority>/);
});
