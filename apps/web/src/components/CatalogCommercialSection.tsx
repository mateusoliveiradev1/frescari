type CatalogCommercialSectionProps = {
  faqItems: Array<{
    answer: string;
    question: string;
  }>;
  eyebrow: string;
  intro: string;
  metrics: Array<{
    detail: string;
    label: string;
    value: string;
  }>;
  title: string;
};

export function CatalogCommercialSection({
  faqItems,
  eyebrow,
  intro,
  metrics,
  title,
}: CatalogCommercialSectionProps) {
  return (
    <section className="rounded-[36px] border border-soil/10 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl font-bold text-soil">{title}</h2>
        <p className="max-w-3xl text-base leading-relaxed text-bark">{intro}</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[28px] border border-soil/10 bg-cream/70 p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
              {metric.label}
            </p>
            <p className="mt-3 font-display text-2xl font-bold text-soil">
              {metric.value}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-bark">
              {metric.detail}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/60">
            FAQ de compra
          </p>
          <p className="mt-2 text-sm leading-relaxed text-bark">
            Respostas curtas para as duvidas comerciais mais comuns deste
            recorte.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group rounded-[24px] border border-soil/10 bg-cream/50 p-5"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-soil marker:content-none">
                <span>{item.question}</span>
                <span className="text-bark/50 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-bark">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
