/**
 * Delivery windows the buyer can pick at checkout.
 *
 * A producer says on which weekdays they deliver, in which periods
 * (morning / afternoon) and how many days ahead an order must be placed.
 * From that, listDeliverySlots builds the next windows, and findDeliverySlot
 * re-validates the buyer's choice on the server, so a stale or forged slot
 * id never reaches an order.
 *
 * Times are Brasilia time (UTC-3, no daylight saving since 2019). Farms in
 * other Brazilian time zones see the same wall-clock periods, which is close
 * enough for half-day windows.
 */

export const DELIVERY_PERIODS = {
  manha: { label: "Manhã", startHour: 8, endHour: 12 },
  tarde: { label: "Tarde", startHour: 13, endHour: 18 },
} as const;

export type DeliveryPeriod = keyof typeof DELIVERY_PERIODS;
export const DELIVERY_PERIOD_IDS = Object.keys(
  DELIVERY_PERIODS,
) as DeliveryPeriod[];

export const WEEKDAY_LABELS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;

export type DeliverySchedule = {
  days: number[]; // 0 = Sunday ... 6 = Saturday
  periods: DeliveryPeriod[];
  leadDays: number; // 0 = same day, 1 = from tomorrow, ...
};

// Used until the producer saves their own schedule.
export const DEFAULT_DELIVERY_SCHEDULE: DeliverySchedule = {
  days: [1, 2, 3, 4, 5, 6],
  periods: ["manha", "tarde"],
  leadDays: 1,
};

export const MAX_LEAD_DAYS = 7;
const SLOT_HORIZON_DAYS = 14;
// A same-day window must still be at least this far away.
const MIN_HOURS_BEFORE_START = 2;
const BRASILIA_OFFSET_HOURS = -3;
const DAY_MS = 86_400_000;

export type DeliverySlot = {
  id: string; // "YYYY-MM-DD:periodo"
  date: string; // YYYY-MM-DD, Brasilia
  weekday: number;
  period: DeliveryPeriod;
  start: Date;
  end: Date;
  label: string; // "Qui, 27/11 · Manhã (8h–12h)"
};

function isDeliveryPeriod(value: unknown): value is DeliveryPeriod {
  return typeof value === "string" && value in DELIVERY_PERIODS;
}

export function resolveDeliverySchedule(farm: {
  deliveryDays?: number[] | null;
  deliveryPeriods?: string[] | null;
  deliveryLeadDays?: number | null;
}): DeliverySchedule & { isDefault: boolean } {
  const days = (farm.deliveryDays ?? []).filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  const periods = (farm.deliveryPeriods ?? []).filter(isDeliveryPeriod);

  if (days.length === 0 || periods.length === 0) {
    return { ...DEFAULT_DELIVERY_SCHEDULE, isDefault: true };
  }

  const lead = farm.deliveryLeadDays ?? DEFAULT_DELIVERY_SCHEDULE.leadDays;
  return {
    days: Array.from(new Set(days)).sort((a, b) => a - b),
    periods: DELIVERY_PERIOD_IDS.filter((period) => periods.includes(period)),
    leadDays: Math.min(MAX_LEAD_DAYS, Math.max(0, Math.trunc(lead))),
    isDefault: false,
  };
}

// The calendar day in Brasilia, as a UTC-midnight timestamp.
function brasiliaDayStart(now: Date) {
  const shifted = now.getTime() + BRASILIA_OFFSET_HOURS * 3_600_000;
  return Math.floor(shifted / DAY_MS) * DAY_MS;
}

function toDateKey(dayStartUtc: number) {
  return new Date(dayStartUtc).toISOString().slice(0, 10);
}

function brasiliaHourToUtc(dayStartUtc: number, hour: number) {
  return new Date(dayStartUtc + (hour - BRASILIA_OFFSET_HOURS) * 3_600_000);
}

function formatSlotLabel(dayStartUtc: number, period: DeliveryPeriod) {
  const date = new Date(dayStartUtc);
  const weekday = WEEKDAY_LABELS[date.getUTCDay()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const { label, startHour, endHour } = DELIVERY_PERIODS[period];
  return `${weekday}, ${day}/${month} · ${label} (${startHour}h–${endHour}h)`;
}

function buildSlot(dayStartUtc: number, period: DeliveryPeriod): DeliverySlot {
  const date = toDateKey(dayStartUtc);
  const { startHour, endHour } = DELIVERY_PERIODS[period];
  return {
    id: `${date}:${period}`,
    date,
    weekday: new Date(dayStartUtc).getUTCDay(),
    period,
    start: brasiliaHourToUtc(dayStartUtc, startHour),
    end: brasiliaHourToUtc(dayStartUtc, endHour),
    label: formatSlotLabel(dayStartUtc, period),
  };
}

export function listDeliverySlots(
  schedule: DeliverySchedule,
  now: Date,
  horizonDays = SLOT_HORIZON_DAYS,
): DeliverySlot[] {
  const today = brasiliaDayStart(now);
  const earliestStart = now.getTime() + MIN_HOURS_BEFORE_START * 3_600_000;
  const slots: DeliverySlot[] = [];

  for (let offset = schedule.leadDays; offset <= horizonDays; offset += 1) {
    const dayStart = today + offset * DAY_MS;
    if (!schedule.days.includes(new Date(dayStart).getUTCDay())) continue;

    for (const period of schedule.periods) {
      const slot = buildSlot(dayStart, period);
      if (slot.start.getTime() >= earliestStart) {
        slots.push(slot);
      }
    }
  }

  return slots;
}

export const DELIVERY_SLOT_ID_PATTERN = /^(\d{4}-\d{2}-\d{2}):(manha|tarde)$/;

export function findDeliverySlot(
  schedule: DeliverySchedule,
  slotId: string,
  now: Date,
): DeliverySlot | null {
  if (!DELIVERY_SLOT_ID_PATTERN.test(slotId)) return null;
  return (
    listDeliverySlots(schedule, now).find((slot) => slot.id === slotId) ?? null
  );
}

export function describeDeliverySchedule(schedule: DeliverySchedule) {
  const days = schedule.days.map((day) => WEEKDAY_LABELS[day]).join(", ");
  const periods = schedule.periods
    .map((period) => DELIVERY_PERIODS[period].label.toLowerCase())
    .join(" e ");
  const lead =
    schedule.leadDays === 0
      ? "pedido no mesmo dia"
      : schedule.leadDays === 1
        ? "pedido com 1 dia de antecedência"
        : `pedido com ${schedule.leadDays} dias de antecedência`;
  return `${days} · ${periods} · ${lead}`;
}

// Labels an order's stored window ("Qui, 27/11 · Manhã (8h–12h)").
export function formatDeliveryWindow(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const dayStart = brasiliaDayStart(startDate);
  const toHour = (date: Date) =>
    (((date.getUTCHours() + BRASILIA_OFFSET_HOURS) % 24) + 24) % 24;
  const startHour = toHour(startDate);
  const endHour = toHour(endDate);
  const period = DELIVERY_PERIOD_IDS.find(
    (id) =>
      DELIVERY_PERIODS[id].startHour === startHour &&
      DELIVERY_PERIODS[id].endHour === endHour,
  );
  if (period) return formatSlotLabel(dayStart, period);

  const date = new Date(dayStart);
  const weekday = WEEKDAY_LABELS[date.getUTCDay()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${weekday}, ${day}/${month} · ${startHour}h–${endHour}h`;
}
