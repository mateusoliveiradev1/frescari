import assert from "node:assert/strict";
import test from "node:test";

test("buildNextDispatchAction groups compatible deliveries into a single candidate wave", async () => {
    const { buildNextDispatchAction } = await import("./delivery-control-summary");
    const deliveries = [
        {
            activeOverride: null,
            buyerName: "Mercado Modelo",
            dispatch: null,
            orderId: "order-1",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "high",
                explanation: "Despachar agora para consolidar a janela da manha.",
                priorityScore: 92,
                reasons: ["janela curta"],
                riskLevel: "high",
                suggestedVehicle: { id: "vehicle-1", label: "Van Refrigerada" },
                suggestedVehicleType: "refrigerated_van",
                urgencyLevel: "high",
            },
            status: "confirmed",
            totalEstimatedWeightKg: 18,
        },
        {
            activeOverride: null,
            buyerName: "Padaria Central",
            dispatch: null,
            orderId: "order-2",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "medium",
                explanation: "Mesmo veiculo e mesma janela operacional.",
                priorityScore: 80,
                reasons: ["mesmo encaixe"],
                riskLevel: "medium",
                suggestedVehicle: { id: "vehicle-1", label: "Van Refrigerada" },
                suggestedVehicleType: "refrigerated_van",
                urgencyLevel: "medium",
            },
            status: "picking",
            totalEstimatedWeightKg: 9,
        },
        {
            activeOverride: { action: "delay" },
            buyerName: "Cliente Segurado",
            dispatch: null,
            orderId: "order-3",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "high",
                explanation: "Nao deveria entrar na wave sugerida.",
                priorityScore: 99,
                reasons: ["override delay"],
                riskLevel: "high",
                suggestedVehicle: { id: "vehicle-1", label: "Van Refrigerada" },
                suggestedVehicleType: "refrigerated_van",
                urgencyLevel: "high",
            },
            status: "confirmed",
            totalEstimatedWeightKg: 5,
        },
    ] as unknown as Parameters<typeof buildNextDispatchAction>[0];

    const result = buildNextDispatchAction(deliveries);

    assert.ok(result);
    assert.equal(result.primaryDelivery.orderId, "order-1");
    assert.deepEqual(
        result.deliveries.map((delivery: { orderId: string }) => delivery.orderId),
        ["order-1", "order-2"],
    );
    assert.equal(result.totalOrders, 2);
    assert.equal(result.suggestedVehicleLabel, "Van Refrigerada");
});

test("buildNextDispatchAction skips already dispatched deliveries and returns null when nothing is actionable", async () => {
    const { buildNextDispatchAction } = await import("./delivery-control-summary");
    const deliveries = [
        {
            activeOverride: null,
            buyerName: "Pedido Ja Confirmado",
            dispatch: { waveId: "wave-1" },
            orderId: "order-1",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "high",
                explanation: "Wave ja criada.",
                priorityScore: 90,
                reasons: ["ja confirmado"],
                riskLevel: "medium",
                suggestedVehicle: { id: "vehicle-1", label: "Pickup 01" },
                suggestedVehicleType: "pickup",
                urgencyLevel: "high",
            },
            status: "ready_for_dispatch",
            totalEstimatedWeightKg: 10,
        },
        {
            activeOverride: { action: "delay" },
            buyerName: "Pedido Adiado",
            dispatch: null,
            orderId: "order-2",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "medium",
                explanation: "Override ativo.",
                priorityScore: 88,
                reasons: ["override"],
                riskLevel: "medium",
                suggestedVehicle: null,
                suggestedVehicleType: "pickup",
                urgencyLevel: "medium",
            },
            status: "confirmed",
            totalEstimatedWeightKg: 6,
        },
    ] as unknown as Parameters<typeof buildNextDispatchAction>[0];

    const result = buildNextDispatchAction(deliveries);

    assert.equal(result, null);
});

test("buildSelectedWaveMapContext prioritizes the wave under review and keeps the anchor first", async () => {
    const { buildSelectedWaveMapContext, buildDispatchWaveCandidate } = await import("./delivery-control-summary");
    const deliveries = [
        {
            activeOverride: null,
            buyerName: "Mercado Modelo",
            dispatch: null,
            orderId: "order-1",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "high",
                explanation: "Despachar agora para consolidar a janela da manha.",
                priorityScore: 92,
                reasons: ["janela curta"],
                riskLevel: "high",
                suggestedVehicle: { id: "vehicle-1", label: "Van Refrigerada" },
                suggestedVehicleType: "refrigerated_van",
                urgencyLevel: "high",
            },
            status: "confirmed",
            totalEstimatedWeightKg: 18,
        },
        {
            activeOverride: null,
            buyerName: "Padaria Central",
            dispatch: null,
            orderId: "order-2",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "medium",
                explanation: "Mesmo veiculo e mesma janela operacional.",
                priorityScore: 80,
                reasons: ["mesmo encaixe"],
                riskLevel: "medium",
                suggestedVehicle: { id: "vehicle-1", label: "Van Refrigerada" },
                suggestedVehicleType: "refrigerated_van",
                urgencyLevel: "medium",
            },
            status: "picking",
            totalEstimatedWeightKg: 9,
        },
    ] as unknown as Parameters<typeof buildDispatchWaveCandidate>[0];

    const dispatchReviewCandidate = buildDispatchWaveCandidate(deliveries, "order-1");

    assert.ok(dispatchReviewCandidate);

    const result = buildSelectedWaveMapContext({
        deliveries,
        dispatchReviewCandidate,
        selectedDispatchOrderIds: ["order-2"],
        selectedOrderId: "order-2",
    });

    assert.ok(result);
    assert.equal(result.kind, "suggested");
    assert.deepEqual(result.orderIds, ["order-1", "order-2"]);
    assert.deepEqual(result.stops, [
        { orderId: "order-1", sequence: 1 },
        { orderId: "order-2", sequence: 2 },
    ]);
});

test("buildSelectedWaveMapContext exposes the confirmed wave sequence for the selected order", async () => {
    const { buildSelectedWaveMapContext } = await import("./delivery-control-summary");
    const deliveries = [
        {
            activeOverride: null,
            buyerName: "Mercado Modelo",
            dispatch: { sequence: 2, waveId: "wave-1" },
            orderId: "order-1",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "high",
                explanation: "Wave confirmada.",
                priorityScore: 92,
                reasons: ["janela curta"],
                riskLevel: "high",
                suggestedVehicle: { id: "vehicle-1", label: "Van Refrigerada" },
                suggestedVehicleType: "refrigerated_van",
                urgencyLevel: "high",
            },
            status: "ready_for_dispatch",
            totalEstimatedWeightKg: 18,
        },
        {
            activeOverride: null,
            buyerName: "Padaria Central",
            dispatch: { sequence: 1, waveId: "wave-1" },
            orderId: "order-2",
            origin: { farmId: "farm-1" },
            recommendation: {
                confidence: "medium",
                explanation: "Mesma wave confirmada.",
                priorityScore: 80,
                reasons: ["mesmo encaixe"],
                riskLevel: "medium",
                suggestedVehicle: { id: "vehicle-1", label: "Van Refrigerada" },
                suggestedVehicleType: "refrigerated_van",
                urgencyLevel: "medium",
            },
            status: "ready_for_dispatch",
            totalEstimatedWeightKg: 9,
        },
    ] as unknown as Parameters<typeof buildSelectedWaveMapContext>[0]["deliveries"];

    const result = buildSelectedWaveMapContext({
        deliveries,
        dispatchReviewCandidate: null,
        selectedDispatchOrderIds: [],
        selectedOrderId: "order-1",
    });

    assert.ok(result);
    assert.equal(result.kind, "confirmed");
    assert.deepEqual(result.stops, [
        { orderId: "order-2", sequence: 1 },
        { orderId: "order-1", sequence: 2 },
    ]);
});
