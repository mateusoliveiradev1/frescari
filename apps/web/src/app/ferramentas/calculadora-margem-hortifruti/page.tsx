import type { Metadata } from "next";

import { buildFaqPageJsonLd } from "@/lib/catalog-commercial";
import { serializeJsonLd } from "@/lib/catalog-seo";
import { buildSeoMetadata } from "@/lib/seo";

import {
  ToolCta,
  ToolFaq,
  ToolHero,
  ToolSection,
  type ToolFaqItem,
} from "../tool-page-parts";
import { MarginCalculator } from "./margin-calculator";

export const metadata: Metadata = buildSeoMetadata({
  title: "Calculadora de margem para hortifruti, com quebra | Frescari",
  description:
    "Calcule o preço de venda de frutas, legumes e verduras considerando a quebra, os custos extras e a margem que você quer ter. Grátis, sem cadastro.",
  path: "/ferramentas/calculadora-margem-hortifruti",
});

const FAQ: ToolFaqItem[] = [
  {
    question: "Por que a quebra muda o preço de venda?",
    answer:
      "Se 10% do que você compra estraga, os 90% que sobram precisam pagar a compra inteira. Por isso o custo real de cada unidade vendida é maior do que o preço que você pagou.",
  },
  {
    question: "Qual a diferença entre margem e markup?",
    answer:
      "Margem é a parte do preço de venda que fica com você. Markup é quanto você soma em cima do custo. Uma margem de 30% equivale a um markup de cerca de 43% sem quebra, e mais com quebra.",
  },
  {
    question: "Qual é uma margem comum em hortifruti?",
    answer:
      "Varia muito por produto, região e tipo de negócio. Itens muito perecíveis costumam precisar de margem maior para cobrir a perda. Use a calculadora para testar cenários com os seus números.",
  },
  {
    question: "Como diminuir a quebra?",
    answer:
      "Comprar em quantidade menor e com mais frequência, conferir a data de colheita, armazenar na temperatura certa e usar primeiro o que chegou antes. Comprar direto do produtor encurta o caminho até a sua cozinha.",
  },
];

export default function MarginCalculatorPage() {
  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildFaqPageJsonLd(FAQ)),
        }}
      />

      <ToolHero
        eyebrow="Ferramenta grátis"
        title="Calculadora de margem para hortifruti"
        intro="Descubra por quanto vender cada produto para manter a sua margem mesmo com a quebra. O cálculo roda no seu navegador: nada é enviado nem salvo."
      />

      <div className="mx-auto flex max-w-[1100px] flex-col gap-16 px-6 py-14 lg:px-12">
        <MarginCalculator />

        <ToolSection id="como-calcula" title="Como o cálculo funciona">
          <ol className="grid gap-4 md:grid-cols-3">
            <li className="rounded-[24px] border border-forest/15 bg-sage/25 p-6 text-sm leading-relaxed text-bark">
              <strong className="block text-base text-soil">
                1. Custo real
              </strong>
              (custo de compra + outros custos) ÷ (1 − quebra). Com 10% de
              quebra, divida por 0,9.
            </li>
            <li className="rounded-[24px] border border-forest/15 bg-sage/25 p-6 text-sm leading-relaxed text-bark">
              <strong className="block text-base text-soil">
                2. Preço de venda
              </strong>
              custo real ÷ (1 − margem). Com 30% de margem, divida por 0,7.
            </li>
            <li className="rounded-[24px] border border-forest/15 bg-sage/25 p-6 text-sm leading-relaxed text-bark">
              <strong className="block text-base text-soil">3. Exemplo</strong>
              Tomate a R$ 5,00/kg, R$ 0,40 de outros custos, 10% de quebra e 30%
              de margem: (5,40 ÷ 0,9) ÷ 0,7 = R$ 8,57/kg.
            </li>
          </ol>
        </ToolSection>

        <ToolFaq items={FAQ} />
        <ToolCta />
      </div>
    </main>
  );
}
