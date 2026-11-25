import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DELIVERY_SCHEDULE,
  describeDeliverySchedule,
  findDeliverySlot,
  formatDeliveryWindow,
  listDeliverySlots,
  resolveDeliverySchedule,
} from "./delivery-slots";

// Wednesday 2026-11-25, 10:00 in Brasilia (13:00 UTC).
const WED_10AM = new Date("2026-11-25T13:00:00Z");

test("unset or invalid schedules fall back to the default", () => {
  const empty = resolveDeliverySchedule({});
  assert.equal(empty.isDefault, true);
  assert.deepEqual(empty.days, DEFAULT_DELIVERY_SCHEDULE.days);

  const invalid = resolveDeliverySchedule({
    deliveryDays: [9],
    deliveryPeriods: ["noite"],
  });
  assert.equal(invalid.isDefault, true);

  const custom = resolveDeliverySchedule({
    deliveryDays: [5, 2, 2],
    deliveryPeriods: ["tarde"],
    deliveryLeadDays: 30,
  });
  assert.deepEqual(custom, {
    days: [2, 5],
    periods: ["tarde"],
    leadDays: 7,
    isDefault: false,
  });
});

test("slots respect weekdays, periods and lead time, in Brasilia time", () => {
  const slots = listDeliverySlots(
    { days: [4, 6], periods: ["manha"], leadDays: 1 },
    WED_10AM,
    7,
  );

  assert.deepEqual(
    slots.map((slot) => slot.id),
    // Thu 26 and Sat 28; Thu 3/12 is past the 7-day horizon.
    ["2026-11-26:manha", "2026-11-28:manha"],
  );
  assert.equal(slots[0]!.label, "Qui, 26/11 · Manhã (8h–12h)");
  // 08:00 in Brasilia is 11:00 UTC.
  assert.equal(slots[0]!.start.toISOString(), "2026-11-26T11:00:00.000Z");
  assert.equal(slots[0]!.end.toISOString(), "2026-11-26T15:00:00.000Z");
});

test("same-day delivery only offers windows at least 2 hours away", () => {
  const slots = listDeliverySlots(
    { days: [3], periods: ["manha", "tarde"], leadDays: 0 },
    WED_10AM,
    0,
  );
  // Morning (8h) has started; afternoon (13h) is 3 hours away.
  assert.deepEqual(
    slots.map((slot) => slot.id),
    ["2026-11-25:tarde"],
  );

  const lateSlots = listDeliverySlots(
    { days: [3], periods: ["manha", "tarde"], leadDays: 0 },
    new Date("2026-11-25T15:30:00Z"), // 12:30 Brasilia
    0,
  );
  assert.deepEqual(lateSlots, []);
});

test("the day boundary follows Brasilia, not UTC", () => {
  // 22:00 Tuesday in Brasilia is already Wednesday 01:00 UTC.
  const slots = listDeliverySlots(
    { days: [3], periods: ["manha"], leadDays: 1 },
    new Date("2026-11-25T01:00:00Z"),
    1,
  );
  assert.deepEqual(
    slots.map((slot) => slot.id),
    ["2026-11-25:manha"],
  );
});

test("findDeliverySlot accepts only offered, well-formed ids", () => {
  const schedule = { days: [4], periods: ["tarde" as const], leadDays: 1 };
  assert.equal(
    findDeliverySlot(schedule, "2026-11-26:tarde", WED_10AM)?.id,
    "2026-11-26:tarde",
  );
  // Not a delivery day, wrong period, before lead time, malformed.
  assert.equal(findDeliverySlot(schedule, "2026-11-27:tarde", WED_10AM), null);
  assert.equal(findDeliverySlot(schedule, "2026-11-26:manha", WED_10AM), null);
  assert.equal(findDeliverySlot(schedule, "2026-11-25:tarde", WED_10AM), null);
  assert.equal(findDeliverySlot(schedule, "amanha", WED_10AM), null);
});

test("stored windows and schedules have readable labels", () => {
  assert.equal(
    formatDeliveryWindow(
      "2026-11-26T16:00:00.000Z",
      "2026-11-26T21:00:00.000Z",
    ),
    "Qui, 26/11 · Tarde (13h–18h)",
  );
  assert.equal(formatDeliveryWindow(null, null), null);
  assert.equal(
    describeDeliverySchedule(DEFAULT_DELIVERY_SCHEDULE),
    "Seg, Ter, Qua, Qui, Sex, Sáb · manhã e tarde · pedido com 1 dia de antecedência",
  );
});

test("orders with weighed items only get windows the card hold covers", () => {
  const all = listDeliverySlots(DEFAULT_DELIVERY_SCHEDULE, WED_10AM);
  const weighed = listDeliverySlots(
    DEFAULT_DELIVERY_SCHEDULE,
    WED_10AM,
    undefined,
    {
      weighed: true,
    },
  );

  // Holds expire 7 days after checkout; windows must end by 6.5 days.
  const limit = WED_10AM.getTime() + 6.5 * 86_400_000;
  assert.ok(weighed.length > 0);
  assert.ok(weighed.every((slot) => slot.end.getTime() <= limit));
  assert.ok(all.some((slot) => slot.end.getTime() > limit));
  // Tue 01/12 afternoon ends 18:00 BRT = 21:00Z, before the limit (02/12 01:00Z).
  assert.ok(weighed.some((slot) => slot.id === "2026-12-01:tarde"));
  assert.ok(!weighed.some((slot) => slot.id === "2026-12-02:manha"));

  // Checkout re-checks with the same rule.
  assert.notEqual(
    findDeliverySlot(DEFAULT_DELIVERY_SCHEDULE, "2026-12-05:manha", WED_10AM),
    null,
  );
  assert.equal(
    findDeliverySlot(DEFAULT_DELIVERY_SCHEDULE, "2026-12-05:manha", WED_10AM, {
      weighed: true,
    }),
    null,
  );
});
