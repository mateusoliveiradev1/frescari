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
    confirmed: "bg-amber-100 text-amber-800 border-amber-200",
    picking: "bg-blue-100 text-blue-800 border-blue-200",
    in_transit: "bg-sky-100 text-sky-800 border-sky-200",
    delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-red-100 text-red-800 border-red-200"
};

const statusLabels = {
    draft: "Rascunho",
    confirmed: "Confirmado",
    picking: "Em separação",
    in_transit: "A Caminho",
    delivered: "Entregue",
    cancelled: "Cancelado"
};

export default function PedidosPage() {
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { data: dbOrders, isLoading } = trpc.order.listMyOrders.useQuery();

    const handleViewDetails = (order: any) => {
        setSelectedOrder(order);
        setIsDialogOpen(true);
    };

    const handleRepeatOrder = (orderId: string) => {
        toast.success(`Sucesso! Itens do pedido ${orderId} foram adicionados ao seu carrinho.`);
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-cream">
            <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-12">
                {/* ── Page header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {dbOrders.map((order) => (
                            <div key={order.id} className="bg-white border border-soil/10 rounded-sm shadow-sm flex flex-col overflow-hidden hover:border-forest/20 transition-all duration-300">
                                {/* Card Header */}
                                <div className="p-6 border-b border-soil/5 flex justify-between items-start bg-sage/5">
                                    <div className="space-y-1">
                                        <h3 className="font-display font-bold text-lg text-soil truncate max-w-[180px]">{order.id}</h3>
                                        <div className="flex items-center text-sm text-bark/80 gap-1.5">
                                            <Calendar className="w-4 h-4 shrink-0" />
                                            <span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(order.createdAt))}</span>
                                        </div>
                                    </div>
                                    <Badge className={statusStyles[order.status as keyof typeof statusStyles] || statusStyles.draft}>
                                        {statusLabels[order.status as keyof typeof statusLabels] || order.status}
                                    </Badge>
                                </div>

                                {/* Card Body */}
                                <div className="p-6 flex-1 space-y-5">
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2 text-soil">
                                            <Store className="w-5 h-5 text-forest mt-0.5 shrink-0" />
                                            <div className="truncate">
                                                <span className="text-xs font-bold uppercase tracking-wider text-bark/60 block mb-0.5">Produtor</span>
                                                <span className="font-medium truncate block" title={order.sellerTenantId}>{order.sellerTenantId}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-soil">
                                            <CircleDollarSign className="w-5 h-5 text-forest mt-0.5 shrink-0" />
                                            <div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-bark/60 block mb-0.5">Valor Total</span>
                                                <span className="font-medium">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.totalAmount))}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-soil/5">
                                        <span className="text-xs font-bold uppercase tracking-wider text-bark/60 block mb-2">Itens</span>
                                        <p className="text-sm text-soil line-clamp-2 leading-relaxed">
                                            {order.items.map((item: any) => `${item.qty}${item.saleUnit} de ${item.productName}`).join(", ")}
                                        </p>
                                    </div>
                                </div>

                                {/* Card Footer / Actions */}
                                <div className="p-6 pt-0 mt-auto flex flex-col sm:flex-row gap-3">
                                    <Button variant="secondary" className="flex-1 w-full justify-center" onClick={() => handleViewDetails(order)}>
                                        Ver Detalhes
                                    </Button>
                                    <Button variant="primary" className="flex-1 w-full justify-center gap-2 group" onClick={() => handleRepeatOrder(order.id)}>
                                        <RotateCw className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500 ease-in-out" />
                                        <span>Repetir Pedido</span>
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
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-bark/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-6 border border-soil/10 bg-cream p-8 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-sm">

                        {selectedOrder && (
                            <>
                                <div className="flex flex-col space-y-2 text-center sm:text-left">
                                    <Dialog.Title className="text-2xl font-display font-black text-soil tracking-wide truncate">
                                        Detalhes do pedido: <span className="text-lg text-bark/60 break-all">{selectedOrder.id}</span>
                                    </Dialog.Title>
                                    <Dialog.Description className="text-sm font-sans text-bark/80">
                                        Comprado em <strong className="font-medium text-soil">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(selectedOrder.createdAt))}</strong> na <strong className="font-medium text-soil tooltip " title={selectedOrder.sellerTenantId}>{selectedOrder.sellerTenantId.substring(0, 18)}...</strong>
                                    </Dialog.Description>
                                    <div className="pt-2">
                                        <Badge className={`px-3 py-1 text-xs ${statusStyles[selectedOrder.status as keyof typeof statusStyles] || statusStyles.draft}`}>
                                            Status: {statusLabels[selectedOrder.status as keyof typeof statusLabels] || selectedOrder.status}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="my-2 border-y border-soil/10 divide-y divide-soil/10 max-h-[40vh] overflow-y-auto pr-2">
                                    {selectedOrder.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-soil">{item.productName}</span>
                                                <span className="text-sm font-sans text-bark/70 tracking-wide">{item.qty}{item.saleUnit} x R$ {Number(item.unitPrice).toFixed(2)}</span>
                                            </div>
                                            <span className="font-bold font-sans tracking-wide text-forest">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.unitPrice) * item.qty)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between font-bold text-soil text-lg pt-2">
                                    <span className="tracking-wide">Total</span>
                                    <span className="text-forest text-2xl">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(selectedOrder.totalAmount))}
                                    </span>
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-4 mt-6">
                                    <Dialog.Close asChild>
                                        <Button variant="ghost">Fechar</Button>
                                    </Dialog.Close>
                                    <Button variant="primary" className="gap-2" onClick={() => {
                                        handleRepeatOrder(selectedOrder.id);
                                        setIsDialogOpen(false);
                                    }}>
                                        <RotateCw className="w-4 h-4" />
                                        Repetir Pedido
                                    </Button>
                                </div>
                            </>
                        )}
                        <Dialog.Close asChild>
                            <button className="absolute right-4 top-4 rounded-sm opacity-50 p-1.5 transition-colors hover:opacity-100 hover:bg-soil/5 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 disabled:pointer-events-none text-soil">
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
