import {
  CATALOG_REVALIDATE_SECONDS,
  getCategoryStaticParams,
  getProductStaticParams,
  getSupplierRegionStaticParams,
} from "@/lib/catalog-public";
import { buildSupplierRegionPath } from "@/lib/catalog-pseo";
import { buildCategoryPath, buildProductPath, getSiteUrl } from "@/lib/catalog-seo";

export const revalidate = 3600;

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
  const now = new Date().toISOString();
  const categories = await getCategoryStaticParams();
  const products = await getProductStaticParams();
  const supplierRegions = await getSupplierRegionStaticParams();

  const urls = new Set<string>([
    `${siteUrl}/`,
    `${siteUrl}/catalogo`,
    ...categories.map(({ categoria }) => `${siteUrl}${buildCategoryPath(categoria)}`),
    ...products.map(
      ({ categoria, produto }) =>
        `${siteUrl}${buildProductPath(categoria, produto)}`,
    ),
    ...supplierRegions.map(
      ({ estado, cidade }) =>
        `${siteUrl}${buildSupplierRegionPath(estado, cidade)}`,
    ),
  ]);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(urls)
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>${url.endsWith("/catalogo") ? "0.9" : "0.7"}</priority>
  </url>`,
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
