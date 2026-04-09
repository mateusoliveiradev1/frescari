import { formatCurrencyBRL } from "@frescari/ui";

import { getQuantityMinLabel } from "./cart-quantity";
import { sanitizeText } from "./catalog-seo";
import { getSaleUnitLabel, normalizeSaleUnit } from "./sale-units";

type CatalogCommercialLot = {
  deliveryRadiusKm?: number | null;
  farmCity?: string | null;
  farmName: string;
  farmState?: string | null;
  finalPrice: number;
  freshnessScore?: number | null;
  pricingType: "UNIT" | "WEIGHT" | "BOX";
  saleUnit?: string | null;
  status?: string | null;
  unit?: string | null;
};

type CatalogCommercialFaq = {
  answer: string;
  question: string;
};

type CatalogCommercialMetric = {
  detail: string;
  label: string;
  value: string;
};

type ProductCommercialContext = {
  productName: string;
  regionName?: string;
};

export type ProductCommercialSnapshot = {
  faqItems: CatalogCommercialFaq[];
  intro: string;
  metrics: CatalogCommercialMetric[];
};

const PRICING_TYPE_LABELS: Record<CatalogCommercialLot["pricingType"], string> =
  {
    BOX: "por caixa",
    UNIT: "por unidade",
    WEIGHT: "por peso",
  };

const UNIT_WORDS: Record<string, string> = {
  box: "caixa",
  bunch: "maco",
  cx: "caixa",
  dozen: "duzia",
  dz: "duzia",
  g: "g",
  kg: "kg",
  maco: "maco",
  un: "unidade",
  unit: "unidade",
};

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatPriceBand(
  lowestPrice: number,
  highestPrice: number,
  saleUnitLabel: string,
) {
  const suffix = `/${saleUnitLabel}`;

  if (lowestPrice === highestPrice) {
    return `${formatCurrencyBRL(lowestPrice)}${suffix}`;
  }

  return `${formatCurrencyBRL(lowestPrice)} a ${formatCurrencyBRL(highestPrice)}${suffix}`;
}

function getMedian(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      Math.round(
        ((sorted[middleIndex - 1] ?? 0) + (sorted[middleIndex] ?? 0)) * 5,
      ) / 10
    );
  }

  return Math.round((sorted[middleIndex] ?? 0) * 10) / 10;
}

function getPrimarySaleUnit(lots: CatalogCommercialLot[]) {
  return lots[0]?.saleUnit ?? lots[0]?.unit ?? "unit";
}

function getUnitWord(saleUnit?: string | null) {
  const normalizedUnit = normalizeSaleUnit(saleUnit);
  return UNIT_WORDS[normalizedUnit] ?? getSaleUnitLabel(saleUnit);
}

function buildFaqItem(question: string, answer: string): CatalogCommercialFaq {
  return {
    answer: sanitizeText(answer, 320),
    question: sanitizeText(question, 140),
  };
}

export function buildProductCommercialSnapshot(
  lots: CatalogCommercialLot[],
  context: ProductCommercialContext,
): ProductCommercialSnapshot {
  const primarySaleUnit = getPrimarySaleUnit(lots);
  const saleUnitLabel = getSaleUnitLabel(primarySaleUnit);
  const saleUnitWord = getUnitWord(primarySaleUnit);
  const sampleLot = lots[0] ?? {
    pricingType: "UNIT" as const,
    saleUnit: "unit",
    unit: "unit",
  };
  const minimumOrder = `${getQuantityMinLabel(sampleLot)} ${saleUnitWord}`;
  const subject = context.regionName
    ? `${context.productName} em ${context.regionName}`
    : context.productName;
  const farmCount = new Set(lots.map((lot) => lot.farmName)).size;
  const routeCount = new Set(
    lots
      .map((lot) =>
        lot.farmCity && lot.farmState
          ? `${lot.farmCity}|${lot.farmState}`
          : null,
      )
      .filter((value): value is string => value !== null),
  ).size;
  const lowestPrice = Math.min(...lots.map((lot) => lot.finalPrice));
  const highestPrice = Math.max(...lots.map((lot) => lot.finalPrice));
  const pricingTypeEntries = Array.from(
    lots.reduce<Map<CatalogCommercialLot["pricingType"], number>>(
      (accumulator, lot) => {
        accumulator.set(
          lot.pricingType,
          (accumulator.get(lot.pricingType) ?? 0) + 1,
        );
        return accumulator;
      },
      new Map<CatalogCommercialLot["pricingType"], number>(),
    ),
  ).sort((left, right) => right[1] - left[1]);
  const dominantPricingType = pricingTypeEntries[0]?.[0] ?? "UNIT";
  const pricingMix = pricingTypeEntries
    .map(([pricingType]) => PRICING_TYPE_LABELS[pricingType])
    .join(" + ");
  const freshnessScores = lots
    .map((lot) => lot.freshnessScore)
    .filter((score): score is number => Number.isFinite(score));
  const averageFreshness =
    freshnessScores.length > 0
      ? Math.round(
          freshnessScores.reduce((sum, score) => sum + score, 0) /
            freshnessScores.length,
        )
      : null;
  const lastChanceCount = lots.filter(
    (lot) => lot.status === "last_chance",
  ).length;
  const deliveryRadii = lots
    .map((lot) => lot.deliveryRadiusKm)
    .filter((radius): radius is number => Number.isFinite(radius));
  const medianDeliveryRadius = getMedian(deliveryRadii);
  const freshnessValue =
    averageFreshness !== null
      ? `${averageFreshness}/100`
      : medianDeliveryRadius !== null
        ? `${medianDeliveryRadius} km`
        : lastChanceCount > 0
          ? formatCount(lastChanceCount, "alerta", "alertas")
          : "Sem score";

  const intro = sanitizeText(
    context.regionName
      ? `Resumo comercial de ${subject} com base nos lotes ativos agora: faixa de preco, formato de venda, produtores, frescor e cobertura local antes do pedido.`
      : `Resumo comercial de ${subject} com base nos lotes ativos agora: faixa de preco, formato de venda, produtores, frescor e cobertura local antes da negociacao.`,
    220,
  );

  const metrics: CatalogCommercialMetric[] = [
    {
      detail: sanitizeText(
        `${formatCount(lots.length, "lote ativo", "lotes ativos")} publicados agora para ${subject}.`,
        160,
      ),
      label: "Faixa ativa",
      value: formatPriceBand(lowestPrice, highestPrice, saleUnitLabel),
    },
    {
      detail: sanitizeText(
        `Unidade principal em ${saleUnitWord}. Pedido minimo publico a partir de ${minimumOrder}.`,
        160,
      ),
      label: "Formato de venda",
      value: pricingMix || PRICING_TYPE_LABELS[dominantPricingType],
    },
    {
      detail: sanitizeText(
        context.regionName
          ? `${formatCount(lots.length, "lote", "lotes")} distribuidos entre ${formatCount(farmCount, "produtor", "produtores")} nesta rota local.`
          : `${formatCount(lots.length, "lote", "lotes")}, ${formatCount(farmCount, "produtor", "produtores")} e cobertura em ${formatCount(routeCount, "rota local", "rotas locais")}.`,
        180,
      ),
      label: "Ritmo de oferta",
      value: context.regionName
        ? `${lots.length} lotes / ${farmCount} produtores`
        : `${farmCount} produtores / ${routeCount} rotas`,
    },
    {
      detail: sanitizeText(
        [
          averageFreshness !== null
            ? `Media de frescor em ${averageFreshness}/100.`
            : "Sem media publica de frescor no momento.",
          medianDeliveryRadius !== null
            ? `Mediana de entrega em ${medianDeliveryRadius} km nos lotes que informam raio.`
            : "Nenhum raio medio de entrega publicado agora.",
          lastChanceCount > 0
            ? `${formatCount(lastChanceCount, "lote em janela final", "lotes em janela final")} neste recorte.`
            : "Sem lotes em janela final neste recorte.",
        ].join(" "),
        220,
      ),
      label: "Frescor e entrega",
      value: freshnessValue,
    },
  ];

  const faqItems = [
    buildFaqItem(
      `Qual a faixa de preco de ${subject}?`,
      `Hoje ${subject} aparece entre ${formatCurrencyBRL(lowestPrice)} e ${formatCurrencyBRL(highestPrice)} por ${saleUnitWord}, com ${formatCount(lots.length, "lote ativo", "lotes ativos")} em ${formatCount(farmCount, "produtor", "produtores")}.`,
    ),
    buildFaqItem(
      `Como ${context.productName} costuma ser vendido${context.regionName ? ` em ${context.regionName}` : ""}?`,
      `A precificacao dominante hoje e ${PRICING_TYPE_LABELS[dominantPricingType]}, com unidade principal em ${saleUnitWord}. O pedido minimo publico comeca em ${minimumOrder}.`,
    ),
    buildFaqItem(
      context.regionName
        ? `Existe oferta recorrente nessa rota de ${context.productName}?`
        : `Existe cobertura para compra recorrente de ${context.productName}?`,
      context.regionName
        ? `${subject} concentra ${formatCount(lots.length, "lote ativo", "lotes ativos")} de ${formatCount(farmCount, "produtor", "produtores")} nesta rota${medianDeliveryRadius !== null ? `, com mediana de ${medianDeliveryRadius} km de entrega nos lotes que informam raio` : ""}.`
        : `${subject} aparece hoje com ${formatCount(lots.length, "lote ativo", "lotes ativos")}, ${formatCount(farmCount, "produtor", "produtores")} e cobertura em ${formatCount(routeCount, "rota local", "rotas locais")}, o que ajuda a comparar fornecedor e repetir abastecimento dentro do catalogo.`,
    ),
    buildFaqItem(
      `Como esta o frescor publicado de ${subject} hoje?`,
      averageFreshness !== null
        ? `A media publica de frescor esta em ${averageFreshness}/100 entre ${formatCount(freshnessScores.length, "lote medido", "lotes medidos")}.${lastChanceCount > 0 ? ` Tambem ha ${formatCount(lastChanceCount, "lote em janela final", "lotes em janela final")}.` : ""}`
        : lastChanceCount > 0
          ? `${formatCount(lastChanceCount, "lote entrou", "lotes entraram")} em janela final neste recorte, mesmo sem score medio publicado.`
          : `No momento nao ha score medio de frescor publicado para ${subject}, mas os lotes seguem ativos para consulta comercial.`,
    ),
  ];

  return {
    faqItems,
    intro,
    metrics,
  };
}

export function buildFaqPageJsonLd(faqItems: CatalogCommercialFaq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
      name: item.question,
    })),
  };
}
