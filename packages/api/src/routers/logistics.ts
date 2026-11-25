import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  type AppDb,
  addresses,
  deliveryDispatchOverrides,
  deliveryDispatchWaveOrders,
  deliveryDispatchWaves,
  enableTenantCatalogReadContext,
  farmVehicles,
  farms,
  orderItems,
  orders,
  productLots,
  products,
  tenants,
} from "@frescari/db";
import { calculateFreightSchema } from "@frescari/validators";

import {
  buildDispatchControlQueueWithExternalRiskSignals,
  estimateDeliveryWeightKg,
  getOperationDate,
  suggestVehicleTypeForLoad,
  type DeliveryControlFleetVehicle,
  type DeliveryControlQueueItem,
  type DispatchConfidence,
} from "../delivery-control";
import {
  MAX_WAVE_STOPS,
  UNKNOWN_ITEM_WEIGHT_KG,
  WAVE_RADIUS_KM,
  brasiliaDayKey,
  haversineKm,
  planStopOrder,
  selectWaveMembers,
  type GeoPoint,
  type WaveCandidate,
} from "../dispatch-route";
import { stubDeliveryExternalSignalsResolver } from "../external-risk-signals";
import {
  normalizeCurrencyValue,
  normalizeNullableCurrencyValue,
  resolveEffectiveDeliveryRadiusKm,
} from "../freight-quote";
import {
  describeDeliverySchedule,
  listDeliverySlots,
  resolveDeliverySchedule,
} from "../delivery-slots";
import { emitOrderNotifications } from "../notifications/domain-events";
import { buyerProcedure, createTRPCRouter, producerProcedure } from "../trpc";

const pendingDeliveryStatuses = [
  "payment_authorized",
  "confirmed",
  "picking",
  "ready_for_dispatch",
  // Shown as "em rota" so the producer can confirm the delivery here.
  "in_transit",
] as const;
// Only orders already paid and confirmed can go into a wave
// (payment_authorized is an uncaptured legacy state).
const dispatchableStatuses = new Set(["confirmed", "picking"]);
const deliveryMutationStatuses = [
  "ready_for_dispatch",
  "in_transit",
  "delivered",
] as const;
const dispatchConfidenceLevels = ["high", "medium", "low"] as const;
const fleetVehicleTypes = [
  "motorcycle",
  "car",
  "pickup",
  "van",
  "refrigerated_van",
  "truck",
  "refrigerated_truck",
] as const;
const dispatchOverrideActions = ["pin_to_top", "delay"] as const;
const dispatchOverrideReasons = [
  "customer_priority",
  "delivery_window",
  "vehicle_load",
  "address_issue",
  "awaiting_picking",
  "commercial_decision",
  "other",
] as const;
export { resolveEffectiveDeliveryRadiusKm } from "../freight-quote";

type DeliveryMutationStatus = (typeof deliveryMutationStatuses)[number];

type PendingDeliveryRow = {
  orderId: string;
  status: string;
  totalAmount: string;
  deliveryFee: string;
  createdAt: Date;
  buyerTenantId: string;
  buyerName: string;
  deliveryStreet: string;
  deliveryNumber: string;
  deliveryCep: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryAddress: string;
  deliveryNotes: string | null;
  deliveryWindowStart: Date | null;
  deliveryWindowEnd: Date | null;
  farmId: string | null;
  farmName: string | null;
  farmLatitude: number | null;
  farmLongitude: number | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  distanceKm: number | null;
  orderItemId: string;
  productId: string;
  productName: string;
  itemQty: string;
  itemSaleUnit: string;
  productSaleUnit: string;
  unitWeightG: number | null;
  estimatedWeightKg: number | null;
  lotExpiryDate: string | Date | null;
  lotFreshnessScore: number | null | undefined;
};

type PendingDeliveryItem = {
  orderItemId: string;
  productId: string;
  productName: string;
  qty: string;
  saleUnit: string;
  productSaleUnit: string;
  unitWeightG: number | null;
  estimatedWeightKg: number | null;
};

type PendingDelivery = {
  orderId: string;
  status: string;
  totalAmount: string;
  deliveryFee: string;
  createdAt: Date;
  buyerTenantId: string;
  buyerName: string;
  deliveryAddress: {
    street: string;
    number: string;
    cep: string;
    city: string;
    state: string;
    label: string;
    notes: string | null;
  };
  deliveryWindow: {
    start: Date | null;
    end: Date | null;
  };
  deliveryWindowStart: Date | null;
  deliveryWindowEnd: Date | null;
  distanceKm: number | null;
  totalEstimatedWeightKg: number | null;
  minFreshnessScore: number | null;
  nearestExpiryDate: Date | null;
  itemCount: number;
  hasValidRouteCoordinates: boolean;
  origin: {
    farmId: string;
    farmName: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  destination: {
    latitude: number | null;
    longitude: number | null;
  } | null;
  items: PendingDeliveryItem[];
};

type PendingDeliveryAccumulator = PendingDelivery & {
  totalEstimatedWeightKg: number;
  hasEstimatedWeight: boolean;
};

type PendingDeliveryQueueItem = DeliveryControlQueueItem<PendingDelivery>;

type DeliveryMapWavePoint = {
  latitude: number;
  longitude: number;
};

type DeliveryMapWaveOrigin = {
  farmId: string;
  farmName: string;
  latitude: number;
  longitude: number;
} | null;

type DeliveryMapWaveStop = {
  orderId: string;
  buyerName: string;
  sequence: number;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
};

type DeliveryMapWaveContext = {
  kind: "suggested" | "confirmed";
  orderIds: string[];
  origin: DeliveryMapWaveOrigin;
  polyline: DeliveryMapWavePoint[];
  primaryOrderId: string;
  stops: DeliveryMapWaveStop[];
  subtitle: string;
  title: string;
};

type DispatchSuggestionDelivery = {
  orderId: string;
  buyerName: string;
  deliveryAddress: {
    label: string;
  };
  status: string;
  distanceKm: number | null;
  totalEstimatedWeightKg: number | null;
};

type DispatchSuggestion = {
  ctaLabel: string;
  deliveries: DispatchSuggestionDelivery[];
  orderIds: string[];
  primaryDelivery: {
    orderId: string;
    origin: {
      farmId: string | null;
    } | null;
    recommendation: {
      priorityScore: number;
      urgencyLevel: "high" | "medium" | "low";
      riskLevel: "high" | "medium" | "low";
      confidence: (typeof dispatchConfidenceLevels)[number];
      suggestedVehicleType: (typeof fleetVehicleTypes)[number];
      suggestedVehicle: {
        id: string;
        label: string;
      } | null;
      reasons: string[];
    };
  };
  recommendationSummary: string;
  suggestedVehicleLabel: string;
  subtitle: string;
  title: string;
  totalEstimatedWeightKg: number | null;
  totalOrders: number;
  waveContext: DeliveryMapWaveContext;
};

type PendingDeliveryResponseItem = PendingDeliveryQueueItem & {
  dispatchSuggestion: DispatchSuggestion | null;
  mapWaveContext: DeliveryMapWaveContext | null;
};

type DeliveryOverrideRow = {
  id: string;
  orderId: string;
  operationDate: string;
  action: (typeof dispatchOverrideActions)[number];
  reason: (typeof dispatchOverrideReasons)[number];
  reasonNotes: string | null;
  createdAt: Date;
};

type FleetVehicleRow = {
  id: string;
  farmId: string | null;
  label: string;
  vehicleType: (typeof fleetVehicleTypes)[number];
  capacityKg: string;
  refrigeration: boolean;
  availabilityStatus: "available" | "in_use" | "maintenance" | "offline";
};

type DispatchWaveAssignmentRow = {
  waveId: string;
  orderId: string;
  sequence: number;
  status: "confirmed" | "departed" | "cancelled";
  confidence: (typeof dispatchConfidenceLevels)[number];
  recommendedVehicleType: (typeof fleetVehicleTypes)[number];
  selectedVehicleId: string | null;
  selectedVehicleLabel: string | null;
  confirmedAt: Date;
};

function assertDeliveryTransition(
  currentStatus: string,
  nextStatus: DeliveryMutationStatus,
) {
  const allowedTransitions: Record<string, DeliveryMutationStatus[]> = {
    confirmed: ["ready_for_dispatch"],
    picking: ["ready_for_dispatch"],
    ready_for_dispatch: ["in_transit", "delivered"],
    in_transit: ["delivered"],
  };

  const allowedNextStatuses = allowedTransitions[currentStatus] ?? [];

  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Nao e possivel avancar um pedido com status "${currentStatus}" para "${nextStatus}".`,
    });
  }
}

function groupPendingDeliveryRows(
  rows: PendingDeliveryRow[],
): PendingDelivery[] {
  const deliveriesByOrder = new Map<string, PendingDeliveryAccumulator>();

  for (const row of rows) {
    const existingDelivery = deliveriesByOrder.get(row.orderId);

    const lotExpiryDate =
      row.lotExpiryDate instanceof Date
        ? row.lotExpiryDate
        : row.lotExpiryDate != null
          ? new Date(row.lotExpiryDate)
          : null;
    const lotFreshnessScore = row.lotFreshnessScore ?? null;

    if (!existingDelivery) {
      deliveriesByOrder.set(row.orderId, {
        orderId: row.orderId,
        status: row.status,
        totalAmount: row.totalAmount,
        deliveryFee: row.deliveryFee,
        createdAt: row.createdAt,
        buyerTenantId: row.buyerTenantId,
        buyerName: row.buyerName,
        deliveryAddress: {
          street: row.deliveryStreet,
          number: row.deliveryNumber,
          cep: row.deliveryCep,
          city: row.deliveryCity,
          state: row.deliveryState,
          label: row.deliveryAddress,
          notes: row.deliveryNotes,
        },
        deliveryWindow: {
          start: row.deliveryWindowStart,
          end: row.deliveryWindowEnd,
        },
        deliveryWindowStart: row.deliveryWindowStart,
        deliveryWindowEnd: row.deliveryWindowEnd,
        distanceKm: row.distanceKm,
        totalEstimatedWeightKg: 0,
        minFreshnessScore: lotFreshnessScore,
        nearestExpiryDate: lotExpiryDate,
        itemCount: 0,
        hasValidRouteCoordinates:
          row.farmLatitude !== null &&
          row.farmLongitude !== null &&
          row.deliveryLatitude !== null &&
          row.deliveryLongitude !== null,
        origin:
          row.farmId !== null && row.farmName !== null
            ? {
                farmId: row.farmId,
                farmName: row.farmName,
                latitude: row.farmLatitude,
                longitude: row.farmLongitude,
              }
            : null,
        destination:
          row.deliveryLatitude !== null && row.deliveryLongitude !== null
            ? {
                latitude: row.deliveryLatitude,
                longitude: row.deliveryLongitude,
              }
            : null,
        items: [],
        hasEstimatedWeight: false,
      });
    }

    const groupedDelivery = deliveriesByOrder.get(row.orderId);

    groupedDelivery?.items.push({
      orderItemId: row.orderItemId,
      productId: row.productId,
      productName: row.productName,
      qty: row.itemQty,
      saleUnit: row.itemSaleUnit,
      productSaleUnit: row.productSaleUnit,
      unitWeightG: row.unitWeightG,
      estimatedWeightKg: row.estimatedWeightKg,
    });

    if (groupedDelivery) {
      groupedDelivery.itemCount += 1;

      if (row.estimatedWeightKg !== null) {
        groupedDelivery.totalEstimatedWeightKg += row.estimatedWeightKg;
        groupedDelivery.hasEstimatedWeight = true;
      } else {
        // 40 boxes with no unit weight are not weightless: without this an
        // order of 2 kg + 40 boxes was estimated at 2 kg (a motorcycle).
        groupedDelivery.totalEstimatedWeightKg += UNKNOWN_ITEM_WEIGHT_KG;
      }

      if (lotFreshnessScore !== null) {
        groupedDelivery.minFreshnessScore =
          groupedDelivery.minFreshnessScore === null
            ? lotFreshnessScore
            : Math.min(groupedDelivery.minFreshnessScore, lotFreshnessScore);
      }

      if (lotExpiryDate !== null) {
        groupedDelivery.nearestExpiryDate =
          groupedDelivery.nearestExpiryDate === null ||
          lotExpiryDate < groupedDelivery.nearestExpiryDate
            ? lotExpiryDate
            : groupedDelivery.nearestExpiryDate;
      }
    }
  }

  return Array.from(deliveriesByOrder.values()).map(
    ({ hasEstimatedWeight, totalEstimatedWeightKg, ...delivery }) => ({
      ...delivery,
      totalEstimatedWeightKg: hasEstimatedWeight
        ? Number(totalEstimatedWeightKg.toFixed(3))
        : null,
    }),
  );
}

function isValidCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function humanizeVehicleType(value: string) {
  return value.replace(/_/g, " ");
}

function hasConfirmedDispatch(delivery: PendingDeliveryQueueItem) {
  return delivery.dispatch !== null || delivery.status === "ready_for_dispatch";
}

function isDispatchable(delivery: PendingDeliveryQueueItem) {
  return (
    !hasConfirmedDispatch(delivery) && dispatchableStatuses.has(delivery.status)
  );
}

function isAutoActionable(delivery: PendingDeliveryQueueItem) {
  return (
    isDispatchable(delivery) && delivery.activeOverride?.action !== "delay"
  );
}

function resolveWaveOrigin(
  delivery: PendingDeliveryQueueItem,
): DeliveryMapWaveOrigin {
  if (
    !delivery.origin ||
    !isValidCoordinate(delivery.origin.latitude) ||
    !isValidCoordinate(delivery.origin.longitude)
  ) {
    return null;
  }

  return {
    farmId: delivery.origin.farmId,
    farmName: delivery.origin.farmName,
    latitude: delivery.origin.latitude,
    longitude: delivery.origin.longitude,
  };
}

function createWaveStop(
  delivery: PendingDeliveryQueueItem,
  sequence: number,
): DeliveryMapWaveStop | null {
  if (
    !delivery.destination ||
    !isValidCoordinate(delivery.destination.latitude) ||
    !isValidCoordinate(delivery.destination.longitude)
  ) {
    return null;
  }

  return {
    orderId: delivery.orderId,
    buyerName: delivery.buyerName,
    sequence,
    latitude: delivery.destination.latitude,
    longitude: delivery.destination.longitude,
    distanceKm: delivery.distanceKm,
  };
}

function buildWavePolyline(
  origin: DeliveryMapWaveOrigin,
  stops: DeliveryMapWaveStop[],
): DeliveryMapWavePoint[] {
  const polyline: DeliveryMapWavePoint[] = [];

  if (origin) {
    polyline.push({
      latitude: origin.latitude,
      longitude: origin.longitude,
    });
  }

  for (const stop of stops) {
    polyline.push({
      latitude: stop.latitude,
      longitude: stop.longitude,
    });
  }

  return polyline;
}

type DeliveryWaveCandidate = WaveCandidate & {
  delivery: PendingDeliveryQueueItem;
};

function toWaveCandidate(
  delivery: PendingDeliveryQueueItem,
): DeliveryWaveCandidate {
  const destination = delivery.destination;
  const point: GeoPoint | null =
    destination &&
    isValidCoordinate(destination.latitude) &&
    isValidCoordinate(destination.longitude)
      ? { latitude: destination.latitude, longitude: destination.longitude }
      : null;

  return {
    orderId: delivery.orderId,
    farmId: delivery.origin?.farmId ?? null,
    point,
    windowStart: delivery.deliveryWindowStart,
    weightKg: estimateDeliveryWeightKg(delivery),
    needsRefrigeration: delivery.recommendation.riskLevel === "high",
    delivery,
  };
}

// Stops in driving order from the farm (shortest path); a stop without
// coordinates goes last.
function routeWave(members: DeliveryWaveCandidate[]) {
  const origin = resolveWaveOrigin(members[0]!.delivery);
  const located = members.filter(
    (member): member is DeliveryWaveCandidate & { point: GeoPoint } =>
      member.point !== null,
  );
  const unlocated = members.filter((member) => member.point === null);
  const { ordered, totalKm } = planStopOrder(
    origin ? { latitude: origin.latitude, longitude: origin.longitude } : null,
    located,
  );

  return {
    deliveries: [...ordered, ...unlocated].map((member) => member.delivery),
    routeKm: located.length > 0 ? Number(totalKm.toFixed(1)) : null,
  };
}

function resolveWaveVehicleType(
  members: DeliveryWaveCandidate[],
  totalKg: number,
  needsRefrigeration: boolean,
  vehicle: DeliveryControlFleetVehicle | null,
) {
  if (vehicle) {
    return vehicle.vehicleType;
  }

  const distances = members
    .map((member) => member.delivery.distanceKm)
    .filter((km): km is number => km !== null);

  return suggestVehicleTypeForLoad({
    weightKg: totalKg,
    maxDistanceKm: distances.length > 0 ? Math.max(...distances) : null,
    needsRefrigeration,
  });
}

/**
 * The wave suggested around `primary`: same farm, same delivery day, close
 * to it, within one vehicle's capacity (see dispatch-route.ts), in driving
 * order.
 */
function planDispatchWave(
  primary: PendingDeliveryQueueItem,
  candidates: PendingDeliveryQueueItem[],
  vehicles: DeliveryControlFleetVehicle[],
) {
  const plan = selectWaveMembers(
    toWaveCandidate(primary),
    candidates.map(toWaveCandidate),
    vehicles,
  );
  const route = routeWave(plan.members);

  return {
    deliveries: route.deliveries,
    routeKm: route.routeKm,
    totalKg: plan.totalKg,
    vehicle: plan.vehicle,
    vehicleType: resolveWaveVehicleType(
      plan.members,
      plan.totalKg,
      plan.needsRefrigeration,
      plan.vehicle,
    ),
  };
}

const confidenceRank: Record<DispatchConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Server-side check of a wave the producer confirms (a suggested wave,
 * possibly with orders unticked): the same rules as the suggestion, so a
 * hand-crafted request can't mix days or regions or overload a vehicle.
 */
function validateDispatchWave(
  deliveries: PendingDeliveryQueueItem[],
  vehicles: DeliveryControlFleetVehicle[],
  selectedVehicleId: string | null,
) {
  const fail = (message: string): never => {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  };

  if (deliveries.length > MAX_WAVE_STOPS) {
    fail(`Uma saida pode ter no maximo ${MAX_WAVE_STOPS} pedidos.`);
  }

  const members = deliveries.map(toWaveCandidate);
  const farmIds = new Set(members.map((member) => member.farmId));

  if (farmIds.size > 1) {
    fail("Pedidos de fazendas diferentes nao podem sair juntos.");
  }

  const days = new Set(
    members
      .map((member) => member.windowStart)
      .filter((date): date is Date => date !== null)
      .map((date) => brasiliaDayKey(date)),
  );

  if (days.size > 1) {
    fail("Pedidos com entrega em dias diferentes nao podem sair juntos.");
  }

  const located = members.filter((member) => member.point !== null);

  for (let i = 0; i < located.length; i += 1) {
    for (let j = i + 1; j < located.length; j += 1) {
      if (
        haversineKm(located[i]!.point!, located[j]!.point!) >
        WAVE_RADIUS_KM * 2
      ) {
        fail(
          "Esses pedidos ficam em regioes distantes; confirme-os em saidas separadas.",
        );
      }
    }
  }

  const totalKg = members.reduce((sum, member) => sum + member.weightKg, 0);
  const needsRefrigeration = members.some(
    (member) => member.needsRefrigeration,
  );
  const farmId = members[0]?.farmId ?? null;
  let vehicle: DeliveryControlFleetVehicle | null = null;

  if (selectedVehicleId) {
    vehicle =
      vehicles.find((candidate) => candidate.id === selectedVehicleId) ?? null;

    if (!vehicle) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Veiculo nao encontrado para este produtor.",
      });
    }

    if (vehicle.availabilityStatus !== "available") {
      fail(`${vehicle.label} nao esta disponivel agora.`);
    }

    if (vehicle.farmId && farmId && vehicle.farmId !== farmId) {
      fail(`${vehicle.label} pertence a outra fazenda.`);
    }

    if (Number(vehicle.capacityKg) < totalKg) {
      fail(
        `A carga estimada (${totalKg.toFixed(0)} kg) passa da capacidade de ${vehicle.label} (${Number(vehicle.capacityKg).toFixed(0)} kg). Tire pedidos ou escolha outro veiculo.`,
      );
    }

    if (needsRefrigeration && !vehicle.refrigeration) {
      fail(
        `Ha carga sensivel nesta saida e ${vehicle.label} nao e refrigerado.`,
      );
    }
  }

  const route = routeWave(members);
  const confidence = deliveries
    .map((delivery) => delivery.recommendation.confidence)
    .reduce<DispatchConfidence>(
      (lowest, current) =>
        confidenceRank[current] > confidenceRank[lowest] ? current : lowest,
      "high",
    );

  return {
    farmId,
    orderedDeliveries: route.deliveries,
    totalKg,
    vehicle,
    vehicleType: resolveWaveVehicleType(
      members,
      totalKg,
      needsRefrigeration,
      vehicle,
    ),
    confidence,
  };
}

function buildSuggestedWaveContext(
  primaryDelivery: PendingDeliveryQueueItem,
  deliveries: PendingDeliveryQueueItem[],
  suggestedVehicleLabel: string,
): DeliveryMapWaveContext {
  const stops = deliveries
    .map((delivery, index) => createWaveStop(delivery, index + 1))
    .filter((stop): stop is DeliveryMapWaveStop => stop !== null);
  const origin = resolveWaveOrigin(primaryDelivery);
  const totalOrders = deliveries.length;

  return {
    kind: "suggested",
    orderIds: deliveries.map((delivery) => delivery.orderId),
    origin,
    polyline: buildWavePolyline(origin, stops),
    primaryOrderId: primaryDelivery.orderId,
    stops,
    subtitle:
      totalOrders === 1
        ? primaryDelivery.recommendation.explanation
        : `Wave sugerida com ${totalOrders} pedidos usando ${suggestedVehicleLabel.toLowerCase()}.`,
    title:
      totalOrders > 1
        ? "Wave sugerida selecionada"
        : "Saida sugerida selecionada",
  };
}

function buildConfirmedWaveContext(
  deliveries: PendingDeliveryQueueItem[],
  selectedOrderId: string,
): DeliveryMapWaveContext | null {
  const selectedDelivery = deliveries.find(
    (delivery) => delivery.orderId === selectedOrderId,
  );

  if (!selectedDelivery) {
    return null;
  }

  const waveId = selectedDelivery?.dispatch?.waveId ?? null;

  if (!waveId) {
    return null;
  }

  const waveDeliveries = deliveries
    .filter((delivery) => delivery.dispatch?.waveId === waveId)
    .sort(
      (left, right) =>
        (left.dispatch?.sequence ?? 0) - (right.dispatch?.sequence ?? 0),
    );

  if (waveDeliveries.length === 0) {
    return null;
  }

  const stops = waveDeliveries
    .map((delivery) =>
      createWaveStop(delivery, delivery.dispatch?.sequence ?? 0),
    )
    .filter((stop): stop is DeliveryMapWaveStop => stop !== null);
  const origin = resolveWaveOrigin(selectedDelivery);
  const totalOrders = waveDeliveries.length;

  return {
    kind: "confirmed",
    orderIds: waveDeliveries.map((delivery) => delivery.orderId),
    origin,
    polyline: buildWavePolyline(origin, stops),
    primaryOrderId: selectedOrderId,
    stops,
    subtitle: `Sequencia operacional confirmada com ${totalOrders} pedido${totalOrders > 1 ? "s" : ""}.`,
    title:
      totalOrders > 1
        ? "Wave confirmada selecionada"
        : "Saida confirmada selecionada",
  };
}

function buildDispatchSuggestion(
  deliveries: PendingDeliveryQueueItem[],
  anchorOrderId: string,
  vehicles: DeliveryControlFleetVehicle[],
): DispatchSuggestion | null {
  const primaryDelivery = deliveries.find(
    (delivery) =>
      delivery.orderId === anchorOrderId && isDispatchable(delivery),
  );

  if (!primaryDelivery) {
    return null;
  }

  const wave = planDispatchWave(
    primaryDelivery,
    deliveries.filter(isAutoActionable),
    vehicles,
  );
  const groupedDeliveries = wave.deliveries;
  const totalEstimatedWeightKg = Number(wave.totalKg.toFixed(3));
  const totalOrders = groupedDeliveries.length;
  const suggestedVehicleLabel =
    wave.vehicle?.label ?? humanizeVehicleType(wave.vehicleType);
  const routeNote =
    wave.routeKm !== null
      ? ` Rota de ~${wave.routeKm.toFixed(1)} km, ${totalEstimatedWeightKg.toFixed(0)} kg.`
      : "";
  const extraOrders = totalOrders - 1;
  const title =
    extraOrders <= 0
      ? `Despachar ${primaryDelivery.buyerName} agora`
      : `Despachar ${primaryDelivery.buyerName} e mais ${extraOrders} pedido${extraOrders > 1 ? "s" : ""}`;
  const subtitle =
    totalOrders === 1
      ? primaryDelivery.recommendation.explanation
      : `Wave sugerida com ${totalOrders} pedidos da mesma regiao e do mesmo dia usando ${suggestedVehicleLabel.toLowerCase()}.${routeNote}`;
  const recommendationSummary =
    totalOrders === 1
      ? primaryDelivery.recommendation.explanation
      : `Consolidar ${totalOrders} pedidos proximos agora.${routeNote} ${primaryDelivery.recommendation.explanation}`;

  return {
    ctaLabel:
      totalOrders === 1
        ? "Confirmar saida"
        : `Confirmar wave (${totalOrders} pedidos)`,
    deliveries: groupedDeliveries.map((delivery) => ({
      orderId: delivery.orderId,
      buyerName: delivery.buyerName,
      deliveryAddress: {
        label: delivery.deliveryAddress.label,
      },
      status: delivery.status,
      distanceKm: delivery.distanceKm,
      totalEstimatedWeightKg: delivery.totalEstimatedWeightKg,
    })),
    orderIds: groupedDeliveries.map((delivery) => delivery.orderId),
    primaryDelivery: {
      orderId: primaryDelivery.orderId,
      origin: primaryDelivery.origin
        ? {
            farmId: primaryDelivery.origin.farmId,
          }
        : null,
      recommendation: {
        priorityScore: primaryDelivery.recommendation.priorityScore,
        urgencyLevel: primaryDelivery.recommendation.urgencyLevel,
        riskLevel: primaryDelivery.recommendation.riskLevel,
        confidence: primaryDelivery.recommendation.confidence,
        // The vehicle for the whole wave, not just for the first order.
        suggestedVehicleType: wave.vehicleType,
        suggestedVehicle: wave.vehicle
          ? {
              id: wave.vehicle.id,
              label: wave.vehicle.label,
            }
          : null,
        reasons: primaryDelivery.recommendation.reasons,
      },
    },
    recommendationSummary,
    suggestedVehicleLabel,
    subtitle,
    title,
    totalEstimatedWeightKg,
    totalOrders,
    waveContext: buildSuggestedWaveContext(
      primaryDelivery,
      groupedDeliveries,
      suggestedVehicleLabel,
    ),
  };
}

function attachDispatchMapContext(
  deliveries: PendingDeliveryQueueItem[],
  vehicles: DeliveryControlFleetVehicle[],
): PendingDeliveryResponseItem[] {
  const dispatchSuggestionsByOrder = new Map<
    string,
    DispatchSuggestion | null
  >();
  const confirmedWaveContextsByOrder = new Map<
    string,
    DeliveryMapWaveContext | null
  >();

  for (const delivery of deliveries) {
    dispatchSuggestionsByOrder.set(
      delivery.orderId,
      buildDispatchSuggestion(deliveries, delivery.orderId, vehicles),
    );
    confirmedWaveContextsByOrder.set(
      delivery.orderId,
      buildConfirmedWaveContext(deliveries, delivery.orderId),
    );
  }

  return deliveries.map((delivery) => {
    const dispatchSuggestion =
      dispatchSuggestionsByOrder.get(delivery.orderId) ?? null;
    const confirmedWaveContext =
      confirmedWaveContextsByOrder.get(delivery.orderId) ?? null;

    return {
      ...delivery,
      dispatchSuggestion,
      mapWaveContext:
        confirmedWaveContext ?? dispatchSuggestion?.waveContext ?? null,
    };
  });
}

// The producer's delivery queue (orders, scores, fleet). Shared by the
// page query and by confirmDispatchWave, which re-plans on the server.
async function loadDispatchQueue(
  ctx: { db: AppDb; tenantId: string },
  now: Date,
) {
  const operationDate = getOperationDate(now);

  const deliveryRows = await ctx.db
    .select({
      orderId: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      deliveryFee: orders.deliveryFee,
      createdAt: orders.createdAt,
      buyerTenantId: orders.buyerTenantId,
      buyerName: tenants.name,
      deliveryStreet: orders.deliveryStreet,
      deliveryNumber: orders.deliveryNumber,
      deliveryCep: orders.deliveryCep,
      deliveryCity: orders.deliveryCity,
      deliveryState: orders.deliveryState,
      deliveryAddress: orders.deliveryAddress,
      deliveryNotes: orders.deliveryNotes,
      deliveryWindowStart: orders.deliveryWindowStart,
      deliveryWindowEnd: orders.deliveryWindowEnd,
      farmId: farms.id,
      farmName: farms.name,
      farmLatitude: sql<number | null>`
                    CASE
                        WHEN ${farms.location} IS NOT NULL AND ST_IsValid(${farms.location})
                            THEN CAST(ST_Y(${farms.location}) AS double precision)
                        ELSE NULL
                    END
                `,
      farmLongitude: sql<number | null>`
                    CASE
                        WHEN ${farms.location} IS NOT NULL AND ST_IsValid(${farms.location})
                            THEN CAST(ST_X(${farms.location}) AS double precision)
                        ELSE NULL
                    END
                `,
      deliveryLatitude: sql<number | null>`
                    CASE
                        WHEN ${orders.deliveryPoint} IS NOT NULL AND ST_IsValid(${orders.deliveryPoint})
                            THEN CAST(ST_Y(${orders.deliveryPoint}) AS double precision)
                        ELSE NULL
                    END
                `,
      deliveryLongitude: sql<number | null>`
                    CASE
                        WHEN ${orders.deliveryPoint} IS NOT NULL AND ST_IsValid(${orders.deliveryPoint})
                            THEN CAST(ST_X(${orders.deliveryPoint}) AS double precision)
                        ELSE NULL
                    END
                `,
      distanceKm: sql<number | null>`
                    CASE
                        WHEN ${farms.location} IS NOT NULL
                            AND ${orders.deliveryPoint} IS NOT NULL
                            AND ST_IsValid(${farms.location})
                            AND ST_IsValid(${orders.deliveryPoint})
                            THEN CAST(
                                ROUND(
                                    (ST_Distance(${farms.location}::geography, ${orders.deliveryPoint}::geography) / 1000.0)::numeric,
                                    2
                                ) AS double precision
                            )
                        ELSE NULL
                    END
                `,
      orderItemId: orderItems.id,
      productId: products.id,
      productName: products.name,
      itemQty: orderItems.qty,
      itemSaleUnit: sql<string>`
                    CASE
                        WHEN ${orderItems.saleUnit} IS NOT NULL AND ${orderItems.saleUnit} <> 'unit'
                            THEN ${orderItems.saleUnit}
                        ELSE ${products.saleUnit}::text
                    END
                `,
      productSaleUnit: sql<string>`${products.saleUnit}::text`,
      unitWeightG: products.unitWeightG,
      estimatedWeightKg: sql<number | null>`
                    CASE
                        WHEN ${orderItems.saleUnit} = 'kg'
                            THEN CAST(${orderItems.qty} AS double precision)
                        WHEN ${orderItems.saleUnit} = 'g'
                            THEN CAST(${orderItems.qty} AS double precision) / 1000.0
                        WHEN ${products.saleUnit} = 'kg'
                            THEN CAST(${orderItems.qty} AS double precision)
                        WHEN ${products.saleUnit} = 'g'
                            THEN CAST(${orderItems.qty} AS double precision) / 1000.0
                        WHEN ${products.unitWeightG} IS NOT NULL
                            THEN (CAST(${orderItems.qty} AS double precision) * CAST(${products.unitWeightG} AS double precision)) / 1000.0
                        ELSE NULL
                    END
                `,
      lotExpiryDate: productLots.expiryDate,
      lotFreshnessScore: productLots.freshnessScore,
    })
    .from(orders)
    .innerJoin(tenants, eq(orders.buyerTenantId, tenants.id))
    .leftJoin(farms, eq(farms.tenantId, orders.sellerTenantId))
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .innerJoin(productLots, eq(orderItems.lotId, productLots.id))
    .where(
      and(
        eq(orders.sellerTenantId, ctx.tenantId),
        inArray(orders.status, pendingDeliveryStatuses),
      ),
    )
    .orderBy(sql`${orders.createdAt} DESC`);

  const groupedDeliveries = groupPendingDeliveryRows(
    deliveryRows as PendingDeliveryRow[],
  );
  const orderIds = groupedDeliveries.map((delivery) => delivery.orderId);

  if (groupedDeliveries.length === 0) {
    return {
      queue: [] as PendingDeliveryQueueItem[],
      vehicles: [] as DeliveryControlFleetVehicle[],
    };
  }

  const [overrideRows, vehicleRows, waveAssignments] = await Promise.all([
    ctx.db
      .select({
        id: deliveryDispatchOverrides.id,
        orderId: deliveryDispatchOverrides.orderId,
        operationDate: deliveryDispatchOverrides.operationDate,
        action: deliveryDispatchOverrides.action,
        reason: deliveryDispatchOverrides.reason,
        reasonNotes: deliveryDispatchOverrides.reasonNotes,
        createdAt: deliveryDispatchOverrides.createdAt,
      })
      .from(deliveryDispatchOverrides)
      .where(
        and(
          eq(deliveryDispatchOverrides.tenantId, ctx.tenantId),
          inArray(deliveryDispatchOverrides.orderId, orderIds),
          eq(deliveryDispatchOverrides.operationDate, operationDate),
          isNull(deliveryDispatchOverrides.clearedAt),
        ),
      ),
    ctx.db
      .select({
        id: farmVehicles.id,
        farmId: farmVehicles.farmId,
        label: farmVehicles.label,
        vehicleType: farmVehicles.vehicleType,
        capacityKg: farmVehicles.capacityKg,
        refrigeration: farmVehicles.refrigeration,
        availabilityStatus: farmVehicles.availabilityStatus,
      })
      .from(farmVehicles)
      .where(eq(farmVehicles.tenantId, ctx.tenantId)),
    ctx.db
      .select({
        waveId: deliveryDispatchWaves.id,
        orderId: deliveryDispatchWaveOrders.orderId,
        sequence: deliveryDispatchWaveOrders.sequence,
        status: deliveryDispatchWaves.status,
        confidence: deliveryDispatchWaves.confidence,
        recommendedVehicleType: deliveryDispatchWaves.recommendedVehicleType,
        selectedVehicleId: deliveryDispatchWaves.selectedVehicleId,
        selectedVehicleLabel: sql<
          string | null
        >`COALESCE(${deliveryDispatchWaves.selectedVehicleLabel}, ${farmVehicles.label})`,
        confirmedAt: deliveryDispatchWaves.confirmedAt,
      })
      .from(deliveryDispatchWaveOrders)
      .innerJoin(
        deliveryDispatchWaves,
        eq(deliveryDispatchWaveOrders.waveId, deliveryDispatchWaves.id),
      )
      .leftJoin(
        farmVehicles,
        eq(deliveryDispatchWaves.selectedVehicleId, farmVehicles.id),
      )
      .where(
        and(
          eq(deliveryDispatchWaves.tenantId, ctx.tenantId),
          inArray(deliveryDispatchWaveOrders.orderId, orderIds),
        ),
      ),
  ]);

  const vehicles: DeliveryControlFleetVehicle[] = (
    vehicleRows as FleetVehicleRow[]
  ).map((vehicle) => ({
    ...vehicle,
    capacityKg: Number(vehicle.capacityKg),
  }));
  const queue = await buildDispatchControlQueueWithExternalRiskSignals(
    groupedDeliveries,
    {
      now,
      operationDate,
      overrides: overrideRows as DeliveryOverrideRow[],
      vehicles,
      waveAssignments: waveAssignments as DispatchWaveAssignmentRow[],
      resolveExternalSignals: stubDeliveryExternalSignalsResolver,
    },
  );

  return { queue, vehicles };
}

export const logisticsRouter = createTRPCRouter({
  // Windows the buyer can choose for this farm's order. The checkout
  // re-validates the chosen id against the same schedule.
  getDeliverySlots: buyerProcedure
    .input(
      z
        .object({
          farmId: z.string().uuid(),
          // The cart has items sold by weight: only windows the card
          // authorization still covers (checkout enforces the same rule).
          weighed: z.boolean().optional(),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const farmRecord = await ctx.db.transaction(async (tx) => {
        await enableTenantCatalogReadContext(tx, {
          tenantId: ctx.tenantId,
          userId: ctx.user.id,
        });

        const [farm] = await tx
          .select({
            deliveryDays: farms.deliveryDays,
            deliveryPeriods: farms.deliveryPeriods,
            deliveryLeadDays: farms.deliveryLeadDays,
          })
          .from(farms)
          .where(eq(farms.id, input.farmId))
          .limit(1);

        return farm ?? null;
      });

      if (!farmRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fazenda não encontrada.",
        });
      }

      const schedule = resolveDeliverySchedule(farmRecord);

      return {
        scheduleLabel: describeDeliverySchedule(schedule),
        slots: listDeliverySlots(schedule, new Date(), undefined, {
          weighed: input.weighed ?? false,
        }).map((slot) => ({
          id: slot.id,
          date: slot.date,
          period: slot.period,
          label: slot.label,
        })),
      };
    }),

  calculateFreight: buyerProcedure
    .input(calculateFreightSchema)
    .query(async ({ ctx, input }) => {
      const { addressRecord, distanceRow, farmRecord } =
        await ctx.db.transaction(async (tx) => {
          await enableTenantCatalogReadContext(tx, {
            tenantId: ctx.tenantId,
            userId: ctx.user.id,
          });

          const [addressRecord] = await tx
            .select({
              id: addresses.id,
              tenantId: addresses.tenantId,
              location: addresses.location,
            })
            .from(addresses)
            .where(eq(addresses.id, input.addressId))
            .limit(1);

          if (!addressRecord) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Endereço não encontrado.",
            });
          }

          if (addressRecord.tenantId !== ctx.tenantId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Este endereço não pertence ao tenant autenticado.",
            });
          }

          const [farmRecord] = await tx
            .select({
              id: farms.id,
              location: farms.location,
              baseDeliveryFee: farms.baseDeliveryFee,
              pricePerKm: farms.pricePerKm,
              maxDeliveryRadiusKm: farms.maxDeliveryRadiusKm,
              minOrderValue: farms.minOrderValue,
              freeShippingThreshold: farms.freeShippingThreshold,
            })
            .from(farms)
            .where(eq(farms.id, input.farmId))
            .limit(1);

          if (!farmRecord) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Fazenda não encontrada.",
            });
          }

          const [distanceRow] = await tx
            .select({
              distanceMeters: sql<number>`
                            CAST(
                                ST_DistanceSphere(${farms.location}, ${addresses.location})
                                AS double precision
                            )
                        `,
            })
            .from(farms)
            .innerJoin(addresses, eq(addresses.id, input.addressId))
            .where(
              and(
                eq(farms.id, input.farmId),
                eq(addresses.tenantId, ctx.tenantId),
              ),
            )
            .limit(1);

          return {
            addressRecord,
            distanceRow,
            farmRecord,
          };
        });

      if (!farmRecord.location || !addressRecord.location) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Não foi possível calcular o frete para esta combinação de origem e destino.",
        });
      }

      const maxDeliveryRadiusKm = resolveEffectiveDeliveryRadiusKm(
        farmRecord.maxDeliveryRadiusKm,
      );

      if (!Number.isFinite(maxDeliveryRadiusKm) || maxDeliveryRadiusKm <= 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Esta fazenda ainda não possui cobertura de entrega configurada.",
        });
      }

      const rawDistanceKm = (distanceRow?.distanceMeters ?? 0) / 1000;
      const distanceKm = Number(rawDistanceKm.toFixed(2));

      if (rawDistanceKm > maxDeliveryRadiusKm) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Endereço fora da área de cobertura desta fazenda.",
        });
      }

      const baseDeliveryFee = Number(farmRecord.baseDeliveryFee);
      const pricePerKm = Number(farmRecord.pricePerKm);
      const subtotal = normalizeCurrencyValue(input.subtotal);
      const minOrderValue = normalizeCurrencyValue(farmRecord.minOrderValue);
      const freeShippingThreshold = normalizeNullableCurrencyValue(
        farmRecord.freeShippingThreshold,
      );
      const hasReachedMinimumOrder = subtotal >= minOrderValue;
      const remainingForMinimumOrder = Number(
        Math.max(0, minOrderValue - subtotal).toFixed(2),
      );
      const baseFreightCost = Number(
        (baseDeliveryFee + distanceKm * pricePerKm).toFixed(2),
      );
      const hasReachedFreeShipping =
        freeShippingThreshold !== null && subtotal >= freeShippingThreshold;
      const remainingForFreeShipping =
        freeShippingThreshold !== null
          ? Number(Math.max(0, freeShippingThreshold - subtotal).toFixed(2))
          : null;
      const freightCost = hasReachedFreeShipping ? 0 : baseFreightCost;

      return {
        freightCost,
        baseFreightCost,
        distanceKm,
        minOrderValue,
        freeShippingThreshold,
        hasReachedMinimumOrder,
        remainingForMinimumOrder,
        hasReachedFreeShipping,
        remainingForFreeShipping,
      };
    }),

  getPendingDeliveries: producerProcedure.query(async ({ ctx }) => {
    const { queue, vehicles } = await loadDispatchQueue(ctx, new Date());

    return attachDispatchMapContext(queue, vehicles);
  }),

  applyDispatchOverride: producerProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        action: z.enum(dispatchOverrideActions),
        reason: z.enum(dispatchOverrideReasons),
        reasonNotes: z.string().trim().max(280).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const operationDate = getOperationDate(now);
      const reasonNotes = input.reasonNotes?.trim() || null;

      if (input.reason === "other" && !reasonNotes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: 'Informe um motivo quando a opcao selecionada for "outro".',
        });
      }

      const targetOrder = await ctx.db.query.orders.findFirst({
        where: and(
          eq(orders.id, input.orderId),
          eq(orders.sellerTenantId, ctx.tenantId),
        ),
      });

      if (!targetOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido nao encontrado para este produtor.",
        });
      }

      if (
        !pendingDeliveryStatuses.includes(
          targetOrder.status as (typeof pendingDeliveryStatuses)[number],
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A ordem manual so pode ser aplicada em pedidos ainda ativos na mesa logistica.",
        });
      }

      await ctx.db
        .update(deliveryDispatchOverrides)
        .set({ clearedAt: now })
        .where(
          and(
            eq(deliveryDispatchOverrides.tenantId, ctx.tenantId),
            eq(deliveryDispatchOverrides.orderId, input.orderId),
            eq(deliveryDispatchOverrides.operationDate, operationDate),
            isNull(deliveryDispatchOverrides.clearedAt),
          ),
        );

      const [override] = await ctx.db
        .insert(deliveryDispatchOverrides)
        .values({
          tenantId: ctx.tenantId,
          orderId: input.orderId,
          operationDate,
          action: input.action,
          reason: input.reason,
          reasonNotes,
          createdByUserId: ctx.user.id,
        })
        .returning({
          id: deliveryDispatchOverrides.id,
        });

      return {
        success: true,
        overrideId: override?.id ?? null,
        action: input.action,
      };
    }),

  clearDispatchOverride: producerProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const operationDate = getOperationDate(now);

      await ctx.db
        .update(deliveryDispatchOverrides)
        .set({ clearedAt: now })
        .where(
          and(
            eq(deliveryDispatchOverrides.tenantId, ctx.tenantId),
            eq(deliveryDispatchOverrides.orderId, input.orderId),
            eq(deliveryDispatchOverrides.operationDate, operationDate),
            isNull(deliveryDispatchOverrides.clearedAt),
          ),
        );

      return {
        success: true,
        orderId: input.orderId,
      };
    }),

  confirmDispatchWave: producerProcedure
    .input(
      z.object({
        orderIds: z.array(z.string().uuid()).min(1),
        farmId: z.string().uuid().optional(),
        selectedVehicleId: z.string().uuid().optional(),
        confidence: z.enum(dispatchConfidenceLevels),
        recommendedVehicleType: z.enum(fleetVehicleTypes),
        recommendationSummary: z.string().trim().min(8).max(280),
        recommendationSnapshot: z
          .object({
            priorityScore: z.number().int(),
            urgencyLevel: z.enum(["high", "medium", "low"]),
            riskLevel: z.enum(["high", "medium", "low"]),
            confidence: z.enum(dispatchConfidenceLevels),
            suggestedVehicleType: z.enum(fleetVehicleTypes),
            explanation: z.string(),
            reasons: z.array(z.string()),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const operationDate = getOperationDate(now);
      const orderIds = [...new Set(input.orderIds)];

      // Re-plan on the server with the same rules as the suggestion: the
      // client only picks which suggested orders go and in which vehicle.
      const { queue, vehicles } = await loadDispatchQueue(ctx, now);
      const queueById = new Map(
        queue.map((delivery) => [delivery.orderId, delivery]),
      );
      const waveDeliveries: PendingDeliveryQueueItem[] = [];

      for (const orderId of orderIds) {
        const delivery = queueById.get(orderId);

        if (!delivery) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Nem todos os pedidos informados pertencem a este produtor.",
          });
        }

        if (!isDispatchable(delivery)) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Um dos pedidos ja saiu em outra entrega ou nao esta pronto. Recarregue a pagina.",
          });
        }

        assertDeliveryTransition(delivery.status, "ready_for_dispatch");
        waveDeliveries.push(delivery);
      }

      const wave = validateDispatchWave(
        waveDeliveries,
        vehicles,
        input.selectedVehicleId ?? null,
      );

      if (input.farmId && wave.farmId && input.farmId !== wave.farmId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Fazenda nao encontrada na sua conta.",
        });
      }

      // Only from a dispatchable status: two confirmations at once (two
      // tabs) can't put one order in two waves; the second one finds the
      // order already ready_for_dispatch and the whole transaction rolls back.
      const updatedOrders = await ctx.db
        .update(orders)
        .set({ status: "ready_for_dispatch" })
        .where(
          and(
            eq(orders.sellerTenantId, ctx.tenantId),
            inArray(orders.id, orderIds),
            inArray(orders.status, ["confirmed", "picking"]),
          ),
        )
        .returning({ id: orders.id });

      if (updatedOrders.length !== orderIds.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Um dos pedidos mudou enquanto voce confirmava (cancelado ou ja despachado). Nada foi salvo; recarregue a pagina.",
        });
      }

      const [wave_] = await ctx.db
        .insert(deliveryDispatchWaves)
        .values({
          tenantId: ctx.tenantId,
          farmId: wave.farmId,
          operationDate,
          confidence: wave.confidence,
          recommendedVehicleType: wave.vehicleType,
          selectedVehicleId: wave.vehicle?.id ?? null,
          selectedVehicleLabel: wave.vehicle?.label ?? null,
          recommendationSummary: input.recommendationSummary,
          recommendationSnapshot: input.recommendationSnapshot ?? null,
          confirmedByUserId: ctx.user.id,
        })
        .returning({
          id: deliveryDispatchWaves.id,
        });

      if (!wave_) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nao foi possivel criar a onda de despacho.",
        });
      }

      // Stop order is the driving order computed here, not the client's.
      await ctx.db.insert(deliveryDispatchWaveOrders).values(
        wave.orderedDeliveries.map((delivery, index) => ({
          waveId: wave_.id,
          orderId: delivery.orderId,
          sequence: index + 1,
          priorityScore: Math.max(1, wave.orderedDeliveries.length - index),
        })),
      );

      const targetOrders = wave.orderedDeliveries.map((delivery) => ({
        id: delivery.orderId,
        buyerTenantId: delivery.buyerTenantId,
      }));

      for (const targetOrder of targetOrders) {
        await emitOrderNotifications({
          tx: ctx.db,
          type: "order_ready_for_dispatch",
          orderId: targetOrder.id,
          buyerTenantId: targetOrder.buyerTenantId,
          sellerTenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          metadata: {
            orderId: targetOrder.id,
            status: "ready_for_dispatch",
            waveId: wave_.id,
          },
        });
      }

      return {
        success: true,
        waveId: wave_.id,
        status: "confirmed" as const,
        updatedOrderCount: orderIds.length,
      };
    }),

  updateDeliveryStatus: producerProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        status: z.enum(deliveryMutationStatuses),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const targetOrder = await ctx.db.query.orders.findFirst({
        where: and(
          eq(orders.id, input.orderId),
          eq(orders.sellerTenantId, ctx.tenantId),
        ),
      });

      if (!targetOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido nao encontrado para este produtor.",
        });
      }

      assertDeliveryTransition(targetOrder.status, input.status);

      await ctx.db
        .update(orders)
        .set({ status: input.status })
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.sellerTenantId, ctx.tenantId),
          ),
        );

      const notificationType =
        input.status === "ready_for_dispatch"
          ? "order_ready_for_dispatch"
          : input.status === "in_transit"
            ? "delivery_in_transit"
            : "delivery_delivered";

      await emitOrderNotifications({
        tx: ctx.db,
        type: notificationType,
        orderId: targetOrder.id,
        buyerTenantId: targetOrder.buyerTenantId,
        sellerTenantId: targetOrder.sellerTenantId,
        actorUserId: ctx.user.id,
        metadata: {
          orderId: targetOrder.id,
          status: input.status,
        },
      });

      return {
        success: true,
        status: input.status,
      };
    }),
});

export {
  assertDeliveryTransition,
  groupPendingDeliveryRows,
  pendingDeliveryStatuses,
};
