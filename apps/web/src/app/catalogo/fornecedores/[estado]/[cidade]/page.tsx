import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrencyBRL } from "@frescari/ui";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import {
  getSupplierRegionPageData,
  getSupplierRegionStaticParams,
} from "@/lib/catalog-public";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";
import { buildSeoMetadata } from "@/lib/seo";

export const revalidate = 3600;

type SupplierRegionPageProps = {
  params: Promise<{
    estado: string;
    cidade: string;
  }>;
};

export async function generateStaticParams(): Promise<
  Array<{ estado: string; cidade: string }>
> {
  return getSupplierRegionStaticParams();
}

export async function generateMetadata({
  params,
}: SupplierRegionPageProps): Promise<Metadata> {
  const { estado, cidade } = await params;
  const data = await getSupplierRegionPageData(estado, cidade);

  if (!data) {
    return {
      title: "Regiao nao encontrada | Frescari",
    };
  }

  const title = `Fornecedores em ${sanitizeText(data.region.name)} | Frescari`;
  const description = sanitizeText(data.region.description, 160);
  return buildSeoMetadata({
    description,
    path: data.region.path,
    title,
  });
}

export default async function SupplierRegionPage({
  params,
}: SupplierRegionPageProps) {
  const { estado, cidade } = await params;
  const data = await getSupplierRegionPageData(estado, cidade);

  if (!data) {
    notFound();
  }

  const canonical = `${getSiteUrl()}${data.region.path}`;
  const farmNames = Array.from(new Set(data.lots.map((lot) => lot.farmName)));
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
        name: data.region.name,
        item: canonical,
      },
    ],
  };
  const regionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Fornecedores em ${sanitizeText(data.region.name)}`,
    description: sanitizeText(data.region.description, 200),
    url: canonical,
    about: farmNames.slice(0, 12).map((farmName) => ({
      "@type": "Organization",
      name: sanitizeText(farmName),
    })),
  };

  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(regionJsonLd) }}
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
          <span className="font-medium text-soil">{data.region.name}</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-forest" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                Oferta regional indexavel
              </span>
            </div>

            <h1 className="font-display text-5xl font-black tracking-tight text-soil sm:text-6xl">
              Fornecedores em {data.region.name}
            </h1>

            <p className="max-w-3xl text-lg leading-relaxed text-bark">
              {data.region.description}
            </p>

            <div className="flex flex-wrap gap-3">
              {data.categories.map((category) => (
                <Link
                  key={category.path}
                  href={category.path}
                  className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm transition-colors hover:text-forest"
                >
                  {category.name}
                </Link>
              ))}
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
                entre {data.region.farmCount} produtores ativos
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

        <section aria-labelledby="produtos-da-regiao" className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
              Navegacao de produto
            </p>
            <h2
              id="produtos-da-regiao"
              className="font-display text-3xl font-bold text-soil"
            >
              Produtos ativos nesta regiao
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.products.map((product) => (
              <Link
                key={product.path}
                href={product.path}
                className="group rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-forest/30 hover:shadow-lg"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                  {product.categoryName}
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
                    Ver produto
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="produtores-da-regiao" className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
              Malha local
            </p>
            <h2
              id="produtores-da-regiao"
              className="font-display text-3xl font-bold text-soil"
            >
              Produtores publicados em {data.region.name}
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

        <section aria-labelledby="lotes-da-regiao" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-forest/10" />
            <h2
              id="lotes-da-regiao"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark"
            >
              Lotes ativos nesta regiao
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
