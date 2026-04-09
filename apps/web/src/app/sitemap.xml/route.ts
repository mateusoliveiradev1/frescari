import {
  CATALOG_REVALIDATE_SECONDS,
  getCategoryRegionStaticParams,
  getCategoryStaticParams,
  getProductRegionStaticParams,
  getProductStaticParams,
  getSupplierRegionStaticParams,
} from "@/lib/catalog-public";
import {
  buildCategoryRegionPath,
  buildProductRegionPath,
  buildSupplierRegionPath,
} from "@/lib/catalog-pseo";
import {
  buildCategoryPath,
  buildProductPath,
  getSiteUrl,
} from "@/lib/catalog-seo";
import {
  getLegalDocumentLastModifiedIso,
  legalDocumentLinks,
} from "@/lib/legal-documents";

export const revalidate = 3600;

type SitemapEntry = {
  lastmod?: string;
  url: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(): Promise<Response> {
  const siteUrl = getSiteUrl();
  const categories = await getCategoryStaticParams();
  const categoryRegions = await getCategoryRegionStaticParams();
  const productRegions = await getProductRegionStaticParams();
  const products = await getProductStaticParams();
  const supplierRegions = await getSupplierRegionStaticParams();

  const entryList: Array<readonly [string, SitemapEntry]> = [
    [`${siteUrl}/`, { url: `${siteUrl}/` }],
    [`${siteUrl}/catalogo`, { url: `${siteUrl}/catalogo` }],
    ...legalDocumentLinks.map(
      ({ slug }) =>
        [
          `${siteUrl}/${slug}`,
          {
            lastmod: getLegalDocumentLastModifiedIso(slug),
            url: `${siteUrl}/${slug}`,
          },
        ] as const,
    ),
    ...categories.map(
      ({ categoria }) =>
        [
          `${siteUrl}${buildCategoryPath(categoria)}`,
          { url: `${siteUrl}${buildCategoryPath(categoria)}` },
        ] as const,
    ),
    ...categoryRegions.map(
      ({ categoria, estado, cidade }) =>
        [
          `${siteUrl}${buildCategoryRegionPath(categoria, estado, cidade)}`,
          {
            url: `${siteUrl}${buildCategoryRegionPath(categoria, estado, cidade)}`,
          },
        ] as const,
    ),
    ...productRegions.map(
      ({ categoria, produto, estado, cidade }) =>
        [
          `${siteUrl}${buildProductRegionPath(categoria, produto, estado, cidade)}`,
          {
            url: `${siteUrl}${buildProductRegionPath(categoria, produto, estado, cidade)}`,
          },
        ] as const,
    ),
    ...products.map(
      ({ categoria, produto }) =>
        [
          `${siteUrl}${buildProductPath(categoria, produto)}`,
          { url: `${siteUrl}${buildProductPath(categoria, produto)}` },
        ] as const,
    ),
    ...supplierRegions.map(
      ({ estado, cidade }) =>
        [
          `${siteUrl}${buildSupplierRegionPath(estado, cidade)}`,
          { url: `${siteUrl}${buildSupplierRegionPath(estado, cidade)}` },
        ] as const,
    ),
  ];
  const entries = new Map<string, SitemapEntry>(entryList);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(entries.values())
  .sort((left, right) => left.url.localeCompare(right.url))
  .map(
    ({ url, lastmod }) => `  <url>
    <loc>${escapeXml(url)}</loc>
${lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : ""}  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${CATALOG_REVALIDATE_SECONDS}, stale-while-revalidate=${CATALOG_REVALIDATE_SECONDS}`,
    },
  });
}
