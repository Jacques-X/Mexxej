import type { TripLocation } from "@/types/trip";

const WALK_SPEED_KMH = 5;

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

function travelMinutes(a: TripLocation, b: TripLocation): number {
  return Math.round((haversineKm(a, b) / WALK_SPEED_KMH) * 60);
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(((totalMinutes % 1440) + 1440) % 1440 / 60);
  const m = ((totalMinutes % 1440) + 1440) % 1440 % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface StopTiming {
  locationId: string;
  arrivalMin: number | null;     // minutes from midnight
  departureMin: number | null;
  travelToNextMin: number;       // walking time to next stop
  isAnchor: boolean;             // has a user-set arrival_time
}

export function computeDayTimeline(stops: TripLocation[]): StopTiming[] {
  if (stops.length === 0) return [];

  // Find the first anchor (user-set arrival_time)
  const anchorIdx = stops.findIndex((s) => s.arrival_time);

  const result: StopTiming[] = stops.map((s, i) => ({
    locationId: s.id,
    arrivalMin: null,
    departureMin: null,
    travelToNextMin: i < stops.length - 1 ? travelMinutes(s, stops[i + 1]) : 0,
    isAnchor: !!s.arrival_time,
  }));

  if (anchorIdx === -1) return result; // no anchor — can't infer anything

  // Cascade forward from anchor
  result[anchorIdx].arrivalMin = parseMinutes(stops[anchorIdx].arrival_time!);
  for (let i = anchorIdx; i < stops.length; i++) {
    const arr = result[i].arrivalMin;
    if (arr === null) break;
    const dur = stops[i].duration_minutes;
    if (dur == null) {
      // No duration — cascade stops here
      result[i].departureMin = null;
      break;
    }
    result[i].departureMin = arr + dur;
    if (i + 1 < stops.length) {
      result[i + 1].arrivalMin = result[i].departureMin! + result[i].travelToNextMin;
    }
  }

  // Cascade backward from anchor (for stops before anchor)
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
