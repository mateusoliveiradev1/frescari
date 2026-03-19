import { sanitizeText, slugifySegment } from "./catalog-seo";

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

export function buildSupplierRegionPath(stateSlug: string, citySlug: string): string {
  return `/catalogo/fornecedores/${stateSlug}/${citySlug}`;
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
        description: buildSupplierRegionDescription(cityName, stateName, regionLots),
        path: buildSupplierRegionPath(stateSlug, citySlug),
        farmCount: new Set(regionLots.map((lot) => lot.farmName)).size,
        productCount: new Set(regionLots.map((lot) => lot.productName)).size,
        lotCount: regionLots.length,
        lowestPrice: Math.min(...regionLots.map((lot) => lot.finalPrice)),
      } satisfies CatalogSupplierRegionSummary;
    })
    .filter((summary): summary is CatalogSupplierRegionSummary => summary !== null)
    .sort((left, right) => {
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
