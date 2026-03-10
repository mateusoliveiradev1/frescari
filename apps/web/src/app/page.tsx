import Link from "next/link";
import { Button } from "@frescari/ui";
import { ScrollReveal } from "../components/scroll-reveal";

// ─────────────────────────────────────────────────────
// Frescari Landing Page — Organic Editorial Luxury
// ─────────────────────────────────────────────────────

const features = [
  {
    title: "Colheita Noturna",
    label: "Frescor Garantido",
    desc: "Produtos colhidos na madrugada para entrega na manhã seguinte — distância mínima, frescor máximo.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M14 3C14 3 4 10 4 18C4 23.5 8.5 26 14 26C19.5 26 24 23.5 24 18C24 10 14 3 14 3Z" fill="#e8f0e3" stroke="#0d3321" strokeWidth="1.5" />
        <circle cx="14" cy="9" r="2" fill="#0d3321" opacity="0.5" />
        <path d="M14 26V16" stroke="#0d3321" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Zero Intermediário",
    label: "Direto do Produtor",
    desc: "Cada compra vai diretamente ao produtor familiar. Mais renda para quem cultiva, preço justo para quem compra.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="9" cy="14" r="5" fill="#e8f0e3" stroke="#0d3321" strokeWidth="1.5" />
        <circle cx="19" cy="14" r="5" fill="#e8f0e3" stroke="#0d3321" strokeWidth="1.5" />
        <path d="M14 14H14.01" stroke="#0d3321" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "CO₂ Reduzido",
    label: "Sustentabilidade Real",
    desc: "Rotas inteligentes de menos de 50km reduzem a pegada de carbono de cada colheita. Tecnologia a favor da terra.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M6 20C6 14 10 6 14 4C18 6 22 14 22 20" stroke="#0d3321" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 20C10 16 12 12 14 10C16 12 18 16 18 20" fill="#e8f0e3" stroke="#0d3321" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 24H20" stroke="#0d3321" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-cream selection:bg-forest/20 selection:text-forest">

      {/* ── Hero ── */}
      <section className="relative pt-20 pb-28 overflow-hidden">
        {/* Background accent — asymmetric, not centered */}
        <div className="absolute top-0 right-0 -z-10 w-[45%] h-full bg-gradient-to-bl from-sage via-sage/40 to-transparent" />
        <div className="absolute bottom-0 left-0 -z-10 w-[30%] h-40 bg-gradient-to-tr from-cream-dark/60 to-transparent" />

        <div className="max-w-[1400px] mx-auto px-6 md:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-16 items-center">
          {/* Left — text */}
          <ScrollReveal className="space-y-8 max-w-2xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-forest/10 border border-forest/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest/50 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-forest" />
              </span>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
                Logística da colheita à sua mesa
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-6xl sm:text-7xl lg:text-[82px] font-black text-soil leading-[0.92] tracking-tighter">
              Compre{" "}
              <span className="italic text-forest">fresco</span>,<br />
              apoie o{" "}
              <span className="text-ember italic">local</span>.
            </h1>

            {/* Body */}
            <p className="font-sans text-lg text-bark leading-relaxed max-w-lg">
              A Frescari conecta produtores familiares diretamente com o comércio local.
              Tecnologia B2B para reduzir o desperdício e aumentar o frescor de cada colheita.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/catalogo" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full sm:w-auto h-14 sm:h-12 shadow-[0_4px_24px_rgba(13,51,33,0.25)] hover:shadow-[0_6px_32px_rgba(13,51,33,0.35)] transition-all">
                  Ver Ofertas Hoje
                </Button>
              </Link>
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button variant="ghost" size="lg" className="w-full sm:w-auto h-14 sm:h-12">
                  Sou Produtor
                </Button>
              </Link>
            </div>

            {/* Social proof micro-line */}
            <div className="flex items-center gap-4 pt-4 border-t border-soil/8">
              <span className="font-sans text-xs text-bark/70">
                Fazendas parceiras em menos de 50km de você
              </span>
            </div>
          </ScrollReveal>

          {/* Right — visual card */}
          <ScrollReveal delay={200} className="relative hidden lg:block">
            {/* Main frame */}
            <div className="aspect-[3/4] rounded-sm bg-sage/40 border border-soil/10 overflow-hidden relative shadow-card-hover">
              {/* Dot pattern */}
              <div className="absolute inset-0 opacity-30"
                style={{ backgroundImage: "radial-gradient(#0d3321 1px, transparent 1px)", backgroundSize: "20px 20px" }}
              />
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-6 p-12 text-center">
                {/* Leaf SVG illustration */}
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
                  <path d="M40 8C40 8 12 24 12 46C12 62 24 72 40 72C56 72 68 62 68 46C68 24 40 8 40 8Z"
                    fill="#e8f0e3" stroke="#0d3321" strokeWidth="2" />
                  <path d="M40 72C40 72 40 40 40 24" stroke="#0d3321" strokeWidth="2" strokeLinecap="round" />
                  <path d="M40 54C40 54 26 44 22 30" stroke="#0d3321" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  <path d="M40 46C40 46 54 36 58 22" stroke="#0d3321" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                </svg>
                <div>
                  <p className="font-display text-2xl font-bold text-forest italic">Conexão Real</p>
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark mt-1">
                    Logística Hiper-Local
                  </p>
                </div>
              </div>
            </div>

            {/* Floating Last Chance card */}
            <div className="absolute -bottom-6 -left-8 p-5 bg-cream border border-ember/30 rounded-sm shadow-[0_8px_30px_-6px_rgba(232,76,30,0.25)] max-w-[200px]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-sm bg-ember/10 border border-ember/25 flex items-center justify-center flex-shrink-0">
                  <span className="block h-2.5 w-2.5 rounded-full bg-ember animate-[pulse-ember_1.2s_ease-in-out_infinite]" />
                </div>
                <div>
                  <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-ember">Última Chance</p>
                  <p className="font-display text-base font-black text-soil">Tomates: −40%</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Social Proof Marquee ── */}
      <section className="border-y border-soil/5 bg-sage/20 overflow-hidden py-3">
        <div className="flex w-full whitespace-nowrap">
          <div className="animate-[marquee_30s_linear_infinite] flex items-center gap-12 px-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-12">
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-bark/60">✦ Direto do Produtor</span>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-bark/60">✦ Entrega em 24h</span>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-bark/60">✦ Qualidade Selecionada</span>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-bark/60">✦ Parceria com Produtores Locais</span>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-bark/60">✦ Logística Sustentável</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="como-funciona" className="py-28 bg-cream-dark/40">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 lg:px-12 space-y-16">
          {/* Section header */}
          <ScrollReveal className="flex items-center gap-6 max-w-sm">
            <div className="h-px flex-1 bg-forest/15" />
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark">
              Como Funciona
            </span>
            <div className="h-px flex-1 bg-forest/15" />
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <ScrollReveal key={i} delay={i * 150}>
                <div
                  className="group h-full p-8 bg-cream border border-soil/8 rounded-sm shadow-card hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200 cursor-default"
                >
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-sm bg-sage/60 border border-forest/15 flex items-center justify-center mb-6 group-hover:bg-sage transition-colors">
                    {feature.icon}
                  </div>
                  {/* Label */}
                  <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-bark/70 mb-2">
                    {feature.label}
                  </p>
                  {/* Title */}
                  <h3 className="font-display text-xl font-bold text-soil mb-3">
                    {feature.title}
                  </h3>
                  {/* Description */}
                  <p className="font-sans text-sm text-bark leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 bg-forest">
        <ScrollReveal className="max-w-[1400px] mx-auto px-6 md:px-8 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="space-y-3 w-full md:w-auto">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-sage/70">
              Plataforma B2B
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-black text-cream italic leading-tight tracking-tight">
              Pronto para comprar<br />com propósito?
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0 w-full md:w-auto">
            <Link href="/catalogo" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto h-14 sm:h-12">Ver Catálogo</Button>
            </Link>
            <Link href="/auth/register" className="w-full sm:w-auto">
              <Button size="lg"
                className="w-full sm:w-auto h-14 sm:h-12 bg-cream text-forest border-cream hover:bg-cream-dark hover:border-cream-dark shadow-[0_4px_24px_rgba(249,246,240,0.15)] hover:shadow-[0_6px_32px_rgba(249,246,240,0.25)] transition-all">
                Criar Conta Grátis
              </Button>
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 border-t border-soil/8 bg-cream">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-forest rounded-sm flex items-center justify-center">
              <span className="font-display text-white font-black text-sm italic leading-none">F</span>
            </div>
            <span className="font-display text-sm font-bold text-soil italic">Frescari</span>
          </div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
            © 2025 Frescari — Alimento real, perto de você.
          </p>
        </div>
      </footer>
    </div>
  );
}
