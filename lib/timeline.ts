import type { TripLocation } from "@/types/trip";

export type TransportMode = "walk" | "cycle" | "transit";

export const TRANSPORT_META: Record<TransportMode, { label: string; icon: string; speedKmh: number }> = {
  walk:    { label: "Walking", icon: "🚶", speedKmh: 5  },
  cycle:   { label: "Cycling", icon: "🚲", speedKmh: 15 },
  transit: { label: "Transit", icon: "🚌", speedKmh: 20 },
};

function haversineKm(a: TripLocation, b: TripLocation): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function estimatedTravelMinutes(a: TripLocation, b: TripLocation, mode: TransportMode): number {
  return Math.round((haversineKm(a, b) / TRANSPORT_META[mode].speedKmh) * 60);
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface StopTiming {
  locationId: string;
  arrivalMin: number | null;
  departureMin: number | null;
  /** Minutes to travel from this stop to the next (real or estimated) */
  travelToNextMin: number;
  isAnchor: boolean;
  transportMode: TransportMode;
  /** True if travelToNextMin came from real routing rather than estimate */
  travelIsReal: boolean;
}

/**
 * Compute timeline for an ordered list of stops in one day.
 * @param realTravelMinutes  keyed `${fromId}:${toId}` → real minutes from routing API
 */
export function computeDayTimeline(
  stops: TripLocation[],
  realTravelMinutes: Record<string, number> = {},
): StopTiming[] {
  if (stops.length === 0) return [];

  const anchorIdx = stops.findIndex((s) => s.arrival_time);

  const result: StopTiming[] = stops.map((s, i) => {
    const mode = (s.transport_mode as TransportMode | null | undefined) ?? "walk";
    const safeMode: TransportMode = (mode === "walk" || mode === "cycle" || mode === "transit") ? mode : "walk";
    let travelToNextMin = 0;
    let travelIsReal = false;
    if (i < stops.length - 1) {
      const key = `${s.id}:${stops[i + 1].id}`;
      if (realTravelMinutes[key] != null) {
        travelToNextMin = realTravelMinutes[key];
        travelIsReal = true;
      } else {
        travelToNextMin = estimatedTravelMinutes(s, stops[i + 1], safeMode);
      }
    }
    return {
      locationId: s.id,
      arrivalMin: null,
      departureMin: null,
      travelToNextMin,
      isAnchor: !!s.arrival_time,
      transportMode: safeMode,
      travelIsReal,
    };
  });

  if (anchorIdx === -1) return result;

  // Cascade forward from anchor
  result[anchorIdx].arrivalMin = parseMinutes(stops[anchorIdx].arrival_time!);
  for (let i = anchorIdx; i < stops.length; i++) {
    const arr = result[i].arrivalMin;
    if (arr === null) break;
    const dur = stops[i].duration_minutes;
    if (dur == null) {
      result[i].departureMin = null;
      break;
    }
    result[i].departureMin = arr + dur;
    if (i + 1 < stops.length) {
      result[i + 1].arrivalMin = result[i].departureMin! + result[i].travelToNextMin;
    }
  }

  // Cascade backward from anchor
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const nextArr = result[i + 1].arrivalMin;
    if (nextArr === null) break;
    result[i].departureMin = nextArr - result[i].travelToNextMin;
    const dur = stops[i].duration_minutes;
    if (dur == null) {
      result[i].arrivalMin = null;
      break;
    }
    result[i].arrivalMin = result[i].departureMin! - dur;
  }

  return result;
}
