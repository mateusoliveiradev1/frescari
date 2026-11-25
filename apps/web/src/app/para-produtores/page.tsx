import type { Metadata } from "next";
import Link from "next/link";

import { buildFaqPageJsonLd } from "@/lib/catalog-commercial";
import { serializeJsonLd } from "@/lib/catalog-seo";
import { buildSeoMetadata } from "@/lib/seo";

// Landing page for producers. Every claim here maps to something the
// platform does today (fee: PLATFORM_FEE_RATE in the checkout router; payout
// rules: /pagamentos-e-repasses). Keep it that way when editing.

export const metadata: Metadata = buildSeoMetadata({
  title: "Venda hortifruti direto para restaurantes | Frescari",
  description:
    "Venda direto para restaurantes e mercados da sua região. Sem mensalidade: a Frescari cobra 10% sobre os produtos, só quando você vende, e o frete é todo seu.",
  path: "/para-produtores",
});

const PRICING = [
  {
    value: "R$ 0",
    label: "de mensalidade e de cadastro",
  },
  {
    value: "10%",
    label: "sobre o valor dos produtos, só quando você vende",
  },
  {
    value: "100%",
    label: "do frete fica com você",
  },
];

const BENEFITS = [
  {
    title: "Compradores com intenção de compra",
    text: "Restaurantes, mercados e cozinhas da sua região procuram hortifruti no catálogo e compram direto de você.",
  },
  {
    title: "Você manda no preço",
    text: "Você define o preço de cada lote e a unidade de venda: quilo, caixa ou unidade.",
  },
  {
    title: "Você manda na entrega",
    text: "Defina o raio de entrega, a taxa base e o valor por km, o pedido mínimo, o frete grátis e os dias e períodos em que entrega.",
  },
  {
    title: "Recebe direto na sua conta",
    text: "Quando o pagamento é confirmado, o seu valor vai automaticamente para a sua conta de recebimento no Stripe.",
  },
  {
    title: "Venda por peso sem prejuízo",
    text: "Em itens por quilo, você pesa e informa o peso real, e o comprador paga exatamente esse valor.",
  },
  {
    title: "Menos sobra no fim do dia",
    text: "Lotes nas últimas 24 horas de validade ganham 40% de desconto automático e chamam a atenção no catálogo.",
  },
];

const STEPS = [
  {
    title: "Crie sua conta de produtor",
    text: "Cadastro grátis, com os dados da sua fazenda ou empresa.",
  },
  {
    title: "Cadastre a fazenda",
    text: "Endereço, raio de entrega, frete, pedido mínimo e dias de entrega.",
  },
  {
    title: "Publique o primeiro lote",
    text: "Produto, preço, unidade de venda, quantidade e data de colheita.",
  },
  {
    title: "Ative o recebimento",
    text: "Conecte sua conta no Stripe para receber. O painel mostra o que falta, passo a passo.",
  },
];

const FAQ = [
  {
    question: "Quanto custa vender na Frescari?",
    answer:
      "Não há mensalidade nem taxa de cadastro. A Frescari cobra 10% sobre o valor dos produtos de cada pedido, só quando você vende. A comissão não incide sobre o frete, que é repassado integralmente a você.",
  },
  {
    question: "Quando e como eu recebo?",
    answer:
      "Quando o pagamento do pedido é confirmado, o valor dos produtos menos a comissão, mais o frete, é transferido automaticamente para a sua conta de recebimento no Stripe. Em itens vendidos por peso, a transferência acontece quando você informa o peso final. O depósito no banco segue o calendário de repasses do Stripe.",
  },
  {
    question: "O que preciso para começar a receber?",
    answer:
      "Uma conta de recebimento no Stripe, com CPF ou CNPJ, dados bancários e a verificação de identidade que o Stripe pede. O painel do produtor mostra o que ainda falta.",
  },
  {
    question: "Quem faz a entrega?",
    answer:
      "Você, dentro do raio que escolher. O comprador vê o frete antes de pagar e escolhe o dia e o período entre os que você atende.",
  },
  {
    question: "E se eu precisar cancelar um pedido?",
    answer:
      "Você pode cancelar pelo painel, por exemplo quando faltar produto. O comprador recebe o estorno automaticamente, e a comissão também é revertida.",
  },
  {
    question: "Preciso entender de tecnologia?",
    answer:
      "Não. O painel guia o cadastro da fazenda, do primeiro lote e do recebimento, um passo de cada vez, e avisa por e-mail quando chega um pedido.",
  },
];

export default function ForProducersPage() {
  return (
    <main className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildFaqPageJsonLd(FAQ)),
        }}
      />

      <section className="border-b border-soil/8 bg-sage/30">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-16 lg:px-12 lg:py-24">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-forest" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
              Para produtores
            </span>
          </div>
          <h1 className="max-w-3xl font-display text-4xl font-black leading-tight tracking-tight text-soil sm:text-6xl">
            Venda seu hortifruti direto para restaurantes
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-bark">
            Restaurantes, mercados e cozinhas da sua região compram direto de
            você. Sem mensalidade: você só paga quando vende.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register"
              className="rounded-sm bg-forest px-6 py-3 text-sm font-bold uppercase tracking-wider text-cream transition-colors hover:bg-forest/90"
            >
              Criar conta de produtor
            </Link>
            <Link
              href="#quanto-custa"
              className="rounded-sm border border-forest/30 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wider text-forest transition-colors hover:bg-forest/5"
            >
              Quanto custa
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-20 px-6 py-16 lg:px-12">
        <section aria-labelledby="quanto-custa" className="space-y-8">
          <h2
            id="quanto-custa"
            className="scroll-mt-24 font-display text-3xl font-bold text-soil sm:text-4xl"
          >
            Quanto custa vender
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {PRICING.map((item) => (
              <li
                key={item.label}
                className="rounded-[24px] border border-forest/15 bg-white p-6 shadow-sm"
              >
                <p className="font-display text-5xl font-black text-forest">
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-bark">
                  {item.label}
                </p>
              </li>
            ))}
          </ul>
          <p className="max-w-3xl text-sm leading-relaxed text-bark">
            Exemplo: num pedido de R$ 200 em produtos com R$ 20 de frete, a
            comissão é de R$ 20 (10% de R$ 200) e você recebe R$ 200. Taxas do
            parceiro de pagamento, quando houver, seguem a{" "}
            <Link
              href="/pagamentos-e-repasses"
              className="font-semibold text-forest hover:underline"
            >
              Política de Pagamentos, Comissões e Repasses
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="por-que" className="space-y-8">
          <h2
            id="por-que"
            className="font-display text-3xl font-bold text-soil sm:text-4xl"
          >
            Por que vender na Frescari
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-[24px] border border-soil/10 bg-white p-6 shadow-sm"
              >
                <h3 className="font-display text-xl font-bold text-soil">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-bark">
                  {benefit.text}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="como-comecar" className="space-y-8">
          <h2
            id="como-comecar"
            className="font-display text-3xl font-bold text-soil sm:text-4xl"
          >
            Como começar
          </h2>
          <ol className="grid gap-4 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-3 rounded-[24px] border border-forest/15 bg-sage/25 p-6"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-forest font-display text-lg font-black text-cream"
                >
                  {index + 1}
                </span>
                <h3 className="font-sans text-base font-semibold text-soil">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-bark">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="duvidas" className="space-y-6">
          <h2
            id="duvidas"
            className="font-display text-3xl font-bold text-soil sm:text-4xl"
          >
            Dúvidas frequentes
          </h2>
          <div className="divide-y divide-soil/10 rounded-[24px] border border-soil/10 bg-white">
            {FAQ.map((item) => (
              <details key={item.question} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-sans text-base font-semibold text-soil">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="text-xl text-forest transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-bark">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start gap-5 rounded-[28px] bg-forest px-8 py-10 text-cream sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold">
              Comece a vender hoje
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-cream/80">
              Criar a conta é grátis. Você só paga quando vende.
            </p>
          </div>
          <Link
            href="/auth/register"
            className="rounded-sm bg-cream px-6 py-3 text-sm font-bold uppercase tracking-wider text-forest transition-colors hover:bg-white"
          >
            Criar conta de produtor
          </Link>
        </section>

        <p className="text-center text-sm text-bark">
          Compra para um restaurante ou mercado?{" "}
          <Link
            href="/para-restaurantes"
            className="font-semibold text-forest hover:underline"
          >
            Veja como comprar
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
