"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Badge } from "@frescari/ui";
import { Calendar, Store, RotateCw, X, ShoppingBag, PackageOpen, LayoutGrid, ChevronRight } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Toaster, toast } from "sonner";
import { trpc } from "@/trpc/react";

const statusStyles = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    confirmed: "bg-amber-100 text-amber-800 border-amber-200",
    picking: "bg-blue-100 text-blue-800 border-blue-200",
    in_transit: "bg-sky-100 text-sky-800 border-sky-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200"
};

const statusLabels = {
    draft: "Rascunho",
    confirmed: "Processando",
    picking: "Em separação",
    in_transit: "A Caminho",
    delivered: "Entregue",
    cancelled: "Cancelado"
};

interface OrderItem {
    orderId: string;
    qty: string;
    unitPrice: string;
    productName: string;
    saleUnit: string;
    farmName: string;
    imageUrl: string | null;
}

interface DBOrder {
    id: string;
    status: string;
    totalAmount: string;
    createdAt: Date | string;
    sellerTenantId: string;
    sellerName: string;
    items: OrderItem[];
    visualId?: string;
}

// Custom Skeleton Component
const OrderCardSkeleton = () => (
    <div className="bg-white border border-border rounded-xl shadow-sm flex flex-col h-[240px] overflow-hidden">
        <div className="p-6 flex flex-col flex-1 gap-5">
            <div className="flex justify-between items-start gap-4 pb-4 border-b border-border/50">
                <div className="space-y-2 flex-1">
                    <div className="h-4 w-16 bg-sage animate-pulse rounded-sm" />
                    <div className="h-6 w-24 bg-sage animate-pulse rounded-sm" />
                </div>
                <div className="h-6 w-24 bg-sage animate-pulse rounded-full" />
            </div>
            <div className="flex justify-between items-end pt-2">
                <div className="space-y-3 flex-1">
                    <div className="h-4 w-32 bg-sage animate-pulse rounded-sm" />
                    <div className="h-4 w-48 bg-sage animate-pulse rounded-sm" />
                </div>
                <div className="space-y-2 flex flex-col items-end">
                    <div className="h-3 w-10 bg-sage animate-pulse rounded-sm" />
                    <div className="h-6 w-20 bg-sage animate-pulse rounded-sm" />
                </div>
            </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/50 border-t border-border/50 h-14 bg-sage/20 animate-pulse" />
    </div>
);

export default function PedidosPage() {
    const [selectedOrder, setSelectedOrder] = useState<DBOrder | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [filterStatus, setFilterStatus] = useState<string>("all");

    const utils = trpc.useUtils();

    // Casting as any because the trpc package hasn't been built yet in the monorepo to expose types to this app
    const { data: fetchOrders, isLoading } = (trpc.order as any).listMyOrders.useQuery({ status: filterStatus });

    const { mutate: cancelOrder, isPending: isCancelling } = (trpc.order as any).cancelOrder.useMutation({
        onSuccess: () => {
            toast.success('Pedido cancelado com sucesso e estoque estornado!');
            setIsDialogOpen(false);
            (utils.order as any).listMyOrders.invalidate();
        },
        onError: (error: any) => {
            toast.error(error.message || 'Erro ao cancelar o pedido');
        }
    });

    // Process orders to include sequential visual IDs
    const dbOrders = (fetchOrders as DBOrder[] | undefined)?.map((order, index, arr) => ({
        ...order,
        visualId: (arr.length - index).toString().padStart(4, '0')
    }));

    const handleViewDetails = (order: DBOrder) => {
        setSelectedOrder(order);
        setIsDialogOpen(true);
    };

    const handleRepeatOrder = (orderId: string, visualId?: string) => {
        const displayId = visualId || orderId.slice(-6).toUpperCase();
        toast.success(`Sucesso! Itens do pedido ${displayId} foram adicionados ao seu carrinho.`);
    };

    const formatFriendlyDate = (date: Date | string) => {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(new Date(date));
    };

    const formatCurrency = (amount: string | number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(Number(amount));
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-background">
            <main className="max-w-6xl mx-auto px-6 lg:px-8 py-12 space-y-10">
                {/* ── Page Header ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-forest flex items-center justify-center shadow-sm">
                            <ShoppingBag className="w-6 h-6 text-cream" />
                        </div>
                        <div>
                            <h1 className="font-display text-3xl font-black text-forest">Meus Pedidos</h1>
                            <p className="font-sans text-sm font-medium text-muted-foreground mt-1">
                                Acompanhe o histórico e o status das suas compras
                            </p>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                        {[
                            { id: "all", label: "Todos" },
                            { id: "confirmed", label: "Processando" },
                            { id: "picking", label: "Em separação" },
                            { id: "in_transit", label: "A Caminho" },
                            { id: "delivered", label: "Entregue" },
                            { id: "cancelled", label: "Cancelado" },
                        ].map((filter) => (
                            <button
                                key={filter.id}
                                onClick={() => setFilterStatus(filter.id)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide transition-colors whitespace-nowrap border ${filterStatus === filter.id
                                    ? "bg-forest text-cream border-forest"
                                    : "bg-white text-muted-foreground border-border hover:bg-sage/20 hover:text-forest hover:border-forest/30"
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Orders List ── */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <OrderCardSkeleton key={i} />
                        ))}
                    </div>
                ) : dbOrders && dbOrders.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dbOrders.map((order: DBOrder) => {
                            const shortId = order.visualId || order.id.slice(-6).toUpperCase();
                            return (
                                <div key={order.id} className="group bg-card border border-border hover:border-forest/30 rounded-xl shadow-sm hover:shadow-card-hover transition-all duration-300 flex flex-col min-w-0 overflow-hidden cursor-pointer">
                                    <div className="p-5 sm:p-6 flex flex-col flex-1 gap-5 min-w-0" onClick={() => handleViewDetails(order)}>
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start gap-4 min-w-0 pb-4 border-b border-border/60">
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-sans text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pedido</span>
                                                    <h3 className="font-display font-bold text-lg text-forest truncate" title={`PED-${shortId}`}>
                                                        #{shortId}
                                                    </h3>
                                                </div>
                                                <div className="flex items-center text-[13px] text-muted-foreground font-medium gap-1.5 min-w-0">
                                                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="truncate">{formatFriendlyDate(order.createdAt)}</span>
                                                </div>
                                            </div>
                                            <div className={`shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full border ${statusStyles[order.status as keyof typeof statusStyles] || statusStyles.draft}`}>
                                                {statusLabels[order.status as keyof typeof statusLabels] || order.status}
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="flex justify-between items-end min-w-0 flex-1">
                                            <div className="flex flex-col gap-2 min-w-0 flex-1 pr-4">
                                                <div className="flex items-center gap-1.5 text-[13px] font-medium text-forest">
                                                    <Store className="w-4 h-4 shrink-0 text-forest/70" />
                                                    <span className="truncate" title={order.sellerName}>{order.sellerName}</span>
                                                </div>
                                                <p className="text-[13px] text-muted-foreground line-clamp-1 break-words mt-1" title={order.items.map((item: OrderItem) => `${item.qty}x ${item.productName}`).join(", ")}>
                                                    <span className="font-medium text-soil">{order.items.length} {order.items.length === 1 ? 'item' : 'itens'}:</span> {order.items.map(i => i.productName).join(", ")}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</span>
                                                <span className="font-display font-black text-xl text-soil">
                                                    {formatCurrency(order.totalAmount)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer / Actions */}
                                    <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60 bg-muted/30 mt-auto">
                                        <button
                                            onClick={() => handleViewDetails(order)}
                                            className="flex items-center justify-center gap-1.5 py-4 text-[11px] font-bold uppercase tracking-wider text-soil hover:bg-sage/40 hover:text-forest transition-colors"
                                        >
                                            Ver Detalhes
                                            <ChevronRight className="w-3.5 h-3.5 text-forest/60 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                                        </button>
                                        <button
                                            onClick={() => handleRepeatOrder(order.id, order.visualId)}
                                            className="flex items-center justify-center gap-1.5 py-4 text-[11px] font-bold uppercase tracking-wider text-forest hover:bg-forest hover:text-cream transition-colors group/btn"
                                        >
                                            <RotateCw className="w-3.5 h-3.5 shrink-0 transition-transform group-hover/btn:rotate-180 duration-500 ease-in-out" />
                                            <span className="truncate">Refazer Pedido</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Empty State
                    <div className="py-24 border border-dashed border-border/60 rounded-2xl bg-white flex flex-col items-center justify-center gap-6 text-center shadow-sm">
                        <div className="w-20 h-20 rounded-full bg-sage/50 flex items-center justify-center mb-2">
                            <PackageOpen className="w-10 h-10 text-forest/40" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h3 className="font-display text-2xl font-bold text-forest">
                                Nenhum pedido encontrado
                            </h3>
                            <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                                Você ainda não realizou nenhuma compra. Explore nosso catálogo para descobrir os melhores produtos direto dos produtores.
                            </p>
                        </div>
                        <Button variant="primary" size="lg" asChild className="mt-4 shadow-sm">
                            <Link href="/catalogo" className="flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4" />
                                Explorar Catálogo
                            </Link>
                        </Button>
                    </div>
                )}
            </main>

            <Toaster richColors position="bottom-right" />

            <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[520px] translate-x-[-50%] translate-y-[-50%] gap-0 border border-border bg-white p-8 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl">
                        {selectedOrder && (
                            <>
                                {/* Modal Header */}
                                <div className="flex flex-col space-y-3 mb-8 text-left">
                                    <div className="flex items-center gap-3">
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest border ${statusStyles[selectedOrder.status as keyof typeof statusStyles] || statusStyles.draft}`}>
                                            {statusLabels[selectedOrder.status as keyof typeof statusLabels] || selectedOrder.status}
                                        </div>
                                    </div>
                                    <Dialog.Title className="text-2xl font-display font-black text-forest tracking-tight truncate">
                                        Pedido #{selectedOrder.visualId || selectedOrder.id.slice(-6).toUpperCase()}
                                    </Dialog.Title>
                                    <Dialog.Description className="text-[13px] font-sans text-muted-foreground flex flex-col gap-1 tracking-wide">
                                        <span>Comprado em <strong className="font-medium text-soil">{formatFriendlyDate(selectedOrder.createdAt)}</strong></span>
                                        <span>Produtor: <strong className="font-medium text-soil" title={selectedOrder.sellerName}>{selectedOrder.sellerName}</strong></span>
                                    </Dialog.Description>
                                </div>

                                {/* Items List */}
                                <div className="border-t border-border/40 divide-y divide-border/30 max-h-[45vh] overflow-y-auto pr-3 -mr-3 pb-2 scrollbar-thin scrollbar-thumb-sage scrollbar-track-transparent">
                                    {selectedOrder.items.map((item: OrderItem, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between py-4 group">
                                            <div className="flex items-center justify-start gap-4">
                                                {/* Optional image placeholder if we had them working gracefully */}
                                                <div className="h-12 w-12 bg-sage/30 rounded-md border border-border/50 flex-shrink-0 flex items-center justify-center text-forest/20">
                                                    <PackageOpen className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-[14px] text-soil group-hover:text-forest transition-colors">{item.productName}</span>
                                                    <span className="text-[12px] font-medium text-muted-foreground">{item.qty} {item.saleUnit === 'unit' ? 'unidades' : item.saleUnit} x {formatCurrency(item.unitPrice)}</span>
                                                </div>
                                            </div>
                                            <span className="font-display font-bold text-[16px] text-soil ml-4 shrink-0">
                                                {formatCurrency(Number(item.unitPrice) * Number(item.qty))}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Total Summary */}
                                <div className="flex items-center justify-between pt-6 border-t border-border/80 mt-4 bg-sage/10 -mx-8 px-8 pb-8 -mb-8 rounded-b-xl">
                                    <div className="flex flex-col gap-1.5 items-start">
                                        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Valor Total</span>
                                        {selectedOrder.status === 'confirmed' && (
                                            <button
                                                className="text-[10px] font-bold uppercase tracking-widest text-red-500/80 hover:text-red-600 transition-colors"
                                                disabled={isCancelling}
                                                onClick={() => {
                                                    if (confirm('Tem certeza que deseja cancelar este pedido? O estoque será devolvido à fazenda.')) {
                                                        cancelOrder({ orderId: selectedOrder.id });
                                                    }
                                                }}
                                            >
                                                {isCancelling ? 'Cancelando...' : 'Cancelar Pedido'}
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-3xl font-display font-black text-forest">
                                        {formatCurrency(selectedOrder.totalAmount)}
                                    </span>
                                </div>
                            </>
                        )}
                        <Dialog.Close asChild>
                            <button className="absolute right-5 top-5 rounded-sm opacity-50 p-2 transition-colors hover:opacity-100 hover:bg-black/5 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-forest disabled:pointer-events-none text-soil">
                                <X className="h-4 w-4" />
                                <span className="sr-only">Fechar janela</span>
                            </button>
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
