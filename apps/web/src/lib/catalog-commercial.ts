import { formatCurrencyBRL } from "@frescari/ui";

import { getQuantityMinLabel } from "./cart-quantity";
import { sanitizeText } from "./catalog-seo";
import { getSaleUnitLabel, normalizeSaleUnit } from "./sale-units";

type CatalogCommercialLot = {
  categoryName?: string | null;
  deliveryRadiusKm?: number | null;
  farmCity?: string | null;
  farmName: string;
  farmState?: string | null;
  finalPrice: number;
  freshnessScore?: number | null;
  pricingType: "UNIT" | "WEIGHT" | "BOX";
  productName?: string | null;
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

type SupplierRegionCommercialContext = {
  regionName: string;
};

type CategoryRegionCommercialContext = {
  categoryName: string;
  regionName: string;
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

function formatPlainPriceBand(lowestPrice: number, highestPrice: number) {
  if (lowestPrice === highestPrice) {
    return formatCurrencyBRL(lowestPrice);
  }

  return `${formatCurrencyBRL(lowestPrice)} a ${formatCurrencyBRL(highestPrice)}`;
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

function formatTopNames(
  names: string[],
  options?: {
    emptyLabel?: string;
    limit?: number;
  },
) {
  const uniqueNames = Array.from(
    new Set(
      names.map((name) => sanitizeText(name)).filter((name) => name.length > 0),
    ),
  );

  if (uniqueNames.length === 0) {
    return options?.emptyLabel ?? "Mix em atualizacao";
  }

  const limit = options?.limit ?? 3;
  const selectedNames = uniqueNames.slice(0, limit);
  const remainingNames = uniqueNames.length - selectedNames.length;
  const baseLabel = selectedNames.join(", ");

  if (remainingNames <= 0) {
    return baseLabel;
  }

  return `${baseLabel} e mais ${remainingNames}`;
}

function buildFreshnessMetric(lots: CatalogCommercialLot[]) {
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
  const value =
    averageFreshness !== null
      ? `${averageFreshness}/100`
      : medianDeliveryRadius !== null
        ? `${medianDeliveryRadius} km`
        : lastChanceCount > 0
          ? formatCount(lastChanceCount, "alerta", "alertas")
          : "Sem score";

  return {
    averageFreshness,
    freshnessScores,
    lastChanceCount,
    medianDeliveryRadius,
    value,
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
  const freshnessMetric = buildFreshnessMetric(lots);

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
          freshnessMetric.averageFreshness !== null
            ? `Media de frescor em ${freshnessMetric.averageFreshness}/100.`
            : "Sem media publica de frescor no momento.",
          freshnessMetric.medianDeliveryRadius !== null
            ? `Mediana de entrega em ${freshnessMetric.medianDeliveryRadius} km nos lotes que informam raio.`
            : "Nenhum raio medio de entrega publicado agora.",
          freshnessMetric.lastChanceCount > 0
            ? `${formatCount(freshnessMetric.lastChanceCount, "lote em janela final", "lotes em janela final")} neste recorte.`
            : "Sem lotes em janela final neste recorte.",
        ].join(" "),
        220,
      ),
      label: "Frescor e entrega",
      value: freshnessMetric.value,
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
        ? `${subject} concentra ${formatCount(lots.length, "lote ativo", "lotes ativos")} de ${formatCount(farmCount, "produtor", "produtores")} nesta rota${freshnessMetric.medianDeliveryRadius !== null ? `, com mediana de ${freshnessMetric.medianDeliveryRadius} km de entrega nos lotes que informam raio` : ""}.`
        : `${subject} aparece hoje com ${formatCount(lots.length, "lote ativo", "lotes ativos")}, ${formatCount(farmCount, "produtor", "produtores")} e cobertura em ${formatCount(routeCount, "rota local", "rotas locais")}, o que ajuda a comparar fornecedor e repetir abastecimento dentro do catalogo.`,
    ),
    buildFaqItem(
      `Como esta o frescor publicado de ${subject} hoje?`,
      freshnessMetric.averageFreshness !== null
        ? `A media publica de frescor esta em ${freshnessMetric.averageFreshness}/100 entre ${formatCount(freshnessMetric.freshnessScores.length, "lote medido", "lotes medidos")}.${freshnessMetric.lastChanceCount > 0 ? ` Tambem ha ${formatCount(freshnessMetric.lastChanceCount, "lote em janela final", "lotes em janela final")}.` : ""}`
        : freshnessMetric.lastChanceCount > 0
          ? `${formatCount(freshnessMetric.lastChanceCount, "lote entrou", "lotes entraram")} em janela final neste recorte, mesmo sem score medio publicado.`
          : `No momento nao ha score medio de frescor publicado para ${subject}, mas os lotes seguem ativos para consulta comercial.`,
    ),
  ];

  return {
    faqItems,
    intro,
    metrics,
  };
}

export function buildSupplierRegionCommercialSnapshot(
  lots: CatalogCommercialLot[],
  context: SupplierRegionCommercialContext,
): ProductCommercialSnapshot {
  const farmCount = new Set(lots.map((lot) => lot.farmName)).size;
  const productNames = lots
    .map((lot) => lot.productName)
    .filter((name): name is string => Boolean(name));
  const categoryNames = lots
    .map((lot) => lot.categoryName)
    .filter((name): name is string => Boolean(name));
  const productCount = new Set(productNames).size;
  const categoryCount = new Set(categoryNames).size;
  const lowestPrice = Math.min(...lots.map((lot) => lot.finalPrice));
  const highestPrice = Math.max(...lots.map((lot) => lot.finalPrice));
  const freshnessMetric = buildFreshnessMetric(lots);
  const topProducts = formatTopNames(productNames, {
    emptyLabel: "Produtos em atualizacao",
  });
  const topCategories = formatTopNames(categoryNames, {
    emptyLabel: "Categorias em atualizacao",
  });
  const subject = `fornecedores em ${context.regionName}`;

  return {
    intro: sanitizeText(
      `Leitura comercial da malha de ${subject}: quantos produtores publicam hoje, quais categorias e produtos puxam oferta, qual a entrada de preco e como estao os sinais de frescor e entrega antes de abrir os lotes.`,
      220,
    ),
    metrics: [
      {
        detail: sanitizeText(
          `Entrada atual de ${formatPlainPriceBand(lowestPrice, highestPrice)} entre ${formatCount(lots.length, "lote ativo", "lotes ativos")} publicados nesta malha regional.`,
          180,
        ),
        label: "Entrada de preco",
        value: formatPlainPriceBand(lowestPrice, highestPrice),
      },
      {
        detail: sanitizeText(
          `${formatCount(farmCount, "produtor ativo", "produtores ativos")} abastecem ${formatCount(productCount, "produto", "produtos")} neste recorte local agora.`,
          180,
        ),
        label: "Produtores ativos",
        value: `${farmCount} produtores`,
      },
      {
        detail: sanitizeText(
          `Categorias com maior presenca hoje: ${topCategories}. Produtos mais visiveis: ${topProducts}.`,
          200,
        ),
        label: "Mix local",
        value: `${categoryCount} categorias`,
      },
      {
        detail: sanitizeText(
          [
            freshnessMetric.averageFreshness !== null
              ? `Media de frescor em ${freshnessMetric.averageFreshness}/100.`
              : "Sem media publica de frescor no momento.",
            freshnessMetric.medianDeliveryRadius !== null
              ? `Mediana de entrega em ${freshnessMetric.medianDeliveryRadius} km nos lotes com raio informado.`
              : "Sem mediana publica de entrega neste recorte.",
            freshnessMetric.lastChanceCount > 0
              ? `${formatCount(freshnessMetric.lastChanceCount, "lote em janela final", "lotes em janela final")} nesta malha.`
              : "Sem lotes em janela final nesta malha.",
          ].join(" "),
          220,
        ),
        label: "Frescor e entrega",
        value: freshnessMetric.value,
      },
    ],
    faqItems: [
      buildFaqItem(
        `Quantos fornecedores estao ativos em ${context.regionName}?`,
        `Hoje a malha de ${subject} concentra ${formatCount(farmCount, "produtor ativo", "produtores ativos")}, ${formatCount(lots.length, "lote publicado", "lotes publicados")} e ${formatCount(productCount, "produto", "produtos")} com oferta visivel no catalogo.`,
      ),
      buildFaqItem(
        `Que mix aparece entre os fornecedores em ${context.regionName}?`,
        `As categorias com maior presenca hoje sao ${topCategories}. Entre os produtos mais recorrentes neste recorte aparecem ${topProducts}.`,
      ),
      buildFaqItem(
        `Qual e a entrada de preco para comprar nessa regiao?`,
        `A leitura atual da malha de ${subject} vai de ${formatPlainPriceBand(lowestPrice, highestPrice)}, considerando os lotes ativos publicados agora no catalogo.`,
      ),
      buildFaqItem(
        `Como estao frescor e entrega nos lotes de ${context.regionName}?`,
        freshnessMetric.averageFreshness !== null
          ? `A media publica de frescor esta em ${freshnessMetric.averageFreshness}/100.${freshnessMetric.medianDeliveryRadius !== null ? ` Nos lotes com raio informado, a mediana de entrega esta em ${freshnessMetric.medianDeliveryRadius} km.` : ""}${freshnessMetric.lastChanceCount > 0 ? ` Tambem ha ${formatCount(freshnessMetric.lastChanceCount, "lote em janela final", "lotes em janela final")}.` : ""}`
          : freshnessMetric.lastChanceCount > 0
            ? `${formatCount(freshnessMetric.lastChanceCount, "lote entrou", "lotes entraram")} em janela final neste recorte.${freshnessMetric.medianDeliveryRadius !== null ? ` A mediana de entrega entre os lotes com raio informado esta em ${freshnessMetric.medianDeliveryRadius} km.` : ""}`
            : `No momento nao ha score medio de frescor publicado para ${subject}, mas os lotes seguem ativos para consulta comercial.${freshnessMetric.medianDeliveryRadius !== null ? ` A mediana de entrega entre os lotes com raio informado esta em ${freshnessMetric.medianDeliveryRadius} km.` : ""}`,
      ),
    ],
  };
}

export function buildCategoryRegionCommercialSnapshot(
  lots: CatalogCommercialLot[],
  context: CategoryRegionCommercialContext,
): ProductCommercialSnapshot {
  const farmCount = new Set(lots.map((lot) => lot.farmName)).size;
  const productNames = lots
    .map((lot) => lot.productName)
    .filter((name): name is string => Boolean(name));
  const productCount = new Set(productNames).size;
  const lowestPrice = Math.min(...lots.map((lot) => lot.finalPrice));
  const highestPrice = Math.max(...lots.map((lot) => lot.finalPrice));
  const freshnessMetric = buildFreshnessMetric(lots);
  const topProducts = formatTopNames(productNames, {
    emptyLabel: "Produtos em atualizacao",
  });
  const subject = `${context.categoryName} em ${context.regionName}`;

  return {
    intro: sanitizeText(
      `Resumo comercial de ${subject} com foco em faixa de preco, variedade de produtos, produtores ativos e sinais de frescor e entrega antes do pedido nesta rota local.`,
      220,
    ),
    metrics: [
      {
        detail: sanitizeText(
          `${formatCount(lots.length, "lote ativo", "lotes ativos")} publicados hoje para ${subject}, com leitura de preco do menor ao maior lote visivel.`,
          180,
        ),
        label: "Faixa local",
        value: formatPlainPriceBand(lowestPrice, highestPrice),
      },
      {
        detail: sanitizeText(
          `Produtos com maior presenca hoje: ${topProducts}.`,
          180,
        ),
        label: "Mix de produto",
        value: `${productCount} produtos`,
      },
      {
        detail: sanitizeText(
          `${formatCount(farmCount, "produtor ativo", "produtores ativos")} sustentam a oferta local desta categoria agora.`,
          180,
        ),
        label: "Produtores ativos",
        value: `${farmCount} produtores / ${lots.length} lotes`,
      },
      {
        detail: sanitizeText(
          [
            freshnessMetric.averageFreshness !== null
              ? `Media de frescor em ${freshnessMetric.averageFreshness}/100.`
              : "Sem media publica de frescor no momento.",
            freshnessMetric.medianDeliveryRadius !== null
              ? `Mediana de entrega em ${freshnessMetric.medianDeliveryRadius} km nos lotes com raio informado.`
              : "Sem mediana publica de entrega neste recorte.",
            freshnessMetric.lastChanceCount > 0
              ? `${formatCount(freshnessMetric.lastChanceCount, "lote em janela final", "lotes em janela final")} nesta categoria local.`
              : "Sem lotes em janela final nesta categoria local.",
          ].join(" "),
          220,
        ),
        label: "Frescor e entrega",
        value: freshnessMetric.value,
      },
    ],
    faqItems: [
      buildFaqItem(
        `Qual a faixa de preco de ${subject}?`,
        `Hoje ${subject} aparece entre ${formatPlainPriceBand(lowestPrice, highestPrice)}, considerando ${formatCount(lots.length, "lote ativo", "lotes ativos")} publicados no catalogo para esta rota.`,
      ),
      buildFaqItem(
        `Quais produtos puxam a oferta de ${context.categoryName} em ${context.regionName}?`,
        `Os produtos mais presentes neste recorte hoje sao ${topProducts}, dentro de um mix local de ${formatCount(productCount, "produto ativo", "produtos ativos")}.`,
      ),
      buildFaqItem(
        `Quantos produtores publicam ${context.categoryName} nessa regiao?`,
        `${subject} reune hoje ${formatCount(farmCount, "produtor ativo", "produtores ativos")} e ${formatCount(lots.length, "lote publicado", "lotes publicados")} com oferta local visivel.`,
      ),
      buildFaqItem(
        `Como estao frescor e entrega em ${subject}?`,
        freshnessMetric.averageFreshness !== null
          ? `A media publica de frescor esta em ${freshnessMetric.averageFreshness}/100.${freshnessMetric.medianDeliveryRadius !== null ? ` A mediana de entrega entre os lotes com raio informado esta em ${freshnessMetric.medianDeliveryRadius} km.` : ""}${freshnessMetric.lastChanceCount > 0 ? ` Tambem ha ${formatCount(freshnessMetric.lastChanceCount, "lote em janela final", "lotes em janela final")}.` : ""}`
          : freshnessMetric.lastChanceCount > 0
            ? `${formatCount(freshnessMetric.lastChanceCount, "lote entrou", "lotes entraram")} em janela final neste recorte.${freshnessMetric.medianDeliveryRadius !== null ? ` A mediana de entrega entre os lotes com raio informado esta em ${freshnessMetric.medianDeliveryRadius} km.` : ""}`
            : `No momento nao ha score medio de frescor publicado para ${subject}, mas a oferta segue ativa no catalogo.${freshnessMetric.medianDeliveryRadius !== null ? ` A mediana de entrega entre os lotes com raio informado esta em ${freshnessMetric.medianDeliveryRadius} km.` : ""}`,
      ),
    ],
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
