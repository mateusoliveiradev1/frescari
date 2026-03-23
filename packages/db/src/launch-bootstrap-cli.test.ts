import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLaunchBootstrapPlan,
  parseLaunchBootstrapCliArgs,
  parseLaunchBootstrapManifest,
} from "./launch-bootstrap-cli";

test("parseLaunchBootstrapCliArgs supports admin emails, dry-run and manifest path", () => {
  const args = parseLaunchBootstrapCliArgs([
    "--manifest",
    "docs/operations/catalog.json",
    "--admin-email",
    "root@frescari.com",
    "--admin-email=ops@frescari.com",
    "--dry-run",
  ]);

  assert.deepEqual(args, {
    adminEmails: ["root@frescari.com", "ops@frescari.com"],
    adminOnly: false,
    catalogOnly: false,
    dryRun: true,
    manifestPath: "docs/operations/catalog.json",
  });
});

test("parseLaunchBootstrapCliArgs requires a manifest unless admin-only mode is selected", () => {
  assert.throws(
    () => parseLaunchBootstrapCliArgs(["--admin-email", "root@frescari.com"]),
    /manifest/i,
  );

  const adminOnlyArgs = parseLaunchBootstrapCliArgs([
    "--admin-only",
    "--admin-email",
    "root@frescari.com",
  ]);

  assert.equal(adminOnlyArgs.adminOnly, true);
  assert.equal(adminOnlyArgs.manifestPath, null);
});

test("parseLaunchBootstrapManifest rejects duplicate categories and dangling product references", () => {
  assert.throws(
    () =>
      parseLaunchBootstrapManifest({
        categories: [
          { name: "Frutas", slug: "frutas" },
          { name: "Frutas importadas", slug: "frutas" },
        ],
        masterProducts: [],
      }),
    /duplicate category slug/i,
  );

  assert.throws(
    () =>
      parseLaunchBootstrapManifest({
        categories: [{ name: "Frutas", slug: "frutas" }],
        masterProducts: [
          {
            categorySlug: "folhas",
            name: "Alface Crespa",
            pricingType: "UNIT",
          },
        ],
      }),
    /unknown category slug/i,
  );
});

test("buildLaunchBootstrapPlan classifies admin, category and master product actions idempotently", () => {
  const manifest = parseLaunchBootstrapManifest({
    categories: [
      {
        name: "Frutas",
        seoDescription: "Linha mestra de frutas frescas.",
        slug: "frutas",
      },
      {
        name: "Folhas",
        seoDescription: "Verduras de alta rotatividade.",
        slug: "folhas",
      },
      {
        name: "Raizes",
        slug: "raizes",
      },
    ],
    masterProducts: [
      {
        categorySlug: "frutas",
        defaultImageUrl: "https://cdn.frescari.test/banana.png",
        name: "Banana Prata",
        pricingType: "UNIT",
      },
      {
        categorySlug: "folhas",
        name: "Alface Crespa",
        pricingType: "UNIT",
      },
      {
        categorySlug: "raizes",
        name: "Cenoura Extra",
        pricingType: "WEIGHT",
      },
    ],
  });

  const plan = buildLaunchBootstrapPlan({
    existingCategories: [
      {
        id: "cat-frutas",
        name: "Frutas frescas",
        seoDescription: "Descricao antiga",
        slug: "frutas",
      },
      {
        id: "cat-folhas",
        name: "Folhas",
        seoDescription: "Verduras de alta rotatividade.",
        slug: "folhas",
      },
    ],
    existingMasterProducts: [
      {
        category: "Frutas frescas",
        defaultImageUrl: null,
        id: "mp-banana",
        name: "Banana Prata",
        pricingType: "UNIT",
      },
      {
        category: "Folhas",
        defaultImageUrl: null,
        id: "mp-alface",
        name: "Alface Crespa",
        pricingType: "UNIT",
      },
    ],
    existingUsers: [
      { email: "root@frescari.com", id: "user-root", role: "buyer" },
      { email: "ops@frescari.com", id: "user-ops", role: "admin" },
    ],
    manifest,
    requestedAdminEmails: [
      "root@frescari.com",
      "ops@frescari.com",
      "missing@frescari.com",
    ],
  });

  assert.deepEqual(
    plan.adminActions.map((item) => ({
      action: item.action,
      email: item.email,
    })),
    [
      { action: "promote", email: "root@frescari.com" },
      { action: "noop", email: "ops@frescari.com" },
      { action: "missing", email: "missing@frescari.com" },
    ],
  );

  assert.deepEqual(
    plan.categoryActions.map((item) => ({
      action: item.action,
      slug: item.slug,
    })),
    [
      { action: "update", slug: "frutas" },
      { action: "noop", slug: "folhas" },
      { action: "create", slug: "raizes" },
    ],
  );

  assert.deepEqual(
    plan.masterProductActions.map((item) => ({
      action: item.action,
      name: item.name,
    })),
    [
      { action: "update", name: "Banana Prata" },
      { action: "noop", name: "Alface Crespa" },
      { action: "create", name: "Cenoura Extra" },
    ],
  );

  assert.deepEqual(plan.summary, {
    adminMissing: 1,
    adminNoop: 1,
    adminPromote: 1,
    categoriesCreate: 1,
    categoriesNoop: 1,
    categoriesUpdate: 1,
    masterProductsCreate: 1,
    masterProductsNoop: 1,
    masterProductsUpdate: 1,
  });
});

test("buildLaunchBootstrapPlan rejects duplicate master product names already present in the database slice", () => {
  const manifest = parseLaunchBootstrapManifest({
    categories: [{ name: "Frutas", slug: "frutas" }],
    masterProducts: [
      {
        categorySlug: "frutas",
        name: "Banana Prata",
        pricingType: "UNIT",
      },
    ],
  });

  assert.throws(
    () =>
      buildLaunchBootstrapPlan({
        existingCategories: [
          {
            id: "cat-frutas",
            name: "Frutas",
            seoDescription: null,
            slug: "frutas",
          },
        ],
        existingMasterProducts: [
          {
            category: "Frutas",
            defaultImageUrl: null,
            id: "mp-1",
            name: "Banana Prata",
            pricingType: "UNIT",
          },
          {
            category: "Frutas",
            defaultImageUrl: null,
            id: "mp-2",
            name: "Banana Prata",
            pricingType: "UNIT",
          },
        ],
        existingUsers: [],
        manifest,
        requestedAdminEmails: [],
      }),
    /duplicate existing master product/i,
  );
});
