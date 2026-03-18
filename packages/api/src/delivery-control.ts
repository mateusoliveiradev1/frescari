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
export type DeliveryExternalSignalSource = 'weather' | 'traffic' | 'closures';
export type DeliveryExternalSignalStatus = 'available' | 'unavailable';
export type DeliveryExternalSignalImpact = 'none' | 'attention' | 'critical';
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

export type DeliveryExternalSignal = {
    source: DeliveryExternalSignalSource;
    status: DeliveryExternalSignalStatus;
    impact: DeliveryExternalSignalImpact;
    summary: string;
};

export type DeliveryExternalContext = {
    status: 'ready' | 'degraded';
    summary: string;
    signals: DeliveryExternalSignal[];
};

export type DeliveryRecommendation = {
    priorityScore: number;
    urgencyLevel: 'high' | 'medium' | 'low';
    riskLevel: 'high' | 'medium' | 'low';
    confidence: DispatchConfidence;
    externalContext: DeliveryExternalContext;
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

export type DeliveryExternalSignalsResolverInput<TDelivery extends DeliveryControlBaseDelivery = DeliveryControlBaseDelivery> = {
    deliveries: TDelivery[];
    now: Date;
    operationDate: string;
};

export type DeliveryExternalSignalsResolver<TDelivery extends DeliveryControlBaseDelivery = DeliveryControlBaseDelivery> = (
    input: DeliveryExternalSignalsResolverInput<TDelivery>,
) => Promise<DeliveryExternalSignal[]>;

type BuildDispatchControlQueueOptions = {
    now: Date;
    operationDate: string;
    overrides: DeliveryControlOverride[];
    vehicles: DeliveryControlFleetVehicle[];
    waveAssignments: DeliveryControlWaveAssignment[];
    externalSignals?: DeliveryExternalSignal[];
};

type BuildDispatchControlQueueWithExternalRiskSignalsOptions<TDelivery extends DeliveryControlBaseDelivery> =
    BuildDispatchControlQueueOptions & {
        resolveExternalSignals?: DeliveryExternalSignalsResolver<TDelivery>;
        externalSignalsTimeoutMs?: number;
    };

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const EXTERNAL_RISK_PRIORITY_PENALTY = {
    attention: 6,
    critical: 12,
} as const;

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

function lowerConfidence(confidence: DispatchConfidence, levels = 1): DispatchConfidence {
    const scale: DispatchConfidence[] = ['high', 'medium', 'low'];
    const currentIndex = scale.indexOf(confidence);
    const nextIndex = Math.min(scale.length - 1, currentIndex + levels);

    return scale[nextIndex] ?? confidence;
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

function resolveExternalContext(externalSignals?: DeliveryExternalSignal[]) {
    const signals = externalSignals?.length ? externalSignals : [];
    const impactfulSignals = signals.filter(
        (signal) => signal.status === 'available' && signal.impact !== 'none',
    );
    const hasUnavailableSignals = signals.some((signal) => signal.status === 'unavailable');

    if (signals.length === 0) {
        return {
            confidencePenalty: 0,
            explanationNote: null,
            priorityAdjustment: 0,
            reasons: [] as string[],
            context: {
                status: 'ready' as const,
                summary: 'Sem alertas externos relevantes; heuristica mantida com a pontuacao base.',
                signals: [],
            } satisfies DeliveryExternalContext,
        };
    }

    if (hasUnavailableSignals) {
        return {
            confidencePenalty: 0,
            explanationNote: null,
            priorityAdjustment: 0,
            reasons: [] as string[],
            context: {
                status: 'degraded' as const,
                summary: 'Sinais externos indisponiveis; heuristica mantida com a pontuacao base.',
                signals,
            } satisfies DeliveryExternalContext,
        };
    }

    if (impactfulSignals.length === 0) {
        return {
            confidencePenalty: 0,
            explanationNote: null,
            priorityAdjustment: 0,
            reasons: [] as string[],
            context: {
                status: 'ready' as const,
                summary: 'Clima, transito e vias sem alertas relevantes para a rota atual.',
                signals,
            } satisfies DeliveryExternalContext,
        };
    }

    const summaries = impactfulSignals.map((signal) => signal.summary);
    const priorityPenalty = impactfulSignals.reduce((total, signal) => {
        return total + (signal.impact === 'critical'
            ? EXTERNAL_RISK_PRIORITY_PENALTY.critical
            : EXTERNAL_RISK_PRIORITY_PENALTY.attention);
    }, 0);

    return {
        confidencePenalty: 0,
        explanationNote: `Penalizacao externa aplicada: ${summaries.join(' | ')}.`,
        priorityAdjustment: -priorityPenalty,
        reasons: summaries.map((summary) => `risco externo: ${summary}`),
        context: {
            status: 'ready' as const,
            summary: summaries.join(' | '),
            signals,
        } satisfies DeliveryExternalContext,
    };
}

function resolveConfidence(
    delivery: DeliveryControlBaseDelivery,
    externalContext: ReturnType<typeof resolveExternalContext>,
) {
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
        return lowerConfidence('medium', externalContext.confidencePenalty);
    }

    return lowerConfidence('high', externalContext.confidencePenalty);
}

function buildRecommendation(
    delivery: DeliveryControlBaseDelivery,
    vehicles: DeliveryControlFleetVehicle[],
    now: Date,
    externalSignals?: DeliveryExternalSignal[],
) {
    const urgency = resolveUrgency(delivery, now);
    const risk = resolveRisk(delivery, now);
    const geographyPoints = resolveGeographyPoints(delivery);
    const valuePoints = Math.min(18, Math.round(parseCurrency(delivery.totalAmount) / 20));
    const externalContext = resolveExternalContext(externalSignals);
    const suggestedVehicleType = resolveSuggestedVehicleType(delivery, risk.level);
    const suggestedVehicle = pickSuggestedVehicle(delivery, vehicles, suggestedVehicleType, risk.level);
    const confidence = resolveConfidence(delivery, externalContext);
    const reasons = [
        urgency.reason,
        risk.reason,
        delivery.distanceKm === null
            ? 'geografia incompleta exige validacao manual'
            : `distancia de ${delivery.distanceKm.toFixed(1)} km considerada no sequenciamento`,
        ...externalContext.reasons,
    ];
    const explanationParts = [
        `Prioridade ${urgency.level} com risco ${risk.level}.`,
        suggestedVehicle
            ? `Melhor encaixe atual: ${suggestedVehicle.label}.`
            : `Tipo de veiculo sugerido: ${suggestedVehicleType}.`,
    ];

    if (externalContext.explanationNote) {
        explanationParts.push(externalContext.explanationNote);
    }

    if (confidence === 'low') {
        explanationParts.push('Revisao humana recomendada antes de confirmar a saida.');
    }

    return {
        priorityScore:
            urgency.points
            + risk.points
            + geographyPoints
            + valuePoints
            + externalContext.priorityAdjustment,
        urgencyLevel: urgency.level,
        riskLevel: risk.level,
        confidence,
        externalContext: externalContext.context,
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
        const recommendation = buildRecommendation(
            delivery,
            options.vehicles,
            options.now,
            options.externalSignals,
        );

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

class DeliveryExternalSignalsTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`external risk signals timed out after ${timeoutMs}ms`);
        this.name = 'DeliveryExternalSignalsTimeoutError';
    }
}

async function resolveExternalSignalsWithTimeout<TDelivery extends DeliveryControlBaseDelivery>(
    deliveries: TDelivery[],
    options: BuildDispatchControlQueueWithExternalRiskSignalsOptions<TDelivery>,
) {
    if (!options.resolveExternalSignals) {
        return options.externalSignals;
    }

    const timeoutMs = options.externalSignalsTimeoutMs ?? 1500;
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
        return await Promise.race([
            options.resolveExternalSignals({
                deliveries,
                now: options.now,
                operationDate: options.operationDate,
            }),
            new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new DeliveryExternalSignalsTimeoutError(timeoutMs));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

export async function buildDispatchControlQueueWithExternalRiskSignals<TDelivery extends DeliveryControlBaseDelivery>(
    deliveries: TDelivery[],
    options: BuildDispatchControlQueueWithExternalRiskSignalsOptions<TDelivery>,
) {
    let externalSignals = options.externalSignals;

    if (!externalSignals && options.resolveExternalSignals) {
        try {
            externalSignals = await resolveExternalSignalsWithTimeout(deliveries, options);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            console.warn(
                `[delivery-control.external-risk-signals] external risk signals unavailable; falling back to base scoring (${errorMessage})`,
                error,
            );
            externalSignals = undefined;
        }
    }

    return buildDispatchControlQueue(deliveries, {
        now: options.now,
        operationDate: options.operationDate,
        overrides: options.overrides,
        vehicles: options.vehicles,
        waveAssignments: options.waveAssignments,
        externalSignals,
    });
}
