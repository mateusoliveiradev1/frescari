import {
  buildCategoryPath,
  buildProductPath,
  sanitizeText,
  slugifySegment,
} from "./catalog-seo";

type SupplierRegionLot = {
  farmName: string;
  productName: string;
  categoryName: string;
  finalPrice: number;
  farmCity: string | null;
  farmState: string | null;
};

type OfferAreaServedInput = {
  farmCity: string | null;
  farmState: string | null;
  farmLatitude: number | null;
  farmLongitude: number | null;
  deliveryRadiusKm: number | null;
};

export type CatalogSupplierRegionSummary = {
  stateSlug: string;
  citySlug: string;
  stateName: string;
  cityName: string;
  name: string;
  description: string;
  path: string;
  farmCount: number;
  productCount: number;
  lotCount: number;
  lowestPrice: number;
};

type CategoryRegionLot = SupplierRegionLot & {
  categorySlug: string;
};

export type CatalogCategoryRegionSummary = {
  categorySlug: string;
  categoryName: string;
  categoryPath: string;
  stateSlug: string;
  citySlug: string;
  stateName: string;
  cityName: string;
  regionName: string;
  name: string;
  description: string;
  path: string;
  farmCount: number;
  productCount: number;
  lotCount: number;
  lowestPrice: number;
};

type ProductRegionLot = CategoryRegionLot & {
  productSlug: string;
  saleUnit: string;
  imageUrl?: string | null;
};

export type CatalogProductRegionSummary = {
  categorySlug: string;
  categoryName: string;
  productSlug: string;
  productName: string;
  productPath: string;
  stateSlug: string;
  citySlug: string;
  stateName: string;
  cityName: string;
  regionName: string;
  name: string;
  description: string;
  path: string;
  imageUrl: string | null;
  saleUnit: string;
  farmCount: number;
  lotCount: number;
  lowestPrice: number;
  highestPrice: number;
  offerCount: number;
  farmNames: string[];
};

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function normalizeCityName(value: string | null): string {
  return sanitizeText(value).trim();
}

function normalizeStateName(value: string | null): string {
  return sanitizeText(value).trim().toUpperCase();
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildSupplierRegionPath(
  stateSlug: string,
  citySlug: string,
): string {
  return `/catalogo/fornecedores/${stateSlug}/${citySlug}`;
}

export function buildCategoryRegionPath(
  categorySlug: string,
  stateSlug: string,
  citySlug: string,
): string {
  return `${buildCategoryPath(categorySlug)}/em/${stateSlug}/${citySlug}`;
}

export function buildProductRegionPath(
  categorySlug: string,
  productSlug: string,
  stateSlug: string,
  citySlug: string,
): string {
  return `${buildProductPath(categorySlug, productSlug)}/em/${stateSlug}/${citySlug}`;
}

export function buildSupplierRegionDescription(
  cityName: string,
  stateName: string,
  lots: SupplierRegionLot[],
): string {
  const farmCount = new Set(lots.map((lot) => lot.farmName)).size;
  const productCount = new Set(lots.map((lot) => lot.productName)).size;
  const lowestPrice = Math.min(...lots.map((lot) => lot.finalPrice));

  return sanitizeText(
    `Oferta Frescari em ${cityName}, ${stateName} com ${lots.length} lotes ativos, ${farmCount} produtores e ${productCount} produtos a partir de ${brlFormatter.format(lowestPrice)}.`,
    160,
  );
}

export function buildCategoryRegionDescription(
  categoryName: string,
  cityName: string,
  stateName: string,
  lots: CategoryRegionLot[],
): string {
  const farmCount = new Set(lots.map((lot) => lot.farmName)).size;
  const productCount = new Set(lots.map((lot) => lot.productName)).size;
  const lowestPrice = Math.min(...lots.map((lot) => lot.finalPrice));

  return sanitizeText(
    `Compre ${categoryName.toLowerCase()} em ${cityName}, ${stateName} com ${lots.length} lotes ativos, ${farmCount} produtores e ${productCount} produtos publicados na Frescari a partir de ${brlFormatter.format(lowestPrice)}.`,
    160,
  );
}

export function buildProductRegionDescription(
  productName: string,
  cityName: string,
  stateName: string,
  lots: ProductRegionLot[],
): string {
  const farmCount = new Set(lots.map((lot) => lot.farmName)).size;
  const lowestPrice = Math.min(...lots.map((lot) => lot.finalPrice));
  const saleUnit = lots[0]?.saleUnit ?? "un";

  return sanitizeText(
    `${productName} em ${cityName}, ${stateName} com ${lots.length} ofertas ativas em ${farmCount} produtores na Frescari a partir de ${brlFormatter.format(lowestPrice)}/${saleUnit}.`,
    160,
  );
}

export function isIndexableCategoryRegion(
  input: Pick<
    CatalogCategoryRegionSummary,
    "farmCount" | "productCount" | "lotCount"
  >,
): boolean {
  return (
    input.lotCount >= 2 && (input.farmCount >= 2 || input.productCount >= 2)
  );
}

export function isIndexableProductRegion(
  input: Pick<CatalogProductRegionSummary, "farmCount" | "lotCount">,
): boolean {
  return input.lotCount >= 2 && input.farmCount >= 2;
}

export function buildSupplierRegionSummaries<T extends SupplierRegionLot>(
  lots: T[],
): CatalogSupplierRegionSummary[] {
  const regions = new Map<string, T[]>();

  for (const lot of lots) {
    const cityName = normalizeCityName(lot.farmCity);
    const stateName = normalizeStateName(lot.farmState);

    if (!cityName || !stateName) {
      continue;
    }

    const stateSlug = slugifySegment(stateName);
    const citySlug = slugifySegment(cityName);
    const key = `${stateSlug}:${citySlug}`;
    const regionLots = regions.get(key) ?? [];

    regionLots.push(lot);
    regions.set(key, regionLots);
  }

  return Array.from(regions.entries())
    .map(([key, regionLots]) => {
      const [stateSlug, citySlug] = key.split(":");
      const firstLot = regionLots[0];

      if (!stateSlug || !citySlug || !firstLot) {
        return null;
      }

      const cityName = normalizeCityName(firstLot.farmCity);
      const stateName = normalizeStateName(firstLot.farmState);

      return {
        stateSlug,
        citySlug,
        stateName,
        cityName,
        name: `${cityName}, ${stateName}`,
        description: buildSupplierRegionDescription(
          cityName,
          stateName,
          regionLots,
        ),
        path: buildSupplierRegionPath(stateSlug, citySlug),
        farmCount: new Set(regionLots.map((lot) => lot.farmName)).size,
        productCount: new Set(regionLots.map((lot) => lot.productName)).size,
        lotCount: regionLots.length,
        lowestPrice: Math.min(...regionLots.map((lot) => lot.finalPrice)),
      } satisfies CatalogSupplierRegionSummary;
    })
    .filter(
      (summary): summary is CatalogSupplierRegionSummary => summary !== null,
    )
    .sort((left, right) => {
      if (left.stateName !== right.stateName) {
        return left.stateName.localeCompare(right.stateName, "pt-BR");
      }

      return left.cityName.localeCompare(right.cityName, "pt-BR");
    });
}

export function buildCategoryRegionSummaries<T extends CategoryRegionLot>(
  lots: T[],
): CatalogCategoryRegionSummary[] {
  const regions = new Map<string, T[]>();

  for (const lot of lots) {
    const cityName = normalizeCityName(lot.farmCity);
    const stateName = normalizeStateName(lot.farmState);

    if (!cityName || !stateName) {
      continue;
    }

    const stateSlug = slugifySegment(stateName);
    const citySlug = slugifySegment(cityName);
    const key = `${lot.categorySlug}:${stateSlug}:${citySlug}`;
    const regionLots = regions.get(key) ?? [];

    regionLots.push(lot);
    regions.set(key, regionLots);
  }

  return Array.from(regions.entries())
    .map(([key, regionLots]) => {
      const [categorySlug, stateSlug, citySlug] = key.split(":");
      const firstLot = regionLots[0];

      if (!categorySlug || !stateSlug || !citySlug || !firstLot) {
        return null;
      }

      const cityName = normalizeCityName(firstLot.farmCity);
      const stateName = normalizeStateName(firstLot.farmState);
      const farmCount = new Set(regionLots.map((lot) => lot.farmName)).size;
      const productCount = new Set(regionLots.map((lot) => lot.productName))
        .size;
      const summary = {
        categorySlug,
        categoryName: firstLot.categoryName,
        categoryPath: buildCategoryPath(categorySlug),
        stateSlug,
        citySlug,
        stateName,
        cityName,
        regionName: `${cityName}, ${stateName}`,
        name: `${firstLot.categoryName} em ${cityName}, ${stateName}`,
        description: buildCategoryRegionDescription(
          firstLot.categoryName,
          cityName,
          stateName,
          regionLots,
        ),
        path: buildCategoryRegionPath(categorySlug, stateSlug, citySlug),
        farmCount,
        productCount,
        lotCount: regionLots.length,
        lowestPrice: Math.min(...regionLots.map((lot) => lot.finalPrice)),
      } satisfies CatalogCategoryRegionSummary;

      return isIndexableCategoryRegion(summary) ? summary : null;
    })
    .filter(
      (summary): summary is CatalogCategoryRegionSummary => summary !== null,
    )
    .sort((left, right) => {
      if (left.categoryName !== right.categoryName) {
        return left.categoryName.localeCompare(right.categoryName, "pt-BR");
      }

      if (left.lotCount !== right.lotCount) {
        return right.lotCount - left.lotCount;
      }

      if (left.stateName !== right.stateName) {
        return left.stateName.localeCompare(right.stateName, "pt-BR");
      }

      return left.cityName.localeCompare(right.cityName, "pt-BR");
    });
}

export function buildProductRegionSummaries<T extends ProductRegionLot>(
  lots: T[],
): CatalogProductRegionSummary[] {
  const regions = new Map<string, T[]>();

  for (const lot of lots) {
    const cityName = normalizeCityName(lot.farmCity);
    const stateName = normalizeStateName(lot.farmState);

    if (!cityName || !stateName) {
      continue;
    }

    const stateSlug = slugifySegment(stateName);
    const citySlug = slugifySegment(cityName);
    const key = `${lot.categorySlug}:${lot.productSlug}:${stateSlug}:${citySlug}`;
    const regionLots = regions.get(key) ?? [];

    regionLots.push(lot);
    regions.set(key, regionLots);
  }

  return Array.from(regions.entries())
    .map(([key, regionLots]) => {
      const [categorySlug, productSlug, stateSlug, citySlug] = key.split(":");
      const firstLot = regionLots[0];

      if (
        !categorySlug ||
        !productSlug ||
        !stateSlug ||
        !citySlug ||
        !firstLot
      ) {
        return null;
      }

      const cityName = normalizeCityName(firstLot.farmCity);
      const stateName = normalizeStateName(firstLot.farmState);
      const farmNames = Array.from(
        new Set(regionLots.map((lot) => lot.farmName)),
      );
      const summary = {
        categorySlug,
        categoryName: firstLot.categoryName,
        productSlug,
        productName: firstLot.productName,
        productPath: buildProductPath(categorySlug, productSlug),
        stateSlug,
        citySlug,
        stateName,
        cityName,
        regionName: `${cityName}, ${stateName}`,
        name: `${firstLot.productName} em ${cityName}, ${stateName}`,
        description: buildProductRegionDescription(
          firstLot.productName,
          cityName,
          stateName,
          regionLots,
        ),
        path: buildProductRegionPath(
          categorySlug,
          productSlug,
          stateSlug,
          citySlug,
        ),
        imageUrl: regionLots.find((lot) => lot.imageUrl)?.imageUrl ?? null,
        saleUnit: firstLot.saleUnit,
        farmCount: farmNames.length,
        lotCount: regionLots.length,
        lowestPrice: Math.min(...regionLots.map((lot) => lot.finalPrice)),
        highestPrice: Math.max(...regionLots.map((lot) => lot.finalPrice)),
        offerCount: regionLots.length,
        farmNames,
      } satisfies CatalogProductRegionSummary;

      return isIndexableProductRegion(summary) ? summary : null;
    })
    .filter(
      (summary): summary is CatalogProductRegionSummary => summary !== null,
    )
    .sort((left, right) => {
      if (left.productName !== right.productName) {
        return left.productName.localeCompare(right.productName, "pt-BR");
      }

      if (left.offerCount !== right.offerCount) {
        return right.offerCount - left.offerCount;
      }

      if (left.stateName !== right.stateName) {
        return left.stateName.localeCompare(right.stateName, "pt-BR");
      }

      return left.cityName.localeCompare(right.cityName, "pt-BR");
    });
}

export function buildOfferAreaServed(input: OfferAreaServedInput) {
  if (
    isFiniteNumber(input.farmLatitude) &&
    isFiniteNumber(input.farmLongitude) &&
    isFiniteNumber(input.deliveryRadiusKm) &&
    input.deliveryRadiusKm > 0
  ) {
    return {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: input.farmLatitude,
        longitude: input.farmLongitude,
      },
      geoRadius: input.deliveryRadiusKm * 1000,
    };
  }

  const cityName = normalizeCityName(input.farmCity);
  const stateName = normalizeStateName(input.farmState);

  if (cityName && stateName) {
    return {
      "@type": "AdministrativeArea",
      name: `${cityName}, ${stateName}`,
    };
  }

  return undefined;
}
