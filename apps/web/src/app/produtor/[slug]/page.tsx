import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrencyBRL } from "@frescari/ui";

import { ProductCardWrapper } from "@/components/ProductCardWrapper";
import { StorefrontShareButtons } from "@/components/StorefrontShareButtons";
import { getProducerStorefrontPageData } from "@/lib/catalog-public";
import { getSiteUrl, sanitizeText, serializeJsonLd } from "@/lib/catalog-seo";
import {
  buildProducerStorefrontPath,
  getProducerInitials,
  groupLotsByCategory,
  pickStorefrontHighlights,
} from "@/lib/producer-storefront";
import { buildSeoMetadata } from "@/lib/seo";

export const revalidate = 3600;

type ProducerStorefrontPageProps = {
  params: Promise<{ slug: string }>;
};

const TRUST_POINTS = [
  {
    title: "Pagamento protegido",
    text: "Você paga pela Frescari e recebe o estorno se o pedido for cancelado.",
  },
  {
    title: "Direto do produtor",
    text: "Sem atravessador: o preço e a colheita são da própria fazenda.",
  },
  {
    title: "Frete na hora",
    text: "O valor da entrega aparece no carrinho, calculado pelo seu endereço.",
  },
];

function formatPlace(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(" - ");
}

function formatHarvestDay(isoDate: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function joinProductNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

export async function generateMetadata({
  params,
}: ProducerStorefrontPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProducerStorefrontPageData(slug);

  if (!data) {
    return { title: "Produtor nao encontrado | Frescari" };
  }

  const name = sanitizeText(data.producer.name);
  const place = formatPlace(data.producer.city, data.producer.state);
  const { highlights } = pickStorefrontHighlights(
    data.lots,
    formatCurrencyBRL,
    3,
  );
  const productNames = joinProductNames(highlights.map((item) => item.name));
  // Product names and the town in the description are what people search
  // for ("tomate direto do produtor em Pirangi").
  const description = sanitizeText(
    productNames
      ? `${productNames} direto de ${name}${place ? `, ${place}` : ""}. Compre online, direto do produtor, com entrega pela propria fazenda.`
      : data.producer.bio
        ? data.producer.bio
        : `Produtos frescos de ${name}${place ? ` (${place})` : ""}, direto do produtor, com entrega pela propria fazenda.`,
    160,
  );

  return buildSeoMetadata({
    description,
    // An empty storefront is a thin page: keep it out of search results
    // until the producer has something to sell.
    index: data.lots.length > 0,
    // The storefront's own card (producer, town, prices) is what WhatsApp
    // shows when the link is pasted, instead of the generic site image.
    images: [
      {
        alt: `Vitrine de ${name} na Frescari`,
        url: `${buildProducerStorefrontPath(data.producer.slug)}/opengraph-image`,
      },
    ],
    path: buildProducerStorefrontPath(data.producer.slug),
    title: `${name} | Frescari`,
  });
}

export default async function ProducerStorefrontPage({
  params,
}: ProducerStorefrontPageProps) {
  const { slug } = await params;
  const data = await getProducerStorefrontPageData(slug);

  if (!data) {
    notFound();
  }

  const { producer, lots } = data;
  const place = formatPlace(producer.city, producer.state);
  const url = `${getSiteUrl()}${buildProducerStorefrontPath(producer.slug)}`;
  const showFarmName =
    producer.farmName !== null && producer.farmName !== producer.name;
  const { highlights, productCount } = pickStorefrontHighlights(
    lots,
    formatCurrencyBRL,
  );
  const categoryGroups = groupLotsByCategory(lots);
  const latestHarvest = lots.reduce<string | null>(
    (latest, lot) =>
      latest === null || lot.harvestDate > latest ? lot.harvestDate : latest,
    null,
  );
  // The same terms the checkout applies, shown before the buyer fills a cart.
  const terms = [
    {
      label: "Entrega",
      value: producer.deliveryRadiusKm
        ? `Pela fazenda, em até ${Math.round(producer.deliveryRadiusKm)} km${producer.city ? ` de ${producer.city}` : ""}`
        : "Feita pela fazenda, combinada com o produtor",
    },
    ...(producer.deliveryScheduleLabel
      ? [{ label: "Dias de entrega", value: producer.deliveryScheduleLabel }]
      : []),
    {
      label: "Pedido mínimo",
      value: producer.minOrderValue
        ? formatCurrencyBRL(producer.minOrderValue)
        : "Sem pedido mínimo",
    },
    {
      label: "Frete",
      value: producer.freeShippingThreshold
        ? `Grátis acima de ${formatCurrencyBRL(producer.freeShippingThreshold)}`
        : producer.baseDeliveryFee
          ? `A partir de ${formatCurrencyBRL(producer.baseDeliveryFee)}, calculado no carrinho`
          : "Calculado no carrinho pelo seu endereço",
    },
  ];

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#produtor`,
    name: sanitizeText(producer.name),
    url,
    ...(producer.photoUrl ? { image: producer.photoUrl } : {}),
    ...(producer.bio ? { description: sanitizeText(producer.bio, 500) } : {}),
    ...(producer.city || producer.state
      ? {
          address: {
            "@type": "PostalAddress",
            ...(producer.city ? { addressLocality: producer.city } : {}),
            ...(producer.state ? { addressRegion: producer.state } : {}),
            addressCountry: "BR",
          },
        }
      : {}),
    ...(lots.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `Ofertas de ${sanitizeText(producer.name)}`,
            itemListElement: lots.slice(0, 50).map((lot) => ({
              "@type": "Offer",
              price: lot.finalPrice.toFixed(2),
              priceCurrency: "BRL",
              availability: "https://schema.org/InStock",
              itemOffered: {
                "@type": "Product",
                name: sanitizeText(lot.productName),
                category: sanitizeText(lot.categoryName),
                ...(lot.imageUrl ? { image: lot.imageUrl } : {}),
              },
            })),
          },
        }
      : {}),
  };
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
        name: sanitizeText(producer.name),
        item: url,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(storeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-12 lg:px-12 lg:py-16">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-bark/70">
          <Link
            href="/catalogo"
            className="transition-colors hover:text-forest"
          >
            Catálogo
          </Link>
          <span>/</span>
          <span className="font-medium text-soil">{producer.name}</span>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] lg:items-start">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {producer.photoUrl ? (
                <Image
                  src={producer.photoUrl}
                  alt={`Foto de ${producer.name}`}
                  width={96}
                  height={96}
                  priority
                  className="h-20 w-20 shrink-0 rounded-full object-cover shadow-sm ring-4 ring-white sm:h-24 sm:w-24"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-forest font-display text-2xl font-black text-cream shadow-sm"
                >
                  {getProducerInitials(producer.name)}
                </span>
              )}
              <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-forest" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                  Vitrine do produtor
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-4xl font-black tracking-tight text-soil sm:text-6xl">
                {producer.name}
              </h1>
              {showFarmName || place ? (
                <p className="text-lg text-bark">
                  {[showFarmName ? producer.farmName : null, place]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>

            {producer.certifications.length > 0 ? (
              <ul aria-label="Certificações" className="flex flex-wrap gap-2">
                {producer.certifications.map((certification) => (
                  <li
                    key={certification}
                    className="inline-flex items-center gap-1.5 rounded-full border border-forest/25 bg-white px-3 py-1 text-sm font-medium text-forest"
                  >
                    <span aria-hidden="true">✓</span>
                    {certification}
                  </li>
                ))}
              </ul>
            ) : null}

            {producer.bio ? (
              <section aria-labelledby="sobre-o-produtor" className="max-w-2xl">
                <h2
                  id="sobre-o-produtor"
                  className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60"
                >
                  Sobre o produtor
                </h2>
                <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-soil">
                  {producer.bio}
                </p>
              </section>
            ) : (
              <p className="max-w-2xl text-base leading-relaxed text-bark">
                Compre direto de quem produz. O pagamento é feito com segurança
                pela Frescari e a entrega sai da própria fazenda.
              </p>
            )}

            <StorefrontShareButtons
              producerName={producer.name}
              place={place || null}
              highlights={highlights}
              productCount={productCount}
              url={url}
            />
          </div>

          <aside
            aria-labelledby="condicoes-do-produtor"
            className="grid gap-5 rounded-[28px] border border-soil/10 bg-white/80 p-6 shadow-sm backdrop-blur"
          >
            <h2
              id="condicoes-do-produtor"
              className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60"
            >
              Condições do produtor
            </h2>
            <dl className="grid gap-4">
              {terms.map((term) => (
                <div key={term.label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-bark/60">
                    {term.label}
                  </dt>
                  <dd className="mt-1 text-base font-medium text-soil">
                    {term.value}
                  </dd>
                </div>
              ))}
            </dl>
            {lots.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 border-t border-soil/10 pt-4">
                <div>
                  <p className="text-2xl font-semibold text-forest">
                    {productCount}
                  </p>
                  <p className="text-xs text-bark/70">
                    {productCount === 1 ? "produto" : "produtos"}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-forest">
                    {lots.length}
                  </p>
                  <p className="text-xs text-bark/70">
                    {lots.length === 1 ? "lote" : "lotes"}
                  </p>
                </div>
                {latestHarvest ? (
                  <div>
                    <p className="text-2xl font-semibold text-forest">
                      {formatHarvestDay(latestHarvest)}
                    </p>
                    <p className="text-xs text-bark/70">última colheita</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </header>

        {/* On phones the offers come first; the reassurance moves below them. */}
        <ul className="order-last grid gap-3 sm:order-none sm:grid-cols-3">
          {TRUST_POINTS.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-soil/10 bg-sage/30 px-5 py-4"
            >
              <p className="text-sm font-semibold text-soil">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-bark">
                {item.text}
              </p>
            </li>
          ))}
        </ul>

        {lots.length > 0 ? (
          <section
            aria-labelledby="ofertas-do-produtor"
            className="space-y-8 pb-24"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2
                id="ofertas-do-produtor"
                className="font-display text-3xl font-bold text-soil"
              >
                Ofertas disponíveis ({lots.length})
              </h2>
              {categoryGroups.length > 1 ? (
                <nav aria-label="Categorias" className="flex flex-wrap gap-2">
                  {categoryGroups.map((group) => (
                    <a
                      key={group.slug}
                      href={`#categoria-${group.slug}`}
                      className="rounded-full border border-soil/10 bg-white px-3 py-1.5 text-sm text-bark shadow-sm transition-colors hover:text-forest"
                    >
                      {group.name} ({group.lots.length})
                    </a>
                  ))}
                </nav>
              ) : null}
            </div>

            {categoryGroups.map((group, groupIndex) => (
              <section
                key={group.slug}
                id={`categoria-${group.slug}`}
                aria-label={group.name}
                className="scroll-mt-24 space-y-4"
              >
                {categoryGroups.length > 1 ? (
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-bark/70">
                    {group.name}
                  </h3>
                ) : null}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.lots.map((lot, index) => (
                    <ProductCardWrapper
                      key={lot.id}
                      lot={lot}
                      isLastChance={lot.status === "last_chance"}
                      priority={groupIndex === 0 && index < 4}
                      hideFarmName
                    />
                  ))}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <section className="rounded-[28px] border border-soil/10 bg-white p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-soil">
              Sem ofertas no momento
            </h2>
            <p className="mt-2 text-bark">
              Este produtor ainda não tem lotes disponíveis. Veja o que outros
              produtores estão oferecendo no catálogo.
            </p>
            <Link
              href="/catalogo"
              className="mt-4 inline-block font-semibold text-forest hover:underline"
            >
              Ver catálogo →
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
