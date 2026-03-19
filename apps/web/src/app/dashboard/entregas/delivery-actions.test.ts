import assert from "node:assert/strict";
import test from "node:test";

import { canMarkDelivered, getDeliveryPrimaryAction } from "./delivery-actions";

test("getDeliveryPrimaryAction keeps dispatch as the only next step before dispatch confirmation", () => {
    assert.deepEqual(getDeliveryPrimaryAction("payment_authorized"), {
        kind: "dispatch",
        label: "Confirmar saida",
    });
    assert.deepEqual(getDeliveryPrimaryAction("confirmed"), {
        kind: "dispatch",
        label: "Confirmar saida",
    });
    assert.deepEqual(getDeliveryPrimaryAction("picking"), {
        kind: "dispatch",
        label: "Confirmar saida",
    });
});

test("getDeliveryPrimaryAction advances operational statuses in sequence after dispatch", () => {
    assert.deepEqual(getDeliveryPrimaryAction("ready_for_dispatch"), {
        kind: "status",
        label: "Saiu para entrega",
        nextStatus: "in_transit",
    });
    assert.deepEqual(getDeliveryPrimaryAction("in_transit"), {
        kind: "status",
        label: "Confirmar entrega",
        nextStatus: "delivered",
    });
});

test("getDeliveryPrimaryAction returns no CTA once the delivery is finalized or cancelled", () => {
    assert.equal(getDeliveryPrimaryAction("delivered"), null);
    assert.equal(getDeliveryPrimaryAction("cancelled"), null);
});

test("canMarkDelivered only allows the delivered shortcut after dispatch", () => {
    assert.equal(canMarkDelivered("payment_authorized"), false);
    assert.equal(canMarkDelivered("confirmed"), false);
    assert.equal(canMarkDelivered("picking"), false);
    assert.equal(canMarkDelivered("ready_for_dispatch"), true);
    assert.equal(canMarkDelivered("in_transit"), true);
    assert.equal(canMarkDelivered("delivered"), false);
});
