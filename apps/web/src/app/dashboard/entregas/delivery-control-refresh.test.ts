import assert from "node:assert/strict";
import test from "node:test";

test("reconcileRecommendationQueue auto applies incoming recommendations when no manual override is active", async () => {
    const { reconcileRecommendationQueue } = await import("./delivery-control-refresh");
    const visibleDeliveries = [
        {
            activeOverride: null,
            dispatch: null,
            orderId: "order-1",
            recommendation: {
                confidence: "high",
                priorityScore: 80,
                suggestedVehicle: null,
                suggestedVehicleType: "pickup",
            },
            status: "confirmed",
        },
    ];
    const incomingDeliveries = [
        {
            ...visibleDeliveries[0],
            recommendation: {
                ...visibleDeliveries[0].recommendation,
                priorityScore: 95,
            },
        },
    ];

    const result = reconcileRecommendationQueue({
        visibleDeliveries,
        incomingDeliveries,
    });

    assert.deepEqual(result.visibleDeliveries, incomingDeliveries);
    assert.equal(result.stagedDeliveries, null);
    assert.equal(result.hasPendingRecommendationUpdate, false);
});

test("reconcileRecommendationQueue stages the incoming queue when a manual override is active", async () => {
    const { reconcileRecommendationQueue } = await import("./delivery-control-refresh");
    const visibleDeliveries = [
        {
            activeOverride: { action: "pin_to_top" },
            dispatch: null,
            orderId: "order-1",
            recommendation: {
                confidence: "medium",
                priorityScore: 80,
                suggestedVehicle: null,
                suggestedVehicleType: "pickup",
            },
            status: "confirmed",
        },
        {
            activeOverride: null,
            dispatch: null,
            orderId: "order-2",
            recommendation: {
                confidence: "medium",
                priorityScore: 70,
                suggestedVehicle: null,
                suggestedVehicleType: "pickup",
            },
            status: "confirmed",
        },
    ];
    const incomingDeliveries = [visibleDeliveries[1], visibleDeliveries[0]];

    const result = reconcileRecommendationQueue({
        visibleDeliveries,
        incomingDeliveries,
    });

    assert.deepEqual(result.visibleDeliveries, visibleDeliveries);
    assert.deepEqual(result.stagedDeliveries, incomingDeliveries);
    assert.equal(result.hasPendingRecommendationUpdate, true);
});

test("reconcileRecommendationQueue force applies the incoming queue after an operator action", async () => {
    const { reconcileRecommendationQueue } = await import("./delivery-control-refresh");
    const visibleDeliveries: Parameters<typeof reconcileRecommendationQueue>[0]["visibleDeliveries"] = [
        {
            activeOverride: { action: "delay" },
            dispatch: null,
            orderId: "order-1",
            recommendation: {
                confidence: "medium",
                priorityScore: 75,
                suggestedVehicle: null,
                suggestedVehicleType: "pickup",
            },
            status: "confirmed",
        },
    ];
    const incomingDeliveries: Parameters<typeof reconcileRecommendationQueue>[0]["incomingDeliveries"] = [
        {
            ...visibleDeliveries[0],
            activeOverride: null,
            recommendation: {
                ...visibleDeliveries[0].recommendation,
                priorityScore: 88,
            },
        },
    ];

    const result = reconcileRecommendationQueue({
        visibleDeliveries,
        incomingDeliveries,
        forceApplyIncoming: true,
    });

    assert.deepEqual(result.visibleDeliveries, incomingDeliveries);
    assert.equal(result.stagedDeliveries, null);
    assert.equal(result.hasPendingRecommendationUpdate, false);
});

test("reconcileRecommendationQueue stages incoming updates while the UI manual override lock is active", async () => {
    const { reconcileRecommendationQueue } = await import("./delivery-control-refresh");
    const visibleDeliveries = [
        {
            activeOverride: null,
            dispatch: null,
            orderId: "order-1",
            recommendation: {
                confidence: "medium",
                priorityScore: 80,
                suggestedVehicle: null,
                suggestedVehicleType: "pickup",
            },
            status: "confirmed",
        },
        {
            activeOverride: null,
            dispatch: null,
            orderId: "order-2",
            recommendation: {
                confidence: "medium",
                priorityScore: 70,
                suggestedVehicle: null,
                suggestedVehicleType: "pickup",
            },
            status: "confirmed",
        },
    ];
    const incomingDeliveries = [visibleDeliveries[1], visibleDeliveries[0]];

    const result = reconcileRecommendationQueue({
        visibleDeliveries,
        incomingDeliveries,
        lockIncomingUpdates: true,
    });

    assert.deepEqual(result.visibleDeliveries, visibleDeliveries);
    assert.deepEqual(result.stagedDeliveries, incomingDeliveries);
    assert.equal(result.hasPendingRecommendationUpdate, true);
});
