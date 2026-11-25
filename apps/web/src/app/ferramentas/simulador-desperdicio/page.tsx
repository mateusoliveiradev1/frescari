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
import { WasteSimulator } from "./waste-simulator";

export const metadata: Metadata = buildSeoMetadata({
  title: "Simulador de desperdício de hortifruti em restaurantes | Frescari",
  description:
    "Veja quanto dinheiro o desperdício de frutas, legumes e verduras custa ao seu restaurante por mês e por ano, e quanto você economiza reduzindo a perda.",
  path: "/ferramentas/simulador-desperdicio",
});

const FAQ: ToolFaqItem[] = [
  {
    question: "Como medir o desperdício da minha cozinha?",
    answer:
      "Durante uma semana, pese ou anote o valor de tudo que vai para o lixo sem ser servido: folhas murchas, frutas passadas, sobras de pré-preparo. Divida pelo total comprado na semana.",
  },
  {
    question: "O simulador conta aparas e cascas?",
    answer:
      "Ele conta o percentual que você informar. Se quiser medir só o que estragou, deixe de fora as aparas normais do preparo. Se quiser o custo total, inclua tudo.",
  },
  {
    question: "Por que o mês tem mais de quatro semanas?",
    answer:
      "O valor mensal é o anual dividido por 12. Um ano tem 52 semanas, então cada mês tem pouco mais de quatro semanas em média.",
  },
  {
    question: "O que ajuda a reduzir o desperdício?",
    answer:
      "Comprar com mais frequência e em menor quantidade, escolher lotes com colheita recente, controlar o estoque pelo que chegou primeiro e aproveitar itens perto do vencimento no prato do dia.",
  },
];

export default function WasteSimulatorPage() {
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
        title="Simulador de desperdício de hortifruti"
        intro="Coloque quanto você compra por semana e quanto vai para o lixo. Veja o custo em reais e quanto sobra no caixa ao reduzir a perda. O cálculo roda no seu navegador."
      />

      <div className="mx-auto flex max-w-[1100px] flex-col gap-16 px-6 py-14 lg:px-12">
        <WasteSimulator />

        <ToolSection id="como-calcula" title="Como o cálculo funciona">
          <p className="max-w-3xl text-sm leading-relaxed text-bark">
            Desperdício por semana = compras da semana × percentual de
            desperdício. O valor por ano multiplica a semana por 52, e o mês é o
            ano dividido por 12. A economia compara o desperdício de hoje com o
            da meta. Exemplo: R$ 3.000 por semana com 12% de desperdício são R$
            18.720 por ano; baixar para 5% devolve R$ 10.920 ao caixa.
          </p>
        </ToolSection>

        <ToolFaq items={FAQ} />
        <ToolCta />
      </div>
    </main>
  );
}
