import type { Metadata } from "next";
import Link from "next/link";

import { buildFaqPageJsonLd } from "@/lib/catalog-commercial";
import { serializeJsonLd } from "@/lib/catalog-seo";
import { buildSeoMetadata } from "@/lib/seo";

// Landing page for buyers (restaurants, markets, kitchens). Every claim here
// maps to something the platform does today; keep it that way when editing.

export const metadata: Metadata = buildSeoMetadata({
  title: "Hortifruti direto do produtor para restaurantes | Frescari",
  description:
    "Compre hortifruti direto de produtores: preço do produtor, data de colheita em cada lote, janela de entrega escolhida por você e pagamento protegido.",
  path: "/para-restaurantes",
});

const BENEFITS = [
  {
    title: "Preço de quem planta",
    text: "Você compra direto do produtor, sem atravessador. O preço que aparece é o que ele definiu.",
  },
  {
    title: "Frescor que dá para conferir",
    text: "Cada lote mostra a data de colheita e a validade. Nada de caixa misteriosa.",
  },
  {
    title: "Última chance com desconto",
    text: "Lotes nas últimas 24 horas de validade ficam 40% mais baratos, automaticamente. Bom para o prato do dia.",
  },
  {
    title: "Você escolhe quando receber",
    text: "No carrinho, escolha o dia e o período da entrega entre os que o produtor atende, e deixe observações para quem entrega.",
  },
  {
    title: "Frete calculado na hora",
    text: "O frete é calculado pelo seu endereço antes de pagar. Cada produtor mostra o pedido mínimo e a partir de quanto o frete é grátis.",
  },
  {
    title: "Compra por peso sem surpresa",
    text: "Em itens vendidos por quilo, você paga o peso real que o produtor pesou, não um valor estimado.",
  },
];

const STEPS = [
  {
    title: "Crie sua conta de comprador",
    text: "Cadastro gratuito. Informe o endereço de entrega do seu restaurante ou mercado.",
  },
  {
    title: "Escolha no catálogo",
    text: "Veja os produtos à venda, com preço, colheita e validade. O carrinho avisa se o seu endereço estiver fora da área de entrega.",
  },
  {
    title: "Feche o pedido",
    text: "Escolha a janela de entrega, confira o frete e pague com cartão em ambiente seguro.",
  },
  {
    title: "Receba do produtor",
    text: "O próprio produtor entrega no dia e período que você escolheu. Acompanhe tudo em Meus Pedidos.",
  },
];

const FAQ = [
  {
    question: "Quanto custa usar a Frescari?",
    answer:
      "Para o comprador, nada além dos produtos e do frete. Não há mensalidade nem taxa extra no seu pedido.",
  },
  {
    question: "Como funciona o pagamento?",
    answer:
      "Você paga com cartão pelo Stripe, processador de pagamentos usado no mundo todo. A Frescari não vê nem guarda os dados do seu cartão.",
  },
  {
    question: "E se eu precisar cancelar?",
    answer:
      "Você pode cancelar em Meus Pedidos antes de o produtor começar a separar o pedido. O valor volta automaticamente para o seu cartão.",
  },
  {
    question: "Como funciona a compra por peso?",
    answer:
      "Para itens vendidos por quilo, o pagamento é autorizado com uma pequena margem. O produtor pesa, informa o peso real e só esse valor é cobrado.",
  },
  {
    question: "Quem faz a entrega?",
    answer:
      "O próprio produtor, dentro da área que ele atende. Se o seu endereço estiver fora, o carrinho avisa antes de você pagar.",
  },
  {
    question: "Posso comprar de mais de um produtor?",
    answer:
      "Sim. O carrinho separa os itens por produtor, e cada pedido tem o seu frete e a sua janela de entrega.",
  },
];

export default function ForRestaurantsPage() {
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
              Para restaurantes, mercados e cozinhas
            </span>
          </div>
          <h1 className="max-w-3xl font-display text-4xl font-black leading-tight tracking-tight text-soil sm:text-6xl">
            Hortifruti direto do produtor para a sua cozinha
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-bark">
            Compre direto de quem produz, com preço de quem planta, data de
            colheita em cada lote e entrega no dia que você escolher.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register"
              className="rounded-sm bg-forest px-6 py-3 text-sm font-bold uppercase tracking-wider text-cream transition-colors hover:bg-forest/90"
            >
              Criar conta de comprador
            </Link>
            <Link
              href="/catalogo"
              className="rounded-sm border border-forest/30 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wider text-forest transition-colors hover:bg-forest/5"
            >
              Ver o catálogo
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-20 px-6 py-16 lg:px-12">
        <section aria-labelledby="por-que" className="space-y-8">
          <h2
            id="por-que"
            className="font-display text-3xl font-bold text-soil sm:text-4xl"
          >
            Por que comprar na Frescari
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

        <section aria-labelledby="como-funciona" className="space-y-8">
          <h2
            id="como-funciona"
            className="font-display text-3xl font-bold text-soil sm:text-4xl"
          >
            Como funciona
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
              Comece pelo catálogo
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-cream/80">
              Veja o que os produtores estão vendendo hoje. Criar a conta leva
              um minuto.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register"
              className="rounded-sm bg-cream px-6 py-3 text-sm font-bold uppercase tracking-wider text-forest transition-colors hover:bg-white"
            >
              Criar conta
            </Link>
            <Link
              href="/catalogo"
              className="rounded-sm border border-cream/40 px-6 py-3 text-sm font-bold uppercase tracking-wider text-cream transition-colors hover:bg-cream/10"
            >
              Ver catálogo
            </Link>
          </div>
        </section>

        <p className="text-center text-sm text-bark">
          É produtor?{" "}
          <Link
            href="/para-produtores"
            className="font-semibold text-forest hover:underline"
          >
            Venda na Frescari
          </Link>
          . Você só paga quando vende.
        </p>
      </div>
    </main>
  );
}
