import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Returns travel duration in minutes between two points for a given mode.
// walk/cycle: OSRM public API (no key)
// transit:    Transitous (transitous.org) — free community MOTIS server, no key, good European coverage

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fromLat = p.get("from_lat");
  const fromLng = p.get("from_lng");
  const toLat   = p.get("to_lat");
  const toLng   = p.get("to_lng");
  const mode    = p.get("mode") ?? "walk";

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
      // Transitous: community-run MOTIS server, OTP-compatible API, no key required
      const url =
        `https://api.transitous.org/api/v1/plan` +
        `?fromPlace=${fromLat},${fromLng}` +
        `&toPlace=${toLat},${toLng}` +
        `&mode=TRANSIT,WALK` +
        `&numItineraries=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mexxej/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Transitous ${res.status}`);
      const data = await res.json() as { plan?: { itineraries?: { duration: number }[] } };
      const secs = data.plan?.itineraries?.[0]?.duration;
      if (secs == null) throw new Error("No transit itinerary");
      return NextResponse.json({ minutes: Math.ceil(secs / 60), real: true });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    // Return a sentinel so the client knows to show an estimate
    return NextResponse.json({ error: String(err), real: false }, { status: 502 });
  }
}
