// Route planning for delivery waves: which orders go out together, in what
// vehicle, and in what stop order. Pure functions, no database access, so the
// suggestion (getPendingDeliveries) and the confirmation (confirmDispatchWave)
// apply exactly the same rules.

export type GeoPoint = { latitude: number; longitude: number };

// A wave only groups stops close to the first one: a neighbourhood, not a
// city. Larger radii start sending one vehicle to opposite sides of town.
export const WAVE_RADIUS_KM = 10;
export const MAX_WAVE_STOPS = 6;
// Weight assumed for an item whose weight is unknown (box, bunch, unit with
// no unit weight). Same fallback the dispatch scoring has always used.
export const UNKNOWN_ITEM_WEIGHT_KG = 4;

const EARTH_RADIUS_KM = 6371;
// Brasília has no daylight saving since 2019.
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Calendar day in Brasília ("2026-11-26"), whatever the server timezone. */
export function brasiliaDayKey(date: Date) {
  return new Date(date.getTime() - BRASILIA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Orders with a delivery window go out together only on the same day; an
 * order without a window (placed before windows existed) fits any day.
 */
export function isSameDeliveryDay(a: Date | null, b: Date | null) {
  if (!a || !b) return true;
  return brasiliaDayKey(a) === brasiliaDayKey(b);
}

function pathKm(origin: GeoPoint | null, stops: GeoPoint[]) {
  let total = 0;
  let previous = origin;
  for (const stop of stops) {
    if (previous) total += haversineKm(previous, stop);
    previous = stop;
  }
  return total;
}

/**
 * Stop order for a vehicle leaving `origin` (the farm): nearest neighbour,
 * then 2-opt to undo crossings. Open path (the vehicle does not need to come
 * back for the order to be delivered). Exact for the small waves we build.
 */
export function planStopOrder<T extends { point: GeoPoint }>(
  origin: GeoPoint | null,
  stops: T[],
): { ordered: T[]; totalKm: number } {
  if (stops.length <= 1) {
    return {
      ordered: [...stops],
      totalKm: pathKm(
        origin,
        stops.map((stop) => stop.point),
      ),
    };
  }

  const remaining = [...stops];
  const ordered: T[] = [];
  let current: GeoPoint | null = origin;

  while (remaining.length > 0) {
    let bestIndex = 0;
    if (current) {
      let bestKm = Infinity;
      remaining.forEach((stop, index) => {
        const km = haversineKm(current as GeoPoint, stop.point);
        if (km < bestKm) {
          bestKm = km;
          bestIndex = index;
        }
      });
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next!);
    current = next!.point;
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const candidate = [
          ...ordered.slice(0, i),
          ...ordered.slice(i, j + 1).reverse(),
          ...ordered.slice(j + 1),
        ];
        const before = pathKm(
          origin,
          ordered.map((stop) => stop.point),
        );
        const after = pathKm(
          origin,
          candidate.map((stop) => stop.point),
        );
        if (after + 1e-9 < before) {
          ordered.splice(0, ordered.length, ...candidate);
          improved = true;
        }
      }
    }
  }

  return {
    ordered,
    totalKm: pathKm(
      origin,
      ordered.map((stop) => stop.point),
    ),
  };
}

export type WaveVehicle = {
  id: string;
  farmId: string | null;
  label: string;
  capacityKg: number;
  refrigeration: boolean;
  availabilityStatus: string;
};

/** Smallest available vehicle of the farm that carries the whole wave. */
export function pickWaveVehicle<TVehicle extends WaveVehicle>(
  vehicles: TVehicle[],
  input: {
    farmId: string | null;
    totalKg: number;
    needsRefrigeration: boolean;
  },
): TVehicle | null {
  return (
    vehicles
      .filter((vehicle) => vehicle.availabilityStatus === "available")
      .filter(
        (vehicle) =>
          input.farmId === null ||
          vehicle.farmId === null ||
          vehicle.farmId === input.farmId,
      )
      .filter((vehicle) => Number(vehicle.capacityKg) >= input.totalKg)
      .filter((vehicle) => !input.needsRefrigeration || vehicle.refrigeration)
      .sort(
        (left, right) => Number(left.capacityKg) - Number(right.capacityKg),
      )[0] ?? null
  );
}

export type WaveCandidate = {
  orderId: string;
  farmId: string | null;
  point: GeoPoint | null;
  windowStart: Date | null;
  weightKg: number;
  needsRefrigeration: boolean;
};

export type WavePlan<TCandidate extends WaveCandidate, TVehicle> = {
  members: TCandidate[];
  vehicle: TVehicle | null;
  totalKg: number;
  needsRefrigeration: boolean;
};

/**
 * Builds the wave around `primary` (the most urgent order): same farm, same
 * delivery day, within WAVE_RADIUS_KM of it, closest first, while one
 * available vehicle still carries the total (with refrigeration when any
 * stop needs it). With no fleet registered, only the stop count limits it.
 */
export function selectWaveMembers<
  TCandidate extends WaveCandidate,
  TVehicle extends WaveVehicle,
>(
  primary: TCandidate,
  candidates: TCandidate[],
  vehicles: TVehicle[],
): WavePlan<TCandidate, TVehicle> {
  const members = [primary];
  let totalKg = primary.weightKg;
  let needsRefrigeration = primary.needsRefrigeration;
  const hasFleet = vehicles.length > 0;
  let vehicle = hasFleet
    ? pickWaveVehicle(vehicles, {
        farmId: primary.farmId,
        totalKg,
        needsRefrigeration,
      })
    : null;

  if (!primary.point) {
    return { members, vehicle, totalKg, needsRefrigeration };
  }

  const primaryPoint = primary.point;
  const nearby = candidates
    .filter((candidate) => candidate.orderId !== primary.orderId)
    .filter((candidate) => candidate.farmId === primary.farmId)
    .filter((candidate) =>
      isSameDeliveryDay(candidate.windowStart, primary.windowStart),
    )
    .filter(
      (candidate): candidate is TCandidate & { point: GeoPoint } =>
        candidate.point !== null,
    )
    .map((candidate) => ({
      candidate,
      km: haversineKm(primaryPoint, candidate.point),
    }))
    .filter(({ km }) => km <= WAVE_RADIUS_KM)
    .sort((left, right) => left.km - right.km);

  for (const { candidate } of nearby) {
    if (members.length >= MAX_WAVE_STOPS) break;

    const nextKg = totalKg + candidate.weightKg;
    const nextRefrigeration =
      needsRefrigeration || candidate.needsRefrigeration;

    if (hasFleet) {
      const nextVehicle = pickWaveVehicle(vehicles, {
        farmId: primary.farmId,
        totalKg: nextKg,
        needsRefrigeration: nextRefrigeration,
      });
      // Doesn't fit any vehicle together with what is already loaded: leave
      // it for the next wave and try smaller orders.
      if (!nextVehicle) continue;
      vehicle = nextVehicle;
    }

    members.push(candidate);
    totalKg = nextKg;
    needsRefrigeration = nextRefrigeration;
  }

  return { members, vehicle, totalKg, needsRefrigeration };
}
