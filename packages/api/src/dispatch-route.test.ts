import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WAVE_STOPS,
  brasiliaDayKey,
  haversineKm,
  isSameDeliveryDay,
  pickWaveVehicle,
  planStopOrder,
  selectWaveMembers,
  type WaveCandidate,
} from "./dispatch-route";

const farm = { latitude: -23.55, longitude: -46.63 };
// ~30 km north, ~31 km north next to it, ~30 km south.
const north1 = { latitude: -23.28, longitude: -46.63 };
const north2 = { latitude: -23.271, longitude: -46.625 };
const south1 = { latitude: -23.82, longitude: -46.63 };

const order = (
  orderId: string,
  point: WaveCandidate["point"],
  extra: Partial<WaveCandidate> = {},
): WaveCandidate => ({
  orderId,
  farmId: "farm-1",
  point,
  windowStart: new Date("2026-11-26T11:00:00Z"),
  weightKg: 10,
  needsRefrigeration: false,
  ...extra,
});

const vehicle = (
  id: string,
  capacityKg: number,
  extra: Partial<{ refrigeration: boolean; availabilityStatus: string }> = {},
) => ({
  id,
  farmId: "farm-1",
  label: id,
  capacityKg,
  refrigeration: false,
  availabilityStatus: "available",
  ...extra,
});

test("haversineKm matches known distances", () => {
  assert.ok(Math.abs(haversineKm(farm, north1) - 30) < 0.5);
  assert.equal(haversineKm(farm, farm), 0);
});

test("brasiliaDayKey uses the Brasilia calendar day on any server", () => {
  // 2026-11-26 01:30 UTC is still the 25th in Brasilia (22:30).
  assert.equal(brasiliaDayKey(new Date("2026-11-26T01:30:00Z")), "2026-11-25");
  assert.equal(brasiliaDayKey(new Date("2026-11-26T03:00:00Z")), "2026-11-26");
  assert.equal(
    isSameDeliveryDay(
      new Date("2026-11-26T11:00:00Z"),
      new Date("2026-11-26T16:00:00Z"),
    ),
    true,
  );
  assert.equal(
    isSameDeliveryDay(
      new Date("2026-11-26T11:00:00Z"),
      new Date("2026-11-27T11:00:00Z"),
    ),
    false,
  );
  assert.equal(isSameDeliveryDay(null, new Date()), true);
});

test("a wave never mixes opposite sides of town", () => {
  const n1 = order("N1", north1);
  const plan = selectWaveMembers(
    n1,
    [order("S1", south1), order("N2", north2)],
    [],
  );
  assert.deepEqual(
    plan.members.map((member) => member.orderId),
    ["N1", "N2"],
  );
});

test("a wave never mixes delivery days", () => {
  const today = order("TODAY", north1);
  const nextWeek = order("NEXTWEEK", north2, {
    windowStart: new Date("2026-12-02T11:00:00Z"),
  });
  const plan = selectWaveMembers(today, [nextWeek], []);
  assert.deepEqual(
    plan.members.map((member) => member.orderId),
    ["TODAY"],
  );
});

test("a wave stops at what one vehicle can carry", () => {
  const plan = selectWaveMembers(
    order("A", north1, { weightKg: 24 }),
    [
      order("B", north2, { weightKg: 24 }),
      order("C", north2, { weightKg: 24 }),
    ],
    [vehicle("strada", 30), vehicle("van", 50)],
  );
  assert.deepEqual(
    plan.members.map((member) => member.orderId),
    ["A", "B"],
  );
  assert.equal(plan.totalKg, 48);
  assert.equal(plan.vehicle?.id, "van");
});

test("a cold stop needs a refrigerated vehicle for the whole wave", () => {
  const plan = selectWaveMembers(
    order("A", north1),
    [order("COLD", north2, { needsRefrigeration: true })],
    [vehicle("dry", 500), vehicle("cold", 200, { refrigeration: true })],
  );
  assert.deepEqual(
    plan.members.map((member) => member.orderId),
    ["A", "COLD"],
  );
  assert.equal(plan.vehicle?.id, "cold");
  assert.equal(plan.needsRefrigeration, true);
});

test("vehicles in use or too small are never picked", () => {
  const picked = pickWaveVehicle(
    [
      vehicle("busy", 100, { availabilityStatus: "in_use" }),
      vehicle("small", 10),
      vehicle("ok", 60),
    ],
    { farmId: "farm-1", totalKg: 40, needsRefrigeration: false },
  );
  assert.equal(picked?.id, "ok");
});

test("an order without coordinates goes out alone", () => {
  const plan = selectWaveMembers(
    order("NOPOINT", null),
    [order("N2", north2)],
    [],
  );
  assert.deepEqual(
    plan.members.map((member) => member.orderId),
    ["NOPOINT"],
  );
});

test("a wave holds at most MAX_WAVE_STOPS stops", () => {
  const many = Array.from({ length: 10 }, (_, index) =>
    order(`X${index}`, {
      latitude: north1.latitude + index * 0.001,
      longitude: north1.longitude,
    }),
  );
  const plan = selectWaveMembers(many[0]!, many.slice(1), []);
  assert.equal(plan.members.length, MAX_WAVE_STOPS);
});

test("stops follow the shortest path from the farm, not the priority", () => {
  // Priority order: far, near, middle on one line north of the farm.
  const far = { id: "far", point: { latitude: -23.25, longitude: -46.63 } };
  const near = { id: "near", point: { latitude: -23.5, longitude: -46.63 } };
  const middle = {
    id: "middle",
    point: { latitude: -23.4, longitude: -46.63 },
  };
  const { ordered, totalKm } = planStopOrder(farm, [far, near, middle]);
  assert.deepEqual(
    ordered.map((stop) => stop.id),
    ["near", "middle", "far"],
  );
  assert.ok(Math.abs(totalKm - haversineKm(farm, far.point)) < 0.01);
});

test("2-opt removes a crossing nearest-neighbour leaves behind", () => {
  const stops = [
    { id: "a", point: { latitude: -23.5, longitude: -46.6 } },
    { id: "b", point: { latitude: -23.5, longitude: -46.5 } },
    { id: "c", point: { latitude: -23.4, longitude: -46.6 } },
    { id: "d", point: { latitude: -23.4, longitude: -46.5 } },
  ];
  const { ordered, totalKm } = planStopOrder(farm, stops);
  // Brute force over all orders: the plan must be the shortest open path.
  const permutations = (items: typeof stops): (typeof stops)[] =>
    items.length <= 1
      ? [items]
      : items.flatMap((item, index) =>
          permutations([
            ...items.slice(0, index),
            ...items.slice(index + 1),
          ]).map((rest) => [item, ...rest]),
        );
  const best = Math.min(
    ...permutations(stops).map((path) => {
      let km = 0;
      let previous = farm;
      for (const stop of path) {
        km += haversineKm(previous, stop.point);
        previous = stop.point;
      }
      return km;
    }),
  );
  assert.ok(Math.abs(totalKm - best) < 0.001, `${totalKm} vs ${best}`);
  assert.equal(ordered.length, 4);
});
