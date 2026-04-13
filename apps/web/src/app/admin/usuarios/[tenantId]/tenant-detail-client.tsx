"use client";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@frescari/api";
import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  CreditCard,
  MapPin,
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

import { formatSaoPauloDateBR } from "@/lib/date-format";
import { trpc } from "@/trpc/react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TenantAddressesPage = RouterOutputs["admin"]["getTenantAddressesPage"];
type TenantDetail = RouterOutputs["admin"]["getTenantOperationDetail"];
type TenantFarmsPage = RouterOutputs["admin"]["getTenantFarmsPage"];
type TenantLotsPage = RouterOutputs["admin"]["getTenantLotsPage"];
type TenantOrdersAsBuyerPage =
  RouterOutputs["admin"]["getTenantOrdersAsBuyerPage"];
type TenantOrdersAsSellerPage =
  RouterOutputs["admin"]["getTenantOrdersAsSellerPage"];
type TenantProductsPage = RouterOutputs["admin"]["getTenantProductsPage"];
type TenantUsersPage = RouterOutputs["admin"]["getTenantUsersPage"];

const DETAIL_LIST_PAGE_SIZE = 4;

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

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value));
}

function formatDateTime(value: Date | string) {
  return formatSaoPauloDateBR(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function getHealthBadgeClassName(health: TenantDetail["health"]["health"]) {
  if (health === "operating") {
    return "border-forest/20 bg-sage text-forest";
  }

  if (health === "inactive") {
    return "border-soil/15 bg-cream-dark text-soil";
  }

  return "border-ember/20 bg-ember/10 text-ember";
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-56 animate-pulse rounded-[32px] border border-forest/10 bg-cream/60" />
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[28px] border border-forest/10 bg-white"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-[28px] border border-forest/10 bg-white"
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState(props: { body: string; title: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-forest/14 bg-cream/40 px-5 py-8">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
        {props.title}
      </p>
      <p className="mt-3 font-sans text-sm leading-6 text-bark/68">
        {props.body}
      </p>
    </div>
  );
}

function SectionLoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-[22px] border border-forest/10 bg-cream/40"
        />
      ))}
    </div>
  );
}

function InfoCard(props: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="overflow-hidden border-forest/8 bg-white/95 shadow-[0_24px_52px_-40px_rgba(13,51,33,0.48)]">
      <CardHeader className="border-b border-forest/6 bg-cream/45">
        <CardTitle className="text-soil">{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">{props.children}</CardContent>
    </Card>
  );
}

function PeopleList({ users }: { users: TenantUsersPage["items"] }) {
  if (users.length === 0) {
    return (
      <EmptyState
        body="Nenhuma pessoa apareceu vinculada a esta conta comercial."
        title="Sem pessoas"
      />
    );
  }

  return users.map((user) => (
    <div
      key={user.id}
      className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
            {user.name}
          </p>
          <p className="font-sans text-sm leading-6 text-bark/72">
            {user.email}
          </p>
          <p className="font-sans text-xs text-bark/58">
            desde {formatDateTime(user.createdAt)}
          </p>
        </div>
        <Badge variant="secondary">{user.role}</Badge>
      </div>
    </div>
  ));
}

function AddressesList({
  addresses,
}: {
  addresses: TenantAddressesPage["items"];
}) {
  if (addresses.length === 0) {
    return (
      <EmptyState
        body="Esta conta comercial ainda nao cadastrou enderecos de entrega."
        title="Sem enderecos"
      />
    );
  }

  return addresses.map((address) => (
    <div
      key={address.id}
      className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
            {address.title}
          </p>
          <p className="font-sans text-sm leading-6 text-bark/72">
            {address.formattedAddress}
          </p>
          <p className="font-sans text-xs text-bark/58">
            {address.city}, {address.state}
          </p>
        </div>
        {address.isDefault ? <Badge variant="secondary">padrao</Badge> : null}
      </div>
    </div>
  ));
}

function FarmsList({ farms }: { farms: TenantFarmsPage["items"] }) {
  if (farms.length === 0) {
    return (
      <EmptyState
        body="Nenhuma fazenda apareceu vinculada a este produtor."
        title="Sem fazendas"
      />
    );
  }

  return farms.map((farm) => (
    <div
      key={farm.id}
      className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
    >
      <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
        {farm.name}
      </p>
      <p className="mt-2 font-sans text-sm leading-6 text-bark/72">
        {farm.address?.city && farm.address?.state
          ? `${farm.address.city}, ${farm.address.state}`
          : "Endereco da fazenda ainda incompleto"}
      </p>
      <p className="mt-2 font-sans text-xs text-bark/58">
        criada em {formatDateTime(farm.createdAt)}
      </p>
    </div>
  ));
}

function ProductsList({ products }: { products: TenantProductsPage["items"] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        body="Ainda nao existe catalogo publicado para esta conta comercial."
        title="Sem catalogo"
      />
    );
  }

  return products.map((product) => (
    <div
      key={product.id}
      className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
            {product.name}
          </p>
          <p className="font-sans text-xs text-bark/58">
            criado em {formatDateTime(product.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            lotes ativos
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {product.activeLotCount}
          </p>
        </div>
      </div>
    </div>
  ));
}

function LotsList({ lots }: { lots: TenantLotsPage["items"] }) {
  if (lots.length === 0) {
    return (
      <EmptyState
        body="Nenhum lote apareceu vinculado a esta conta comercial."
        title="Sem lotes"
      />
    );
  }

  return lots.map((lot) => (
    <div
      key={lot.id}
      className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            {lot.productName}
          </p>
          <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
            {lot.lotCode}
          </p>
          <p className="font-sans text-xs text-bark/58">
            expira em {formatDateTime(lot.expiryDate)}
          </p>
        </div>
        <div className="text-right">
          <Badge
            className={
              lot.isExpired
                ? "border-ember/20 bg-ember/10 text-ember"
                : "border-forest/18 bg-sage text-forest"
            }
            variant="outline"
          >
            {lot.isExpired ? "expirado" : "ativo"}
          </Badge>
          <p className="mt-2 font-sans text-sm font-semibold text-soil">
            {formatCompactNumber(Number(lot.availableQty))}
          </p>
        </div>
      </div>
    </div>
  ));
}

function OrdersList(props: {
  emptyBody: string;
  orders: TenantOrdersAsBuyerPage["items"] | TenantOrdersAsSellerPage["items"];
}) {
  if (props.orders.length === 0) {
    return <EmptyState body={props.emptyBody} title="Sem pedidos" />;
  }

  return props.orders.map((order) => (
    <div
      key={order.id}
      className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{formatStatus(order.status)}</Badge>
            {order.counterpartyName ? (
              <Badge variant="secondary">{order.counterpartyName}</Badge>
            ) : null}
          </div>
          <p className="font-display text-xl font-black tracking-[-0.03em] text-soil">
            Pedido {order.id.slice(0, 8)}
          </p>
          <p className="font-sans text-sm leading-6 text-bark/72">
            {order.deliveryCity}, {order.deliveryState}
          </p>
          <p className="font-sans text-xs text-bark/58">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <p className="font-sans text-sm font-semibold text-soil">
          {formatCurrency(order.totalAmount)}
        </p>
      </div>
    </div>
  ));
}

function PaginatedSectionFooter(props: {
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  loadedCount: number;
  onLoadMore: () => void;
}) {
  if (!props.hasNextPage) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-dashed border-forest/14 bg-cream/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-sans text-sm leading-6 text-bark/68">
        {props.loadedCount} itens carregados nesta secao.
      </p>
      <Button
        disabled={props.isFetchingNextPage}
        onClick={props.onLoadMore}
        variant="ghost"
      >
        {props.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
      </Button>
    </div>
  );
}

export function TenantDetailClient({ tenantId }: { tenantId: string }) {
  const [activityWindowDays, setActivityWindowDays] = useState<30 | 90>(30);
  const detailQuery = trpc.admin.getTenantOperationDetail.useQuery(
    {
      activityWindowDays,
      tenantId,
    },
    {
      placeholderData: (previousData) => previousData,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );
  const detail = detailQuery.data;
  const isProducer = detail?.tenant.type === "PRODUCER";
  const usersQuery = trpc.admin.getTenantUsersPage.useInfiniteQuery(
    {
      limit: DETAIL_LIST_PAGE_SIZE,
      tenantId,
    },
    {
      enabled: Boolean(detail),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
    },
  );
  const farmsQuery = trpc.admin.getTenantFarmsPage.useInfiniteQuery(
    {
      limit: DETAIL_LIST_PAGE_SIZE,
      tenantId,
    },
    {
      enabled: Boolean(detail) && isProducer,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
    },
  );
  const addressesQuery = trpc.admin.getTenantAddressesPage.useInfiniteQuery(
    {
      limit: DETAIL_LIST_PAGE_SIZE,
      tenantId,
    },
    {
      enabled: Boolean(detail) && !isProducer,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
    },
  );
  const productsQuery = trpc.admin.getTenantProductsPage.useInfiniteQuery(
    {
      limit: DETAIL_LIST_PAGE_SIZE,
      tenantId,
    },
    {
      enabled: Boolean(detail) && isProducer,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
    },
  );
  const lotsQuery = trpc.admin.getTenantLotsPage.useInfiniteQuery(
    {
      limit: DETAIL_LIST_PAGE_SIZE,
      tenantId,
    },
    {
      enabled: Boolean(detail) && isProducer,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchOnWindowFocus: false,
    },
  );
  const buyerOrdersQuery =
    trpc.admin.getTenantOrdersAsBuyerPage.useInfiniteQuery(
      {
        limit: DETAIL_LIST_PAGE_SIZE,
        tenantId,
      },
      {
        enabled: Boolean(detail) && !isProducer,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        refetchOnWindowFocus: false,
      },
    );
  const sellerOrdersQuery =
    trpc.admin.getTenantOrdersAsSellerPage.useInfiniteQuery(
      {
        limit: DETAIL_LIST_PAGE_SIZE,
        tenantId,
      },
      {
        enabled: Boolean(detail) && isProducer,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        refetchOnWindowFocus: false,
      },
    );
  const userItems = usersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const farmItems = farmsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const addressItems =
    addressesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const productItems =
    productsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const lotItems = lotsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const buyerOrderItems =
    buyerOrdersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const sellerOrderItems =
    sellerOrdersQuery.data?.pages.flatMap((page) => page.items) ?? [];

  if (!detail) {
    if (detailQuery.error) {
      return (
        <Card className="border-forest/8 bg-white/95 shadow-[0_24px_52px_-40px_rgba(13,51,33,0.48)]">
          <CardHeader>
            <CardTitle className="text-soil">Conta nao encontrada</CardTitle>
            <CardDescription>
              Nao encontramos uma conta comercial com esse identificador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="primary">
              <Link href="/admin/usuarios">Voltar para contas</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    return <LoadingState />;
  }
  const tenantLabel =
    detail.tenant.type === "PRODUCER"
      ? "produtor"
      : detail.tenant.type === "BUYER"
        ? "comprador"
        : "conta";

  const summaryCards = isProducer
    ? [
        {
          icon: Users,
          label: "Usuarios",
          value: detail.summary.userCount,
        },
        {
          icon: Building2,
          label: "Fazendas",
          value: detail.summary.farmCount,
        },
        {
          icon: Sprout,
          label: "Produtos ativos",
          value: detail.summary.productCount,
        },
        {
          icon: ShoppingCart,
          label: "Fila operacional",
          value: detail.summary.sellerOperationalOrderCount,
        },
      ]
    : [
        {
          icon: Users,
          label: "Usuarios",
          value: detail.summary.userCount,
        },
        {
          icon: MapPin,
          label: "Enderecos",
          value: detail.summary.addressCount,
        },
        {
          icon: ShoppingCart,
          label: "Pedidos na janela",
          value: detail.summary.buyerOrderCount,
        },
        {
          icon: CreditCard,
          label: "Plano",
          value: detail.tenant.plan,
        },
      ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-forest/10 bg-[radial-gradient(circle_at_top_left,_rgba(213,229,216,0.9),_rgba(248,245,237,0.96)_45%,_rgba(255,255,255,1)_100%)] p-6 shadow-[0_30px_80px_-56px_rgba(13,51,33,0.58)] sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{tenantLabel}</Badge>
              <Badge variant="secondary">{detail.tenant.plan}</Badge>
              <Badge
                className={getHealthBadgeClassName(detail.health.health)}
                variant="outline"
              >
                {detail.health.healthLabel}
              </Badge>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-black tracking-[-0.06em] text-soil sm:text-5xl">
                {detail.tenant.name}
              </h1>
              <p className="max-w-2xl font-sans text-sm leading-7 text-bark/76 sm:text-base">
                Leitura de uma conta comercial em profundidade: pessoas, base,
                catalogo, pedidos e sinais de prontidao.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-bark/58">
              <span>identificador {detail.tenant.slug}</span>
              <span>desde {formatDateTime(detail.tenant.createdAt)}</span>
              <span>prontidao {detail.health.progressPercent}%</span>
            </div>
          </div>

          <div className="space-y-4 xl:min-w-[24rem]">
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

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="primary">
                <Link href="/admin/usuarios">Voltar para contas</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/admin">Painel admin</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
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
                    {typeof metric.value === "number"
                      ? formatCompactNumber(metric.value)
                      : metric.value}
                  </span>
                  <Icon className="h-5 w-5 text-forest" />
                </CardTitle>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <InfoCard
          description="Pessoas com acesso e papel operacional nesta conta comercial."
          title="Pessoas"
        >
          {usersQuery.data ? (
            <>
              <PeopleList users={userItems} />
              <PaginatedSectionFooter
                hasNextPage={usersQuery.hasNextPage}
                isFetchingNextPage={usersQuery.isFetchingNextPage}
                loadedCount={userItems.length}
                onLoadMore={() => void usersQuery.fetchNextPage()}
              />
            </>
          ) : (
            <SectionLoadingState />
          )}
        </InfoCard>

        <InfoCard
          description={
            isProducer
              ? "Base fisica e operacional do produtor."
              : "Enderecos prontos para o ciclo comercial."
          }
          title={isProducer ? "Base operacional" : "Enderecos"}
        >
          {isProducer ? (
            farmsQuery.data ? (
              <>
                <FarmsList farms={farmItems} />
                <PaginatedSectionFooter
                  hasNextPage={farmsQuery.hasNextPage}
                  isFetchingNextPage={farmsQuery.isFetchingNextPage}
                  loadedCount={farmItems.length}
                  onLoadMore={() => void farmsQuery.fetchNextPage()}
                />
              </>
            ) : (
              <SectionLoadingState />
            )
          ) : addressesQuery.data ? (
            <>
              <AddressesList addresses={addressItems} />
              <PaginatedSectionFooter
                hasNextPage={addressesQuery.hasNextPage}
                isFetchingNextPage={addressesQuery.isFetchingNextPage}
                loadedCount={addressItems.length}
                onLoadMore={() => void addressesQuery.fetchNextPage()}
              />
            </>
          ) : (
            <SectionLoadingState />
          )}
        </InfoCard>

        {isProducer ? (
          <InfoCard
            description="Catalogo ativo e quantidade de lotes vivos por produto."
            title="Catalogo vivo"
          >
            {productsQuery.data ? (
              <>
                <ProductsList products={productItems} />
                <PaginatedSectionFooter
                  hasNextPage={productsQuery.hasNextPage}
                  isFetchingNextPage={productsQuery.isFetchingNextPage}
                  loadedCount={productItems.length}
                  onLoadMore={() => void productsQuery.fetchNextPage()}
                />
              </>
            ) : (
              <SectionLoadingState />
            )}
          </InfoCard>
        ) : null}

        {isProducer ? (
          <InfoCard
            description="Lotes recentes para entender disponibilidade e expiracao."
            title="Lotes recentes"
          >
            {lotsQuery.data ? (
              <>
                <LotsList lots={lotItems} />
                <PaginatedSectionFooter
                  hasNextPage={lotsQuery.hasNextPage}
                  isFetchingNextPage={lotsQuery.isFetchingNextPage}
                  loadedCount={lotItems.length}
                  onLoadMore={() => void lotsQuery.fetchNextPage()}
                />
              </>
            ) : (
              <SectionLoadingState />
            )}
          </InfoCard>
        ) : null}

        <InfoCard
          description={
            isProducer
              ? "Pedidos em que este produtor aparece como origem da oferta."
              : "Pedidos recentes feitos por esta conta compradora."
          }
          title={isProducer ? "Pedidos de venda" : "Pedidos de compra"}
        >
          {(isProducer ? sellerOrdersQuery.data : buyerOrdersQuery.data) ? (
            <>
              <OrdersList
                emptyBody={
                  isProducer
                    ? "Nenhum pedido de venda apareceu para esta conta comercial."
                    : "Nenhum pedido recente apareceu para esta conta comercial."
                }
                orders={isProducer ? sellerOrderItems : buyerOrderItems}
              />
              <PaginatedSectionFooter
                hasNextPage={
                  isProducer
                    ? sellerOrdersQuery.hasNextPage
                    : buyerOrdersQuery.hasNextPage
                }
                isFetchingNextPage={
                  isProducer
                    ? sellerOrdersQuery.isFetchingNextPage
                    : buyerOrdersQuery.isFetchingNextPage
                }
                loadedCount={
                  isProducer ? sellerOrderItems.length : buyerOrderItems.length
                }
                onLoadMore={() =>
                  void (isProducer
                    ? sellerOrdersQuery.fetchNextPage()
                    : buyerOrdersQuery.fetchNextPage())
                }
              />
            </>
          ) : (
            <SectionLoadingState />
          )}
        </InfoCard>

        <InfoCard
          description="Leitura curta dos bloqueios e sinais que mais pesam na prontidao."
          title="Sinais operacionais"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {detail.health.checklist.map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-forest/10 bg-white px-4 py-4"
              >
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                  {item.label}
                </p>
                <p className="mt-2 font-sans text-sm leading-6 text-bark/72">
                  {item.done ? "Concluido" : "Pendente"}
                </p>
              </div>
            ))}
            <div className="rounded-[22px] border border-forest/10 bg-white px-4 py-4">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                Recebimento
              </p>
              <p className="mt-2 font-sans text-sm leading-6 text-bark/72">
                {detail.summary.stripeConnected
                  ? "Recebimento pronto"
                  : "Recebimento pendente"}
              </p>
            </div>
            <div className="rounded-[22px] border border-forest/10 bg-white px-4 py-4">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
                Janela comercial
              </p>
              <p className="mt-2 font-sans text-sm leading-6 text-bark/72">
                {isProducer
                  ? `${detail.summary.sellerOperationalOrderCount} pedidos operacionais`
                  : `${detail.summary.buyerOrderCount} pedidos recentes`}
              </p>
            </div>
          </div>
        </InfoCard>
      </section>
    </div>
  );
}
