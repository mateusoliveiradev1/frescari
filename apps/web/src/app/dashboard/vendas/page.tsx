"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@frescari/ui";
import {
    Calendar,
    User,
    Package,
    TruckIcon,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ShoppingBag,
    PackageOpen,
    LayoutGrid,
    ArrowLeft,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { trpc } from "@/trpc/react";

const statusStyles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    confirmed: "bg-amber-100 text-amber-800 border-amber-200",
    picking: "bg-blue-100 text-blue-800 border-blue-200",
    in_transit: "bg-sky-100 text-sky-800 border-sky-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
};

const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    confirmed: "Processando",
    picking: "Em separação",
    in_transit: "A Caminho",
    delivered: "Entregue",
    cancelled: "Cancelado",
};

const statusIcons: Record<string, React.ReactNode> = {
    confirmed: <Package className="w-3.5 h-3.5" />,
    picking: <Package className="w-3.5 h-3.5" />,
    in_transit: <TruckIcon className="w-3.5 h-3.5" />,
    delivered: <CheckCircle2 className="w-3.5 h-3.5" />,
    cancelled: <XCircle className="w-3.5 h-3.5" />,
};

const statusFlow = ["confirmed", "picking", "in_transit", "delivered"];

interface ReceivedOrderItem {
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
    createdAt: Date | string;
    buyerTenantId: string;
    buyerName: string;
    visualId: string;
    items: ReceivedOrderItem[];
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

export default function VendasPage() {
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    const utils = trpc.useUtils();

    const { data: fetchOrders, isLoading } = (trpc.order as any).listReceivedOrders.useQuery({
        status: filterStatus,
    });

    const { mutate: updateStatus, isPending: isUpdating } = (trpc.order as any).updateOrderStatus.useMutation({
        onSuccess: () => {
            toast.success("Status do pedido atualizado!");
            (utils.order as any).listReceivedOrders.invalidate();
        },
        onError: (error: any) => {
            toast.error(error.message || "Erro ao atualizar status.");
        },
    });

    const orders = fetchOrders as ReceivedOrder[] | undefined;

    const formatCurrency = (amount: string | number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(amount));

    const formatDate = (date: Date | string) =>
        new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));

    const getNextStatus = (currentStatus: string): string | null => {
        const idx = statusFlow.indexOf(currentStatus);
        if (idx === -1 || idx >= statusFlow.length - 1) return null;
        return statusFlow[idx + 1];
    };

    const handleAdvanceStatus = (orderId: string, currentStatus: string) => {
        const next = getNextStatus(currentStatus);
        if (!next) return;
        updateStatus({ orderId, status: next });
    };

    return (
        <div className="min-h-screen bg-cream">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-10">
                {/* ── Page Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-forest flex items-center justify-center shadow-sm">
                            <ShoppingBag className="w-6 h-6 text-cream" />
                        </div>
                        <div>
                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                                Gestão de Vendas
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

                {/* ── Filter Pills ── */}
                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { id: "all", label: "Todos" },
                        { id: "confirmed", label: "Processando" },
                        { id: "picking", label: "Em separação" },
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

                {/* ── Orders Table ── */}
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
                                            Ação
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => {
                                        const nextStatus = getNextStatus(order.status);
                                        const isExpanded = expandedOrderId === order.id;

                                        return (
                                            <>
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
                                                        {nextStatus && order.status !== "cancelled" ? (
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
                                                            <span className="text-xs text-bark/40">—</span>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* Expanded items row */}
                                                {isExpanded && (
                                                    <tr key={`${order.id}-items`} className="bg-sage/10">
                                                        <td colSpan={6} className="px-6 py-4">
                                                            <div className="space-y-2">
                                                                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-bark/60 mb-3">
                                                                    Itens do Pedido
                                                                </p>
                                                                {order.items.map((item, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="flex items-center justify-between py-2 px-4 bg-white rounded-sm border border-soil/5"
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 bg-sage/30 rounded-sm flex items-center justify-center">
                                                                                <PackageOpen className="w-4 h-4 text-forest/40" />
                                                                            </div>
                                                                            <span className="font-sans text-sm font-medium text-soil">
                                                                                {item.productName}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-6 text-sm">
                                                                            <span className="text-bark">
                                                                                {item.qty}{" "}
                                                                                {item.saleUnit === "unit" ? "un" : item.saleUnit}
                                                                            </span>
                                                                            <span className="font-semibold text-soil">
                                                                                {formatCurrency(
                                                                                    Number(item.unitPrice) * Number(item.qty)
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* ── Empty State ── */
                    <div className="py-24 border border-dashed border-soil/10 rounded-sm bg-white flex flex-col items-center justify-center gap-6 text-center shadow-card">
                        <div className="w-20 h-20 rounded-full bg-sage/50 flex items-center justify-center mb-2">
                            <PackageOpen className="w-10 h-10 text-forest/40" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h3 className="font-display text-2xl font-bold text-soil">
                                Nenhum pedido recebido
                            </h3>
                            <p className="font-sans text-sm text-bark leading-relaxed">
                                Quando compradores fizerem pedidos dos seus produtos, eles aparecerão aqui para
                                que você possa gerenciar a entrega.
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

            <Toaster richColors position="bottom-right" />
        </div>
    );
}
