import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@frescari/api";
import Link from "next/link";
import { Badge } from "@frescari/ui";

import { formatSaoPauloDateBR } from "@/lib/date-format";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TenantHealthCardProps = {
  tenant: RouterOutputs["admin"]["getTenantOperationsOverview"]["tenants"][number];
};

function formatDateTime(value: Date | string) {
  return formatSaoPauloDateBR(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getHealthBadgeClassName(
  health: TenantHealthCardProps["tenant"]["health"],
) {
  if (health === "operating") {
    return "border-forest/20 bg-sage text-forest";
  }

  if (health === "inactive") {
    return "border-soil/15 bg-cream-dark text-soil";
  }

  return "border-ember/20 bg-ember/10 text-ember";
}

export function TenantHealthCard({ tenant }: TenantHealthCardProps) {
  const isProducer = tenant.tenant.type === "PRODUCER";
  const tenantLabel =
    tenant.tenant.type === "PRODUCER"
      ? "produtor"
      : tenant.tenant.type === "BUYER"
        ? "comprador"
        : "tenant";

  return (
    <div className="rounded-[28px] border border-forest/10 bg-white px-5 py-5 shadow-[0_22px_48px_-40px_rgba(13,51,33,0.5)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{tenantLabel}</Badge>
            <Badge variant="secondary">{tenant.tenant.plan}</Badge>
            <Badge
              className={getHealthBadgeClassName(tenant.health)}
              variant="outline"
            >
              {tenant.healthLabel}
            </Badge>
          </div>
          <h3 className="font-display text-3xl font-black tracking-[-0.05em] text-soil">
            {tenant.tenant.name}
          </h3>
          <p className="font-sans text-xs uppercase tracking-[0.16em] text-bark/58">
            desde {formatDateTime(tenant.tenant.createdAt)}
          </p>
        </div>

        <div className="min-w-[12rem] space-y-2">
          <div className="flex items-center justify-between font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-bark/58">
            <span>Prontidao</span>
            <span>{tenant.progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-cream-dark">
            <div
              className="h-2 rounded-full bg-forest transition-[width] duration-300"
              style={{ width: `${tenant.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tenant.checklist.map((item) => (
          <Badge
            key={item.label}
            className={
              item.done
                ? "border-forest/18 bg-sage text-forest"
                : "border-soil/14 bg-cream-dark text-bark/62"
            }
            variant="outline"
          >
            {item.done ? "ok" : "pendente"} {item.label}
          </Badge>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] border border-forest/10 bg-cream/45 px-4 py-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            Usuarios
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {tenant.userCount}
          </p>
        </div>
        <div className="rounded-[20px] border border-forest/10 bg-cream/45 px-4 py-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            {isProducer ? "Fazendas" : "Enderecos"}
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {isProducer ? tenant.farmCount : tenant.addressCount}
          </p>
        </div>
        <div className="rounded-[20px] border border-forest/10 bg-cream/45 px-4 py-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            {isProducer ? "Lotes ativos" : "Pedidos recentes"}
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {isProducer ? tenant.activeLotCount : tenant.buyerOrderCount}
          </p>
        </div>
        <div className="rounded-[20px] border border-forest/10 bg-cream/45 px-4 py-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
            {isProducer ? "Fila operacional" : "Sinal comercial"}
          </p>
          <p className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-soil">
            {isProducer
              ? tenant.sellerOperationalOrderCount
              : tenant.buyerOrderCount}
          </p>
          <p className="mt-2 font-sans text-xs leading-5 text-bark/64">
            {isProducer
              ? tenant.stripeConnected
                ? "Stripe conectado"
                : "Stripe pendente"
              : tenant.buyerOrderCount > 0
                ? "Comprando na janela"
                : "Sem atividade recente"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Link
          className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-forest underline-offset-4 transition-colors hover:text-soil hover:underline"
          href={`/admin/usuarios/${tenant.tenant.id}`}
        >
          Abrir detalhe
        </Link>
      </div>
    </div>
  );
}
