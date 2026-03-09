"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Badge } from "@frescari/ui";
import { Calendar, Store, CircleDollarSign, RotateCw, X, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Toaster, toast } from "sonner";
import { trpc } from "@/trpc/react";

const statusStyles = {
    draft: "bg-gray-100 text-gray-800 border-gray-200",
    confirmed: "bg-[#FFF8E7] text-[#D4A017] border-[#F2E0AA]", // Custom processing yellow colors from mockup
    picking: "bg-blue-100 text-blue-800 border-blue-200",
    in_transit: "bg-[#E6F3FB] text-[#2D8CBA] border-[#C3E2F4]", // Custom cyan/blue for 'in transit'
    delivered: "bg-[#E6F8F0] text-[#2D996A] border-[#C2EED9]", // Custom green for 'delivered'
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

export default function PedidosPage() {
    const [selectedOrder, setSelectedOrder] = useState<DBOrder | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Casting as any because the trpc package hasn't been built yet in the monorepo to expose types to this app
    const { data: fetchOrders, isLoading } = (trpc.order as any).listMyOrders.useQuery();

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
        const displayId = visualId || orderId.slice(0, 8).toUpperCase();
        toast.success(`Sucesso! Itens do pedido ${displayId} foram adicionados ao seu carrinho.`);
    };

    const formatMockDate = (date: Date | string) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const monthRaw = d.toLocaleString('pt-BR', { month: 'short' });
        const month = monthRaw.replace('.', '').charAt(0).toUpperCase() + monthRaw.replace('.', '').slice(1);
        const year = d.getFullYear();
        return `${day} ${month} ${year}`;
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-[#FDFBF7]">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-12">
                {/* ── Page header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/60">
                            Painel do Comprador
                        </p>
                        <h1 className="font-display text-4xl font-black text-soil">
                            Meus Pedidos
                        </h1>
                    </div>
                </div>

                {/* ── Orders List ── */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-bark/60">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-forest" />
                        <p>Carregando seus pedidos...</p>
                    </div>
                ) : dbOrders && dbOrders.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dbOrders.map((order: DBOrder) => (
                            <div key={order.id} className="bg-white border border-soil/10 rounded-sm shadow-sm flex flex-col hover:border-forest/20 transition-all duration-300 min-w-0">
                                <div className="p-6 flex flex-col flex-1 gap-6 min-w-0">
                                    {/* Card Header */}
                                    <div className="flex justify-between items-start gap-4 min-w-0">
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <h3 className="font-display font-black text-lg text-soil truncate" title={`PED-${order.visualId}`}>
                                                PED-{order.visualId}
                                            </h3>
                                            <div className="flex items-center text-[13px] text-bark/70 gap-1.5 min-w-0">
                                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">{formatMockDate(order.createdAt)}</span>
                                            </div>
                                        </div>
                                        <Badge className={`shrink-0 uppercase text-[10px] font-bold tracking-widest px-2.5 py-1 ${statusStyles[order.status as keyof typeof statusStyles] || statusStyles.draft}`}>
                                            {statusLabels[order.status as keyof typeof statusLabels] || order.status}
                                        </Badge>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-px w-full bg-soil/5" />

                                    {/* Card Body */}
                                    <div className="flex flex-col gap-5 min-w-0 flex-1">
                                        <div className="space-y-4">
                                            {/* Produtor */}
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-bark/50">
                                                    <Store className="w-3.5 h-3.5 shrink-0 text-forest" />
                                                    <span>Produtor</span>
                                                </div>
                                                <span className="font-medium text-soil truncate ml-5 block" title={order.sellerName}>{order.sellerName}</span>
                                            </div>

                                            {/* Valor Total */}
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-bark/50">
                                                    <CircleDollarSign className="w-3.5 h-3.5 shrink-0 text-forest" />
                                                    <span>Valor Total</span>
                                                </div>
                                                <span className="font-medium text-soil truncate ml-5 block">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.totalAmount))}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-soil/5 min-w-0 mt-auto">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-bark/50 block mb-2">Itens</span>
                                            <p className="text-[13px] text-soil/90 line-clamp-2 leading-relaxed break-words" title={order.items.map((item: OrderItem) => `${item.qty} ${item.saleUnit} de ${item.productName}`).join(", ")}>
                                                {order.items.map((item: OrderItem) => `${item.qty} ${item.saleUnit === 'UN' ? 'unidades' : item.saleUnit} de ${item.productName}`).join(", ")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {/* Card Footer / Actions */}
                                <div className="px-6 pb-6 pt-0 flex gap-3 min-w-0 mt-auto">
                                    <Button variant="secondary" className="flex-1 justify-center shrink-0 min-w-0 bg-[#E9EBE7] hover:bg-[#DCE0D8] border-none text-forest h-11" onClick={() => handleViewDetails(order)}>
                                        <span className="text-xs font-bold uppercase tracking-wider truncate">Ver Detalhes</span>
                                    </Button>
                                    <Button variant="primary" className="flex-1 justify-center gap-2 group shrink-0 min-w-0 h-11" onClick={() => handleRepeatOrder(order.id, order.visualId)}>
                                        <RotateCw className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:rotate-180 duration-500 ease-in-out" />
                                        <span className="text-xs font-bold uppercase tracking-wider truncate">Repetir Pedido</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 border border-dashed border-soil/20 rounded-sm bg-sage/10 flex flex-col items-center justify-center gap-6 text-center shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-cream border border-soil/15 flex items-center justify-center mb-2 shadow-sm">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-soil/40">
                                <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-display text-2xl font-bold text-soil mb-2">
                                Você ainda não fez nenhum pedido
                            </h3>
                            <p className="font-sans text-sm text-bark max-w-md mx-auto leading-relaxed">
                                Explore o nosso catálogo para encontrar produtos frescos direto dos produtores e comece a comprar.
                            </p>
                        </div>
                        <Button variant="primary" asChild className="mt-4">
                            <Link href="/catalogo">Explorar Catálogo</Link>
                        </Button>
                    </div>
                )}
            </main>

            <Toaster richColors position="bottom-right" />

            <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-bark/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[480px] translate-x-[-50%] translate-y-[-50%] gap-0 border border-soil/10 bg-[#FDFBF7] p-8 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-sm">
                        {selectedOrder && (
                            <>
                                <div className="flex flex-col space-y-2.5 mb-8 text-left">
                                    <Dialog.Title className="text-2xl font-display font-black text-soil tracking-wide truncate">
                                        Detalhes do PED-{selectedOrder.visualId}
                                    </Dialog.Title>
                                    <Dialog.Description className="text-sm font-sans text-bark/70">
                                        Comprado em <strong className="font-medium text-soil">{formatMockDate(selectedOrder.createdAt)}</strong> na <strong className="font-medium text-soil" title={selectedOrder.sellerName}>{selectedOrder.sellerName}</strong>
                                    </Dialog.Description>
                                    <div className="pt-2">
                                        <Badge className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest ${statusStyles[selectedOrder.status as keyof typeof statusStyles] || statusStyles.draft}`}>
                                            Status: {statusLabels[selectedOrder.status as keyof typeof statusLabels] || selectedOrder.status}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="border-t border-soil/10 divide-y divide-soil/5 max-h-[45vh] overflow-y-auto pr-2 -mr-2">
                                    {selectedOrder.items.map((item: OrderItem, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between py-4 group pr-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-[15px] text-soil">{item.productName}</span>
                                                <span className="text-[13px] font-sans text-bark/60">{item.qty} {item.saleUnit === 'UN' ? 'unidades' : item.saleUnit}</span>
                                            </div>
                                            <span className="font-bold font-sans text-[15px] text-soil">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.unitPrice) * Number(item.qty))}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between font-bold text-soil pt-6 border-t border-soil/10 mt-2">
                                    <span className="tracking-wide">Total</span>
                                    <span className="text-xl text-forest">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(selectedOrder.totalAmount))}
                                    </span>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-8">
                                    <Dialog.Close asChild>
                                        <Button variant="secondary" className="flex-1 sm:flex-none justify-center bg-transparent border border-soil/15 text-soil hover:bg-soil/5 text-xs font-bold uppercase tracking-wider px-8 h-11 shrink-0">
                                            Fechar
                                        </Button>
                                    </Dialog.Close>
                                    <Button variant="primary" className="flex-1 sm:flex-none justify-center gap-2 group text-xs font-bold uppercase tracking-wider px-8 h-11 shrink-0" onClick={() => {
                                        handleRepeatOrder(selectedOrder.id, selectedOrder.visualId);
                                        setIsDialogOpen(false);
                                    }}>
                                        <RotateCw className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:rotate-180 duration-500 ease-in-out" />
                                        <span className="truncate">Repetir Pedido</span>
                                    </Button>
                                </div>
                            </>
                        )}
                        <Dialog.Close asChild>
                            <button className="absolute right-5 top-5 rounded-sm opacity-50 p-1 transition-colors hover:opacity-100 hover:bg-soil/5 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 disabled:pointer-events-none text-soil">
                                <X className="h-5 w-5" />
                                <span className="sr-only">Close</span>
                            </button>
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
