import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import {
  adminConnectionString,
  masterProducts,
  productCategories,
  users,
} from "./index";

config({ path: "../../.env" });

type PricingType = "BOX" | "UNIT" | "WEIGHT";

export type LaunchBootstrapCliArgs = {
  adminEmails: string[];
  adminOnly: boolean;
  catalogOnly: boolean;
  dryRun: boolean;
  manifestPath: string | null;
};

export type LaunchBootstrapCategory = {
  name: string;
  seoDescription: string | null;
  slug: string;
};

export type LaunchBootstrapMasterProduct = {
  categorySlug: string;
  defaultImageUrl: string | null;
  name: string;
  pricingType: PricingType;
};

export type LaunchBootstrapManifest = {
  categories: LaunchBootstrapCategory[];
  masterProducts: LaunchBootstrapMasterProduct[];
};

type LaunchBootstrapUserRecord = {
  email: string;
  id: string;
  role: string;
};

type LaunchBootstrapCategoryRecord = {
  id: string;
  name: string;
  seoDescription: string | null;
  slug: string;
};

type LaunchBootstrapMasterProductRecord = {
  category: string;
  defaultImageUrl: string | null;
  id: string;
  name: string;
  pricingType: string;
};

type LaunchBootstrapAdminAction = {
  action: "missing" | "noop" | "promote";
  email: string;
  userId: string | null;
};

type LaunchBootstrapCategoryAction = {
  action: "create" | "noop" | "update";
  desired: LaunchBootstrapCategory;
  id: string | null;
  slug: string;
};

type LaunchBootstrapMasterProductAction = {
  action: "create" | "noop" | "update";
  desired: {
    category: string;
    defaultImageUrl: string | null;
    name: string;
    pricingType: PricingType;
  };
  id: string | null;
  name: string;
};

export type LaunchBootstrapPlan = {
  adminActions: LaunchBootstrapAdminAction[];
  categoryActions: LaunchBootstrapCategoryAction[];
  masterProductActions: LaunchBootstrapMasterProductAction[];
  summary: {
    adminMissing: number;
    adminNoop: number;
    adminPromote: number;
    categoriesCreate: number;
    categoriesNoop: number;
    categoriesUpdate: number;
    masterProductsCreate: number;
    masterProductsNoop: number;
    masterProductsUpdate: number;
  };
};

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmed;
}

function readArgValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function assertArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value;
}

function assertUrlOrNull(value: unknown, fieldName: string) {
  const normalized = normalizeText(
    typeof value === "string" ? value : value == null ? null : undefined,
  );

  if (!normalized) {
    return null;
  }

  try {
    new URL(normalized);
    return normalized;
  } catch {
    throw new Error(`${fieldName} must be a valid URL.`);
  }
}

function printHelp() {
  console.info(`Usage: pnpm --filter @frescari/db launch:bootstrap -- [options]

Options:
  --manifest <path>      JSON manifest with categories and master products.
  --admin-email <email>  Promote an existing user to root admin. Repeatable.
  --admin-only           Run only the admin promotion slice.
  --catalog-only         Run only the catalog bootstrap slice.
  --dry-run              Print the plan without writing to the database.
  --help                 Show this help message.
`);
}

export function parseLaunchBootstrapCliArgs(
  argv = process.argv.slice(2),
): LaunchBootstrapCliArgs {
  const adminEmails: string[] = [];
  let adminOnly = false;
  let catalogOnly = false;
  let dryRun = false;
  let manifestPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      continue;
    }

    if (arg === "--admin-only") {
      adminOnly = true;
      continue;
    }

    if (arg === "--catalog-only") {
      catalogOnly = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--manifest") {
      manifestPath = readArgValue(argv, index, "--manifest");
      index += 1;
      continue;
    }

    if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length);
      continue;
    }

    if (arg === "--admin-email") {
      adminEmails.push(readArgValue(argv, index, "--admin-email"));
      index += 1;
      continue;
    }

    if (arg.startsWith("--admin-email=")) {
      adminEmails.push(arg.slice("--admin-email=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (adminOnly && catalogOnly) {
    throw new Error("Choose either --admin-only or --catalog-only, not both.");
  }

  if (!adminOnly && !manifestPath) {
    throw new Error(
      "A manifest is required unless --admin-only is explicitly selected.",
    );
  }

  if (adminOnly && adminEmails.length === 0) {
    throw new Error("Provide at least one --admin-email in --admin-only mode.");
  }

  if (!manifestPath && adminEmails.length === 0) {
    throw new Error("No bootstrap work was requested.");
  }

  return {
    adminEmails,
    adminOnly,
    catalogOnly,
    dryRun,
    manifestPath,
  };
}

export function parseLaunchBootstrapManifest(
  raw: unknown,
): LaunchBootstrapManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Manifest must be a JSON object.");
  }

  const record = raw as Record<string, unknown>;
  const rawCategories = assertArray(record.categories, "categories");
  const rawMasterProducts = assertArray(
    record.masterProducts,
    "masterProducts",
  );

  const categories = rawCategories.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`categories[${index}] must be an object.`);
    }

    const category = item as Record<string, unknown>;
    const slug = normalizeRequiredText(
      category.slug,
      `categories[${index}].slug`,
    ).toLowerCase();

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error(
        `categories[${index}].slug must use only lowercase letters, numbers and hyphens.`,
      );
    }

    return {
      name: normalizeRequiredText(category.name, `categories[${index}].name`),
      seoDescription: normalizeText(
        typeof category.seoDescription === "string"
          ? category.seoDescription
          : null,
      ),
      slug,
    };
  });

  const categorySlugSet = new Set<string>();

  for (const category of categories) {
    if (categorySlugSet.has(category.slug)) {
      throw new Error(`Duplicate category slug: ${category.slug}.`);
    }

    categorySlugSet.add(category.slug);
  }

  const masterProductsManifest = rawMasterProducts.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`masterProducts[${index}] must be an object.`);
    }

    const masterProduct = item as Record<string, unknown>;
    const categorySlug = normalizeRequiredText(
      masterProduct.categorySlug,
      `masterProducts[${index}].categorySlug`,
    ).toLowerCase();

    if (!categorySlugSet.has(categorySlug)) {
      throw new Error(
        `Unknown category slug "${categorySlug}" referenced by master product.`,
      );
    }

    const pricingType = normalizeRequiredText(
      masterProduct.pricingType,
      `masterProducts[${index}].pricingType`,
    ).toUpperCase();

    if (
      pricingType !== "BOX" &&
      pricingType !== "UNIT" &&
      pricingType !== "WEIGHT"
    ) {
      throw new Error(
        `masterProducts[${index}].pricingType must be BOX, UNIT or WEIGHT.`,
      );
    }

    return {
      categorySlug,
      defaultImageUrl: assertUrlOrNull(
        masterProduct.defaultImageUrl,
        `masterProducts[${index}].defaultImageUrl`,
      ),
      name: normalizeRequiredText(
        masterProduct.name,
        `masterProducts[${index}].name`,
      ),
      pricingType,
    } as LaunchBootstrapMasterProduct;
  });

  const masterProductNameSet = new Set<string>();

  for (const masterProduct of masterProductsManifest) {
    if (masterProductNameSet.has(masterProduct.name)) {
      throw new Error(`Duplicate master product name: ${masterProduct.name}.`);
    }

    masterProductNameSet.add(masterProduct.name);
  }

  return {
    categories,
    masterProducts: masterProductsManifest,
  };
}

export function buildLaunchBootstrapPlan(args: {
  existingCategories: LaunchBootstrapCategoryRecord[];
  existingMasterProducts: LaunchBootstrapMasterProductRecord[];
  existingUsers: LaunchBootstrapUserRecord[];
  manifest: LaunchBootstrapManifest;
  requestedAdminEmails: string[];
}): LaunchBootstrapPlan {
  const existingUsersByEmail = new Map(
    args.existingUsers.map((user) => [user.email, user]),
  );
  const existingCategoriesBySlug = new Map(
    args.existingCategories.map((category) => [category.slug, category]),
  );
  const existingMasterProductsByName = new Map<
    string,
    LaunchBootstrapMasterProductRecord
  >();

  for (const product of args.existingMasterProducts) {
    if (existingMasterProductsByName.has(product.name)) {
      throw new Error(
        `Duplicate existing master product detected for "${product.name}".`,
      );
    }

    existingMasterProductsByName.set(product.name, product);
  }

  const adminActions = args.requestedAdminEmails.map((email) => {
    const user = existingUsersByEmail.get(email);

    if (!user) {
      return {
        action: "missing",
        email,
        userId: null,
      } satisfies LaunchBootstrapAdminAction;
    }

    return {
      action: user.role === "admin" ? "noop" : "promote",
      email,
      userId: user.id,
    } satisfies LaunchBootstrapAdminAction;
  });

  const categoryActions = args.manifest.categories.map((category) => {
    const existing = existingCategoriesBySlug.get(category.slug);

    if (!existing) {
      return {
        action: "create",
        desired: category,
        id: null,
        slug: category.slug,
      } satisfies LaunchBootstrapCategoryAction;
    }

    const shouldUpdate =
      existing.name !== category.name ||
      normalizeText(existing.seoDescription) !==
        normalizeText(category.seoDescription);

    return {
      action: shouldUpdate ? "update" : "noop",
      desired: category,
      id: existing.id,
      slug: category.slug,
    } satisfies LaunchBootstrapCategoryAction;
  });

  const categoryNamesBySlug = new Map(
    args.manifest.categories.map((category) => [category.slug, category.name]),
  );

  const masterProductActions = args.manifest.masterProducts.map((product) => {
    const categoryName = categoryNamesBySlug.get(product.categorySlug);

    if (!categoryName) {
      throw new Error(
        `Missing category mapping for master product "${product.name}".`,
      );
    }

    const desired = {
      category: categoryName,
      defaultImageUrl: product.defaultImageUrl,
      name: product.name,
      pricingType: product.pricingType,
    };
    const existing = existingMasterProductsByName.get(product.name);

    if (!existing) {
      return {
        action: "create",
        desired,
        id: null,
        name: product.name,
      } satisfies LaunchBootstrapMasterProductAction;
    }

    const shouldUpdate =
      existing.category !== desired.category ||
      normalizeText(existing.defaultImageUrl) !==
        normalizeText(desired.defaultImageUrl) ||
      existing.pricingType !== desired.pricingType;

    return {
      action: shouldUpdate ? "update" : "noop",
      desired,
      id: existing.id,
      name: product.name,
    } satisfies LaunchBootstrapMasterProductAction;
  });

  return {
    adminActions,
    categoryActions,
    masterProductActions,
    summary: {
      adminMissing: adminActions.filter((item) => item.action === "missing")
        .length,
      adminNoop: adminActions.filter((item) => item.action === "noop").length,
      adminPromote: adminActions.filter((item) => item.action === "promote")
        .length,
      categoriesCreate: categoryActions.filter(
        (item) => item.action === "create",
      ).length,
      categoriesNoop: categoryActions.filter((item) => item.action === "noop")
        .length,
      categoriesUpdate: categoryActions.filter(
        (item) => item.action === "update",
      ).length,
      masterProductsCreate: masterProductActions.filter(
        (item) => item.action === "create",
      ).length,
      masterProductsNoop: masterProductActions.filter(
        (item) => item.action === "noop",
      ).length,
      masterProductsUpdate: masterProductActions.filter(
        (item) => item.action === "update",
      ).length,
    },
  };
}

export async function loadLaunchBootstrapManifest(manifestPath: string) {
  const manifestText = await readFile(manifestPath, "utf8");
  return parseLaunchBootstrapManifest(JSON.parse(manifestText));
}

function formatPlanSummary(plan: LaunchBootstrapPlan) {
  return {
    admin: {
      missing: plan.summary.adminMissing,
      noop: plan.summary.adminNoop,
      promote: plan.summary.adminPromote,
    },
    categories: {
      create: plan.summary.categoriesCreate,
      noop: plan.summary.categoriesNoop,
      update: plan.summary.categoriesUpdate,
    },
    masterProducts: {
      create: plan.summary.masterProductsCreate,
      noop: plan.summary.masterProductsNoop,
      update: plan.summary.masterProductsUpdate,
    },
  };
}

export async function runLaunchBootstrapCli(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const args = parseLaunchBootstrapCliArgs(argv);
  const manifest =
    args.adminOnly || !args.manifestPath
      ? { categories: [], masterProducts: [] }
      : await loadLaunchBootstrapManifest(args.manifestPath);
  const queryClient = neon(adminConnectionString);
  const database = drizzle(queryClient);
  const requestedAdminEmails = args.catalogOnly ? [] : args.adminEmails;
  const categorySlugs = args.adminOnly
    ? []
    : manifest.categories.map((category) => category.slug);
  const masterProductNames = args.adminOnly
    ? []
    : manifest.masterProducts.map((product) => product.name);

  const [existingUsers, existingCategories, existingMasterProducts] =
    await Promise.all([
      requestedAdminEmails.length > 0
        ? database
            .select({
              email: users.email,
              id: users.id,
              role: users.role,
            })
            .from(users)
            .where(inArray(users.email, requestedAdminEmails))
        : Promise.resolve([]),
      categorySlugs.length > 0
        ? database
            .select({
              id: productCategories.id,
              name: productCategories.name,
              seoDescription: productCategories.seoDescription,
              slug: productCategories.slug,
            })
            .from(productCategories)
            .where(inArray(productCategories.slug, categorySlugs))
        : Promise.resolve([]),
      masterProductNames.length > 0
        ? database
            .select({
              category: masterProducts.category,
              defaultImageUrl: masterProducts.defaultImageUrl,
              id: masterProducts.id,
              name: masterProducts.name,
              pricingType: masterProducts.pricingType,
            })
            .from(masterProducts)
            .where(inArray(masterProducts.name, masterProductNames))
        : Promise.resolve([]),
    ]);

  const plan = buildLaunchBootstrapPlan({
    existingCategories,
    existingMasterProducts,
    existingUsers,
    manifest,
    requestedAdminEmails,
  });

  console.info("[launch-bootstrap] plan summary:");
  console.info(JSON.stringify(formatPlanSummary(plan), null, 2));

  if (plan.summary.adminMissing > 0) {
    const missingEmails = plan.adminActions
      .filter((item) => item.action === "missing")
      .map((item) => item.email);

    throw new Error(
      `Missing admin users: ${missingEmails.join(", ")}. Create and verify these accounts before promotion.`,
    );
  }

  if (args.dryRun) {
    console.info(
      "[launch-bootstrap] dry-run enabled. No database writes were performed.",
    );
    return;
  }

  await database.transaction(async (tx) => {
    for (const adminAction of plan.adminActions) {
      if (adminAction.action !== "promote" || !adminAction.userId) {
        continue;
      }

      await tx
        .update(users)
        .set({ role: "admin" })
        .where(inArray(users.id, [adminAction.userId]));
    }

    for (const categoryAction of plan.categoryActions) {
      if (categoryAction.action === "create") {
        await tx.insert(productCategories).values({
          name: categoryAction.desired.name,
          seoDescription: categoryAction.desired.seoDescription,
          slug: categoryAction.desired.slug,
        });
        continue;
      }

      if (categoryAction.action === "update" && categoryAction.id) {
        await tx
          .update(productCategories)
          .set({
            name: categoryAction.desired.name,
            seoDescription: categoryAction.desired.seoDescription,
          })
          .where(inArray(productCategories.id, [categoryAction.id]));
      }
    }

    for (const masterProductAction of plan.masterProductActions) {
      if (masterProductAction.action === "create") {
        await tx.insert(masterProducts).values(masterProductAction.desired);
        continue;
      }

      if (masterProductAction.action === "update" && masterProductAction.id) {
        await tx
          .update(masterProducts)
          .set(masterProductAction.desired)
          .where(inArray(masterProducts.id, [masterProductAction.id]));
      }
    }
  });

  console.info("[launch-bootstrap] bootstrap completed.");
}

export function isLaunchBootstrapCliEntryPoint(
  metaUrl = import.meta.url,
  argv = process.argv,
) {
  const entryPoint = argv[1];

  if (!entryPoint) {
    return false;
  }

  try {
    return resolve(fileURLToPath(metaUrl)) === resolve(entryPoint);
  } catch {
    return false;
  }
}

if (isLaunchBootstrapCliEntryPoint()) {
  runLaunchBootstrapCli().catch((error) => {
    console.error("[launch-bootstrap] failed:", error);
    process.exit(1);
  });
}
