"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@frescari/api";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  Clock3,
  MapPin,
  Sprout,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frescari/ui";

import { formatSaoPauloDateBR } from "@/lib/date-format";
import { trpc } from "@/trpc/react";

import { TenantHealthCard } from "./tenant-health-card";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TenantOperationsOverview =
  RouterOutputs["admin"]["getTenantOperationsOverview"];
type TenantHealthRecord = TenantOperationsOverview["tenants"][number];

const TENANTS_PAGE_SIZE = 6;

const healthOptions = [
  { label: "Todos", value: "ALL" as const },
  { label: "Pede preparo", value: "needs_setup" as const },
  { label: "Inativos", value: "inactive" as const },
  { label: "Operando", value: "operating" as const },
];

const typeOptions = [
  { label: "Todos", value: "ALL" as const },
  { label: "Produtores", value: "PRODUCER" as const },
  { label: "Compradores", value: "BUYER" as const },
];

const activityWindowOptions = [
  { label: "30 dias", value: 30 as const },
  { label: "90 dias", value: 90 as const },
];

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function formatDate(value: Date | string) {
  return formatSaoPauloDateBR(value, {
    day: "2-digit",
    month: "short",
  });
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-48 animate-pulse rounded-[32px] border border-forest/10 bg-cream/60" />
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-[28px] border border-forest/10 bg-white"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-[28px] border border-forest/10 bg-white"
            />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-[28px] border border-forest/10 bg-white"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function QueueCard(props: {
  description: string;
  emptyState: string;
  items: TenantHealthRecord[];
  title: string;
}) {
  return (
    <Card className="overflow-hidden border-forest/8 bg-white/95 shadow-[0_24px_52px_-40px_rgba(13,51,33,0.48)]">
      <CardHeader className="border-b border-forest/6 bg-cream/45">
        <CardTitle className="text-soil">{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        {props.items.length > 0 ? (
          props.items.map((tenant) => (
            <div
              key={tenant.tenant.id}
              className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {tenant.tenant.type === "PRODUCER"
                        ? "produtor"
                        : tenant.tenant.type === "BUYER"
                          ? "comprador"
                          : "conta"}
                    </Badge>
                    <Badge variant="secondary">{tenant.tenant.plan}</Badge>
                  </div>
                  <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
                    {tenant.tenant.name}
                  </p>
                  <p className="font-sans text-xs text-bark/62">
                    desde {formatDate(tenant.tenant.createdAt)}
                  </p>
                </div>
                <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ember">
                  {tenant.healthLabel}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-forest/14 bg-cream/40 px-4 py-6 font-sans text-sm leading-6 text-bark/68">
            {props.emptyState}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TenantOperationsClient() {
  const [health, setHealth] = useState<
    "ALL" | "inactive" | "needs_setup" | "operating"
  >("ALL");
  const [type, setType] = useState<"ALL" | "BUYER" | "PRODUCER">("ALL");
  const [activityWindowDays, setActivityWindowDays] = useState<30 | 90>(30);

  const tenantOperationsQuery =
    trpc.admin.getTenantOperationsOverview.useInfiniteQuery(
      {
        activityWindowDays,
        limit: TENANTS_PAGE_SIZE,
        health,
        type,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        refetchOnWindowFocus: false,
      },
    );

  const overview = tenantOperationsQuery.data?.pages[0];
  const loadedTenants =
    tenantOperationsQuery.data?.pages.flatMap((page) => page.tenants) ?? [];

  if (!overview) {
    return <LoadingState />;
  }
  const showProducerQueues = type !== "BUYER";
  const showBuyerQueues = type !== "PRODUCER";
  const summaryCards = [
    {
      copy: "Contas comerciais que batem com perfil, prontidao e janela selecionados.",
      icon: Building2,
      label: "Contas no recorte",
      value: overview.summary.totalTenants,
    },
    {
      copy: "Pessoas com acesso as contas comerciais deste recorte.",
      icon: Users,
      label: "Usuarios no recorte",
      value: overview.summary.totalUsers,
    },
    {
      copy: "Novas contas comerciais dentro da janela e do mesmo recorte.",
      icon: Clock3,
      label: "Novos na janela",
      value: overview.summary.newTenantsInWindow,
    },
    {
      copy: "Produtores com base pronta e lote vivo no catalogo.",
      icon: Sprout,
      label: "Produtores operando",
      value: overview.summary.producersOperating,
    },
    {
      copy: "Produtores que ainda precisam completar a base para vender.",
      icon: AlertTriangle,
      label: "Produtores em preparo",
      value: overview.summary.producersNeedingSetup,
    },
    {
      copy: "Compradores sem endereco pronto para fechar pedido.",
      icon: MapPin,
      label: "Compradores sem endereco",
      value: overview.summary.buyersWithoutAddress,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-forest/10 bg-[radial-gradient(circle_at_top_left,_rgba(213,229,216,0.9),_rgba(248,245,237,0.96)_45%,_rgba(255,255,255,1)_100%)] p-6 shadow-[0_30px_80px_-56px_rgba(13,51,33,0.58)] sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <Badge variant="secondary">prontidao da operacao</Badge>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-black tracking-[-0.06em] text-soil sm:text-5xl">
                Quem esta pronto, quem precisa de apoio e onde agir.
              </h1>
              <p className="max-w-2xl font-sans text-sm leading-7 text-bark/76 sm:text-base">
                A leitura mostra produtores e compradores por prontidao
                comercial: quem entrou, quem ainda precisa completar dados e
                quem ja roda no fluxo real de compra e venda.
              </p>
            </div>
          </div>

          <div className="space-y-4 xl:min-w-[28rem]">
            <div className="space-y-2">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/58">
                Janela de atividade
              </p>
              <div className="flex flex-wrap gap-2">
                {activityWindowOptions.map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => setActivityWindowDays(option.value)}
                    size="sm"
                    variant={
                      activityWindowDays === option.value ? "primary" : "ghost"
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/58">
                Tipo
              </p>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => setType(option.value)}
                    size="sm"
                    variant={type === option.value ? "primary" : "ghost"}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/58">
                Prontidao
              </p>
              <div className="flex flex-wrap gap-2">
                {healthOptions.map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => setHealth(option.value)}
                    size="sm"
                    variant={health === option.value ? "primary" : "ghost"}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Produtores sem base",
              value: overview.summary.producersWithoutFarm,
            },
            {
              label: "Produtores sem recebimento",
              value: overview.summary.producersWithoutStripe,
            },
            {
              label: "Compradores comprando",
              value: overview.summary.buyersActive,
            },
            {
              label: "Leitura atual",
              value: loadedTenants.length,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-forest/10 bg-white/80 px-5 py-5 backdrop-blur"
            >
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                {item.label}
              </p>
              <p className="mt-3 font-display text-3xl font-black tracking-[-0.04em] text-soil">
                {formatCompactNumber(item.value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {summaryCards.map((metric) => {
          const Icon = metric.icon;

          return (
            <Card
              className="overflow-hidden border-forest/8 bg-white/95 shadow-[0_24px_52px_-40px_rgba(13,51,33,0.48)]"
              key={metric.label}
            >
              <CardHeader className="border-b border-forest/6 bg-cream/45">
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="flex items-center justify-between gap-4 text-soil">
                  <span className="font-display text-3xl font-black tracking-[-0.04em]">
                    {formatCompactNumber(metric.value)}
                  </span>
                  <Icon className="h-5 w-5 text-forest" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <p className="font-sans text-sm leading-6 text-bark/72">
                  {metric.copy}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden border-forest/8 bg-white/95 shadow-[0_24px_52px_-40px_rgba(13,51,33,0.48)]">
          <CardHeader className="border-b border-forest/6 bg-cream/45">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-soil">Contas acompanhadas</CardTitle>
                <CardDescription>
                  Resumo, filas e cards usam o mesmo recorte filtrado.
                </CardDescription>
              </div>
              <p className="font-sans text-xs uppercase tracking-[0.16em] text-bark/58">
                {tenantOperationsQuery.isFetching &&
                !tenantOperationsQuery.isFetchingNextPage
                  ? "atualizando leitura"
                  : `${loadedTenants.length} de ${overview.summary.totalTenants} contas carregadas`}
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loadedTenants.length > 0 ? (
              <div className="space-y-4">
                {loadedTenants.map((tenant) => (
                  <TenantHealthCard key={tenant.tenant.id} tenant={tenant} />
                ))}
                {tenantOperationsQuery.hasNextPage ? (
                  <div className="flex flex-col gap-3 rounded-[22px] border border-dashed border-forest/14 bg-cream/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-sans text-sm leading-6 text-bark/68">
                      {loadedTenants.length} de {overview.summary.totalTenants}{" "}
                      contas carregadas.
                    </p>
                    <Button
                      disabled={tenantOperationsQuery.isFetchingNextPage}
                      onClick={() => void tenantOperationsQuery.fetchNextPage()}
                      variant="ghost"
                    >
                      {tenantOperationsQuery.isFetchingNextPage
                        ? "Carregando..."
                        : "Carregar mais contas"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-forest/14 bg-cream/40 px-5 py-8 font-sans text-sm leading-6 text-bark/68">
                Nenhuma conta comercial apareceu nesse recorte. Ajuste os
                filtros para ampliar a leitura.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {showProducerQueues ? (
            <QueueCard
              description="Produtores que ainda precisam completar a base para vender."
              emptyState="Nenhum produtor sem base apareceu nesta leitura."
              items={overview.queues.producersWithoutFarm}
              title="Produtores sem base"
            />
          ) : null}

          {showProducerQueues ? (
            <QueueCard
              description="Produtores que ainda precisam liberar o recebimento."
              emptyState="Nenhum produtor com recebimento pendente apareceu nesta leitura."
              items={overview.queues.producersWithoutStripe}
              title="Produtores sem recebimento"
            />
          ) : null}

          {showBuyerQueues ? (
            <QueueCard
              description="Compradores que ainda precisam cadastrar endereco para fechar pedido."
              emptyState="Nenhum comprador sem endereco apareceu nesta leitura."
              items={overview.queues.buyersWithoutAddress}
              title="Compradores sem endereco"
            />
          ) : null}

          <Card className="overflow-hidden border-forest/8 bg-white/95 shadow-[0_24px_52px_-40px_rgba(13,51,33,0.48)]">
            <CardHeader className="border-b border-forest/6 bg-cream/45">
              <CardTitle className="text-soil">Atalhos operacionais</CardTitle>
              <CardDescription>
                Saltos rapidos para agir onde a operacao pede atencao.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-1">
              <Button asChild variant="primary">
                <Link href="/admin/catalogo">Abrir catalogo base</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/admin">Voltar a visao geral</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/catalogo">Ver catalogo publico</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
