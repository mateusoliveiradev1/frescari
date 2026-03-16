"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@frescari/api";
import Link from "next/link";
import { useState } from "react";
import {
    AlertTriangle,
    BarChart3,
    Boxes,
    ShoppingCart,
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

import { trpc } from "@/trpc/react";

import { AdminTrendChart } from "./admin-trend-chart";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AdminDashboardOverview = RouterOutputs["admin"]["getDashboardOverview"];

const periodOptions = [
    { label: "7 dias", value: 7 as const },
    { label: "30 dias", value: 30 as const },
    { label: "90 dias", value: 90 as const },
];

const trendOptions = [
    { label: "Pedidos", value: "orders" as const },
    { label: "GMV", value: "gmv" as const },
    { label: "Produtores", value: "producers" as const },
];

const metricCardClassName =
    "overflow-hidden border-forest/8 bg-white/95 shadow-[0_24px_52px_-40px_rgba(13,51,33,0.48)]";

function formatCompactNumber(value: number) {
    return new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: value >= 1000 ? 1 : 0,
        notation: value >= 1000 ? "compact" : "standard",
    }).format(value);
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
        currency: "BRL",
        maximumFractionDigits: 0,
        style: "currency",
    }).format(value);
}

function formatDateTime(value: Date | string) {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
    }).format(new Date(value));
}

function formatStatus(status: string) {
    return status.replaceAll("_", " ");
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
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="h-[28rem] animate-pulse rounded-[28px] border border-forest/10 bg-white" />
                <div className="h-[28rem] animate-pulse rounded-[28px] border border-forest/10 bg-white" />
            </div>
        </div>
    );
}

export function AdminOverview({
    initialData,
}: {
    initialData?: AdminDashboardOverview;
}) {
    const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
    const [trendMetric, setTrendMetric] = useState<"gmv" | "orders" | "producers">("orders");
    const dashboardQuery = trpc.admin.getDashboardOverview.useQuery(
        { periodDays },
        {
            initialData: periodDays === 30 ? initialData : undefined,
            placeholderData: (previousData) => previousData,
            refetchOnWindowFocus: false,
        },
    );

    if (!dashboardQuery.data) {
        return <LoadingState />;
    }

    const dashboard = dashboardQuery.data;
    const metricCards = [
        {
            copy: "Pedidos confirmados e em andamento dentro da janela filtrada.",
            icon: ShoppingCart,
            label: "Pedidos na janela",
            value: formatCompactNumber(dashboard.kpis.ordersInWindow),
        },
        {
            copy: "Volume financeiro operacional para leitura rapida do momento.",
            icon: BarChart3,
            label: "GMV na janela",
            value: formatCurrency(dashboard.kpis.gmvInWindow),
        },
        {
            copy: "Produtores com lotes validos e saldo disponivel agora.",
            icon: Sprout,
            label: "Produtores com estoque",
            value: formatCompactNumber(dashboard.kpis.activeProducerTenants),
        },
        {
            copy: "Compradores com pedidos ativos no periodo selecionado.",
            icon: Users,
            label: "Compradores ativos",
            value: formatCompactNumber(dashboard.kpis.activeBuyersInWindow),
        },
        {
            copy: "Lotes vivos no catalogo, sem expiracao e com saldo positivo.",
            icon: Boxes,
            label: "Lotes disponiveis",
            value: formatCompactNumber(dashboard.kpis.activeLots),
        },
        {
            copy: "Itens com lacuna de cadastro, imagem ou expiracao com saldo.",
            icon: AlertTriangle,
            label: "Alertas de catalogo",
            value: formatCompactNumber(dashboard.kpis.catalogAlerts),
        },
    ];

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[34px] border border-forest/10 bg-[radial-gradient(circle_at_top_left,_rgba(213,229,216,0.9),_rgba(248,245,237,0.96)_45%,_rgba(255,255,255,1)_100%)] p-6 shadow-[0_30px_80px_-56px_rgba(13,51,33,0.58)] sm:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl space-y-4">
                        <Badge variant="secondary">cockpit operacional da plataforma</Badge>
                        <div className="space-y-3">
                            <h1 className="font-display text-4xl font-black tracking-[-0.06em] text-soil sm:text-5xl">
                                Operacao admin em uma tela.
                            </h1>
                            <p className="max-w-2xl font-sans text-sm leading-7 text-bark/76 sm:text-base">
                                O foco aqui nao e analytics de vaidade. E fila, saude de
                                catalogo e ritmo operacional para decidir onde atuar primeiro.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 xl:min-w-[24rem]">
                        <div className="flex flex-wrap gap-2">
                            {periodOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    onClick={() => setPeriodDays(option.value)}
                                    size="sm"
                                    variant={periodDays === option.value ? "primary" : "ghost"}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                        <p className="font-sans text-xs uppercase tracking-[0.16em] text-bark/58">
                            {dashboardQuery.isFetching ? "atualizando dados" : "dados consolidados"}{" "}
                            em {formatDateTime(dashboard.generatedAt)}
                        </p>
                    </div>
                </div>

                <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[
                        {
                            label: "Produtores cadastrados",
                            value: dashboard.totals.producerTenants,
                        },
                        {
                            label: "Compradores cadastrados",
                            value: dashboard.totals.buyerTenants,
                        },
                        {
                            label: "Categorias maes",
                            value: dashboard.totals.categories,
                        },
                        {
                            label: "Produtos mestres",
                            value: dashboard.totals.masterProducts,
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
                {metricCards.map((metric) => {
                    const Icon = metric.icon;

                    return (
                        <Card className={metricCardClassName} key={metric.label}>
                            <CardHeader className="border-b border-forest/6 bg-cream/45">
                                <CardDescription>{metric.label}</CardDescription>
                                <CardTitle className="flex items-center justify-between gap-4 text-soil">
                                    <span className="font-display text-3xl font-black tracking-[-0.04em]">
                                        {metric.value}
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

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className={metricCardClassName}>
                    <CardHeader className="border-b border-forest/6 bg-cream/45">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="space-y-2">
                                <CardTitle className="text-soil">Ritmo operacional</CardTitle>
                                <CardDescription>
                                    Tendencia da janela selecionada para pedidos, GMV e entrada de
                                    produtores.
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {trendOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        onClick={() => setTrendMetric(option.value)}
                                        size="sm"
                                        variant={
                                            trendMetric === option.value ? "primary" : "ghost"
                                        }
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <AdminTrendChart metric={trendMetric} points={dashboard.trend} />
                    </CardContent>
                </Card>

                <Card className={metricCardClassName}>
                    <CardHeader className="border-b border-forest/6 bg-cream/45">
                        <CardTitle className="text-soil">Leitura de atencao</CardTitle>
                        <CardDescription>
                            O que pede acao agora, sem precisar navegar o painel inteiro.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        {[
                            {
                                copy: "Pedidos aguardando peso, picking ou entrega.",
                                label: "Operacao",
                                value: dashboard.attention.operationalOrders,
                            },
                            {
                                copy: "Produtores sem fazenda vinculada e ainda fora do fluxo.",
                                label: "Onboarding",
                                value: dashboard.attention.producerOnboarding,
                            },
                            {
                                copy: `${dashboard.catalogBreakdown.productsWithoutMaster} produtos sem mestre, ${dashboard.catalogBreakdown.masterProductsWithoutImage} mestres sem imagem e ${dashboard.catalogBreakdown.expiredLotsWithStock} lotes vencidos com saldo.`,
                                label: "Catalogo",
                                value: dashboard.attention.catalogAlerts,
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="rounded-[24px] border border-forest/10 bg-white px-5 py-5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                                            {item.label}
                                        </p>
                                        <p className="font-sans text-sm leading-6 text-bark/72">
                                            {item.copy}
                                        </p>
                                    </div>
                                    <span className="font-display text-3xl font-black tracking-[-0.04em] text-soil">
                                        {formatCompactNumber(item.value)}
                                    </span>
                                </div>
                            </div>
                        ))}

                        <div className="grid gap-3 pt-2 sm:grid-cols-2">
                            <Button asChild variant="primary">
                                <Link href="/admin/catalogo">Abrir catalogo mestre</Link>
                            </Button>
                            <Button asChild variant="ghost">
                                <Link href="/catalogo">Ver marketplace</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
                <Card className={metricCardClassName}>
                    <CardHeader className="border-b border-forest/6 bg-cream/45">
                        <CardTitle className="text-soil">Pedidos que pedem toque</CardTitle>
                        <CardDescription>
                            Fila operacional para destravar a plataforma.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-6">
                        {dashboard.queues.operationalOrders.length > 0 ? (
                            dashboard.queues.operationalOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-2">
                                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                                                {formatStatus(order.status)}
                                            </p>
                                            <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
                                                {order.sellerName}
                                            </p>
                                            <p className="font-sans text-xs text-bark/62">
                                                {formatDateTime(order.createdAt)}
                                            </p>
                                        </div>
                                        <span className="font-sans text-sm font-semibold text-soil">
                                            {formatCurrency(Number(order.totalAmount))}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[22px] border border-dashed border-forest/14 bg-cream/40 px-4 py-6 font-sans text-sm leading-6 text-bark/68">
                                Nenhum pedido precisa de acao manual agora.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className={metricCardClassName}>
                    <CardHeader className="border-b border-forest/6 bg-cream/45">
                        <CardTitle className="text-soil">Produtores fora do fluxo</CardTitle>
                        <CardDescription>
                            Tenants que ainda nao chegaram na base operacional minima.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-6">
                        {dashboard.queues.onboardingTenants.length > 0 ? (
                            dashboard.queues.onboardingTenants.map((tenant) => (
                                <div
                                    key={tenant.id}
                                    className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
                                >
                                    <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
                                        {tenant.name}
                                    </p>
                                    <p className="mt-2 font-sans text-xs text-bark/62">
                                        cadastrado em {formatDateTime(tenant.createdAt)}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[22px] border border-dashed border-forest/14 bg-cream/40 px-4 py-6 font-sans text-sm leading-6 text-bark/68">
                                Nenhum produtor esta travado na etapa de onboarding.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className={metricCardClassName}>
                    <CardHeader className="border-b border-forest/6 bg-cream/45">
                        <CardTitle className="text-soil">Gaps de catalogo</CardTitle>
                        <CardDescription>
                            Itens com ruina operacional antes de virar problema publico.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-6">
                        {dashboard.queues.catalogIssues.length > 0 ? (
                            dashboard.queues.catalogIssues.map((issue) => (
                                <div
                                    key={`${issue.label}-${issue.id}`}
                                    className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
                                >
                                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                                        {issue.label}
                                    </p>
                                    <p className="mt-2 font-display text-xl font-black tracking-[-0.03em] text-soil">
                                        {issue.title}
                                    </p>
                                    <p className="mt-1 font-sans text-sm leading-6 text-bark/68">
                                        {issue.subtitle}
                                    </p>
                                    <p className="mt-2 font-sans text-xs text-bark/58">
                                        {formatDateTime(issue.createdAt)}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[22px] border border-dashed border-forest/14 bg-cream/40 px-4 py-6 font-sans text-sm leading-6 text-bark/68">
                                Nenhuma ruptura de catalogo relevante apareceu nesta leitura.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
