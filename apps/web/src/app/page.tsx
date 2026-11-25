import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@frescari/ui";
import { ScrollReveal } from "../components/scroll-reveal";
import { BrandLogo } from "@/components/brand-logo";
import { getHomeJsonLd, serializeSeoJsonLd } from "@/lib/seo";
import {
  DirectProducerIcon,
  HarvestSignalIllustration,
  LowCarbonIcon,
  NightHarvestIcon,
} from "@/components/frescari-iconography";

// Every claim on this page maps to something the platform does today
// (same rule as /para-restaurantes). Keep it that way when editing.

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
      <circle
        cx="42.5"
        cy="27.5"
        r="6.5"
        fill="#f9f6f0"
        stroke="#0d3321"
        strokeWidth="2.25"
      />
      <circle cx="42.5" cy="27.5" r="2.75" fill="#e84c1e" />
    </svg>
  );
}

const heroSignals = [
  "Preço do produtor",
  "Colheita em cada lote",
  "Kg, caixa ou unidade",
];

const benefits: Array<{ title: string; desc: string; icon: ReactNode }> = [
  {
    title: "Preço de quem planta",
    desc: "Você compra direto do produtor, sem atravessador. O preço que aparece é o que ele definiu.",
    icon: <DirectProducerIcon className="h-10 w-10" />,
  },
  {
    title: "Frescor que dá para conferir",
    desc: "Cada lote mostra a data de colheita e a validade. Lotes nas últimas 24 horas ficam 40% mais baratos.",
    icon: <NightHarvestIcon className="h-10 w-10" />,
  },
  {
    title: "Por quilo, caixa ou unidade",
    desc: "Em itens vendidos por quilo, você paga o peso real que o produtor pesou, não um valor estimado.",
    icon: <MixedUnitsIcon className="h-10 w-10" />,
  },
  {
    title: "Produtores perto de você",
    desc: "O frete é calculado pelo seu endereço antes de pagar, e você escolhe o dia e o período da entrega.",
    icon: <LowCarbonIcon className="h-10 w-10" />,
  },
];

const steps = [
  {
    step: "01",
    title: "Crie sua conta",
    desc: "Cadastro grátis. Informe o endereço de entrega do seu restaurante, mercado ou cozinha.",
  },
  {
    step: "02",
    title: "Escolha no catálogo",
    desc: "Veja preço, colheita e quantidade de cada lote. O carrinho avisa se o seu endereço estiver fora da área de entrega.",
  },
  {
    step: "03",
    title: "Receba do produtor",
    desc: "Pague com cartão em ambiente seguro. O produtor entrega no dia e período que você escolheu.",
  },
];

const buyerPoints = [
  "Sem mensalidade: você paga só os produtos e o frete.",
  "Pagamento com cartão pelo Stripe. A Frescari não vê os dados do seu cartão.",
  "Cancele em Meus Pedidos antes da separação, com estorno automático.",
  "Pedido separado por produtor, cada um com o seu frete e a sua entrega.",
];

const producerPoints = [
  "Cadastro grátis. Você só paga quando vende: 10% sobre os produtos.",
  "O frete é todo seu, e você recebe direto na sua conta pelo Stripe.",
  "Você define preço, raio de entrega, pedido mínimo e frete grátis.",
  "Pedidos, lotes e rotas de entrega em um painel só.",
];

const faq = [
  {
    question: "Quanto custa usar a Frescari?",
    answer:
      "Para quem compra, nada além dos produtos e do frete. Para quem vende, 10% sobre o valor dos produtos, só quando vende. Sem mensalidade.",
  },
  {
    question: "Como funciona a compra por peso?",
    answer:
      "O pagamento é autorizado com uma pequena margem. O produtor pesa, informa o peso real e só esse valor é cobrado.",
  },
  {
    question: "Preciso entender de tecnologia para vender?",
    answer:
      "Não. O painel guia o cadastro da fazenda, do primeiro lote e do recebimento, um passo de cada vez.",
  },
];

const currentYear = new Date().getFullYear();
const homeStructuredData = getHomeJsonLd();

export default function Home() {
  return (
    <div className="min-h-screen bg-cream selection:bg-forest/20 selection:text-forest">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeSeoJsonLd(homeStructuredData),
        }}
      />

      <section className="relative overflow-hidden bg-cream pb-20 pt-16 sm:pt-20">
        <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_top_right,rgba(191,214,181,0.55),transparent_45%),radial-gradient(circle_at_left,rgba(232,76,30,0.08),transparent_30%)]" />
        <div className="absolute right-0 top-0 -z-10 h-full w-[42%] bg-gradient-to-bl from-sage/70 via-sage/20 to-transparent" />
        <div className="absolute bottom-0 left-0 -z-10 h-40 w-[32%] bg-gradient-to-tr from-cream-dark/70 to-transparent" />

        <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 md:px-8 xl:grid-cols-[1.08fr_0.92fr] lg:px-12">
          <ScrollReveal className="max-w-3xl space-y-8">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-forest/15 bg-forest/6 px-3.5 py-1.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-ember" />
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-forest">
                Para restaurantes, mercados e cozinhas
              </span>
            </div>

            <div className="space-y-5">
              <h1 className="font-display text-5xl font-black leading-[0.92] tracking-[-0.05em] text-soil sm:text-6xl lg:text-[78px]">
                Abasteça seu negócio com{" "}
                <span className="italic text-forest">hortifruti direto</span> do
                produtor.
              </h1>
              <p className="max-w-2xl font-sans text-lg leading-relaxed text-bark">
                Compre de quem planta, com preço do produtor, data de colheita
                em cada lote e entrega no dia que você escolher.
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
                  Ver o catálogo
                </Button>
              </Link>
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-14 w-full sm:h-12 sm:w-auto"
                >
                  Sou produtor
                </Button>
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={180} className="relative hidden xl:block">
            <div className="relative overflow-hidden rounded-[30px] border border-forest/12 bg-gradient-to-br from-cream via-sage/35 to-cream-dark/70 p-8 shadow-[0_28px_70px_-36px_rgba(13,51,33,0.45)]">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(#0d3321 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              />

              <div className="relative grid grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="space-y-4">
                  <HarvestSignalIllustration className="h-28 w-28" />
                  <div className="space-y-2">
                    <p className="font-display text-3xl font-black italic tracking-[-0.04em] text-soil">
                      Da fazenda para a sua cozinha.
                    </p>
                    <p className="max-w-xs font-sans text-sm leading-relaxed text-bark/80">
                      Cada lote diz de onde vem, quando foi colhido e quanto
                      ainda há para vender.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[22px_16px_20px_14px] border border-forest/10 bg-cream/85 p-4 shadow-[0_16px_32px_-24px_rgba(13,51,33,0.45)]">
                    <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-bark/70">
                      Colheita
                    </p>
                    <p className="mt-2 font-display text-xl font-black italic text-forest">
                      Em cada lote
                    </p>
                    <p className="mt-2 font-sans text-xs leading-relaxed text-bark/78">
                      Data de colheita e validade à vista.
                    </p>
                  </div>
                  <div className="rounded-[18px_22px_16px_20px] border border-forest/10 bg-forest px-4 py-4 shadow-[0_22px_36px_-28px_rgba(13,51,33,0.65)]">
                    <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-sage/65">
                      Por quilo
                    </p>
                    <p className="mt-2 font-display text-xl font-black italic text-cream">
                      Peso real
                    </p>
                    <p className="mt-2 font-sans text-xs leading-relaxed text-sage/75">
                      Você paga o que o produtor pesou.
                    </p>
                  </div>
                  <div className="rounded-[20px_14px_22px_16px] border border-ember/15 bg-ember/8 p-4 shadow-[0_16px_32px_-24px_rgba(232,76,30,0.35)]">
                    <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-ember">
                      Última chance
                    </p>
                    <p className="mt-2 font-display text-xl font-black italic text-soil">
                      40% off
                    </p>
                    <p className="mt-2 font-sans text-xs leading-relaxed text-bark/78">
                      Nas últimas 24 horas de validade.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="bg-cream-dark/35 py-20">
        <div className="mx-auto max-w-[1400px] space-y-12 px-6 md:px-8 lg:px-12">
          <ScrollReveal className="max-w-2xl space-y-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
              Por que comprar na Frescari
            </p>
            <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-soil sm:text-5xl">
              Mais fresco, mais barato e sem surpresa na conta.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <ScrollReveal key={benefit.title} delay={index * 100}>
                <div className="group h-full rounded-[28px_18px_24px_20px] border border-soil/8 bg-cream p-7 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px_12px_18px_10px] border border-forest/15 bg-gradient-to-br from-sage via-sage/75 to-cream shadow-[inset_0_1px_0_rgba(249,246,240,0.6),0_10px_20px_-18px_rgba(13,51,33,0.45)] transition-[transform,box-shadow] duration-200 group-hover:-rotate-2">
                      {benefit.icon}
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-black tracking-[-0.03em] text-soil">
                        {benefit.title}
                      </h3>
                      <p className="mt-3 font-sans text-sm leading-relaxed text-bark/82">
                        {benefit.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream py-20" id="como-funciona">
        <div className="mx-auto max-w-[1400px] space-y-12 px-6 md:px-8 lg:px-12">
          <ScrollReveal className="max-w-2xl space-y-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
              Como funciona
            </p>
            <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-soil sm:text-5xl">
              Do catálogo à sua porta em três passos.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {steps.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 100}>
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
                  Compra simples e segura.
                </h3>
                <ul className="mt-6 space-y-3 font-sans text-sm leading-relaxed text-sage/85">
                  {buyerPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <div className="h-full rounded-[18px_28px_18px_24px] border border-soil/8 bg-cream-dark/45 p-8 shadow-card">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
                  Para quem vende
                </p>
                <h3 className="mt-4 font-display text-4xl font-black italic tracking-[-0.04em] text-soil">
                  Venda direto, sem mensalidade.
                </h3>
                <ul className="mt-6 space-y-3 font-sans text-sm leading-relaxed text-bark/82">
                  {producerPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section className="bg-cream-dark/35 py-20">
        <div className="mx-auto max-w-[1400px] space-y-12 px-6 md:px-8 lg:px-12">
          <ScrollReveal className="max-w-2xl space-y-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-bark/65">
              Dúvidas frequentes
            </p>
            <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-soil sm:text-5xl">
              O que todo mundo pergunta.
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {faq.map((item, index) => (
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

          <p className="font-sans text-sm text-bark">
            Quer fazer as contas antes?{" "}
            <Link
              className="font-semibold text-forest hover:underline"
              href="/ferramentas"
            >
              Use as ferramentas grátis
            </Link>{" "}
            de margem e de desperdício.
          </p>
        </div>
      </section>

      <section className="bg-forest py-20">
        <ScrollReveal className="mx-auto max-w-[1400px] px-6 md:px-8 lg:px-12">
          <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-sage/65">
                Próximo passo
              </p>
              <h2 className="font-display text-4xl font-black italic tracking-[-0.04em] text-cream sm:text-5xl">
                Comece pelo catálogo.
              </h2>
              <p className="max-w-2xl font-sans text-base leading-relaxed text-sage/78">
                Veja o que os produtores estão vendendo. Criar a conta leva um
                minuto.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/catalogo" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-14 w-full sm:h-12 sm:w-auto"
                >
                  Ver o catálogo
                </Button>
              </Link>
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-14 w-full border-cream bg-cream text-forest shadow-[0_8px_28px_-18px_rgba(249,246,240,0.35)] hover:border-cream-dark hover:bg-cream-dark sm:h-12 sm:w-auto"
                >
                  Vender na Frescari
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="border-t border-soil/8 bg-cream py-10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 md:px-8 sm:flex-row lg:px-12">
          <BrandLogo size="sm" />
          <nav
            aria-label="Links do rodapé"
            className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-bark"
          >
            <Link className="hover:text-forest" href="/para-restaurantes">
              Para restaurantes
            </Link>
            <Link className="hover:text-forest" href="/ferramentas">
              Ferramentas grátis
            </Link>
            <Link className="hover:text-forest" href="/termos">
              Termos
            </Link>
            <Link className="hover:text-forest" href="/privacidade">
              Privacidade
            </Link>
          </nav>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
            © {currentYear} Frescari - Marketplace B2B de hortifruti.
          </p>
        </div>
      </footer>
    </div>
  );
}
