import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Returns travel duration and (for transit) per-leg breakdown between two points.
// walk/cycle: OSRM public API (no key)
// transit:    Transitous MOTIS 2 API — free community server, no key, OTP-compatible
//             Endpoint: GET https://api.transitous.org/api/v5/plan
//             Times returned as ISO 8601 strings with local timezone offset — no conversion needed.

interface TransitLeg {
  mode: string;
  minutes: number;
  route?: string;
  headsign?: string;
  agency?: string;
  fromStop?: string;
  toStop?: string;
  departTime?: string;   // "HH:MM" in stop's local timezone — extracted from ISO 8601
  arriveTime?: string;
}

interface MOTISPlace {
  name?: string;
}

interface MOTISLeg {
  mode: string;
  duration: number;
  startTime?: string;        // ISO 8601 e.g. "2026-05-28T10:23:00+02:00"
  endTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  routeShortName?: string;
  displayName?: string;
  headsign?: string;
  agencyName?: string;
  from?: MOTISPlace;
  to?: MOTISPlace;
}

interface MOTISResponse {
  itineraries?: Array<{
    duration: number;
    legs?: MOTISLeg[];
  }>;
}

/** Extract HH:MM from an ISO 8601 date-time string — timezone-correct because offset is baked in. */
function isoToHHMM(iso: string): string {
  return iso.substring(11, 16);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fromLat    = p.get("from_lat");
  const fromLng    = p.get("from_lng");
  const toLat      = p.get("to_lat");
  const toLng      = p.get("to_lng");
  const mode       = p.get("mode") ?? "walk";
  const departDate = p.get("depart_date") ?? undefined;   // YYYY-MM-DD
  const departTime = p.get("depart_time") ?? undefined;   // HH:MM

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    if (mode === "walk" || mode === "cycle") {
      const profile = mode === "cycle" ? "bike" : "foot";
      const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
      const res = await fetch(url, { headers: { "User-Agent": "Mexxej/1.0 (mexxej.app)" } });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json() as { routes?: { duration: number }[] };
      const secs = data.routes?.[0]?.duration;
      if (secs == null) throw new Error("No route");
      return NextResponse.json({ minutes: Math.ceil(secs / 60), real: true });
    }

    if (mode === "transit") {
      // MOTIS 2 API (Transitous) — replaced OTP v1 /api/v1/plan
      let transitUrl =
        `https://api.transitous.org/api/v5/plan` +
        `?fromPlace=${fromLat},${fromLng}` +
        `&toPlace=${toLat},${toLng}` +
        `&numItineraries=1`;

      // Pass departure datetime as ISO 8601 for accurate schedule lookup
      if (departDate && departTime) {
        transitUrl += `&time=${encodeURIComponent(`${departDate}T${departTime}:00`)}`;
      } else if (departDate) {
        transitUrl += `&time=${encodeURIComponent(`${departDate}T12:00:00`)}`;
      }

      const res = await fetch(transitUrl, {
        headers: {
          "User-Agent": "Mexxej/1.0 (mexxej.app)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Transitous ${res.status}: ${body.slice(0, 120)}`);
      }
      const data = await res.json() as MOTISResponse;
      const itinerary = data.itineraries?.[0];
      if (!itinerary) throw new Error("No transit itinerary");

      // Map each MOTIS leg to a compact TransitLeg
      const legs: TransitLeg[] = (itinerary.legs ?? []).map((leg: MOTISLeg) => ({
        mode: leg.mode,
        minutes: Math.max(1, Math.ceil(leg.duration / 60)),
        route: leg.routeShortName ?? leg.displayName ?? undefined,
        headsign: leg.headsign ?? undefined,
        agency: leg.agencyName ?? undefined,
        fromStop: leg.from?.name ?? undefined,
        toStop: leg.to?.name ?? undefined,
        // ISO 8601 strings carry the local timezone offset — extracting HH:MM is correct
        departTime: leg.startTime ? isoToHHMM(leg.startTime) : undefined,
        arriveTime: leg.endTime   ? isoToHHMM(leg.endTime)   : undefined,
      }));

      console.log("[routing/transit] legs:", legs.length, legs.map(l => `${l.mode} ${l.minutes}m ${l.route ?? ""} ${l.departTime ?? ""}`).join(" | "));

      return NextResponse.json({
        minutes: Math.ceil(itinerary.duration / 60),
        real: true,
        legs,
      });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    console.error("[routing/error] mode:", mode, "error:", String(err));
    return NextResponse.json({ error: String(err), real: false }, { status: 502 });
  }
}
