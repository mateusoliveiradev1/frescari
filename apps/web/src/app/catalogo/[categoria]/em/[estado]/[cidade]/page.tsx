import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrencyBRL } from "@frescari/ui";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import {
  getCategoryRegionPageData,
  getCategoryRegionStaticParams,
} from "@/lib/catalog-public";
import { buildSupplierRegionPath } from "@/lib/catalog-pseo";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";

export const revalidate = 3600;

type CategoryRegionPageProps = {
  params: Promise<{
    categoria: string;
    estado: string;
    cidade: string;
  }>;
};

export async function generateStaticParams(): Promise<
  Array<{ categoria: string; estado: string; cidade: string }>
> {
  return getCategoryRegionStaticParams();
}

export async function generateMetadata({
  params,
}: CategoryRegionPageProps): Promise<Metadata> {
  const { categoria, estado, cidade } = await params;
  const data = await getCategoryRegionPageData(categoria, estado, cidade);

  if (!data) {
    return {
      title: "Pagina local nao encontrada | Frescari",
    };
  }

  const title = `${sanitizeText(data.region.name)} direto do produtor | Frescari`;
  const description = sanitizeText(data.region.description, 160);
  const canonical = `${getSiteUrl()}${data.region.path}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function CategoryRegionPage({
  params,
}: CategoryRegionPageProps) {
  const { categoria, estado, cidade } = await params;
  const data = await getCategoryRegionPageData(categoria, estado, cidade);

  if (!data) {
    notFound();
  }

  const canonical = `${getSiteUrl()}${data.region.path}`;
  const regionalPath = buildSupplierRegionPath(
    data.region.stateSlug,
    data.region.citySlug,
  );
  const farmNames = Array.from(new Set(data.lots.map((lot) => lot.farmName)));
  const productRegionPathBySlug = new Map(
    data.productRegions.map((region) => [region.productSlug, region.path]),
  );
  const localProducts = data.products.map((product) => {
    const localPath = productRegionPathBySlug.get(product.slug) ?? product.path;

    return {
      product,
      localPath,
      hasLocalPath: localPath !== product.path,
    };
  });
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Catalogo",
        item: `${getSiteUrl()}/catalogo`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: sanitizeText(data.category.name),
        item: `${getSiteUrl()}${data.category.path}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: sanitizeText(data.region.name),
        item: canonical,
      },
    ],
  };
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: sanitizeText(data.region.name),
    description: sanitizeText(data.region.description, 200),
    url: canonical,
    about: {
      "@type": "AdministrativeArea",
      name: sanitizeText(data.region.regionName),
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: data.products.length,
      itemListElement: localProducts
        .slice(0, 12)
        .map(({ product, localPath }, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: sanitizeText(product.name),
          url: `${getSiteUrl()}${localPath}`,
        })),
    },
  };

  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 py-16 lg:px-12">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-bark/70">
          <Link
            href="/catalogo"
            className="transition-colors hover:text-forest"
          >
            Catalogo
          </Link>
          <span>/</span>
          <Link
            href={data.category.path}
            className="transition-colors hover:text-forest"
          >
            {data.category.name}
          </Link>
          <span>/</span>
          <span className="font-medium text-soil">
            {data.region.regionName}
          </span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-forest" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                pSEO local com densidade real
              </span>
            </div>

            <h1 className="font-display text-5xl font-black tracking-tight text-soil sm:text-6xl">
              {data.region.name}
            </h1>

            <p className="max-w-3xl text-lg leading-relaxed text-bark">
              {data.region.description}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href={data.category.path}
                className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm transition-colors hover:text-forest"
              >
                Ver toda a categoria {data.category.name}
              </Link>
              <Link
                href={regionalPath}
                className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm transition-colors hover:text-forest"
              >
                Ver todos os fornecedores em {data.region.regionName}
              </Link>
            </div>
          </div>

          <aside className="grid gap-4 rounded-[28px] border border-soil/10 bg-white/75 p-6 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                Faixa de preco
              </p>
              <p className="mt-2 font-display text-4xl font-black text-soil">
                {formatCurrencyBRL(data.region.lowestPrice)}
              </p>
              <p className="mt-1 text-sm text-bark/70">
                oferta local em {data.region.regionName}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Lotes
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.region.lotCount}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Produtos
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.region.productCount}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Fazendas
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.region.farmCount}
                </p>
              </div>
            </div>
          </aside>
        </header>

        <section aria-labelledby="produtos-locais" className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
              Navegacao local
            </p>
            <h2
              id="produtos-locais"
              className="font-display text-3xl font-bold text-soil"
            >
              Produtos ativos em {data.region.regionName}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {localProducts.map(({ product, localPath, hasLocalPath }) => (
              <Link
                key={product.path}
                href={localPath}
                className="group rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-forest/30 hover:shadow-lg"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                  {product.offerCount} oferta
                  {product.offerCount === 1 ? "" : "s"}
                  {hasLocalPath ? " com rota local" : ""}
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold text-soil transition-colors group-hover:text-forest">
                  {product.name}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-bark">
                  {product.description}
                </p>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-bark/60">
                      A partir de
                    </p>
                    <p className="mt-1 text-xl font-semibold text-forest">
                      {formatCurrencyBRL(product.lowestPrice)}/
                      {product.saleUnit}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-soil">
                    {hasLocalPath ? "Ver rota local" : "Ver produto"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="produtores-locais" className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
              Oferta local
            </p>
            <h2
              id="produtores-locais"
              className="font-display text-3xl font-bold text-soil"
            >
              Produtores publicados nesta rota
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {farmNames.map((farmName) => (
              <span
                key={farmName}
                className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm"
              >
                {farmName}
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="lotes-locais" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-forest/10" />
            <h2
              id="lotes-locais"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark"
            >
              Lotes ativos desta rota
            </h2>
            <div className="h-px flex-1 bg-forest/10" />
          </div>

          <div className="grid grid-cols-1 gap-5 pb-24 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.lots.map((lot, index) => (
              <ProductCardWrapper
                key={lot.id}
                lot={lot}
                isLastChance={lot.status === "last_chance"}
                priority={index < 4}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
