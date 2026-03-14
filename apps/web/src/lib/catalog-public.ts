import { cache } from "react";
import { formatCurrencyBRL } from "@frescari/ui";

import { getServerTrpc } from "@/trpc/server";

import {
  buildCategoryPath,
  buildProductPath,
  sanitizeText,
  slugifySegment,
} from "./catalog-seo";

export const CATALOG_REVALIDATE_SECONDS = 3600;

export type CatalogLotStatus = "fresco" | "last_chance" | "vencido";

export interface PublicCatalogLot {
  id: string;
  lotCode: string;
  farmId: string;
  harvestDate: string;
  expiryDate: string;
  availableQty: number;
  freshnessScore: number | null;
  productName: string;
  saleUnit: string;
  imageUrl: string | null;
  farmName: string;
  originalPrice: number;
  finalPrice: number;
  calculatedPrice: number;
  isLastChance: boolean;
  pricingType: "UNIT" | "WEIGHT" | "BOX";
  estimatedWeight: number | null;
  unit: string;
  status: CatalogLotStatus;
  categorySlug: string;
  categoryName: string;
  categoryDescription: string | null;
  productSlug: string;
  categoryPath: string;
  productPath: string;
}

export interface CatalogCategorySummary {
  slug: string;
  name: string;
  description: string;
  path: string;
  productCount: number;
  lotCount: number;
}

export interface CatalogProductSummary {
  slug: string;
  name: string;
  description: string;
  path: string;
  categorySlug: string;
  categoryName: string;
  imageUrl: string | null;
  saleUnit: string;
  lowestPrice: number;
  highestPrice: number;
  offerCount: number;
  farmNames: string[];
}

export interface CategoryPageData {
  category: CatalogCategorySummary;
  products: CatalogProductSummary[];
  lots: PublicCatalogLot[];
}

export interface ProductPageData {
  category: CatalogCategorySummary;
  product: CatalogProductSummary;
  lots: PublicCatalogLot[];
}

const getAllAvailableCatalogLots = cache(async (): Promise<PublicCatalogLot[]> => {
  const trpc = await getServerTrpc();
  const rows = await trpc.lot.getAvailableLots({});

  return rows
    .map((row) => {
      const categorySlug = row.categorySlug ?? "sem-categoria";
      const categoryName = row.categoryName ?? "Sem categoria";
      const categoryDescription = row.categoryDescription ?? null;
      const productSlug = slugifySegment(row.productName);
      const categoryPath = buildCategoryPath(categorySlug);
      const productPath = buildProductPath(categorySlug, productSlug);

      return {
        id: row.id,
        lotCode: row.lotCode,
        farmId: row.farmId,
        harvestDate: row.harvestDate,
        expiryDate: row.expiryDate,
        availableQty: row.availableQty,
        freshnessScore: row.freshnessScore,
        productName: row.productName,
        saleUnit: row.saleUnit,
        imageUrl: row.imageUrl,
        farmName: row.farmName,
        originalPrice: row.originalPrice,
        finalPrice: row.finalPrice,
        calculatedPrice: row.calculatedPrice,
        isLastChance: row.isLastChance,
        pricingType: row.pricingType,
        estimatedWeight: row.estimatedWeight,
        unit: row.unit,
        status: row.status,
        categorySlug,
        categoryName,
        categoryDescription,
        productSlug,
        categoryPath,
        productPath,
      } satisfies PublicCatalogLot;
    })
    .sort((left, right) => {
      if (left.categoryName !== right.categoryName) {
        return left.categoryName.localeCompare(right.categoryName, "pt-BR");
      }

      if (left.productName !== right.productName) {
        return left.productName.localeCompare(right.productName, "pt-BR");
      }

      return left.finalPrice - right.finalPrice;
    });
});

export async function getAvailableCatalogLots(): Promise<PublicCatalogLot[]> {
  return getAllAvailableCatalogLots();
}

export async function getCategoryStaticParams(): Promise<Array<{ categoria: string }>> {
  const categories = buildCategorySummaries(await getAllAvailableCatalogLots());
  return categories.map((category) => ({ categoria: category.slug }));
}

export async function getProductStaticParams(): Promise<Array<{ categoria: string; produto: string }>> {
  const products = buildProductSummaries(await getAllAvailableCatalogLots());
  return products.map((product) => ({
    categoria: product.categorySlug,
    produto: product.slug,
  }));
}

export async function getCategoryPageData(categorySlug: string): Promise<CategoryPageData | null> {
  const filteredLots = (await getAllAvailableCatalogLots()).filter(
    (lot) => lot.categorySlug === categorySlug,
  );

  if (filteredLots.length === 0) {
    return null;
  }

  const categories = buildCategorySummaries(filteredLots);
  const category = categories[0];

  if (!category) {
    return null;
  }

  return {
    category,
    products: buildProductSummaries(filteredLots),
    lots: filteredLots,
  };
}

export async function getProductPageData(
  categorySlug: string,
  productSlug: string,
): Promise<ProductPageData | null> {
  const filteredLots = (await getAllAvailableCatalogLots()).filter(
    (lot) => lot.categorySlug === categorySlug && lot.productSlug === productSlug,
  );

  if (filteredLots.length === 0) {
    return null;
  }

  const category = buildCategorySummaries(filteredLots)[0];
  const product = buildProductSummaries(filteredLots)[0];

  if (!category || !product) {
    return null;
  }

  return {
    category,
    product,
    lots: filteredLots,
  };
}

export function buildCategorySummaries(lots: PublicCatalogLot[]): CatalogCategorySummary[] {
  const categories = new Map<string, PublicCatalogLot[]>();

  for (const lot of lots) {
    const categoryLots = categories.get(lot.categorySlug) ?? [];
    categoryLots.push(lot);
    categories.set(lot.categorySlug, categoryLots);
  }

  return Array.from(categories.entries())
    .map(([slug, categoryLots]) => {
      const firstLot = categoryLots[0]!;

      return {
        slug,
        name: firstLot.categoryName,
        description: buildCategoryDescription(
          firstLot.categoryName,
          firstLot.categoryDescription,
          categoryLots,
        ),
        path: firstLot.categoryPath,
        productCount: new Set(categoryLots.map((entry) => entry.productSlug)).size,
        lotCount: categoryLots.length,
      } satisfies CatalogCategorySummary;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function buildProductSummaries(lots: PublicCatalogLot[]): CatalogProductSummary[] {
  const productsBySlug = new Map<string, PublicCatalogLot[]>();

  for (const lot of lots) {
    const key = `${lot.categorySlug}:${lot.productSlug}`;
    const productLots = productsBySlug.get(key) ?? [];
    productLots.push(lot);
    productsBySlug.set(key, productLots);
  }

  return Array.from(productsBySlug.entries())
    .map(([, productLots]) => {
      const firstLot = productLots[0]!;

      return {
        slug: firstLot.productSlug,
        name: firstLot.productName,
        description: buildProductDescription(
          firstLot.productName,
          firstLot.categoryName,
          productLots,
        ),
        path: firstLot.productPath,
        categorySlug: firstLot.categorySlug,
        categoryName: firstLot.categoryName,
        imageUrl: productLots.find((entry) => entry.imageUrl)?.imageUrl ?? null,
        saleUnit: firstLot.unit || firstLot.saleUnit,
        lowestPrice: Math.min(...productLots.map((entry) => entry.finalPrice)),
        highestPrice: Math.max(...productLots.map((entry) => entry.finalPrice)),
        offerCount: productLots.length,
        farmNames: Array.from(new Set(productLots.map((entry) => entry.farmName))),
      } satisfies CatalogProductSummary;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function buildCategoryDescription(
  categoryName: string,
  categoryDescription: string | null,
  lots: PublicCatalogLot[],
): string {
  const editorial = sanitizeText(categoryDescription, 120);

  if (editorial) {
    return editorial;
  }

  const producerCount = new Set(lots.map((lot) => lot.farmName)).size;

  return sanitizeText(
    `Compre ${categoryName.toLowerCase()} direto do produtor com ${lots.length} lotes ativos de ${producerCount} fazenda${producerCount === 1 ? "" : "s"} na Frescari.`,
    160,
  );
}

export function buildProductDescription(
  productName: string,
  categoryName: string,
  lots: PublicCatalogLot[],
): string {
  const lowestPrice = Math.min(...lots.map((lot) => lot.finalPrice));
  const farmsCount = new Set(lots.map((lot) => lot.farmName)).size;
  const unit = lots[0]?.unit || lots[0]?.saleUnit || "un";

  return sanitizeText(
    `${productName} na categoria ${categoryName} com ${lots.length} oferta${lots.length === 1 ? "" : "s"} ativa${lots.length === 1 ? "" : "s"} a partir de ${formatCurrencyBRL(lowestPrice)}/${unit} em ${farmsCount} produtor${farmsCount === 1 ? "" : "es"} da Frescari.`,
    160,
  );
}

export function getSchemaUnitCode(saleUnit: string): string {
  const unitMap: Record<string, string> = {
    kg: "KGM",
    g: "GRM",
    unit: "EA",
    un: "EA",
    box: "XBX",
    cx: "XBX",
    dozen: "DZN",
    dz: "DZN",
    bunch: "BH",
    maco: "BH",
  };

  return unitMap[saleUnit] ?? "EA";
}
