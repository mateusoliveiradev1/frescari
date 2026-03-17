export type FleetVehicleType =
    | 'motorcycle'
    | 'car'
    | 'pickup'
    | 'van'
    | 'refrigerated_van'
    | 'truck'
    | 'refrigerated_truck';

export type FleetVehicleStatus = 'available' | 'in_use' | 'maintenance' | 'offline';
export type DispatchConfidence = 'high' | 'medium' | 'low';
export type DispatchOverrideAction = 'pin_to_top' | 'delay';
export type DispatchOverrideReason =
    | 'customer_priority'
    | 'delivery_window'
    | 'vehicle_load'
    | 'address_issue'
    | 'awaiting_picking'
    | 'commercial_decision'
    | 'other';

export type DeliveryControlBaseDelivery = {
    orderId: string;
    status: string;
    totalAmount: string;
    createdAt: Date;
    distanceKm: number | null;
    totalEstimatedWeightKg: number | null;
    itemCount: number;
    minFreshnessScore: number | null;
    nearestExpiryDate: Date | null;
    deliveryWindowStart: Date | null;
    deliveryWindowEnd: Date | null;
    hasValidRouteCoordinates: boolean;
    origin: {
        farmId: string | null;
        farmName: string | null;
    } | null;
};

export type DeliveryControlFleetVehicle = {
    id: string;
    farmId: string | null;
    label: string;
    vehicleType: FleetVehicleType;
    capacityKg: number;
    refrigeration: boolean;
    availabilityStatus: FleetVehicleStatus;
};

export type DeliveryControlOverride = {
    id: string;
    orderId: string;
    operationDate: string;
    action: DispatchOverrideAction;
    reason: DispatchOverrideReason;
    reasonNotes: string | null;
    createdAt: Date;
};

export type DeliveryControlWaveAssignment = {
    waveId: string;
    orderId: string;
    sequence: number;
    status: 'confirmed' | 'departed' | 'cancelled';
    confidence: DispatchConfidence;
    recommendedVehicleType: FleetVehicleType;
    selectedVehicleId: string | null;
    selectedVehicleLabel: string | null;
    confirmedAt: Date;
};

export type DeliveryRecommendation = {
    priorityScore: number;
    urgencyLevel: 'high' | 'medium' | 'low';
    riskLevel: 'high' | 'medium' | 'low';
    confidence: DispatchConfidence;
    suggestedVehicleType: FleetVehicleType;
    suggestedVehicle: DeliveryControlFleetVehicle | null;
    explanation: string;
    reasons: string[];
};

export type DeliveryControlQueueItem<TDelivery extends DeliveryControlBaseDelivery = DeliveryControlBaseDelivery> = TDelivery & {
    activeOverride: DeliveryControlOverride | null;
    dispatch: DeliveryControlWaveAssignment | null;
    recommendation: DeliveryRecommendation;
};

type BuildDispatchControlQueueOptions = {
    now: Date;
    operationDate: string;
    overrides: DeliveryControlOverride[];
    vehicles: DeliveryControlFleetVehicle[];
    waveAssignments: DeliveryControlWaveAssignment[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function diffInDays(target: Date, source: Date) {
    return Math.ceil((target.getTime() - source.getTime()) / DAY_IN_MS);
}

function diffInHours(target: Date, source: Date) {
    return (target.getTime() - source.getTime()) / (60 * 60 * 1000);
}

function parseCurrency(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveUrgency(delivery: DeliveryControlBaseDelivery, now: Date) {
    if (delivery.deliveryWindowEnd) {
        const hoursUntilEnd = diffInHours(delivery.deliveryWindowEnd, now);

        if (hoursUntilEnd <= 6) {
            return { level: 'high' as const, points: 40, reason: 'janela de entrega apertada' };
        }

        if (hoursUntilEnd <= 24) {
            return { level: 'medium' as const, points: 28, reason: 'janela de entrega ainda hoje' };
        }
    }

    if (delivery.deliveryWindowStart) {
        const hoursUntilStart = diffInHours(delivery.deliveryWindowStart, now);

        if (hoursUntilStart <= 12) {
            return { level: 'medium' as const, points: 22, reason: 'saida precisa acontecer hoje' };
        }
    }

    return { level: 'low' as const, points: 12, reason: 'sem pressao imediata de horario' };
}

function resolveRisk(delivery: DeliveryControlBaseDelivery, now: Date) {
    const daysUntilExpiry =
        delivery.nearestExpiryDate !== null ? diffInDays(delivery.nearestExpiryDate, now) : null;
    const freshness = delivery.minFreshnessScore;

    if ((daysUntilExpiry !== null && daysUntilExpiry <= 0) || (freshness !== null && freshness <= 40)) {
        return { level: 'high' as const, points: 30, reason: 'carga sensivel e com risco operacional alto' };
    }

    if ((daysUntilExpiry !== null && daysUntilExpiry <= 1) || (freshness !== null && freshness <= 55)) {
        return { level: 'medium' as const, points: 22, reason: 'perecibilidade pede despacho curto' };
    }

    return { level: 'low' as const, points: 10, reason: 'risco controlado para a operacao' };
}

function resolveGeographyPoints(delivery: DeliveryControlBaseDelivery) {
    if (delivery.distanceKm === null) {
        return 4;
    }

    if (delivery.distanceKm <= 8) {
        return 14;
    }

    if (delivery.distanceKm <= 20) {
        return 10;
    }

    if (delivery.distanceKm <= 40) {
        return 6;
    }

    return 3;
}

function resolveSuggestedVehicleType(delivery: DeliveryControlBaseDelivery, riskLevel: 'high' | 'medium' | 'low'): FleetVehicleType {
    const weight = delivery.totalEstimatedWeightKg ?? Math.max(6, delivery.itemCount * 4);
    const refrigerationNeeded = riskLevel === 'high';

    if (refrigerationNeeded) {
        return weight > 80 ? 'refrigerated_truck' : 'refrigerated_van';
    }

    if (weight <= 8 && delivery.distanceKm !== null && delivery.distanceKm <= 8) {
        return 'motorcycle';
    }

    if (weight <= 25) {
        return 'pickup';
    }

    if (weight <= 80) {
        return 'van';
    }

    return 'truck';
}

function pickSuggestedVehicle(
    delivery: DeliveryControlBaseDelivery,
    vehicles: DeliveryControlFleetVehicle[],
    suggestedVehicleType: FleetVehicleType,
    riskLevel: 'high' | 'medium' | 'low',
) {
    const weight = delivery.totalEstimatedWeightKg ?? Math.max(6, delivery.itemCount * 4);
    const farmId = delivery.origin?.farmId ?? null;
    const refrigerationNeeded = riskLevel === 'high';

    const availableVehicles = vehicles
        .filter((vehicle) => vehicle.availabilityStatus === 'available')
        .filter((vehicle) => farmId === null || vehicle.farmId === farmId)
        .filter((vehicle) => Number(vehicle.capacityKg) >= weight)
        .filter((vehicle) => !refrigerationNeeded || vehicle.refrigeration)
        .sort((left, right) => Number(left.capacityKg) - Number(right.capacityKg));

    const exactMatch = availableVehicles.find((vehicle) => vehicle.vehicleType === suggestedVehicleType);
    return exactMatch ?? availableVehicles[0] ?? null;
}

function resolveConfidence(delivery: DeliveryControlBaseDelivery) {
    let missingSignals = 0;

    if (!delivery.hasValidRouteCoordinates || delivery.distanceKm === null) {
        missingSignals += 1;
    }

    if (delivery.minFreshnessScore === null) {
        missingSignals += 1;
    }

    if (delivery.nearestExpiryDate === null) {
        missingSignals += 1;
    }

    if (missingSignals >= 2) {
        return 'low' as const;
    }

    if (missingSignals === 1) {
        return 'medium' as const;
    }

    return 'high' as const;
}

function buildRecommendation(
    delivery: DeliveryControlBaseDelivery,
    vehicles: DeliveryControlFleetVehicle[],
    now: Date,
) {
    const urgency = resolveUrgency(delivery, now);
    const risk = resolveRisk(delivery, now);
    const geographyPoints = resolveGeographyPoints(delivery);
    const valuePoints = Math.min(18, Math.round(parseCurrency(delivery.totalAmount) / 20));
    const suggestedVehicleType = resolveSuggestedVehicleType(delivery, risk.level);
    const suggestedVehicle = pickSuggestedVehicle(delivery, vehicles, suggestedVehicleType, risk.level);
    const confidence = resolveConfidence(delivery);
    const reasons = [
        urgency.reason,
        risk.reason,
        delivery.distanceKm === null
            ? 'geografia incompleta exige validacao manual'
            : `distancia de ${delivery.distanceKm.toFixed(1)} km considerada no sequenciamento`,
    ];
    const explanationParts = [
        `Prioridade ${urgency.level} com risco ${risk.level}.`,
        suggestedVehicle
            ? `Melhor encaixe atual: ${suggestedVehicle.label}.`
            : `Tipo de veiculo sugerido: ${suggestedVehicleType}.`,
    ];

    if (confidence === 'low') {
        explanationParts.push('Revisao humana recomendada antes de confirmar a saida.');
    }

    return {
        priorityScore: urgency.points + risk.points + geographyPoints + valuePoints,
        urgencyLevel: urgency.level,
        riskLevel: risk.level,
        confidence,
        suggestedVehicleType,
        suggestedVehicle,
        explanation: explanationParts.join(' '),
        reasons,
    } satisfies DeliveryRecommendation;
}

export function getOperationDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

export function buildDispatchControlQueue<TDelivery extends DeliveryControlBaseDelivery>(
    deliveries: TDelivery[],
    options: BuildDispatchControlQueueOptions,
) {
    const overridesByOrder = new Map(
        options.overrides
            .filter((override) => override.operationDate === options.operationDate)
            .map((override) => [override.orderId, override]),
    );
    const waveAssignmentsByOrder = new Map(
        options.waveAssignments.map((assignment) => [assignment.orderId, assignment]),
    );

    const enrichedDeliveries = deliveries.map((delivery) => {
        const activeOverride = overridesByOrder.get(delivery.orderId) ?? null;
        const dispatch = waveAssignmentsByOrder.get(delivery.orderId) ?? null;
        const recommendation = buildRecommendation(delivery, options.vehicles, options.now);

        return {
            ...delivery,
            activeOverride,
            dispatch,
            recommendation,
        } satisfies DeliveryControlQueueItem<TDelivery>;
    });

    return enrichedDeliveries.sort((left, right) => {
        const leftBucket =
            left.activeOverride?.action === 'pin_to_top'
                ? 0
                : left.activeOverride?.action === 'delay'
                    ? 3
                    : left.status === 'ready_for_dispatch'
                        ? 2
                        : 1;
        const rightBucket =
            right.activeOverride?.action === 'pin_to_top'
                ? 0
                : right.activeOverride?.action === 'delay'
                    ? 3
                    : right.status === 'ready_for_dispatch'
                        ? 2
                        : 1;

        if (leftBucket !== rightBucket) {
            return leftBucket - rightBucket;
        }

        if (left.recommendation.priorityScore !== right.recommendation.priorityScore) {
            return right.recommendation.priorityScore - left.recommendation.priorityScore;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
    });
}
