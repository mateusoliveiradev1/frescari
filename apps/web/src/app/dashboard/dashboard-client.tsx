"use client";

import { Button } from "@frescari/ui";
import Link from "next/link";
import { useEffect } from "react";
import { trpc } from "@/trpc/react";
import { StripeConnectButton } from "@/components/StripeConnectButton";
import { StorefrontShareButtons } from "@/components/StorefrontShareButtons";
import { buildProducerStorefrontPath } from "@/lib/producer-storefront";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-soil/10 rounded-sm ${className}`} />;
}

function formatDate(dateInput: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateInput));
}

type PublishReadiness = {
  paymentsStarted: boolean;
  paymentsReady: boolean;
  farmLocated: boolean;
  hasActiveLot: boolean;
  lotsVisibleInCatalog: boolean;
  storefrontSlug: string | null;
  storefrontName: string | null;
};

function StorefrontCard({ slug, name }: { slug: string; name: string }) {
  const path = buildProducerStorefrontPath(slug);
  const url = `${window.location.origin}${path}`;

  return (
    <section
      aria-labelledby="storefront-title"
      className="border border-forest/20 bg-sage/40 rounded-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
    >
      <div className="space-y-1">
        <h2
          id="storefront-title"
          className="font-display text-2xl font-bold text-soil"
        >
          Sua vitrine
        </h2>
        <p className="font-sans text-sm text-bark max-w-xl">
          Uma pagina so com os seus produtos. Mande para os seus clientes e
          grupos: eles compram direto por ela.{" "}
          <Link
            href={path}
            target="_blank"
            className="font-semibold text-forest hover:underline"
          >
            Ver vitrine
          </Link>{" "}
          ·{" "}
          <Link
            href="/dashboard/vitrine"
            className="font-semibold text-forest hover:underline"
          >
            Editar foto e descrição
          </Link>
        </p>
      </div>
      <StorefrontShareButtons producerName={name} url={url} fromProducer />
    </section>
  );
}

type SetupStep = {
  key: string;
  title: string;
  description: string;
  done: boolean;
  action?: { href: string; label: string };
};

function ProducerSetupChecklist({
  readiness,
}: {
  readiness: PublishReadiness;
}) {
  // Quick wins first: the farm and the first lot take minutes and show the
  // producer their offer taking shape. The Stripe form (documents, bank
  // account) comes last, as the step that turns it on for buyers; when it
  // came first, producers stopped there and never saw anything of theirs.
  const steps: SetupStep[] = [
    {
      key: "farm",
      title: "Localizar a fazenda",
      description: readiness.farmLocated
        ? "Pronto: o frete ja pode ser calculado."
        : "Marque no mapa onde fica a fazenda e ate onde voce entrega. Leva 1 minuto.",
      done: readiness.farmLocated,
      action: readiness.farmLocated
        ? undefined
        : { href: "/dashboard/fazenda", label: "Localizar fazenda" },
    },
    {
      key: "lot",
      title: "Publicar o primeiro lote",
      description: readiness.hasActiveLot
        ? "Pronto: voce tem lote ativo."
        : "Escolha o produto, informe quantidade e preco. Leva cerca de 1 minuto.",
      done: readiness.hasActiveLot,
      action: readiness.hasActiveLot
        ? undefined
        : { href: "/dashboard/inventario", label: "Adicionar lote" },
    },
    {
      key: "payments",
      title: "Ativar o recebimento e comecar a vender",
      description: readiness.paymentsReady
        ? "Pronto: voce ja pode receber pagamentos."
        : readiness.paymentsStarted
          ? "Cadastro iniciado no Stripe. Termine o que falta (veja a lista no alto da pagina) para seus lotes aparecerem aos compradores."
          : "Ultimo passo: cadastro no Stripe, que deposita suas vendas direto na sua conta. Tenha em maos documento com foto e dados bancarios. Use o botao 'Ativar recebimento' acima.",
      done: readiness.paymentsReady,
    },
  ];
  const nextStepKey = steps.find((step) => !step.done)?.key ?? null;

  const completed = steps.filter((step) => step.done).length;

  return (
    <section
      aria-labelledby="setup-checklist-title"
      className="border border-forest/20 bg-sage/40 rounded-sm p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div className="space-y-1">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
            {completed} de {steps.length} passos
          </p>
          <h2
            id="setup-checklist-title"
            className="font-display text-2xl font-bold text-soil"
          >
            Comece a vender na Frescari
          </h2>
        </div>
        <p className="font-sans text-sm text-bark max-w-md">
          {readiness.lotsVisibleInCatalog
            ? "Seus lotes ja aparecem para compradores."
            : readiness.farmLocated && readiness.hasActiveLot
              ? "Sua oferta esta montada. Falta so ativar o recebimento para os compradores verem e comprarem."
              : "Seus lotes aparecem para compradores quando os tres passos estiverem prontos."}
        </p>
      </div>

      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`flex flex-col gap-3 rounded-sm border p-4 ${
              step.done
                ? "border-forest/20 bg-cream/70"
                : step.key === nextStepKey
                  ? "border-forest/50 bg-cream ring-2 ring-forest/15"
                  : "border-soil/10 bg-cream"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done ? "bg-forest text-cream" : "bg-soil/10 text-soil"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <p className="font-sans text-sm font-semibold text-soil">
                {step.title}
                <span className="sr-only">
                  {step.done ? " (concluido)" : " (pendente)"}
                </span>
              </p>
            </div>
            {step.key === nextStepKey ? (
              <span className="w-fit rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cream">
                Proximo passo
              </span>
            ) : null}
            <p className="font-sans text-xs text-bark leading-relaxed">
              {step.description}
            </p>
            {step.action ? (
              <Link
                href={step.action.href}
                className="mt-auto font-sans text-sm font-semibold text-forest hover:underline"
              >
                {step.action.label} →
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function DashboardClient({ user }: { user: unknown }) {
  void user;

  const { data: metrics, isLoading: isMetricsLoading } =
    trpc.lot.getDashboardMetrics.useQuery();
  const { data: recentLots, isLoading: isLotsLoading } =
    trpc.lot.getRecentLots.useQuery();
  const { data: readiness } = trpc.lot.getPublishReadiness.useQuery();
  // getConnectStatus re-syncs the Stripe account (e.g. on return from Stripe
  // onboarding); shares its cache with StripeConnectButton. Recompute
  // readiness once the synced state arrives.
  const { data: connectStatus } = trpc.stripe.getConnectStatus.useQuery();
  const utils = trpc.useUtils();
  const connectState = connectStatus?.state;
  useEffect(() => {
    if (connectState) {
      void utils.lot.getPublishReadiness.invalidate();
    }
  }, [connectState, utils]);
  const lotsHidden = readiness ? !readiness.lotsVisibleInCatalog : false;
  const showChecklist =
    readiness !== undefined &&
    !(readiness.lotsVisibleInCatalog && readiness.hasActiveLot);

  return (
    <div className="min-h-screen bg-cream">
      <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-12">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-1">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
              Area do produtor
            </p>
            <h1 className="font-display text-4xl font-black text-soil">
              Oferta viva
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <StripeConnectButton />
            <Button
              variant="primary"
              asChild
              className="shrink-0 bg-forest hover:bg-forest/90 text-cream"
            >
              <Link href="/dashboard/inventario">Adicionar lote</Link>
            </Button>
          </div>
        </div>

        {showChecklist && readiness ? (
          <ProducerSetupChecklist readiness={readiness} />
        ) : null}

        {readiness && !showChecklist && readiness.storefrontSlug ? (
          <StorefrontCard
            slug={readiness.storefrontSlug}
            name={readiness.storefrontName ?? "Minha vitrine"}
          />
        ) : null}

        {/* ── Quick stats row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Metric 1 */}
          <div className="p-6 bg-cream border border-soil/8 rounded-sm shadow-card flex flex-col justify-between min-h-[140px]">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
              Lotes no catalogo
            </p>
            {isMetricsLoading ? (
              <Skeleton className="h-10 w-20 mt-4" />
            ) : (
              <p className="font-display text-4xl font-black text-forest mt-4">
                {metrics?.activeLots ?? 0}
              </p>
            )}
          </div>

          {/* Metric 2 */}
          <div className="p-6 bg-cream border border-soil/8 rounded-sm shadow-card flex flex-col justify-between min-h-[140px]">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
              Perto da validade
            </p>
            {isMetricsLoading ? (
              <Skeleton className="h-10 w-20 mt-4" />
            ) : (
              <p className="font-display text-4xl font-black text-orange-600 mt-4">
                {metrics?.lastChanceQty ?? 0}
              </p>
            )}
          </div>

          {/* Metric 3 */}
          <div className="p-6 bg-cream border border-soil/8 rounded-sm shadow-card flex flex-col justify-between min-h-[140px]">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
              Desperdicio evitado
            </p>
            {isMetricsLoading ? (
              <Skeleton className="h-10 w-32 mt-4" />
            ) : (
              <p className="font-display text-4xl font-black text-forest mt-4">
                {metrics?.co2AvoidedKg ?? 0}{" "}
                <span className="text-xl text-bark/60">kg</span>
              </p>
            )}
          </div>
        </div>

        {/* ── Recent Lots Section ── */}
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-soil border-b border-soil/10 pb-4">
            Lotes mais recentes
          </h2>

          <div className="bg-cream border border-soil/8 shadow-card rounded-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-soil/10 bg-cream-dark/30">
                    <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">
                      Codigo
                    </th>
                    <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">
                      Produto
                    </th>
                    <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80 text-right">
                      Disponivel
                    </th>
                    <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">
                      Validade
                    </th>
                    <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80 text-center">
                      Situacao
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLotsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-soil/5">
                        <td className="py-4 px-6">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="py-4 px-6">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="py-4 px-6">
                          <Skeleton className="h-4 w-12 ml-auto" />
                        </td>
                        <td className="py-4 px-6">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="py-4 px-6">
                          <Skeleton className="h-6 w-20 mx-auto rounded-full" />
                        </td>
                      </tr>
                    ))
                  ) : recentLots && recentLots.length > 0 ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    recentLots.map((lot: any) => {
                      const isLastChance = lot.status === "last_chance";
                      const isExpired = lot.status === "vencido";
                      const isHidden = !isExpired && lotsHidden;
                      const statusText = isExpired
                        ? "Vencido"
                        : isHidden
                          ? "Oculto"
                          : isLastChance
                            ? "Prioridade"
                            : "Publicado";

                      return (
                        <tr
                          key={lot.id}
                          className="border-b border-soil/5 hover:bg-cream-dark/20 transition-colors"
                        >
                          <td className="py-4 px-6 font-sans text-xs font-semibold text-bark">
                            {lot.lotCode}
                          </td>
                          <td className="py-4 px-6 font-sans text-sm font-medium text-soil">
                            {lot.productName || "Produto sem nome"}
                          </td>
                          <td className="py-4 px-6 font-sans text-sm font-semibold text-soil text-right">
                            {Number(lot.availableQty)}
                          </td>
                          <td className="py-4 px-6 font-sans text-xs text-bark">
                            {formatDate(lot.expiryDate)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span
                              title={
                                isHidden
                                  ? "Ainda nao aparece para compradores: conclua os passos de recebimento e localizacao da fazenda."
                                  : undefined
                              }
                              className={`inline-flex items-center px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider ${
                                isExpired
                                  ? "bg-red-100 text-red-700"
                                  : isHidden
                                    ? "bg-soil/10 text-bark border border-soil/15"
                                    : isLastChance
                                      ? "bg-orange-100 text-orange-600 border border-orange-200"
                                      : "bg-sage border border-forest/15 text-forest"
                              }`}
                            >
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 px-6 text-center text-bark text-sm font-sans"
                      >
                        Seu catalogo ainda nao tem lote recente.{" "}
                        <Link
                          href="/dashboard/inventario"
                          className="text-forest hover:underline font-semibold"
                        >
                          Publique o primeiro lote
                        </Link>{" "}
                        para aparecer na oferta da Frescari.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
