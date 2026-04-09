import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  getLegalDocument,
  getLegalDocumentJsonLd,
  legalDocumentLinks,
  type LegalDocumentSlug,
} from "@/lib/legal-documents";
import { serializeSeoJsonLd } from "@/lib/seo";

export function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const document = getLegalDocument(slug);
  const structuredData = serializeSeoJsonLd(getLegalDocumentJsonLd(slug));
  const relatedDocuments = legalDocumentLinks.filter(
    (item) => item.slug !== slug,
  );
  const hasReviewNote = document.reviewNote.trim().length > 0;

  return (
    <main className="min-h-screen bg-cream px-6 py-10 lg:px-12 lg:py-14">
      <script
        dangerouslySetInnerHTML={{ __html: structuredData }}
        type="application/ld+json"
      />
      <div className="mx-auto flex max-w-[76rem] flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo size="sm" />
          <Link
            className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-forest underline-offset-4 transition-[color] hover:text-soil hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            href="/auth/register"
          >
            Voltar ao cadastro
          </Link>
        </div>

        <section className="surface-panel overflow-hidden rounded-[32px]">
          <div className="border-b border-forest/10 bg-[linear-gradient(135deg,rgba(13,51,33,0.97),rgba(26,92,51,0.92))] px-7 py-8 text-cream sm:px-10 sm:py-10">
            <div className="max-w-4xl space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-sage">
                  {document.eyebrow}
                </span>
                <span className="rounded-full border border-white/16 px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-cream/86">
                  {document.status}
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-cream sm:text-5xl">
                  {document.title}
                </h1>
                <p className="max-w-3xl font-sans text-sm leading-7 text-sage/84 sm:text-[0.97rem]">
                  {document.summary}
                </p>
              </div>

              <div className="grid gap-3 text-left sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-sage/70">
                    Versao
                  </p>
                  <p className="mt-2 font-sans text-sm font-semibold text-cream">
                    {document.status}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-sage/70">
                    Publicado em
                  </p>
                  <p className="mt-2 font-sans text-sm font-semibold text-cream">
                    <time dateTime={document.effectiveDateIso}>
                      {document.effectiveDate}
                    </time>
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-sage/70">
                    Atualizado em
                  </p>
                  <p className="mt-2 font-sans text-sm font-semibold text-cream">
                    <time dateTime={document.updatedAtIso}>
                      {document.updatedAt}
                    </time>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <article className="px-7 py-8 sm:px-10 sm:py-10">
              {hasReviewNote ? (
                <div className="rounded-[24px] border border-forest/10 bg-sage/26 px-5 py-5">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                    Nota de revisao
                  </p>
                  <p className="mt-3 font-sans text-sm leading-6 text-bark/86">
                    {document.reviewNote}
                  </p>
                </div>
              ) : null}

              <div className={`${hasReviewNote ? "mt-8" : ""} space-y-8`}>
                {document.sections.map((section) => (
                  <section className="space-y-4" key={section.title}>
                    <div className="space-y-2">
                      <h2 className="font-display text-3xl font-black tracking-[-0.04em] text-soil">
                        {section.title}
                      </h2>
                      <div className="h-px w-16 bg-forest/16" />
                    </div>

                    <div className="space-y-4">
                      {section.paragraphs.map((paragraph) => (
                        <p
                          className="font-sans text-[0.97rem] leading-8 text-bark/88"
                          key={paragraph}
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {section.bullets?.length ? (
                      <ul className="space-y-3 rounded-[24px] border border-forest/10 bg-white/72 px-5 py-5">
                        {section.bullets.map((bullet) => (
                          <li
                            className="flex gap-3 font-sans text-sm leading-7 text-bark/84"
                            key={bullet}
                          >
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ember" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>
            </article>

            <aside className="border-t border-forest/10 bg-white/46 px-7 py-8 sm:px-10 lg:border-l lg:border-t-0 lg:px-7">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-forest">
                    Documentos relacionados
                  </p>
                  <p className="font-sans text-sm leading-6 text-bark/78">
                    Consulte tambem as politicas complementares que regem
                    cadastro, privacidade, pagamentos e a operacao do
                    marketplace.
                  </p>
                </div>

                <div className="space-y-3">
                  {relatedDocuments.map((item) => (
                    <Link
                      className="block rounded-[22px] border border-forest/10 bg-cream/84 px-4 py-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-forest/20 hover:shadow-[0_18px_38px_-32px_rgba(13,51,33,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                      href={item.href}
                      key={item.href}
                    >
                      <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-forest">
                        {item.label}
                      </p>
                      <p className="mt-2 font-sans text-sm leading-6 text-bark/76">
                        Abrir documento complementar desta mesma versao
                        juridica.
                      </p>
                    </Link>
                  ))}
                </div>

                <div className="rounded-[24px] border border-dashed border-forest/14 bg-sage/24 px-4 py-5">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                    Proximo passo
                  </p>
                  <p className="mt-3 font-sans text-sm leading-6 text-bark/82">
                    Em caso de mudanca material nestes documentos, a Frescari
                    pode solicitar novo aceite antes da continuidade do uso da
                    plataforma.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
