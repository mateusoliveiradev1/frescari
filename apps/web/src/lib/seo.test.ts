import assert from "node:assert/strict";
import test from "node:test";

import { buildNoIndexMetadata, buildSeoMetadata, getHomeJsonLd } from "./seo";

test("buildSeoMetadata adds canonical, robots and social preview defaults", () => {
  const metadata = buildSeoMetadata({
    description: "Catalogo vivo de oferta local",
    path: "/catalogo",
    title: "Catalogo | Frescari",
  });
  const robots = metadata.robots;

  assert.equal(
    metadata.alternates?.canonical,
    "http://localhost:3000/catalogo",
  );
  assert.ok(robots && typeof robots !== "string");
  assert.equal(robots.index, true);
  assert.equal(robots.follow, true);
  assert.equal(metadata.openGraph?.url, "http://localhost:3000/catalogo");
  assert.ok(Array.isArray(metadata.openGraph?.images));
  assert.ok(metadata.twitter?.images);
});

test("buildNoIndexMetadata disables indexing and link following", () => {
  const metadata = buildNoIndexMetadata({
    description: "Area autenticada",
    path: "/auth/login",
    title: "Acesso | Frescari",
  });
  const robots = metadata.robots;

  assert.ok(robots && typeof robots !== "string");
  assert.equal(robots.index, false);
  assert.equal(robots.follow, false);
});

test("getHomeJsonLd returns organization and website entities", () => {
  const jsonLd = getHomeJsonLd();

  assert.equal(Array.isArray(jsonLd), true);
  assert.equal(jsonLd.length, 3);
});
