"use client";

import { useMemo, useState } from "react";

import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    SkeletonCard,
    SkeletonText,
    cn,
    formatCurrencyBRL,
    formatDistanceKm,
    formatMass,
    formatQuantity,
} from "@frescari/ui";
import {
    ArrowLeft,
    AlertTriangle,
    CheckCircle2,
    Clock3,
    MapPinned,
    Package,
    RefreshCcw,
    Sparkles,
    Store,
    Truck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { trpc } from "@/trpc/react";
import { getSaleUnitLabel, isWeighableSaleUnit } from "@/lib/sale-units";

import { canMarkDelivered, getDeliveryPrimaryAction } from "./delivery-actions";
import { DeliveryMap } from "./delivery-map";
import type { DispatchWaveCandidate, PendingDelivery } from "./delivery-map.types";
import { useDeliveryControlRefresh } from "./use-delivery-control-refresh";

const statusStyles: Record<string, string> = {
    payment_authorized: "bg-emerald-100 text-emerald-800 border-emerald-200",
    confirmed: "bg-amber-100 text-amber-800 border-amber-200",
    picking: "bg-blue-100 text-blue-800 border-blue-200",
    ready_for_dispatch: "bg-violet-100 text-violet-800 border-violet-200",
    in_transit: "bg-sky-100 text-blue-800 border-sky-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
};

const statusLabels: Record<string, string> = {
    payment_authorized: "Pagamento autorizado",
    confirmed: "Confirmado",
    picking: "Em separacao",
    ready_for_dispatch: "Pronto para sair",
    in_transit: "Em transito",
    delivered: "Entregue",
};

const confidenceLabels: Record<"high" | "medium" | "low", string> = {
    high: "Alta",
    medium: "Media",
    low: "Baixa",
};

const riskLabels: Record<"high" | "medium" | "low", string> = {
    high: "Risco alto",
    medium: "Risco medio",
    low: "Risco controlado",
};

const vehicleTypeLabels: Record<string, string> = {
    motorcycle: "Moto",
    car: "Carro",
    pickup: "Pickup",
    van: "Van",
    refrigerated_van: "Van refrigerada",
    truck: "Caminhao",
    refrigerated_truck: "Caminhao refrigerado",
};

const overrideActionLabels: Record<string, string> = {
    pin_to_top: "Prioridade manual",
    delay: "Segurar na fila",
};

const overrideReasonLabels: Record<string, string> = {
    customer_priority: "Cliente prioritario",
    delivery_window: "Janela de entrega",
    vehicle_load: "Ajuste de carga",
    address_issue: "Endereco em revisao",
    awaiting_picking: "Aguardando picking",
    commercial_decision: "Decisao comercial",
    other: "Outro motivo",
};

const overrideReasonOptions = [
    { value: "customer_priority", label: "Cliente prioritario" },
    { value: "delivery_window", label: "Janela combinada" },
    { value: "vehicle_load", label: "Carga ou veiculo" },
    { value: "address_issue", label: "Endereco em revisao" },
    { value: "awaiting_picking", label: "Aguardar picking" },
    { value: "commercial_decision", label: "Decisao comercial" },
    { value: "other", label: "Outro" },
] as const;

type DispatchOverrideReason = (typeof overrideReasonOptions)[number]["value"];

const dispatchStatusLabels: Record<string, string> = {
    confirmed: "Saida confirmada",
    departed: "Saiu da fazenda",
    cancelled: "Saida cancelada",
};

const vehicleAvailabilityLabels: Record<string, string> = {
    available: "Disponivel",
    in_use: "Em rota",
    maintenance: "Manutencao",
    offline: "Offline",
};

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

    return formatMass(totalEstimatedWeight, "kg");
}

function formatMappedPointsLabel(total: number) {
    if (total === 1) {
        return "1 ponto util";
    }

    return `${total} pontos uteis`;
}

function formatOrdersLabel(total: number) {
    return total === 1 ? "1 pedido" : `${total} pedidos`;
}

function formatDateLabel(value: Date | string | null | undefined) {
    if (!value) {
        return "--";
    }

    const date = value instanceof Date ? value : new Date(value);

    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
    }).format(date);
}

function formatDateTimeLabel(value: Date | string | null | undefined) {
    if (!value) {
        return "--";
    }

    const date = value instanceof Date ? value : new Date(value);

    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function getDefaultOverrideReason(
    delivery: PendingDelivery,
    action: "pin_to_top" | "delay",
): DispatchOverrideReason {
    if (action === "delay" && delivery.status === "picking") {
        return "awaiting_picking";
    }

    return "commercial_decision";
}

function DeliveriesMetricSkeleton() {
    return (
        <div className="rounded-[24px_16px_20px_16px] border border-soil/8 bg-white/85 px-5 py-4 shadow-card">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-10 w-20" />
        </div>
    );
}

function DeliveriesMapSkeleton() {
    return (
        <div className="space-y-4">
            <SkeletonText className="max-w-xs" lines={2} />
            <Skeleton className="h-[560px] rounded-[28px_18px_24px_18px]" />
        </div>
    );
}

function DeliveryCard({
    delivery,
    visualId,
    isSelected,
    isPrimaryPending,
    isDeliveredPending,
    isPinPending,
    isDelayPending,
    onSelect,
    onConfirmDispatch,
    onToggleOverride,
    onUpdateStatus,
}: {
    delivery: PendingDelivery;
    visualId: string;
    isSelected: boolean;
    isPrimaryPending: boolean;
    isDeliveredPending: boolean;
    isPinPending: boolean;
    isDelayPending: boolean;
    onSelect: () => void;
    onConfirmDispatch: () => void;
    onToggleOverride: (action: "pin_to_top" | "delay") => void;
    onUpdateStatus: (status: "ready_for_dispatch" | "in_transit" | "delivered") => void;
}) {
    const totalEstimatedWeight = getEstimatedWeight(delivery);
    const hasRouteCoordinates =
        delivery.origin?.latitude !== null
        && delivery.origin?.longitude !== null
        && delivery.destination?.latitude !== null
        && delivery.destination?.longitude !== null;
    const primaryAction = getDeliveryPrimaryAction(delivery.status);
    const showDeliveredShortcut = canMarkDelivered(delivery.status)
        && !(primaryAction?.kind === "status" && primaryAction.nextStatus === "delivered");
    const PrimaryActionIcon = primaryAction?.kind === "dispatch"
        ? Sparkles
        : primaryAction?.nextStatus === "delivered"
            ? CheckCircle2
            : Truck;
    const handleCardSelect = () => onSelect();
    const suggestedVehicleLabel =
        delivery.recommendation.suggestedVehicle?.label
        ?? vehicleTypeLabels[delivery.recommendation.suggestedVehicleType]
        ?? delivery.recommendation.suggestedVehicleType;

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
                            className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.14em] ${
                                statusStyles[delivery.status] ?? "bg-sage text-forest border-forest/20"
                            }`}
                            variant="secondary"
                        >
                            {statusLabels[delivery.status] ?? delivery.status}
                        </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-sm border border-soil/10 bg-white/70 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-bark/60">
                                Distancia
                            </p>
                            <p className="mt-2 font-display text-xl font-black text-soil">
                                {formatDistanceKm(delivery.distanceKm)}
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
                                {formatCurrencyBRL(delivery.totalAmount)}
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
                                {delivery.origin?.farmName ?? "Fazenda sem geolocalizacao"}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="rounded-sm border border-forest/10 bg-sage/45 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Saida recomendada
                                    </p>
                                    <p className="mt-2 font-semibold text-soil">
                                        {suggestedVehicleLabel}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-bark/75">
                                        {delivery.recommendation.explanation}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge className="rounded-full border border-forest/15 bg-white/90 px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-forest" variant="secondary">
                                        Confianca {confidenceLabels[delivery.recommendation.confidence]}
                                    </Badge>
                                    <Badge className="rounded-full border border-soil/10 bg-white/90 px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-bark/80" variant="secondary">
                                        {riskLabels[delivery.recommendation.riskLevel]}
                                    </Badge>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-sm border border-white/70 bg-white/70 px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-bark/60">
                                        Prioridade IA
                                    </p>
                                    <p className="mt-2 font-display text-xl font-black text-soil">
                                        {delivery.recommendation.priorityScore}
                                    </p>
                                </div>
                                <div className="rounded-sm border border-white/70 bg-white/70 px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-bark/60">
                                        Frescor minimo
                                    </p>
                                    <p className="mt-2 font-display text-xl font-black text-soil">
                                        {delivery.minFreshnessScore ?? "--"}
                                    </p>
                                </div>
                                <div className="rounded-sm border border-white/70 bg-white/70 px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-bark/60">
                                        Validade mais curta
                                    </p>
                                    <p className="mt-2 font-display text-xl font-black text-soil">
                                        {formatDateLabel(delivery.nearestExpiryDate)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {delivery.dispatch ? (
                            <div className="rounded-sm border border-violet-200 bg-violet-50 px-4 py-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
                                    {dispatchStatusLabels[delivery.dispatch.status] ?? "Saida operacional"}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-violet-900">
                                    <span className="font-semibold">
                                        Ordem #{delivery.dispatch.sequence}
                                    </span>
                                    <span>
                                        Veiculo: {delivery.dispatch.selectedVehicleLabel ?? (vehicleTypeLabels[delivery.dispatch.recommendedVehicleType] ?? delivery.dispatch.recommendedVehicleType)}
                                    </span>
                                    <span>
                                        Confirmado em {formatDateTimeLabel(delivery.dispatch.confirmedAt)}
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        {delivery.activeOverride ? (
                            <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800">
                                    {overrideActionLabels[delivery.activeOverride.action] ?? "Override manual"}
                                </p>
                                <p className="mt-2 text-sm text-amber-950">
                                    {overrideReasonLabels[delivery.activeOverride.reason] ?? delivery.activeOverride.reason}
                                    {delivery.activeOverride.reasonNotes ? ` - ${delivery.activeOverride.reasonNotes}` : ""}
                                </p>
                            </div>
                        ) : null}

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
                                            {formatQuantity(item.qty)} {getSaleUnitLabel(item.saleUnit)}
                                        </p>
                                    </div>
                                    {item.estimatedWeightKg !== null && !isWeighableSaleUnit(item.saleUnit) ? (
                                        <span className="text-xs font-semibold text-bark/60">
                                            ~{formatMass(item.estimatedWeightKg, "kg")}
                                        </span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    {primaryAction || showDeliveredShortcut ? (
                        <div className="flex flex-col gap-3 border-t border-soil/8 pt-5 sm:flex-row">
                            {primaryAction ? (
                                <Button
                                    className="flex-1 justify-center gap-2"
                                    isPending={isPrimaryPending}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (primaryAction.kind === "dispatch") {
                                            onConfirmDispatch();
                                            return;
                                        }

                                        onUpdateStatus(primaryAction.nextStatus);
                                    }}
                                    type="button"
                                    variant="primary"
                                >
                                    <PrimaryActionIcon className="h-4 w-4" />
                                    {primaryAction.label}
                                </Button>
                            ) : null}
                            {showDeliveredShortcut ? (
                                <Button
                                    className="flex-1 justify-center gap-2"
                                    isPending={isDeliveredPending}
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
                            ) : null}
                        </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                            className="justify-center gap-2"
                            isPending={isPinPending}
                            onClick={(event) => {
                                event.stopPropagation();
                                onToggleOverride("pin_to_top");
                            }}
                            type="button"
                            variant={delivery.activeOverride?.action === "pin_to_top" ? "primary" : "secondary"}
                        >
                            <Sparkles className="h-4 w-4" />
                            {delivery.activeOverride?.action === "pin_to_top" ? "Remover prioridade" : "Priorizar"}
                        </Button>
                        <Button
                            className="justify-center gap-2"
                            isPending={isDelayPending}
                            onClick={(event) => {
                                event.stopPropagation();
                                onToggleOverride("delay");
                            }}
                            type="button"
                            variant={delivery.activeOverride?.action === "delay" ? "primary" : "secondary"}
                        >
                            <Clock3 className="h-4 w-4" />
                            {delivery.activeOverride?.action === "delay" ? "Retomar fila" : "Adiar"}
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
    const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
    const [dispatchReviewCandidate, setDispatchReviewCandidate] =
        useState<DispatchWaveCandidate | null>(null);
    const [selectedDispatchOrderIds, setSelectedDispatchOrderIds] = useState<string[]>([]);
    const [selectedDispatchVehicleId, setSelectedDispatchVehicleId] =
        useState<string | null>(null);
    const [overrideDialog, setOverrideDialog] = useState<{
        delivery: PendingDelivery;
        action: "pin_to_top" | "delay";
    } | null>(null);
    const [overrideReason, setOverrideReason] =
        useState<DispatchOverrideReason>("commercial_decision");
    const [overrideReasonNotes, setOverrideReasonNotes] = useState("");

    const pendingDeliveriesQuery = trpc.logistics.getPendingDeliveries.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });
    const fleetVehiclesQuery = trpc.farm.listVehicles.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });
    const incomingDeliveries = useMemo(
        () => pendingDeliveriesQuery.data ?? [],
        [pendingDeliveriesQuery.data],
    );
    const recommendationQueue = useDeliveryControlRefresh(incomingDeliveries);
    const deliveries = recommendationQueue.deliveries;
    const hasPendingRecommendationUpdate = recommendationQueue.hasPendingRecommendationUpdate;
    const nextDispatchAction = useMemo(
        () =>
            deliveries.find((delivery) => delivery.dispatchSuggestion !== null)?.dispatchSuggestion
            ?? null,
        [deliveries],
    );
    const isInitialLoading = pendingDeliveriesQuery.isLoading && !pendingDeliveriesQuery.data;
    const isRefreshingRecommendations = pendingDeliveriesQuery.isRefetching && !isInitialLoading;
    const resolvedSelectedOrderId = useMemo(() => {
        if (deliveries.length === 0) {
            return null;
        }

        if (selectedOrderId && deliveries.some((delivery) => delivery.orderId === selectedOrderId)) {
            return selectedOrderId;
        }

        return deliveries[0]?.orderId ?? null;
    }, [deliveries, selectedOrderId]);
    const externalContext = deliveries[0]?.recommendation.externalContext ?? null;
    const selectedDelivery = useMemo(
        () =>
            resolvedSelectedOrderId
                ? deliveries.find((delivery) => delivery.orderId === resolvedSelectedOrderId) ?? null
                : null,
        [deliveries, resolvedSelectedOrderId],
    );
    const selectedWaveMapContext = useMemo(
        () => dispatchReviewCandidate?.waveContext ?? selectedDelivery?.mapWaveContext ?? null,
        [
            dispatchReviewCandidate,
            selectedDelivery,
        ],
    );

    const statusMutation = trpc.logistics.updateDeliveryStatus.useMutation({
        onSuccess(_data, variables) {
            toast.success(
                variables.status === "ready_for_dispatch"
                    ? "Entrega pronta para sair."
                    : variables.status === "in_transit"
                        ? "Entrega despachada."
                        : "Entrega marcada como concluida.",
            );
            setActiveActionKey(null);
            recommendationQueue.forceApplyNextIncomingQueue();
            void utils.logistics.getPendingDeliveries.invalidate();
        },
        onError(error) {
            toast.error(error.message || "Nao foi possivel atualizar a entrega.");
            setActiveActionKey(null);
        },
    });

    const confirmDispatchWaveMutation = trpc.logistics.confirmDispatchWave.useMutation({
        onSuccess(data) {
            toast.success(
                data.updatedOrderCount > 1
                    ? `Saida confirmada para ${data.updatedOrderCount} pedidos.`
                    : "Saida confirmada com dados operacionais.",
            );
            setActiveActionKey(null);
            setDispatchReviewCandidate(null);
            setSelectedDispatchOrderIds([]);
            setSelectedDispatchVehicleId(null);
            recommendationQueue.forceApplyNextIncomingQueue();
            void utils.logistics.getPendingDeliveries.invalidate();
        },
        onError(error) {
            toast.error(error.message || "Nao foi possivel confirmar a saida.");
            setActiveActionKey(null);
        },
    });

    const applyDispatchOverrideMutation = trpc.logistics.applyDispatchOverride.useMutation({
        onSuccess(_data, variables) {
            toast.success(
                variables.action === "pin_to_top"
                    ? "Pedido priorizado na fila."
                    : "Pedido marcado para segurar a saida.",
            );
            setActiveActionKey(null);
            setOverrideDialog(null);
            setOverrideReason("commercial_decision");
            setOverrideReasonNotes("");
            recommendationQueue.registerManualOverride();
            recommendationQueue.forceApplyNextIncomingQueue();
            void utils.logistics.getPendingDeliveries.invalidate();
        },
        onError(error) {
            toast.error(error.message || "Nao foi possivel aplicar o override.");
            setActiveActionKey(null);
        },
    });

    const clearDispatchOverrideMutation = trpc.logistics.clearDispatchOverride.useMutation({
        onSuccess() {
            toast.success("Override manual removido.");
            setActiveActionKey(null);
            recommendationQueue.clearManualOverrideLock();
            recommendationQueue.forceApplyNextIncomingQueue();
            void utils.logistics.getPendingDeliveries.invalidate();
        },
        onError(error) {
            toast.error(error.message || "Nao foi possivel limpar o override.");
            setActiveActionKey(null);
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
            delivery.origin?.latitude !== null
            && delivery.origin?.longitude !== null
            && delivery.destination?.latitude !== null
            && delivery.destination?.longitude !== null,
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

    const selectableVehicles = useMemo(
        () =>
            (fleetVehiclesQuery.data ?? []).filter(
                (vehicle) =>
                    vehicle.availabilityStatus === "available"
                    || vehicle.id === selectedDispatchVehicleId,
            ),
        [fleetVehiclesQuery.data, selectedDispatchVehicleId],
    );
    const selectedDispatchDeliveries = useMemo(() => {
        if (!dispatchReviewCandidate) {
            return [];
        }

        return dispatchReviewCandidate.deliveries.filter((delivery) =>
            selectedDispatchOrderIds.includes(delivery.orderId),
        );
    }, [dispatchReviewCandidate, selectedDispatchOrderIds]);

    const handleStatusUpdate = (orderId: string, status: "ready_for_dispatch" | "in_transit" | "delivered") => {
        setActiveActionKey(`${orderId}:${status}`);
        statusMutation.mutate({ orderId, status });
    };

    const handleOpenDispatchReview = (anchorOrderId: string) => {
        const candidate = deliveries.find(
            (delivery) => delivery.orderId === anchorOrderId,
        )?.dispatchSuggestion ?? null;

        if (!candidate) {
            toast.error("Nao ha uma saida valida para confirmar neste pedido.");
            return;
        }

        setDispatchReviewCandidate(candidate);
        setSelectedDispatchOrderIds(candidate.orderIds);
        setSelectedDispatchVehicleId(
            candidate.primaryDelivery.recommendation.suggestedVehicle?.id ?? null,
        );
    };

    const handleConfirmDispatch = () => {
        if (!dispatchReviewCandidate || selectedDispatchDeliveries.length === 0) {
            return;
        }

        const primaryDelivery = dispatchReviewCandidate.primaryDelivery;
        setActiveActionKey(`${primaryDelivery.orderId}:confirm-dispatch`);

        confirmDispatchWaveMutation.mutate({
            orderIds: selectedDispatchDeliveries.map((delivery) => delivery.orderId),
            farmId: primaryDelivery.origin?.farmId ?? undefined,
            selectedVehicleId: selectedDispatchVehicleId ?? undefined,
            confidence: primaryDelivery.recommendation.confidence,
            recommendedVehicleType: primaryDelivery.recommendation.suggestedVehicleType,
            recommendationSummary: dispatchReviewCandidate.recommendationSummary,
            recommendationSnapshot: {
                priorityScore: primaryDelivery.recommendation.priorityScore,
                urgencyLevel: primaryDelivery.recommendation.urgencyLevel,
                riskLevel: primaryDelivery.recommendation.riskLevel,
                confidence: primaryDelivery.recommendation.confidence,
                suggestedVehicleType: primaryDelivery.recommendation.suggestedVehicleType,
                explanation: dispatchReviewCandidate.recommendationSummary,
                reasons: primaryDelivery.recommendation.reasons,
            },
        });
    };

    const handleToggleDispatchOrder = (orderId: string) => {
        if (!dispatchReviewCandidate || orderId === dispatchReviewCandidate.primaryDelivery.orderId) {
            return;
        }

        setSelectedDispatchOrderIds((current) => {
            if (current.includes(orderId)) {
                const next = current.filter((value) => value !== orderId);
                return next.length > 0 ? next : current;
            }

            return [...current, orderId];
        });
    };

    const handleToggleOverride = (delivery: PendingDelivery, action: "pin_to_top" | "delay") => {
        if (delivery.activeOverride?.action === action) {
            setActiveActionKey(`${delivery.orderId}:clear-override`);
            clearDispatchOverrideMutation.mutate({ orderId: delivery.orderId });
            return;
        }

        setOverrideDialog({
            delivery,
            action,
        });
        setOverrideReason(getDefaultOverrideReason(delivery, action));
        setOverrideReasonNotes("");
    };

    const handleApplyOverride = () => {
        if (!overrideDialog) {
            return;
        }

        if (overrideReason === "other" && !overrideReasonNotes.trim()) {
            toast.error("Descreva o motivo quando selecionar 'Outro'.");
            return;
        }

        setActiveActionKey(`${overrideDialog.delivery.orderId}:${overrideDialog.action}`);
        applyDispatchOverrideMutation.mutate({
            orderId: overrideDialog.delivery.orderId,
            action: overrideDialog.action,
            reason: overrideReason,
            reasonNotes: overrideReasonNotes.trim() || null,
        });
    };

    const handleDispatchReviewChange = (open: boolean) => {
        if (!open && confirmDispatchWaveMutation.isPending) {
            return;
        }

        if (!open) {
            setDispatchReviewCandidate(null);
            setSelectedDispatchOrderIds([]);
            setSelectedDispatchVehicleId(null);
            return;
        }
    };

    const handleOverrideDialogChange = (open: boolean) => {
        if (!open && applyDispatchOverrideMutation.isPending) {
            return;
        }

        if (!open) {
            setOverrideDialog(null);
            setOverrideReason("commercial_decision");
            setOverrideReasonNotes("");
        }
    };

    const handleApplyLatestRecommendation = () => {
        recommendationQueue.applyLatestRecommendation();
        toast.success("Nova recomendacao aplicada sem sobrescrever o override manual.");
    };

    const handleRefreshRecommendation = async () => {
        if (hasPendingRecommendationUpdate) {
            handleApplyLatestRecommendation();
            return;
        }

        const result = await pendingDeliveriesQuery.refetch();

        if (result.error) {
            toast.error(result.error.message || "Nao foi possivel atualizar a recomendacao.");
        }
    };

    return (
        <>
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
                            Operacao logistica dos pedidos prontos para sair da fazenda, com distancia em linha reta calculada no banco e mapa sincronizado com cada destino.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            className="justify-center"
                            disabled={isRefreshingRecommendations}
                            onClick={() => {
                                void handleRefreshRecommendation();
                            }}
                            type="button"
                            variant={hasPendingRecommendationUpdate ? "secondary" : "ghost"}
                        >
                            <RefreshCcw className={`h-4 w-4 ${isRefreshingRecommendations ? "animate-spin" : ""}`} />
                            {hasPendingRecommendationUpdate
                                ? "Aplicar nova recomendacao"
                                : "Atualizar recomendacao"}
                        </Button>
                        <Button asChild className="justify-center" variant="ghost">
                            <Link href="/dashboard">
                                <ArrowLeft className="h-4 w-4" />
                                Voltar ao painel
                            </Link>
                        </Button>
                    </div>
                </header>

                {externalContext ? (
                    <Card
                        className={cn(
                            "overflow-hidden shadow-card",
                            externalContext.status === "degraded"
                                ? "border-amber-200 bg-amber-50/95"
                                : "border-forest/10 bg-white/95",
                        )}
                    >
                        <CardContent className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-2">
                                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-bark/65">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Contexto externo {externalContext.status === "degraded" ? "degradado" : "sincronizado"}
                                </p>
                                <p className="text-sm leading-6 text-bark/80">
                                    {externalContext.summary}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-bark/70">
                                {externalContext.signals.map((signal) => (
                                    <span
                                        className="rounded-full border border-soil/10 bg-white/85 px-3 py-1.5"
                                        key={signal.source}
                                    >
                                        {signal.summary}
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {hasPendingRecommendationUpdate ? (
                    <Card className="overflow-hidden border-amber-200 bg-white/95 shadow-card">
                        <CardContent className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">
                                    Nova recomendacao disponivel
                                </p>
                                <p className="text-sm leading-6 text-bark/80">
                                    Existe override manual ativo. A fila atual foi preservada e a nova leitura da IA ficou aguardando sua aprovacao.
                                </p>
                            </div>

                            <Button onClick={handleApplyLatestRecommendation} type="button">
                                <Sparkles className="h-4 w-4" />
                                Aplicar nova recomendacao
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                {!isInitialLoading && nextDispatchAction ? (
                    <Card className="overflow-hidden border-forest/10 bg-white/95 shadow-[0_28px_70px_-34px_rgba(13,51,33,0.35)]">
                        <CardContent className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-forest/75">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Proxima acao agora
                                    </p>
                                    <h2 className="font-display text-3xl font-black text-soil">
                                        {nextDispatchAction.title}
                                    </h2>
                                    <p className="max-w-3xl text-sm leading-6 text-bark/75">
                                        {nextDispatchAction.subtitle}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-bark/70">
                                    <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1.5">
                                        {formatOrdersLabel(nextDispatchAction.totalOrders)}
                                    </span>
                                    <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1.5">
                                        Veiculo sugerido: {nextDispatchAction.suggestedVehicleLabel}
                                    </span>
                                    <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1.5">
                                        Confianca {confidenceLabels[nextDispatchAction.primaryDelivery.recommendation.confidence]}
                                    </span>
                                    {nextDispatchAction.totalEstimatedWeightKg !== null ? (
                                        <span className="rounded-full border border-forest/10 bg-sage/35 px-3 py-1.5">
                                            Peso estimado: {formatMass(nextDispatchAction.totalEstimatedWeightKg, "kg")}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <Button
                                className="justify-center px-6"
                                onClick={() =>
                                    handleOpenDispatchReview(
                                        nextDispatchAction.primaryDelivery.orderId,
                                    )
                                }
                                type="button"
                            >
                                <Truck className="h-4 w-4" />
                                {nextDispatchAction.ctaLabel}
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                    {isInitialLoading ? (
                        Array.from({ length: 3 }).map((_, index) => <DeliveriesMetricSkeleton key={index} />)
                    ) : (
                        <>
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
                                    Distancia media
                                </p>
                                <p className="mt-2 font-display text-3xl font-black text-soil">
                                    {formatDistanceKm(averageDistanceKm, { fallback: "--" })}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.92fr)]">
                    <section className="space-y-4">
                        {isInitialLoading ? (
                            Array.from({ length: 3 }).map((_, index) => (
                                <SkeletonCard
                                    className="rounded-[28px_18px_24px_18px] border-soil/8 bg-white/80 p-6"
                                    key={index}
                                    showAvatar={false}
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
                                    isDeliveredPending={
                                        statusMutation.isPending && activeActionKey === `${delivery.orderId}:delivered`
                                    }
                                    isDelayPending={
                                        applyDispatchOverrideMutation.isPending && activeActionKey === `${delivery.orderId}:delay`
                                        || clearDispatchOverrideMutation.isPending
                                            && activeActionKey === `${delivery.orderId}:clear-override`
                                            && delivery.activeOverride?.action === "delay"
                                    }
                                    isPinPending={
                                        applyDispatchOverrideMutation.isPending && activeActionKey === `${delivery.orderId}:pin_to_top`
                                        || clearDispatchOverrideMutation.isPending
                                            && activeActionKey === `${delivery.orderId}:clear-override`
                                            && delivery.activeOverride?.action === "pin_to_top"
                                    }
                                    isPrimaryPending={
                                        confirmDispatchWaveMutation.isPending && activeActionKey === `${delivery.orderId}:confirm-dispatch`
                                        || statusMutation.isPending && activeActionKey === `${delivery.orderId}:in_transit`
                                    }
                                    isSelected={resolvedSelectedOrderId === delivery.orderId}
                                    key={delivery.orderId}
                                    onConfirmDispatch={() => handleOpenDispatchReview(delivery.orderId)}
                                    onSelect={() => setSelectedOrderId(delivery.orderId)}
                                    onToggleOverride={(action) => handleToggleOverride(delivery, action)}
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

                        {selectedWaveMapContext ? (
                            <div className="mb-4 rounded-[22px_16px_20px_16px] border border-soil/10 bg-white/90 px-4 py-4 shadow-card">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                    {selectedWaveMapContext.title}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-bark/75">
                                    {selectedWaveMapContext.subtitle}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark/70">
                                    <span className="rounded-full border border-soil/10 bg-cream-dark/35 px-3 py-1.5">
                                        {formatOrdersLabel(selectedWaveMapContext.stops.length)}
                                    </span>
                                    <span className="rounded-full border border-soil/10 bg-cream-dark/35 px-3 py-1.5">
                                        Sequencia {selectedWaveMapContext.kind === "confirmed" ? "confirmada" : "sugerida"}
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        {isInitialLoading ? (
                            <DeliveriesMapSkeleton />
                        ) : (
                            <DeliveryMap
                                deliveries={deliveries}
                                onSelect={(orderId) => setSelectedOrderId(orderId)}
                                selectedOrderId={resolvedSelectedOrderId}
                                waveContext={selectedWaveMapContext}
                            />
                        )}
                    </aside>
                </div>
            </div>

            <Dialog
                onOpenChange={handleDispatchReviewChange}
                open={dispatchReviewCandidate !== null}
            >
                <DialogContent className="max-w-3xl border-soil/10 bg-cream p-0">
                    <DialogHeader className="border-b border-soil/10 px-6 py-5">
                        <DialogTitle className="font-display text-2xl font-black text-soil">
                            Confirmar saida operacional
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-6 text-bark/70">
                            Revise os pedidos da wave e o veiculo antes de marcar a saida.
                        </DialogDescription>
                    </DialogHeader>

                    {dispatchReviewCandidate ? (
                        <>
                            <div className="space-y-5 px-6 py-6">
                                <div className="rounded-[20px] border border-forest/10 bg-sage/40 px-4 py-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                        Recomendacao ativa
                                    </p>
                                    <p className="mt-2 font-semibold text-soil">
                                        {dispatchReviewCandidate.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-bark/75">
                                        {dispatchReviewCandidate.recommendationSummary}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark/70">
                                        <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1">
                                            Veiculo sugerido:{" "}
                                            {dispatchReviewCandidate.primaryDelivery.recommendation.suggestedVehicle?.label
                                                ?? vehicleTypeLabels[
                                                    dispatchReviewCandidate.primaryDelivery.recommendation
                                                        .suggestedVehicleType
                                                ]
                                                ?? dispatchReviewCandidate.primaryDelivery.recommendation.suggestedVehicleType}
                                        </span>
                                        <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1">
                                            Confianca{" "}
                                            {
                                                confidenceLabels[
                                                    dispatchReviewCandidate.primaryDelivery.recommendation.confidence
                                                ]
                                            }
                                        </span>
                                        <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1">
                                            {formatOrdersLabel(selectedDispatchDeliveries.length)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                            Pedidos na wave
                                        </p>
                                        <span className="text-xs font-semibold text-bark/65">
                                            Ancora fixa + pedidos compativeis opcionais
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {dispatchReviewCandidate.deliveries.map((delivery) => {
                                            const isPrimary =
                                                delivery.orderId
                                                === dispatchReviewCandidate.primaryDelivery.orderId;
                                            const isSelected = selectedDispatchOrderIds.includes(
                                                delivery.orderId,
                                            );
                                            const estimatedWeight =
                                                delivery.totalEstimatedWeightKg !== null
                                                    ? formatMass(
                                                        delivery.totalEstimatedWeightKg,
                                                        "kg",
                                                    )
                                                    : null;

                                            return (
                                                <button
                                                    className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                                                        isSelected
                                                            ? "border-forest bg-white shadow-[0_16px_32px_-24px_rgba(13,51,33,0.35)]"
                                                            : "border-soil/10 bg-cream-dark/35 hover:border-forest/20 hover:bg-white/80"
                                                    }`}
                                                    disabled={isPrimary}
                                                    key={delivery.orderId}
                                                    onClick={() =>
                                                        handleToggleDispatchOrder(delivery.orderId)
                                                    }
                                                    type="button"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-soil">
                                                                {delivery.buyerName}
                                                            </p>
                                                            <p className="mt-1 text-sm text-bark/70">
                                                                {delivery.deliveryAddress.label}
                                                            </p>
                                                        </div>
                                                        <span className="rounded-full border border-soil/10 bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-bark/70">
                                                            {isPrimary
                                                                ? "Ancora"
                                                                : isSelected
                                                                    ? "Na wave"
                                                                    : "Fora da wave"}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark/70">
                                                        <span className="rounded-full border border-soil/10 bg-white/80 px-2.5 py-1">
                                                            {statusLabels[delivery.status] ?? delivery.status}
                                                        </span>
                                                        <span className="rounded-full border border-soil/10 bg-white/80 px-2.5 py-1">
                                                            {formatDistanceKm(delivery.distanceKm)}
                                                        </span>
                                                        {estimatedWeight ? (
                                                            <span className="rounded-full border border-soil/10 bg-white/80 px-2.5 py-1">
                                                                {estimatedWeight}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                        Escolha do veiculo
                                    </p>

                                    <button
                                        className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                                            selectedDispatchVehicleId === null
                                                ? "border-forest bg-white shadow-[0_16px_32px_-24px_rgba(13,51,33,0.35)]"
                                                : "border-soil/10 bg-cream-dark/35 hover:border-forest/20 hover:bg-white/80"
                                        }`}
                                        onClick={() => setSelectedDispatchVehicleId(null)}
                                        type="button"
                                    >
                                        <p className="font-semibold text-soil">
                                            Usar apenas o tipo recomendado
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-bark/70">
                                            A wave fica confirmada sem travar um veiculo especifico neste momento.
                                        </p>
                                    </button>

                                    {fleetVehiclesQuery.isLoading && !fleetVehiclesQuery.data ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-24 rounded-[18px]" />
                                            <Skeleton className="h-24 rounded-[18px]" />
                                        </div>
                                    ) : selectableVehicles.length > 0 ? (
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {selectableVehicles.map((vehicle) => (
                                                <button
                                                    className={`rounded-[18px] border px-4 py-4 text-left transition ${
                                                        selectedDispatchVehicleId === vehicle.id
                                                            ? "border-forest bg-white shadow-[0_16px_32px_-24px_rgba(13,51,33,0.35)]"
                                                            : "border-soil/10 bg-cream-dark/35 hover:border-forest/20 hover:bg-white/80"
                                                    }`}
                                                    key={vehicle.id}
                                                    onClick={() =>
                                                        setSelectedDispatchVehicleId(vehicle.id)
                                                    }
                                                    type="button"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-soil">
                                                                {vehicle.label}
                                                            </p>
                                                            <p className="mt-1 text-sm text-bark/70">
                                                                {vehicleTypeLabels[vehicle.vehicleType] ??
                                                                    vehicle.vehicleType}
                                                            </p>
                                                        </div>
                                                        <span className="rounded-full border border-soil/10 bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-bark/70">
                                                            {vehicleAvailabilityLabels[
                                                                vehicle.availabilityStatus
                                                            ] ?? vehicle.availabilityStatus}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-bark/70">
                                                        <span className="rounded-full border border-soil/10 bg-white/80 px-2.5 py-1">
                                                            {vehicle.capacityKg} kg
                                                        </span>
                                                        <span className="rounded-full border border-soil/10 bg-white/80 px-2.5 py-1">
                                                            {vehicle.refrigeration
                                                                ? "Refrigerado"
                                                                : "Carga seca"}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-[18px] border border-soil/10 bg-cream-dark/35 px-4 py-4 text-sm leading-6 text-bark/75">
                                            Nenhum veiculo disponivel no catalogo. A confirmacao pode seguir apenas com o tipo recomendado.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="border-t border-soil/10 px-6 py-5">
                                <Button
                                    onClick={() => handleDispatchReviewChange(false)}
                                    type="button"
                                    variant="ghost"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    disabled={selectedDispatchDeliveries.length === 0}
                                    isPending={confirmDispatchWaveMutation.isPending}
                                    onClick={handleConfirmDispatch}
                                    type="button"
                                >
                                    {selectedDispatchDeliveries.length > 1
                                        ? "Confirmar wave"
                                        : "Confirmar saida"}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog
                onOpenChange={handleOverrideDialogChange}
                open={overrideDialog !== null}
            >
                <DialogContent className="max-w-2xl border-soil/10 bg-cream p-0">
                    <DialogHeader className="border-b border-soil/10 px-6 py-5">
                        <DialogTitle className="font-display text-2xl font-black text-soil">
                            {overrideDialog?.action === "pin_to_top"
                                ? "Priorizar pedido manualmente"
                                : "Adiar pedido na fila"}
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-6 text-bark/70">
                            O motivo fica salvo no ciclo operacional do dia e aparece no control tower.
                        </DialogDescription>
                    </DialogHeader>

                    {overrideDialog ? (
                        <>
                            <div className="space-y-5 px-6 py-6">
                                <div className="rounded-[18px] border border-soil/10 bg-cream-dark/35 px-4 py-4">
                                    <p className="font-semibold text-soil">
                                        {overrideDialog.delivery.buyerName}
                                    </p>
                                    <p className="mt-1 text-sm text-bark/70">
                                        {overrideDialog.delivery.deliveryAddress.label}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60">
                                        Motivo do override
                                    </p>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {overrideReasonOptions.map((option) => (
                                            <button
                                                className={`rounded-[18px] border px-4 py-3 text-left text-sm transition ${
                                                    overrideReason === option.value
                                                        ? "border-forest bg-white text-soil shadow-[0_16px_32px_-24px_rgba(13,51,33,0.35)]"
                                                        : "border-soil/10 bg-cream-dark/35 text-bark/75 hover:border-forest/20 hover:bg-white/80"
                                                }`}
                                                key={option.value}
                                                onClick={() => setOverrideReason(option.value)}
                                                type="button"
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label
                                        className="text-[10px] font-bold uppercase tracking-[0.16em] text-bark/60"
                                        htmlFor="override-reason-notes"
                                    >
                                        Observacao {overrideReason === "other" ? "(obrigatoria)" : "(opcional)"}
                                    </label>
                                    <textarea
                                        className="min-h-[120px] w-full rounded-[18px] border border-soil/10 bg-cream-dark/35 px-4 py-3 text-sm leading-6 text-soil outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
                                        id="override-reason-notes"
                                        onChange={(event) =>
                                            setOverrideReasonNotes(event.target.value)
                                        }
                                        placeholder={
                                            overrideReason === "other"
                                                ? "Explique o motivo operacional."
                                                : "Detalhes adicionais para a equipe."
                                        }
                                        value={overrideReasonNotes}
                                    />
                                </div>
                            </div>

                            <DialogFooter className="border-t border-soil/10 px-6 py-5">
                                <Button
                                    onClick={() => handleOverrideDialogChange(false)}
                                    type="button"
                                    variant="ghost"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    isPending={applyDispatchOverrideMutation.isPending}
                                    onClick={handleApplyOverride}
                                    type="button"
                                >
                                    Salvar override
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}
