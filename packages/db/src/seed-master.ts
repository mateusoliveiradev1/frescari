import { config } from "dotenv";

// Load directly from the root project dir.
config({ path: "../../.env" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import { masterProducts } from "./schema";

const sql = neon(process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL!);
const db = drizzle(sql);
const SEEDED_PRODUCT_IMAGE_PATH = "/images/seed-produce-placeholder.svg";

const masterProductsData = [
  {
    name: "Tomate Carmem",
    category: "Hortalicas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Banana Prata",
    category: "Frutas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Cebola",
    category: "Hortalicas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Alface Crespa",
    category: "Folhas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Cenoura",
    category: "Hortalicas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Manga Palmer",
    category: "Frutas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Batata Lisa",
    category: "Hortalicas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Brocolis",
    category: "Hortalicas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Maca Tommy",
    category: "Frutas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
  {
    name: "Limao Tahiti",
    category: "Frutas",
    defaultImageUrl: SEEDED_PRODUCT_IMAGE_PATH,
  },
];

async function seedMasterProducts() {
  console.log("Seeding master products...");

  for (const product of masterProductsData) {
    const [existingMasterProduct] = await db
      .select({ id: masterProducts.id })
      .from(masterProducts)
      .where(eq(masterProducts.name, product.name))
      .limit(1);

    if (existingMasterProduct) {
      await db
        .update(masterProducts)
        .set({
          category: product.category,
          defaultImageUrl: product.defaultImageUrl,
        })
        .where(eq(masterProducts.id, existingMasterProduct.id));
      continue;
    }

    await sql`
      INSERT INTO "master_products" ("id", "name", "category", "default_image_url")
      VALUES (${crypto.randomUUID()}, ${product.name}, ${product.category}, ${product.defaultImageUrl})
      ON CONFLICT ("id") DO NOTHING;
    `;
  }

  console.log("Master products seeded.");
}

seedMasterProducts()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
