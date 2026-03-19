"use client";

import { startTransition, useDeferredValue, useState } from "react";
import Link from "next/link";
import { Button } from "@frescari/ui";
import {
    Calendar,
    User,
    Package,
    TruckIcon,
    CheckCircle2,
    XCircle,
    ShoppingBag,
    PackageOpen,
    LayoutGrid,
    ArrowLeft,
    Scale
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/trpc/react";
import { getSaleUnitLabel, isWeighableSaleUnit } from "@/lib/sale-units";

const statusStyles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    awaiting_weight: "bg-purple-100 text-purple-800 border-purple-200",
    confirmed: "bg-amber-100 text-amber-800 border-amber-200",
    picking: "bg-blue-100 text-blue-800 border-blue-200",
    ready_for_dispatch: "bg-violet-100 text-violet-800 border-violet-200",
    in_transit: "bg-sky-100 text-sky-800 border-sky-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
};

const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    awaiting_weight: "Aguard. Pesagem",
    confirmed: "Processando",
    picking: "Em separa\u00E7\u00E3o",
    ready_for_dispatch: "Pronto para sair",
    in_transit: "A Caminho",
    delivered: "Entregue",
    cancelled: "Cancelado",
};

const statusIcons: Record<string, React.ReactNode> = {
    awaiting_weight: <Scale className="w-3.5 h-3.5" />,
    confirmed: <Package className="w-3.5 h-3.5" />,
    picking: <Package className="w-3.5 h-3.5" />,
    ready_for_dispatch: <TruckIcon className="w-3.5 h-3.5" />,
    in_transit: <TruckIcon className="w-3.5 h-3.5" />,
    delivered: <CheckCircle2 className="w-3.5 h-3.5" />,
    cancelled: <XCircle className="w-3.5 h-3.5" />,
};

const statusFlow = ["awaiting_weight", "confirmed", "picking", "ready_for_dispatch", "in_transit", "delivered"] as const;
type NextOrderStatus = Exclude<(typeof statusFlow)[number], "awaiting_weight">;
const WEIGHT_SAFETY_MARGIN = 1.1;
const PLATFORM_FEE_RATE = 0.1;

interface ReceivedOrderItem {
    id: string;
    orderId: string;
    qty: string;
    unitPrice: string;
    productName: string;
    saleUnit: string;
}

interface ReceivedOrder {
    id: string;
    status: string;
    totalAmount: string;
    deliveryFee: string;
    createdAt: Date | string;
    buyerTenantId: string;
    buyerName: string;
    visualId: string;
    items: ReceivedOrderItem[];
}

interface WeighingPreview {
    itemSubtotal: number;
    deliveryFee: number;
    grossAmount: number;
    platformFee: number;
    netAmount: number;
    maxByItemId: Record<string, number>;
}

function roundToThreeDecimals(value: number) {
    return Math.round(value * 1000) / 1000;
}

function calculateWeighingPreview(order: ReceivedOrder, weights: Record<string, number>): WeighingPreview {
    const maxByItemId: Record<string, number> = {};

    const itemSubtotalCents = order.items.reduce((sum, item) => {
        const requestedQty = Number(item.qty);
        const isWeightBasedItem = isWeighableSaleUnit(item.saleUnit);
        const effectiveQty = isWeightBasedItem
            ? (weights[item.id] ?? requestedQty)
            : requestedQty;

        if (isWeightBasedItem) {
            maxByItemId[item.id] = roundToThreeDecimals(requestedQty * WEIGHT_SAFETY_MARGIN);
        }

        return sum + Math.round(effectiveQty * Number(item.unitPrice) * 100);
    }, 0);

    const deliveryFeeCents = Math.round(Number(order.deliveryFee ?? 0) * 100);
    const grossAmountCents = itemSubtotalCents + deliveryFeeCents;
    const platformFeeCents = Math.round(grossAmountCents * PLATFORM_FEE_RATE);

    return {
        itemSubtotal: itemSubtotalCents / 100,
        deliveryFee: deliveryFeeCents / 100,
        grossAmount: grossAmountCents / 100,
        platformFee: platformFeeCents / 100,
        netAmount: (grossAmountCents - platformFeeCents) / 100,
        maxByItemId,
    };
}

function TableSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-5 bg-white border border-border rounded-lg animate-pulse">
                    <div className="h-5 w-16 bg-sage rounded-sm" />
                    <div className="h-5 w-32 bg-sage rounded-sm" />
                    <div className="flex-1" />
                    <div className="h-5 w-20 bg-sage rounded-sm" />
                    <div className="h-8 w-28 bg-sage rounded-full" />
                </div>
            ))}
        </div>
    );
}

function WeighingSummarySkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="rounded-lg border border-soil/10 bg-cream-dark/40 p-4 space-y-3 animate-pulse"
                >
                    <div className="h-3 w-24 rounded-full bg-sage/70" />
                    <div className="h-6 w-28 rounded-full bg-sage/70" />
                    <div className="h-3 w-20 rounded-full bg-sage/50" />
                </div>
            ))}
        </div>
    );
}

export default function VendasPage() {
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // Modal state for weighing
    const [weighingOrder, setWeighingOrder] = useState<ReceivedOrder | null>(null);
    const [weighingWeights, setWeighingWeights] = useState<Record<string, number>>({});
    const deferredWeighingWeights = useDeferredValue(weighingWeights);

    const utils = trpc.useUtils();

    const { data: fetchOrders, isLoading } = trpc.order.listReceivedOrders.useQuery({
        status: filterStatus,
    });

    const { mutate: updateStatus, isPending: isUpdating } = trpc.order.updateOrderStatus.useMutation({
        onSuccess: () => {
            toast.success("Status do pedido atualizado!");
            void utils.order.listReceivedOrders.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "Erro ao atualizar status.");
        },
    });

    const { mutate: captureWeight, isPending: isCapturing } = trpc.order.captureWeighedOrder.useMutation({
        onSuccess: (data) => {
            toast.success(`Pesagem confirmada. L\u00EDquido a receber: ${formatCurrency(data?.netAmount ?? data?.finalAmount ?? 0)}`);
            setWeighingOrder(null);
            setWeighingWeights({});
            void utils.order.listReceivedOrders.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "Erro ao capturar pagamento.");
        },
    });

    const orders = fetchOrders as ReceivedOrder[] | undefined;

    const formatCurrency = (amount: string | number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(amount));

    const formatDate = (date: Date | string) =>
        new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));

    const getNextStatus = (currentStatus: string): NextOrderStatus | null => {
        const idx = statusFlow.findIndex((status) => status === currentStatus);
        if (idx === -1 || idx >= statusFlow.length - 1) return null;
        return statusFlow[idx + 1] as NextOrderStatus;
    };

    const weighingPreview = weighingOrder
        ? calculateWeighingPreview(weighingOrder, deferredWeighingWeights)
        : null;
    const isPreviewStale = Boolean(weighingOrder) && deferredWeighingWeights !== weighingWeights;
    const hasInvalidWeighing = weighingOrder
        ? weighingOrder.items.some((item) => {
            if (!isWeighableSaleUnit(item.saleUnit)) {
                return false;
            }

            const currentWeight = weighingWeights[item.id];
            const maxAllowedWeight = roundToThreeDecimals(Number(item.qty) * WEIGHT_SAFETY_MARGIN);

            return typeof currentWeight !== "number"
                || currentWeight <= 0
                || currentWeight > maxAllowedWeight;
        })
        : true;

    const handleAdvanceStatus = (orderId: string, currentStatus: string) => {
        const next = getNextStatus(currentStatus);
        if (!next) return;
        updateStatus({ orderId, status: next });
    };

    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-10">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-forest flex items-center justify-center shadow-sm">
                            <ShoppingBag className="w-6 h-6 text-cream" />
                        </div>
                        <div>
                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                                {"Gest\u00E3o de Vendas"}
                            </p>
                            <h1 className="font-display text-3xl font-black text-soil">
                                Pedidos Recebidos
                            </h1>
                        </div>
                    </div>
                    <Button variant="primary" asChild className="shrink-0 bg-forest hover:bg-forest/90 text-cream">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Voltar ao Painel
                        </Link>
                    </Button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { id: "all", label: "Todos" },
                        { id: "awaiting_weight", label: "Aguard. Pesagem" },
                        { id: "confirmed", label: "Processando" },
                        { id: "picking", label: "Em separa\u00E7\u00E3o" },
                        { id: "ready_for_dispatch", label: "Pronto para sair" },
                        { id: "in_transit", label: "A Caminho" },
                        { id: "delivered", label: "Entregue" },
                        { id: "cancelled", label: "Cancelado" },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilterStatus(f.id)}
                            className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide transition-colors border ${filterStatus === f.id
                                ? "bg-forest text-cream border-forest"
                                : "bg-white text-bark border-soil/10 hover:bg-sage/20 hover:text-forest hover:border-forest/30"
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Orders Table */}
                {isLoading ? (
                    <TableSkeleton />
                ) : orders && orders.length > 0 ? (
                    <div className="bg-cream border border-soil/8 shadow-card rounded-sm overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-soil/10 bg-cream-dark/30">
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">
                                            Pedido
                                        </th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">
                                            Comprador
                                        </th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80">
                                            Data
                                        </th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80 text-right">
                                            Total
                                        </th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80 text-center">
                                            Status
                                        </th>
                                        <th className="py-4 px-6 font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/80 text-center">
                                            {"A\u00E7\u00E3o"}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => {
                                        const nextStatus = getNextStatus(order.status);
                                        const isExpanded = expandedOrderId === order.id;

                                        return (
                                            <tr
                                                key={order.id}
                                                className="border-b border-soil/5 hover:bg-cream-dark/20 transition-colors cursor-pointer"
                                                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                            >
                                                <td className="py-4 px-6">
                                                    <span className="font-display font-bold text-forest">
                                                        #{order.visualId}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-bark/50" />
                                                        <span className="font-sans text-sm font-medium text-soil">
                                                            {order.buyerName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-1.5 text-xs text-bark">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {formatDate(order.createdAt)}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <span className="font-display font-bold text-soil">
                                                        {formatCurrency(order.totalAmount)}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyles[order.status] || statusStyles.draft
                                                            }`}
                                                    >
                                                        {statusIcons[order.status]}
                                                        {statusLabels[order.status] || order.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    {order.status === "awaiting_weight" ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const initialWeights = order.items.reduce((weights, item) => {
                                                                    if (isWeighableSaleUnit(item.saleUnit)) {
                                                                        weights[item.id] = Number(item.qty);
                                                                    }
                                                                    return weights;
                                                                }, {} as Record<string, number>);

                                                                startTransition(() => {
                                                                    setWeighingOrder(order);
                                                                    setWeighingWeights(initialWeights);
                                                                });
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-purple-700 transition-colors"
                                                        >
                                                            <Scale className="w-3.5 h-3.5" />
                                                            Pesar
                                                        </button>
                                                    ) : nextStatus && order.status !== "cancelled" ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAdvanceStatus(order.id, order.status);
                                                            }}
                                                            disabled={isUpdating}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-forest text-cream text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-forest/90 transition-colors disabled:opacity-50"
                                                        >
                                                            {statusIcons[nextStatus]}
                                                            {statusLabels[nextStatus]}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-bark/40">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Empty State */
                    <div className="py-24 border border-dashed border-soil/10 rounded-sm bg-white flex flex-col items-center justify-center gap-6 text-center shadow-card">
                        <div className="w-20 h-20 rounded-full bg-sage/50 flex items-center justify-center mb-2">
                            <PackageOpen className="w-10 h-10 text-forest/40" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h3 className="font-display text-2xl font-bold text-soil">
                                Nenhum pedido recebido
                            </h3>
                            <p className="font-sans text-sm text-bark leading-relaxed">
                                {"Quando compradores fizerem pedidos dos seus produtos, eles aparecer\u00E3o aqui para"}
                                {"que voc\u00EA possa gerenciar a entrega."}
                            </p>
                        </div>
                        <Button variant="primary" asChild className="mt-4 shadow-sm">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4" />
                                Voltar ao Painel
                            </Link>
                        </Button>
                    </div>
                )}
            </main>

            {/* WEIGHING MODAL */}
            {weighingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
                        <div className="p-6 border-b border-soil/10">
                            <h2 className="text-xl font-display font-bold text-soil flex items-center gap-2">
                                <Scale className="w-5 h-5 text-purple-600" />
                                {"Esta\u00E7\u00E3o de Pesagem"}
                            </h2>
                            <p className="text-sm text-bark mt-1">
                                Pedido #{weighingOrder.visualId} | {weighingOrder.buyerName}
                            </p>
                            <p className="mt-2 text-xs text-bark/70">
                                {"Itens vendidos por peso podem variar at\u00E9 10% acima da quantidade original."}
                            </p>
                        </div>
                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {isCapturing || !weighingPreview || isPreviewStale ? (
                                <WeighingSummarySkeleton />
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-soil/10 bg-cream-dark/40 p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-bark/70">
                                            Valor Bruto
                                        </p>
                                        <p className="mt-2 font-display text-2xl font-black text-soil">
                                            {formatCurrency(weighingPreview.grossAmount)}
                                        </p>
                                        <p className="mt-1 text-[11px] text-bark/70">
                                            Inclui entrega de {formatCurrency(weighingPreview.deliveryFee)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-purple-700">
                                            Frescari Fee
                                        </p>
                                        <p className="mt-2 font-display text-2xl font-black text-purple-900">
                                            {formatCurrency(weighingPreview.platformFee)}
                                        </p>
                                        <p className="mt-1 text-[11px] text-purple-800/80">
                                            10% sobre produtos + entrega
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                                            {"L\u00EDquido a Receber"}
                                        </p>
                                        <p className="mt-2 font-display text-2xl font-black text-emerald-900">
                                            {formatCurrency(weighingPreview.netAmount)}
                                        </p>
                                        <p className="mt-1 text-[11px] text-emerald-800/80">
                                            Produtos: {formatCurrency(weighingPreview.itemSubtotal)}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {weighingOrder.items.map(item => {
                                const isWeight = isWeighableSaleUnit(item.saleUnit);
                                const saleUnitLabel = getSaleUnitLabel(item.saleUnit);
                                const maxAllowedWeight = roundToThreeDecimals(Number(item.qty) * WEIGHT_SAFETY_MARGIN);
                                const currentWeight = weighingWeights[item.id];
                                const isOverLimit = isWeight && typeof currentWeight === "number" && currentWeight > maxAllowedWeight;
                                return (
                                    <div key={item.id} className="rounded-lg border border-soil/10 bg-white p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-soil">
                                                    {item.productName}
                                                </label>
                                                <p className="mt-1 text-[11px] text-bark/70">
                                                    Solicitado: {Number(item.qty).toFixed(isWeight ? 3 : 0)} {saleUnitLabel}
                                                </p>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${isWeight ? "bg-purple-100 text-purple-800" : "bg-sage/40 text-bark/70"}`}>
                                                {isWeight ? "Pes\u00E1vel" : "Quantidade fixa"}
                                            </span>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                                            <div className="space-y-2">
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                    max={isWeight ? maxAllowedWeight : undefined}
                                                    value={isWeight ? (weighingWeights[item.id] || '') : item.qty}
                                                    onChange={(e) => setWeighingWeights(prev => ({
                                                        ...prev,
                                                        [item.id]: parseFloat(e.target.value) || 0
                                                    }))}
                                                    disabled={!isWeight}
                                                    className={`w-full rounded-sm border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${!isWeight
                                                        ? "border-soil/10 bg-gray-100 text-bark/60"
                                                        : isOverLimit
                                                            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                                                            : "border-soil/20 focus:border-purple-500 focus:ring-purple-500"
                                                        }`}
                                                />
                                                {isWeight ? (
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-bark/70">
                                                        <span>{`Limite m\u00E1ximo: ${maxAllowedWeight.toFixed(3)} ${saleUnitLabel}`}</span>
                                                        <span>{`Unit\u00E1rio: ${formatCurrency(item.unitPrice)}/${saleUnitLabel}`}</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-bark/60">
                                                        {"Item n\u00E3o pes\u00E1vel. A quantidade permanece fixa."}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-xs font-bold text-bark uppercase w-14 text-right">
                                                {saleUnitLabel}
                                            </div>
                                        </div>
                                        {isOverLimit && (
                                            <p className="text-[11px] font-medium text-red-600">
                                                O peso informado ultrapassa o teto permitido de 10% para este item.
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex flex-col gap-3 border-t border-soil/10 bg-cream-dark/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[11px] text-bark/70">
                                A captura finaliza o pedido com os pesos informados e reconcilia o valor autorizado no Stripe.
                            </p>
                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => setWeighingOrder(null)}
                                    disabled={isCapturing}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => {
                                        const weighedItems = weighingOrder.items
                                            .filter((item) => isWeighableSaleUnit(item.saleUnit))
                                            .map((item) => ({
                                                orderItemId: item.id,
                                                finalWeight: weighingWeights[item.id],
                                            }))
                                            .filter((item): item is { orderItemId: string; finalWeight: number } =>
                                                typeof item.finalWeight === "number" && item.finalWeight > 0,
                                            );

                                        captureWeight({
                                            orderId: weighingOrder.id,
                                            weighedItems,
                                        });
                                    }}
                                    disabled={isCapturing || hasInvalidWeighing}
                                >
                                    {isCapturing ? "Capturando..." : "Confirmar pesagem e capturar"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

         </div>
     );
}
