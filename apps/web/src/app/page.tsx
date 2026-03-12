import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@frescari/ui";
import { ScrollReveal } from "../components/scroll-reveal";
import { BrandLogo } from "@/components/brand-logo";
import {
  DirectProducerIcon,
  HarvestSignalIllustration,
  LowCarbonIcon,
  NightHarvestIcon,
} from "@/components/frescari-iconography";

function MixedUnitsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M18 10.5H43L54 21.5V42L43 53.5H18L8 42V21.5L18 10.5Z"
        fill="#e3ecdd"
        stroke="#0d3321"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M18 46H46"
        stroke="#0d3321"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M20 34H33"
        stroke="#0d3321"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M21 24H29"
        stroke="#0d3321"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="42.5" cy="27.5" r="6.5" fill="#f9f6f0" stroke="#0d3321" strokeWidth="2.25" />
      <circle cx="42.5" cy="27.5" r="2.75" fill="#e84c1e" />
    </svg>
  );
}

const heroSignals = [
  "Marketplace B2B",
  "Compra por kg, caixa e unidade",
  "Raio local e oferta direta",
];

const buyerSegments = [
  {
    eyebrow: "Restaurantes",
    title: "Reposição rápida para cozinha em ritmo real.",
    desc: "Encontre oferta local com mais agilidade, reduza improviso de última hora e compre com mais frescor e margem.",
  },
  {
    eyebrow: "Varejo",
    title: "Mais previsibilidade para gôndola e perecíveis.",
    desc: "Trabalhe com lotes mais próximos da origem e responda melhor ao giro sem depender do atacado tradicional.",
  },
  {
    eyebrow: "Distribuição",
    title: "Complemento regional para demanda urgente.",
    desc: "Ative fornecedores locais quando a operação exigir velocidade, flexibilidade de unidade e menor distância comercial.",
  },
];

const operatingSignals: Array<{
  title: string;
  desc: string;
  icon: ReactNode;
}> = [
  {
    title: "Catálogo vivo por lote",
    desc: "A oferta acompanha a operação do produtor e ajuda o comprador a reagir mais rápido ao abastecimento.",
    icon: <NightHarvestIcon className="h-10 w-10" />,
  },
  {
    title: "Peso, caixa e unidade no mesmo fluxo",
    desc: "A plataforma nasce para o hortifruti real, onde cada produto pode pedir uma lógica comercial diferente.",
    icon: <MixedUnitsIcon className="h-10 w-10" />,
  },
  {
    title: "Raio local e origem por fazenda",
    desc: "A proposta valoriza oferta regional, logística curta e leitura mais clara da procedência do produto.",
    icon: <LowCarbonIcon className="h-10 w-10" />,
  },
  {
    title: "Direto do produtor, sem atravessador",
    desc: "O modelo aproxima comprador e produtor com uma camada digital que organiza a operação sem inflar a negociação.",
    icon: <DirectProducerIcon className="h-10 w-10" />,
  },
];

const flowSteps = [
  {
    step: "01",
    title: "O produtor atualiza a oferta",
    desc: "Lotes, unidade de venda e disponibilidade entram no painel operacional com foco na realidade de campo.",
  },
  {
    step: "02",
    title: "O catálogo B2B responde",
    desc: "A oferta fica pronta para descoberta, compartilhamento e consulta pública com menos fricção comercial.",
  },
  {
    step: "03",
    title: "O comprador fecha o pedido",
    desc: "A jornada é pensada para abastecimento, não para navegação genérica de e-commerce.",
  },
  {
    step: "04",
    title: "A plataforma processa a operação",
    desc: "O fluxo financeiro organiza a intermediação e o repasse de forma clara entre quem compra, quem vende e a plataforma.",
  },
];

const objections = [
  {
    question: "Isso serve para compra recorrente ou só oportunidade pontual?",
    answer:
      "A proposta faz mais sentido quando o negócio precisa de ritmo de abastecimento, leitura rápida de oferta e resposta local.",
  },
  {
    question: "Como a plataforma lida com produtos vendidos por peso e por caixa?",
    answer:
      "Esse é um dos pontos centrais do Frescari: o ecossistema foi pensado para trabalhar peso, unidade e caixa no mesmo contexto comercial.",
  },
  {
    question: "O produtor precisa virar usuário avançado de software?",
    answer:
      "Não. A camada operacional existe para organizar catálogo, lote e pedido sem transformar o produtor em operador de sistema complexo.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-cream selection:bg-forest/20 selection:text-forest">
      <section className="relative overflow-hidden bg-cream pb-24 pt-16 sm:pt-20">
        <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_top_right,rgba(191,214,181,0.55),transparent_45%),radial-gradient(circle_at_left,rgba(232,76,30,0.08),transparent_30%)]" />
        <div className="absolute right-0 top-0 -z-10 h-full w-[42%] bg-gradient-to-bl from-sage/70 via-sage/20 to-transparent" />
        <div className="absolute bottom-0 left-0 -z-10 h-40 w-[32%] bg-gradient-to-tr from-cream-dark/70 to-transparent" />

        <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 md:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-12">
          <ScrollReveal className="max-w-3xl space-y-8">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-forest/15 bg-forest/6 px-3.5 py-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-ember" />
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-forest">
                Marketplace B2B de hortifruti
              </span>
            </div>

            <div className="space-y-5">
              <h1 className="font-display text-5xl font-black leading-[0.92] tracking-[-0.05em] text-soil sm:text-6xl lg:text-[78px]">
                Abasteça seu negócio com{" "}
                <span className="italic text-forest">hortifruti direto</span>{" "}
                do produtor.
              </h1>
              <p className="max-w-2xl font-sans text-lg leading-relaxed text-bark">
                A Frescari conecta compradores B2B a produtores locais com catálogo vivo,
                leitura rápida de oferta e operação pensada para o ritmo real de restaurantes,
                varejo e distribuição.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {heroSignals.map((signal) => (
                <span
                  key={signal}
                  className="inline-flex items-center rounded-full border border-forest/12 bg-cream px-3.5 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark shadow-[0_8px_18px_-18px_rgba(13,51,33,0.45)]"
                >
                  {signal}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/catalogo" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  className="h-14 w-full sm:h-12 sm:w-auto shadow-[0_8px_28px_-14px_rgba(13,51,33,0.45)] hover:shadow-[0_12px_36px_-14px_rgba(13,51,33,0.55)]"
                >
                  Entrar no catálogo atacado
                </Button>
              </Link>
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button variant="ghost" size="lg" className="h-14 w-full sm:h-12 sm:w-auto">
                  Sou produtor
                </Button>
              </Link>
            </div>

            <div className="border-t border-soil/8 pt-5">
              <p className="max-w-xl font-sans text-sm leading-relaxed text-bark/78">
                Para quem compra hortifruti com frequência, o que importa é oferta confiável,
                resposta rápida e uma ponte comercial mais curta entre origem e pedido.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={180} className="relative hidden lg:block">
            <div className="relative overflow-hidden rounded-[30px] border border-forest/12 bg-gradient-to-br from-cream via-sage/35 to-cream-dark/70 p-8 shadow-[0_28px_70px_-36px_rgba(13,51,33,0.45)]">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: "radial-gradient(#0d3321 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              />

              <div className="relative space-y-8">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-forest/12 bg-cream px-3 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-bark shadow-[0_8px_18px_-18px_rgba(13,51,33,0.45)]">
                    Operação de alta velocidade
                  </span>
                  <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-forest/75">
                    compra regional
                  </span>
                </div>

                <div className="grid grid-cols-[1.1fr_0.9fr] gap-6">
                  <div className="space-y-4">
                    <HarvestSignalIllustration className="h-28 w-28" />
                    <div className="space-y-2">
                      <p className="font-display text-3xl font-black italic tracking-[-0.04em] text-soil">
                        Oferta que responde ao lote.
                      </p>
                      <p className="max-w-xs font-sans text-sm leading-relaxed text-bark/80">
                        A plataforma aproxima disponibilidade real, descoberta B2B e fechamento
                        de pedido sem empurrar o produtor para uma operação pesada.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[22px_16px_20px_14px] border border-forest/10 bg-cream/85 p-4 shadow-[0_16px_32px_-24px_rgba(13,51,33,0.45)]">
                      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-bark/70">
                        Catálogo
                      </p>
                      <p className="mt-2 font-display text-xl font-black italic text-forest">
                        Vivo
                      </p>
                      <p className="mt-2 font-sans text-xs leading-relaxed text-bark/78">
                        Leitura rápida de oferta disponível agora.
                      </p>
                    </div>
                    <div className="rounded-[18px_22px_16px_20px] border border-forest/10 bg-forest px-4 py-4 shadow-[0_22px_36px_-28px_rgba(13,51,33,0.65)]">
                      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-sage/65">
                        Unidades comerciais
                      </p>
                      <p className="mt-2 font-display text-xl font-black italic text-cream">
                        Kg + caixa
                      </p>
                      <p className="mt-2 font-sans text-xs leading-relaxed text-sage/75">
                        Ajustado ao fluxo real do hortifruti.
                      </p>
                    </div>
                    <div className="rounded-[20px_14px_22px_16px] border border-ember/15 bg-ember/8 p-4 shadow-[0_16px_32px_-24px_rgba(232,76,30,0.35)]">
                      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-ember">
                        Origem
                      </p>
                      <p className="mt-2 font-display text-xl font-black italic text-soil">
                        Raio local
                      </p>
                      <p className="mt-2 font-sans text-xs leading-relaxed text-bark/78">
                        Menos distância e mais contexto comercial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-8 top-10 max-w-[220px] rounded-[18px_14px_20px_12px] border border-cream/70 bg-cream/92 p-4 shadow-[0_18px_36px_-24px_rgba(13,51,33,0.35)] backdrop-blur-[2px]">
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-bark/65">
                Direção do produto
              </p>
              <p className="mt-2 font-sans text-sm leading-relaxed text-bark/85">
                Marketplace B2B para quem compra. Camada operacional para quem vende.
              </p>
            </div>

            <div className="absolute -bottom-6 right-5 max-w-[240px] rounded-[16px_22px_18px_14px] border border-forest/12 bg-forest p-4 shadow-[0_24px_40px_-28px_rgba(13,51,33,0.7)]">
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-sage/65">
                Tese comercial
              </p>
              <p className="mt-2 font-display text-xl font-black italic text-cream">
                Menos ruído entre oferta e pedido.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="border-y border-soil/6 bg-cream-dark/45 py-5">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-3 px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
          {[
            "Oferta regional com contexto de origem",
            "Leitura mais rápida de perecibilidade e lote",
            "Operação pensada para abastecimento, não vitrine genérica",
            "Compra direta com menos intermediação comercial",
          ].map((signal) => (
            <div
              key={signal}
              className="rounded-[18px] border border-soil/8 bg-cream px-4 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-bark/76 shadow-[0_10px_18px_-20px_rgba(13,51,33,0.45)]"
            >
              {signal}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-cream py-24">
        <div className="mx-auto max-w-[1400px] space-y-14 px-6 md:px-8 lg:px-12">
          <ScrollReveal className="max-w-2xl space-y-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
              Para restaurantes, varejo e distribuição
            </p>
            <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-soil sm:text-5xl">
              Feita para quem compra hortifruti em ritmo profissional.
            </h2>
            <p className="font-sans text-base leading-relaxed text-bark/80">
              Se o seu negócio depende de reposição ágil, melhor margem e oferta regional,
              a Frescari foi desenhada para esse fluxo de abastecimento.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {buyerSegments.map((segment, index) => (
              <ScrollReveal key={segment.title} delay={index * 120}>
                <div className="h-full rounded-[26px_18px_24px_16px] border border-soil/8 bg-cream-dark/50 p-7 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-ember">
                    {segment.eyebrow}
                  </p>
                  <h3 className="mt-4 font-display text-2xl font-black tracking-[-0.03em] text-soil">
                    {segment.title}
                  </h3>
                  <p className="mt-4 font-sans text-sm leading-relaxed text-bark/82">
                    {segment.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream-dark/35 py-24">
        <div className="mx-auto max-w-[1400px] space-y-14 px-6 md:px-8 lg:px-12">
          <ScrollReveal className="max-w-2xl space-y-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
              Como a operação funciona
            </p>
            <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-soil sm:text-5xl">
              Recursos pensados para a rotina real do hortifruti B2B.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {operatingSignals.map((signal, index) => (
              <ScrollReveal key={signal.title} delay={index * 120}>
                <div className="group h-full rounded-[28px_18px_24px_20px] border border-soil/8 bg-cream p-7 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px_12px_18px_10px] border border-forest/15 bg-gradient-to-br from-sage via-sage/75 to-cream shadow-[inset_0_1px_0_rgba(249,246,240,0.6),0_10px_20px_-18px_rgba(13,51,33,0.45)] transition-all duration-200 group-hover:-rotate-2">
                      {signal.icon}
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-black tracking-[-0.03em] text-soil">
                        {signal.title}
                      </h3>
                      <p className="mt-3 font-sans text-sm leading-relaxed text-bark/82">
                        {signal.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream py-24">
        <div className="mx-auto max-w-[1400px] space-y-14 px-6 md:px-8 lg:px-12">
          <ScrollReveal className="max-w-2xl space-y-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
              Fluxo operacional
            </p>
            <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-soil sm:text-5xl">
              Do lote ao pedido, com menos atrito no caminho.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {flowSteps.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 120}>
                <div className="relative h-full rounded-[24px_16px_26px_18px] border border-soil/8 bg-cream-dark/45 p-6 shadow-card">
                  <span className="inline-flex rounded-full border border-forest/12 bg-cream px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                    {item.step}
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-black tracking-[-0.03em] text-soil">
                    {item.title}
                  </h3>
                  <p className="mt-4 font-sans text-sm leading-relaxed text-bark/82">
                    {item.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ScrollReveal>
              <div className="h-full rounded-[28px_18px_24px_18px] border border-forest/12 bg-forest p-8 shadow-[0_28px_60px_-36px_rgba(13,51,33,0.75)]">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-sage/65">
                  Para quem compra
                </p>
                <h3 className="mt-4 font-display text-4xl font-black italic tracking-[-0.04em] text-cream">
                  Um marketplace para abastecimento.
                </h3>
                <ul className="mt-6 space-y-3 font-sans text-sm leading-relaxed text-sage/78">
                  <li>Oferta regional mais próxima do momento real da operação.</li>
                  <li>Compra com linguagem comercial do hortifruti, não do varejo genérico.</li>
                  <li>Mais clareza entre preço, unidade de venda e contexto de origem.</li>
                  <li>Menos distância entre a necessidade do comprador e a resposta do produtor.</li>
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <div className="h-full rounded-[18px_28px_18px_24px] border border-soil/8 bg-cream-dark/45 p-8 shadow-card">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
                  Para quem vende
                </p>
                <h3 className="mt-4 font-display text-4xl font-black italic tracking-[-0.04em] text-soil">
                  Uma camada operacional sem ruído.
                </h3>
                <ul className="mt-6 space-y-3 font-sans text-sm leading-relaxed text-bark/82">
                  <li>Catálogo e lotes organizados sem transformar o produtor em operador de software.</li>
                  <li>Mais chance de descoberta por compradores com intenção real de compra.</li>
                  <li>Melhor ponte entre estoque disponível, pedido e exposição digital.</li>
                  <li>Operação com foco em vender mais, não em aprender sistema complexo.</li>
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="bg-cream-dark/35 py-24">
        <div className="mx-auto max-w-[1400px] space-y-14 px-6 md:px-8 lg:px-12">
          <ScrollReveal className="max-w-2xl space-y-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
              Objeções que importam
            </p>
            <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-soil sm:text-5xl">
              Respostas para as dúvidas mais comuns antes de comprar ou vender.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {objections.map((item, index) => (
              <ScrollReveal key={item.question} delay={index * 100}>
                <div className="h-full rounded-[24px_16px_22px_18px] border border-soil/8 bg-cream p-7 shadow-card">
                  <h3 className="font-display text-2xl font-black tracking-[-0.03em] text-soil">
                    {item.question}
                  </h3>
                  <p className="mt-4 font-sans text-sm leading-relaxed text-bark/82">
                    {item.answer}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-forest py-24">
        <ScrollReveal className="mx-auto max-w-[1400px] px-6 md:px-8 lg:px-12">
          <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-sage/65">
                Próximo passo
              </p>
              <h2 className="font-display text-4xl font-black italic tracking-[-0.04em] text-cream sm:text-5xl">
                Entre no fluxo certo de compra e venda.
              </h2>
              <p className="max-w-2xl font-sans text-base leading-relaxed text-sage/78">
                Explore a oferta disponível no catálogo ou leve sua produção para uma operação
                digital pensada para o mercado de hortifruti.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/catalogo" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="h-14 w-full sm:h-12 sm:w-auto">
                  Ver catálogo atacado
                </Button>
              </Link>
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-14 w-full border-cream bg-cream text-forest shadow-[0_8px_28px_-18px_rgba(249,246,240,0.35)] hover:border-cream-dark hover:bg-cream-dark sm:h-12 sm:w-auto"
                >
                  Levar minha produção para a Frescari
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="border-t border-soil/8 bg-cream py-10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 md:px-8 sm:flex-row lg:px-12">
          <BrandLogo size="sm" />
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
            © 2025 Frescari - Marketplace B2B de hortifruti.
          </p>
        </div>
      </footer>
    </div>
  );
}
