import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrencyBRL } from "@frescari/ui";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import {
  getCategoryPageData,
  getCategoryStaticParams,
} from "@/lib/catalog-public";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";
import { buildSeoMetadata } from "@/lib/seo";

export const revalidate = 3600;

type CategoryPageProps = {
  params: Promise<{
    categoria: string;
  }>;
};

export async function generateStaticParams(): Promise<
  Array<{ categoria: string }>
> {
  return getCategoryStaticParams();
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { categoria } = await params;
  const data = await getCategoryPageData(categoria);

  if (!data) {
    return {
      title: "Categoria não encontrada | Frescari",
    };
  }

  const title = `${sanitizeText(data.category.name)} direto da horta | Frescari`;
  const description = sanitizeText(data.category.description, 160);
  return buildSeoMetadata({
    description,
    path: data.category.path,
    title,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categoria } = await params;
  const data = await getCategoryPageData(categoria);

  if (!data) {
    notFound();
  }

  const canonical = `${getSiteUrl()}${data.category.path}`;
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
        item: canonical,
      },
    ],
  };
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: sanitizeText(data.category.name),
    description: sanitizeText(data.category.description, 200),
    url: canonical,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: data.products.length,
      itemListElement: data.products.slice(0, 12).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: sanitizeText(product.name),
        url: `${getSiteUrl()}${product.path}`,
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
        <nav className="flex items-center gap-2 text-sm text-bark/70">
          <Link
            href="/catalogo"
            className="transition-colors hover:text-forest"
          >
            Catálogo
          </Link>
          <span>/</span>
          <span className="font-medium text-soil">{data.category.name}</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-forest" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                Página de categoria em ISR
              </span>
            </div>

            <h1 className="font-display text-5xl font-black tracking-tight text-soil sm:text-6xl">
              {data.category.name}
            </h1>

            <p className="max-w-3xl text-lg leading-relaxed text-bark">
              {data.category.description}
            </p>
          </div>

          <aside className="grid gap-4 rounded-[28px] border border-soil/10 bg-white/70 p-6 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                Produtos indexados
              </p>
              <p className="mt-2 font-display text-4xl font-black text-soil">
                {data.category.productCount}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Lotes ativos
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {data.category.lotCount}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                  Melhor preço
                </p>
                <p className="mt-2 text-2xl font-semibold text-forest">
                  {formatCurrencyBRL(
                    Math.min(
                      ...data.products.map((product) => product.lowestPrice),
                    ),
                  )}
                </p>
              </div>
            </div>
          </aside>
        </header>

        <section aria-labelledby="produtos-da-categoria" className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
                Navegação de produto
              </p>
              <h2
                id="produtos-da-categoria"
                className="font-display text-3xl font-bold text-soil"
              >
                Produtos publicados
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.products.map((product) => (
              <Link
                key={product.path}
                href={product.path}
                className="group rounded-[28px] border border-soil/10 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-forest/30 hover:shadow-lg"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                  {product.offerCount} oferta
                  {product.offerCount === 1 ? "" : "s"}
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
                    Ver produto →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="lotes-da-categoria" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-forest/10" />
            <h2
              id="lotes-da-categoria"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark"
            >
              Lotes disponíveis agora
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
