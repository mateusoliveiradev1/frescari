import { CATALOG_REVALIDATE_SECONDS } from "@/lib/catalog-public";
import { getSiteUrl } from "@/lib/catalog-seo";

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const siteUrl = getSiteUrl();
  const body = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, s-maxage=${CATALOG_REVALIDATE_SECONDS}, stale-while-revalidate=${CATALOG_REVALIDATE_SECONDS}`,
    },
  });
}
