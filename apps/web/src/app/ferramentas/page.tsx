import type { Metadata } from "next";
import Link from "next/link";

import { buildSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = buildSeoMetadata({
  title: "Ferramentas grátis para quem compra hortifruti | Frescari",
  description:
    "Calculadora de margem com quebra e simulador de desperdício para restaurantes, mercados e cozinhas. Grátis, sem cadastro.",
  path: "/ferramentas",
});

const TOOLS = [
  {
    href: "/ferramentas/calculadora-margem-hortifruti",
    title: "Calculadora de margem",
    text: "Por quanto vender cada produto para manter a margem mesmo com a quebra.",
  },
  {
    href: "/ferramentas/simulador-desperdicio",
    title: "Simulador de desperdício",
    text: "Quanto o hortifruti que vai para o lixo custa por mês e por ano, e quanto você economiza reduzindo a perda.",
  },
];

export default function ToolsHubPage() {
  return (
    <main className="min-h-screen bg-cream">
      <section className="border-b border-soil/8 bg-sage/30">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-14 lg:px-12 lg:py-20">
          <h1 className="max-w-3xl font-display text-4xl font-black leading-tight tracking-tight text-soil sm:text-5xl">
            Ferramentas grátis para quem compra hortifruti
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-bark">
            Contas rápidas para restaurantes, mercados e cozinhas. Sem cadastro:
            o cálculo roda no seu navegador.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-6 py-14 lg:px-12">
        <ul className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="flex h-full flex-col gap-2 rounded-[24px] border border-soil/10 bg-white p-6 shadow-sm transition-colors hover:border-forest/40"
              >
                <h2 className="font-display text-2xl font-bold text-soil">
                  {tool.title}
                </h2>
                <p className="text-sm leading-relaxed text-bark">{tool.text}</p>
                <span className="mt-auto pt-2 text-sm font-bold text-forest">
                  Usar agora →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
