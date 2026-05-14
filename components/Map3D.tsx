"use client";

// Map3D — Google Maps 3D (gmp-map-3d web component via Maps JS API v=alpha)
// Uses Maps JavaScript API, not the Map Tiles API, so avoids the EEA restriction
// on direct tile access. Camera API mirrors our CameraPosition type natively.

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { TripLocation, CameraPosition } from "@/types/trip";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

// ─── Public API exposed via ref ───────────────────────────────
export interface Map3DHandle {
  flyCameraTo: (position: CameraPosition, durationMs?: number) => void;
  flyCameraAround: (position: CameraPosition, durationMs?: number, rounds?: number) => void;
  stopCamera: () => void;
  waitForAnimationEnd: () => Promise<void>;
  drawRoute: (locations: TripLocation[]) => Promise<void>;
  clearRoute: () => void;
  getMapElement: () => HTMLElement | null;
}

interface Props {
  apiKey: string;
  locations: TripLocation[];
  onMarkerClick: (location: TripLocation) => void;
  initialCenter?: { lat: number; lng: number };
  destination?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  hotel:      "#d8a478",
  restaurant: "#e88c64",
  attraction: "#c8b894",
  transport:  "#88a8c0",
  other:      "#9aa4b0",
};

function makePinSvg(color: string, letter: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".4"/></filter>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z"
          fill="${color}" filter="url(#s)"/>
    <circle cx="18" cy="18" r="10" fill="white" opacity=".9"/>
    <text x="18" y="23" font-family="sans-serif" font-size="12" font-weight="bold"
          fill="${color}" text-anchor="middle">${letter}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// CameraPosition → gmp-map-3d camera object (1:1 mapping, no conversion needed)
function toCameraView(pos: CameraPosition) {
  return {
    center: { lat: pos.center.lat, lng: pos.center.lng, altitude: pos.center.altitude ?? 0 },
    tilt: pos.tilt,
    heading: pos.heading,
    range: pos.range,
  };
}

// ─── Component ───────────────────────────────────────────────
const Map3D = forwardRef<Map3DHandle, Props>(function Map3D(
  { apiKey, locations, onMarkerClick, initialCenter, destination },
  ref
) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const mapRef            = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const markerMapRef      = useRef<Map<string, any>>(new Map()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const routePolylineRef  = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const mapsReadyRef      = useRef(false);
  const locationsRef      = useRef(locations);
  locationsRef.current    = locations;
  const onMarkerClickRef  = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  // ── Wait for Maps JS SDK ─────────────────────────────────
  function waitForGoogle(timeoutMs = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== "undefined") return resolve();
      const id = setInterval(() => {
        if (typeof google !== "undefined") { clearInterval(id); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(id); reject(new Error("Google Maps SDK timed out")); }, timeoutMs);
    });
  }

  // ── Geocode a place name ─────────────────────────────────
  async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      await waitForGoogle();
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address });
      if (result.results[0]) {
        const loc = result.results[0].geometry.location;
        return { lat: loc.lat(), lng: loc.lng() };
      }
    } catch { /* fall through */ }
    return null;
  }

  // ── Add a single marker to the map ──────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addMarker(map: any, loc: TripLocation) {
    if (markerMapRef.current.has(loc.id)) return;
    const Marker3DInteractive = google.maps?.maps3d?.Marker3DInteractiveElement;
    if (!Marker3DInteractive) return;

    const color  = CATEGORY_COLORS[loc.category] ?? CATEGORY_COLORS.other;
    const letter = loc.name.charAt(0).toUpperCase();

    const marker = new Marker3DInteractive({
      position: { lat: loc.latitude, lng: loc.longitude, altitude: 0 },
      altitudeMode: "CLAMP_TO_GROUND",
    });

    const img = document.createElement("img");
    img.src    = makePinSvg(color, letter);
    img.width  = 36;
    img.height = 48;
    img.style.cursor = "pointer";
    marker.appendChild(img);

    marker.addEventListener("gmp-click", () => onMarkerClickRef.current(loc));

    map.appendChild(marker);
    markerMapRef.current.set(loc.id, marker);
  }

  // ── Initialise gmp-map-3d ────────────────────────────────
  const initMap = useCallback(async () => {
    if (mapRef.current || !containerRef.current) return;
    await waitForGoogle();
    await google.maps.importLibrary("maps3d");

    let center = initialCenter;
    if (!center && destination) {
      center = (await geocode(destination)) ?? undefined;
    }
    center ??= { lat: 41.9028, lng: 12.4964 };

    const map = document.createElement("gmp-map-3d") as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    map.center  = { lat: center.lat, lng: center.lng, altitude: 0 };
    map.tilt    = 45;
    map.heading = 0;
    map.range   = 8_000;
    map.style.cssText = "width:100%;height:100%;display:block;";

    containerRef.current.appendChild(map);
    mapRef.current = map;

    // Cinematic swoop
    setTimeout(() => {
      map.flyCameraTo({
        endCamera: { center: { lat: center!.lat, lng: center!.lng, altitude: 0 }, tilt: 67.5, heading: 0, range: 600 },
        durationMilliseconds: 3500,
      });
    }, 600);

    // Sync any pins that arrived before the map was ready
    locationsRef.current.forEach((loc) => addMarker(map, loc));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCenter, destination]);

  // ── Load Maps JS API (alpha channel for maps3d) ──────────
  useEffect(() => {
    if (mapsReadyRef.current) return;
    mapsReadyRef.current = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=alpha&libraries=maps3d,places&loading=async`;
    script.async = true;
    script.onload  = () => initMap();
    script.onerror = () => { mapsReadyRef.current = false; };
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers whenever locations change ────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incoming = new Set(locations.map((l) => l.id));
    markerMapRef.current.forEach((marker, locId) => {
      if (!incoming.has(locId)) { marker.remove(); markerMapRef.current.delete(locId); }
    });
    locations.forEach((loc) => addMarker(map, loc));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  // ── Imperative handle ────────────────────────────────────
  useImperativeHandle(ref, () => ({
    flyCameraTo(position, durationMs = 3000) {
      mapRef.current?.flyCameraTo({
        endCamera: toCameraView(position),
        durationMilliseconds: durationMs,
      });
    },

    flyCameraAround(position, durationMs = 10000, rounds = 1) {
      mapRef.current?.flyCameraAround({
        camera: toCameraView(position),
        durationMilliseconds: durationMs,
        rounds,
      });
    },

    stopCamera() {
      mapRef.current?.stopCameraAnimation();
    },

    waitForAnimationEnd() {
      return new Promise<void>((resolve) => {
        const map = mapRef.current;
        if (!map) return resolve();
        const timeout = setTimeout(resolve, 8_000);
        const handler = () => {
          clearTimeout(timeout);
          map.removeEventListener("gmp-animationend", handler);
          resolve();
        };
        map.addEventListener("gmp-animationend", handler);
      });
    },

    async drawRoute(locs) {
      const map = mapRef.current;
      if (!map || locs.length < 2) return;
      if (typeof google === "undefined") return;

      routePolylineRef.current?.remove();
      routePolylineRef.current = null;

      const directionsService = new google.maps.DirectionsService();
      const waypoints = locs.slice(1, -1).map((l) => ({
        location: new google.maps.LatLng(l.latitude, l.longitude),
        stopover: false,
      }));

      let result: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        result = await directionsService.route({
          origin: new google.maps.LatLng(locs[0].latitude, locs[0].longitude),
          destination: new google.maps.LatLng(locs[locs.length - 1].latitude, locs[locs.length - 1].longitude),
          waypoints,
          travelMode: google.maps.TravelMode.WALKING,
          optimizeWaypoints: false,
        });
      } catch { return; }

      await google.maps.importLibrary("maps3d");
      const Polyline3DElement = google.maps.maps3d?.Polyline3DElement;
      if (!Polyline3DElement) return;

      const coordinates: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
      result.routes[0].legs.forEach((leg: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
        leg.steps.forEach((step: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
          step.path?.forEach((p: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
            coordinates.push({ lat: p.lat(), lng: p.lng(), altitude: 15 })
          )
        )
      );

      const polyline = new Polyline3DElement({
        altitudeMode: "ABSOLUTE",
        strokeColor: "#38bdf8",
        strokeWidth: 8,
        drawsOccludedSegments: true,
      });
      polyline.coordinates = coordinates;
      map.appendChild(polyline);
      routePolylineRef.current = polyline;
    },

    clearRoute() {
      routePolylineRef.current?.remove();
      routePolylineRef.current = null;
    },

    getMapElement() {
      return mapRef.current;
    },
  }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="3D interactive map"
    />
  );
});

export default Map3D;
