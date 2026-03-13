"use client";

import { useMemo, useState } from "react";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@frescari/ui";
import {
    ArrowLeft,
    CheckCircle2,
    MapPinned,
    Package,
    Store,
    Truck,
} from "lucide-react";
import Link from "next/link";
import { Toaster, toast } from "sonner";

import { trpc } from "@/trpc/react";

import { DeliveryMap } from "./delivery-map";
import type { PendingDelivery } from "./delivery-map.types";

const statusStyles: Record<string, string> = {
    payment_authorized: "bg-emerald-100 text-emerald-800 border-emerald-200",
    confirmed: "bg-amber-100 text-amber-800 border-amber-200",
    picking: "bg-blue-100 text-blue-800 border-blue-200",
    in_transit: "bg-sky-100 text-sky-800 border-sky-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
};

const statusLabels: Record<string, string> = {
    payment_authorized: "Pagamento autorizado",
    confirmed: "Confirmado",
    picking: "Em separação",
    in_transit: "Em trânsito",
    delivered: "Entregue",
};

function formatCurrency(value: string) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(Number(value));
}

function formatDistance(distanceKm: number | null) {
    if (distanceKm === null) {
        return "distância indisponível";
    }

    return `${distanceKm.toFixed(2)} km`;
}

function formatQuantity(value: string) {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        return value;
    }

    return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: numericValue % 1 === 0 ? 0 : 3,
        maximumFractionDigits: 3,
    }).format(numericValue);
}

function buildVisualId(index: number, length: number) {
    return (length - index).toString().padStart(4, "0");
}

function getEstimatedWeight(delivery: PendingDelivery) {
    const totalEstimatedWeight = delivery.items.reduce((sum, item) => {
        return sum + (item.estimatedWeightKg ?? 0);
    }, 0);

    if (totalEstimatedWeight <= 0) {
        return null;
    }

    return `${totalEstimatedWeight.toFixed(2)} kg`;
}

function formatMappedPointsLabel(total: number) {
    if (total === 1) {
        return "1 ponto util";
    }

    return `${total} pontos uteis`;
}

function DeliveryCard({
    delivery,
    visualId,
    isSelected,
    isMutating,
    onSelect,
    onUpdateStatus,
}: {
    delivery: PendingDelivery;
    visualId: string;
    isSelected: boolean;
    isMutating: boolean;
    onSelect: () => void;
    onUpdateStatus: (status: "in_transit" | "delivered") => void;
}) {
    const totalEstimatedWeight = getEstimatedWeight(delivery);
    const hasRouteCoordinates = delivery.origin?.latitude !== null
        && delivery.origin?.longitude !== null
        && delivery.destination?.latitude !== null
        && delivery.destination?.longitude !== null;
    const handleCardSelect = () => onSelect();

    return (
        <div
            className={`w-full text-left transition-transform duration-200 ${isSelected ? "translate-y-[-2px]" : ""}`}
            onClick={handleCardSelect}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleCardSelect();
                }
            }}
            role="button"
            tabIndex={0}
        >
            <Card
                className={`overflow-hidden border-soil/10 bg-white/95 shadow-lg shadow-forest/5 transition-all duration-200 ${
                    isSelected ? "border-forest/25 shadow-2xl shadow-forest/10" : "hover:border-forest/15 hover:shadow-xl"
                }`}
            >
                <CardHeader className="gap-4 border-b border-soil/8 bg-cream/65 pb-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                                Entrega #{visualId}
                            </p>
                            <CardTitle className="font-display text-2xl font-black text-soil">
                                {delivery.buyerName}
                            </CardTitle>
                        </div>
                        <Badge
                            className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.14em] ${statusStyles[delivery.status] ?? "bg-sage text-forest border-forest/20"}`}
                            variant="secondary"
                        >
                            {statusLabels[delivery.status] ?? delivery.status}
                        </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-sm border border-soil/10 bg-white/70 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-bark/60">
                                Distância
                            </p>
                            <p className="mt-2 font-display text-xl font-black text-soil">
                                {formatDistance(delivery.distanceKm)}
                            </p>
                            {!hasRouteCoordinates ? (
                                <p className="mt-2 text-xs leading-5 text-bark/60">
                                    Sem coordenadas validas para tracar rota no mapa.
                                </p>
                            ) : null}
                        </div>
                        <div className="rounded-sm border border-soil/10 bg-white/70 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-bark/60">
                                Itens
                            </p>
                            <p className="mt-2 font-display text-xl font-black text-soil">
                                {delivery.items.length}
                            </p>
                        </div>
                        <div className="rounded-sm border border-soil/10 bg-white/70 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-bark/60">
                                Total
                            </p>
                            <p className="mt-2 font-display text-xl font-black text-soil">
                                {formatCurrency(delivery.totalAmount)}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-5 p-6">
                    <div className="flex flex-wrap items-start gap-4 text-sm text-bark/80">
                        <div className="min-w-[220px] flex-1 rounded-sm border border-soil/10 bg-cream-dark/35 px-4 py-3">
                            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                <MapPinned className="h-3.5 w-3.5" />
                                Destino
                            </p>
                            <p className="mt-2 leading-6 text-soil">{delivery.deliveryAddress.label}</p>
                            {delivery.deliveryAddress.notes ? (
                                <p className="mt-2 text-xs text-bark/65">
                                    Obs.: {delivery.deliveryAddress.notes}
                                </p>
                            ) : null}
                        </div>

                        <div className="min-w-[180px] rounded-sm border border-soil/10 bg-cream-dark/35 px-4 py-3">
                            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                <Store className="h-3.5 w-3.5" />
                                Origem
                            </p>
                            <p className="mt-2 leading-6 text-soil">
                                {delivery.origin?.farmName ?? "Fazenda sem geolocalização"}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                Carga
                            </p>
                            {totalEstimatedWeight ? (
                                <span className="text-xs font-semibold text-bark/65">
                                    Peso estimado: {totalEstimatedWeight}
                                </span>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            {delivery.items.map((item) => (
                                <div
                                    className="flex items-start justify-between gap-4 rounded-sm border border-soil/8 bg-cream px-4 py-3"
                                    key={item.orderItemId}
                                >
                                    <div>
                                        <p className="font-semibold text-soil">{item.productName}</p>
                                        <p className="mt-1 text-xs text-bark/65">
                                            {formatQuantity(item.qty)} {item.saleUnit}
                                        </p>
                                    </div>
                                    {item.estimatedWeightKg !== null && item.saleUnit !== "kg" && item.saleUnit !== "g" ? (
                                        <span className="text-xs font-semibold text-bark/60">
                                            ~{item.estimatedWeightKg.toFixed(2)} kg
                                        </span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-soil/8 pt-5 sm:flex-row">
                        <Button
                            className="flex-1 justify-center gap-2"
                            disabled={isMutating}
                            onClick={(event) => {
                                event.stopPropagation();
                                onUpdateStatus("in_transit");
                            }}
                            type="button"
                            variant="primary"
                        >
                            <Truck className="h-4 w-4" />
                            Despachar
                        </Button>
                        <Button
                            className="flex-1 justify-center gap-2"
                            disabled={isMutating}
                            onClick={(event) => {
                                event.stopPropagation();
                                onUpdateStatus("delivered");
                            }}
                            type="button"
                            variant="secondary"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Entregue
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function DeliveriesPageClient() {
    const utils = trpc.useUtils();
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

    const pendingDeliveriesQuery = trpc.logistics.getPendingDeliveries.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });

    const deliveries = useMemo(() => pendingDeliveriesQuery.data ?? [], [pendingDeliveriesQuery.data]);
    const resolvedSelectedOrderId = useMemo(() => {
        if (deliveries.length === 0) {
            return null;
        }

        if (selectedOrderId && deliveries.some((delivery) => delivery.orderId === selectedOrderId)) {
            return selectedOrderId;
        }

        return deliveries[0].orderId;
    }, [deliveries, selectedOrderId]);

    const statusMutation = trpc.logistics.updateDeliveryStatus.useMutation({
        onSuccess(_data, variables) {
            toast.success(
                variables.status === "in_transit"
                    ? "Entrega despachada."
                    : "Entrega marcada como concluída.",
            );
            setActiveOrderId(null);
            void utils.logistics.getPendingDeliveries.invalidate();
        },
        onError(error) {
            toast.error(error.message || "Não foi possível atualizar a entrega.");
            setActiveOrderId(null);
        },
    });

    const mappedDeliveries = useMemo(
        () =>
            deliveries.map((delivery, index, collection) => ({
                delivery,
                visualId: buildVisualId(index, collection.length),
            })),
        [deliveries],
    );

    const deliveriesWithMapCoordinates = deliveries.filter(
        (delivery) =>
            delivery.origin?.latitude !== null &&
            delivery.origin?.longitude !== null &&
            delivery.destination?.latitude !== null &&
            delivery.destination?.longitude !== null,
    );

    const averageDistanceKm = useMemo(() => {
        const deliveriesWithDistance = deliveries.filter((delivery) => delivery.distanceKm !== null);

        if (deliveriesWithDistance.length === 0) {
            return null;
        }

        const totalDistance = deliveriesWithDistance.reduce((sum, delivery) => {
            return sum + (delivery.distanceKm ?? 0);
        }, 0);

        return totalDistance / deliveriesWithDistance.length;
    }, [deliveries]);

    const handleStatusUpdate = (orderId: string, status: "in_transit" | "delivered") => {
        setActiveOrderId(orderId);
        statusMutation.mutate({ orderId, status });
    };

    return (
        <>
            <Toaster position="bottom-right" richColors />

            <div className="space-y-8">
                <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-2">
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                            Painel do Produtor
                        </p>
                        <h1 className="font-display text-4xl font-black text-soil">
                            Entregas
                        </h1>
                        <p className="max-w-3xl text-sm leading-6 text-bark/80">
                            Operação logística dos pedidos prontos para sair da fazenda, com distância em linha reta calculada no banco e mapa sincronizado com cada destino.
                        </p>
                    </div>

                    <Button asChild className="justify-center" variant="ghost">
                        <Link href="/dashboard">
                            <ArrowLeft className="h-4 w-4" />
                            Voltar ao painel
                        </Link>
                    </Button>
                </header>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px_16px_20px_16px] border border-soil/8 bg-white/85 px-5 py-4 shadow-card">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                            Pedidos pendentes
                        </p>
                        <p className="mt-2 font-display text-3xl font-black text-soil">
                            {deliveries.length}
                        </p>
                    </div>
                    <div className="rounded-[24px_16px_20px_16px] border border-soil/8 bg-white/85 px-5 py-4 shadow-card">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                            Destinos mapeados
                        </p>
                        <p className="mt-2 font-display text-3xl font-black text-soil">
                            {deliveriesWithMapCoordinates.length}
                        </p>
                    </div>
                    <div className="rounded-[24px_16px_20px_16px] border border-soil/8 bg-white/85 px-5 py-4 shadow-card">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                            Distância média
                        </p>
                        <p className="mt-2 font-display text-3xl font-black text-soil">
                            {averageDistanceKm === null ? "--" : `${averageDistanceKm.toFixed(2)} km`}
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.92fr)]">
                    <section className="space-y-4">
                        {pendingDeliveriesQuery.isLoading ? (
                            Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    className="h-[260px] animate-pulse rounded-[28px_18px_24px_18px] border border-soil/8 bg-white/65"
                                    key={index}
                                />
                            ))
                        ) : mappedDeliveries.length === 0 ? (
                            <Card className="overflow-hidden border-soil/10 bg-white/95 shadow-card">
                                <CardContent className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
                                    <div className="rounded-full border border-forest/15 bg-sage/45 p-5 shadow-[0_18px_38px_rgba(27,67,50,0.08)]">
                                        <CheckCircle2 className="h-8 w-8 text-forest" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="font-display text-2xl font-black text-soil">
                                            Missao cumprida!
                                        </h2>
                                        <p className="max-w-xl text-sm leading-6 text-bark/75">
                                            Todas as entregas ja foram despachadas. Quando novos pedidos entrarem na operacao, esta mesa logistica volta a ser preenchida automaticamente.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            mappedDeliveries.map(({ delivery, visualId }) => (
                                <DeliveryCard
                                    delivery={delivery}
                                    isMutating={statusMutation.isPending && activeOrderId === delivery.orderId}
                                    isSelected={resolvedSelectedOrderId === delivery.orderId}
                                    key={delivery.orderId}
                                    onSelect={() => setSelectedOrderId(delivery.orderId)}
                                    onUpdateStatus={(status) => handleStatusUpdate(delivery.orderId, status)}
                                    visualId={visualId}
                                />
                            ))
                        )}
                    </section>

                    <aside className="xl:sticky xl:top-24 xl:self-start">
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                    Mapa operacional
                                </p>
                                <h2 className="mt-2 font-display text-2xl font-black text-soil">
                                    Fazenda e destinos
                                </h2>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-soil/10 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-bark/70">
                                <Package className="h-3.5 w-3.5" />
                                {formatMappedPointsLabel(deliveriesWithMapCoordinates.length)}
                            </div>
                        </div>

                        <DeliveryMap
                            deliveries={deliveries}
                            onSelect={(orderId) => setSelectedOrderId(orderId)}
                            selectedOrderId={resolvedSelectedOrderId}
                        />
                    </aside>
                </div>
            </div>
        </>
    );
}
