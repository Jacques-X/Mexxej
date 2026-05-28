import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Returns travel duration and (for transit) per-leg breakdown between two points.
// walk/cycle: OSRM public API (no key)
// transit:    Transitous (transitous.org) — free community MOTIS server, no key, OTP-compatible API

interface TransitLeg {
  mode: string;
  minutes: number;
  route?: string;
  headsign?: string;
  agency?: string;
  fromStop?: string;
  toStop?: string;
}

interface OTPLeg {
  mode: string;
  duration: number;
  startTime?: number;      // epoch ms — scheduled departure
  endTime?: number;        // epoch ms — scheduled arrival
  routeShortName?: string;
  headsign?: string;
  agencyName?: string;
  from?: { name?: string };
  to?: { name?: string };
}

interface OTPResponse {
  plan?: {
    itineraries?: Array<{
      duration: number;
      legs?: OTPLeg[];
    }>;
  };
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
      const res = await fetch(url, { headers: { "User-Agent": "Mexxej/1.0" } });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json() as { routes?: { duration: number }[] };
      const secs = data.routes?.[0]?.duration;
      if (secs == null) throw new Error("No route");
      return NextResponse.json({ minutes: Math.ceil(secs / 60), real: true });
    }

    if (mode === "transit") {
      // Transitous: OTP-compatible plan API, free, no key, strong European GTFS coverage
      // Pass departure date/time so the response reflects the actual trip schedule
      let transitUrl =
        `https://api.transitous.org/api/v1/plan` +
        `?fromPlace=${fromLat},${fromLng}` +
        `&toPlace=${toLat},${toLng}` +
        `&mode=TRANSIT,WALK` +
        `&numItineraries=1`;
      if (departDate) transitUrl += `&date=${departDate}`;
      if (departTime) transitUrl += `&time=${departTime}:00`;

      const res = await fetch(transitUrl, {
        headers: { "User-Agent": "Mexxej/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Transitous ${res.status}`);
      const data = await res.json() as OTPResponse;
      const itinerary = data.plan?.itineraries?.[0];
      if (!itinerary) throw new Error("No transit itinerary");

      // Map each OTP leg to a compact TransitLeg; include epoch-ms times when present
      const legs: TransitLeg[] = (itinerary.legs ?? []).map((leg: OTPLeg) => ({
        mode: leg.mode,
        minutes: Math.max(1, Math.ceil(leg.duration / 60)),
        route: leg.routeShortName ?? undefined,
        headsign: leg.headsign ?? undefined,
        agency: leg.agencyName ?? undefined,
        fromStop: leg.from?.name ?? undefined,
        toStop: leg.to?.name ?? undefined,
        departTime: leg.startTime ?? undefined,
        arriveTime: leg.endTime ?? undefined,
      }));

      console.log("[routing/transit] legs:", legs.length, legs.map(l => `${l.mode} ${l.minutes}m ${l.route ?? ""}`).join(" | "));
      return NextResponse.json({
        minutes: Math.ceil(itinerary.duration / 60),
        real: true,
        legs,
      });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err), real: false }, { status: 502 });
  }
}
