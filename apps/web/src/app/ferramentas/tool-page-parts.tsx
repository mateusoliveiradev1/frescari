import Link from "next/link";
import type { ReactNode } from "react";

// Shared pieces of the /ferramentas pages: same look as /para-restaurantes.

export type ToolFaqItem = { question: string; answer: string };

export function ToolHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <section className="border-b border-soil/8 bg-sage/30">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-14 lg:px-12 lg:py-20">
        <nav aria-label="Trilha" className="text-xs font-semibold text-bark">
          <Link className="hover:text-forest hover:underline" href="/">
            Início
          </Link>
          {" / "}
          <Link
            className="hover:text-forest hover:underline"
            href="/ferramentas"
          >
            Ferramentas
          </Link>
        </nav>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-forest/20 bg-forest/10 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-forest" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
            {eyebrow}
          </span>
        </div>
        <h1 className="max-w-3xl font-display text-4xl font-black leading-tight tracking-tight text-soil sm:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-bark">{intro}</p>
      </div>
    </section>
  );
}

export function ToolSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-6">
      <h2
        id={id}
        className="font-display text-3xl font-bold text-soil sm:text-4xl"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ToolFaq({ items }: { items: ToolFaqItem[] }) {
  return (
    <ToolSection id="duvidas" title="Dúvidas frequentes">
      <div className="divide-y divide-soil/10 rounded-[24px] border border-soil/10 bg-white">
        {items.map((item) => (
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
    </ToolSection>
  );
}

export function ToolCta() {
  return (
    <section className="flex flex-col items-start gap-5 rounded-[28px] bg-forest px-8 py-10 text-cream sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-bold">
          Compre direto do produtor
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-cream/80">
          Menos intermediários deixam o custo de compra mais baixo, e a data de
          colheita em cada lote ajuda a perder menos.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/catalogo"
          className="rounded-sm bg-cream px-6 py-3 text-sm font-bold uppercase tracking-wider text-forest transition-colors hover:bg-white"
        >
          Ver catálogo
        </Link>
        <Link
          href="/para-restaurantes"
          className="rounded-sm border border-cream/40 px-6 py-3 text-sm font-bold uppercase tracking-wider text-cream transition-colors hover:bg-cream/10"
        >
          Como funciona
        </Link>
      </div>
    </section>
  );
}

export function ToolField({
  id,
  label,
  hint,
  suffix,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-soil">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-soil/15 bg-white focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20">
        <input
          id={id}
          className="w-full min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-soil outline-none"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <span className="shrink-0 pr-4 text-sm font-semibold text-bark">
          {suffix}
        </span>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-bark/80">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBrl(value: number): string {
  return currency.format(value);
}
