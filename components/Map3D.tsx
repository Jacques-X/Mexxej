"use client";

// Map — Google Maps JS API, hybrid satellite (2D).
// Uses &callback= instead of script.onload — required for loading=async.

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

function rangeToZoom(range: number): number {
  return Math.max(1, Math.min(21, Math.round(21 - Math.log2(range / 50))));
}

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

// ─── Component ───────────────────────────────────────────────
const Map3D = forwardRef<Map3DHandle, Props>(function Map3D(
  { apiKey, locations, onMarkerClick, initialCenter, destination },
  ref
) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const mapRef            = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const markerMapRef      = useRef<Map<string, any>>(new Map()); // eslint-disable-line @typescript-eslint/no-explicit-any
  const routeRendererRef  = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const mapsReadyRef      = useRef(false);
  const locationsRef      = useRef(locations);
  locationsRef.current    = locations;
  const onMarkerClickRef  = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const geocoder = new google.maps.Geocoder();
      const result   = await geocoder.geocode({ address });
      if (result.results[0]) {
        const loc = result.results[0].geometry.location;
        return { lat: loc.lat(), lng: loc.lng() };
      }
    } catch { /* fall through */ }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addMarker(map: any, loc: TripLocation) {
    if (markerMapRef.current.has(loc.id)) return;
    const color  = CATEGORY_COLORS[loc.category] ?? CATEGORY_COLORS.other;
    const letter = loc.name.charAt(0).toUpperCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marker = new (google.maps as any).Marker({
      map,
      position: { lat: loc.latitude, lng: loc.longitude },
      icon: {
        url:        makePinSvg(color, letter),
        scaledSize: new google.maps.Size(36, 48),
        anchor:     new google.maps.Point(18, 48),
      },
      title: loc.name,
    });

    marker.addListener("click", () => onMarkerClickRef.current(loc));
    markerMapRef.current.set(loc.id, marker);
  }

  const initMap = useCallback(async () => {
    if (mapRef.current || !containerRef.current) return;

    let center = initialCenter;
    if (!center && destination) {
      center = (await geocode(destination)) ?? undefined;
    }
    center ??= { lat: 41.9028, lng: 12.4964 };

    const map = new google.maps.Map(containerRef.current, {
      center,
      zoom: 14,
      mapTypeId: "hybrid",
      disableDefaultUI: true,
      gestureHandling: "greedy",
      tilt: 0,
    });

    mapRef.current = map;

    setTimeout(() => map.setZoom(17), 800);

    locationsRef.current.forEach((loc) => addMarker(map, loc));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCenter, destination]);

  // ── Load Maps JS API via callback (required for loading=async) ───
  useEffect(() => {
    if (mapsReadyRef.current) return;
    mapsReadyRef.current = true;

    // Expose callback globally so Maps JS can invoke it when ready
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__mxjMapsReady = () => initMap();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=__mxjMapsReady`;
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const incoming = new Set(locations.map((l) => l.id));
    markerMapRef.current.forEach((marker, locId) => {
      if (!incoming.has(locId)) { marker.setMap(null); markerMapRef.current.delete(locId); }
    });
    locations.forEach((loc) => addMarker(map, loc));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  // ── Imperative handle ────────────────────────────────────
  useImperativeHandle(ref, () => ({
    flyCameraTo(position, _durationMs = 3000) {
      const map = mapRef.current;
      if (!map) return;
      map.panTo({ lat: position.center.lat, lng: position.center.lng });
      map.setZoom(rangeToZoom(position.range));
    },

    flyCameraAround(position) {
      const map = mapRef.current;
      if (!map) return;
      map.panTo({ lat: position.center.lat, lng: position.center.lng });
    },

    stopCamera() { /* pans are instant */ },

    waitForAnimationEnd() {
      return new Promise<void>((resolve) => {
        const map = mapRef.current;
        if (!map) return resolve();
        const timeout = setTimeout(resolve, 2_000);
        google.maps.event.addListenerOnce(map, "idle", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    },

    async drawRoute(locs) {
      const map = mapRef.current;
      if (!map || locs.length < 2) return;

      routeRendererRef.current?.setMap(null);
      routeRendererRef.current = null;

      const directionsService = new google.maps.DirectionsService();
      const waypoints = locs.slice(1, -1).map((l) => ({
        location: new google.maps.LatLng(l.latitude, l.longitude),
        stopover: false,
      }));

      let result: google.maps.DirectionsResult;
      try {
        result = await directionsService.route({
          origin:            new google.maps.LatLng(locs[0].latitude, locs[0].longitude),
          destination:       new google.maps.LatLng(locs[locs.length - 1].latitude, locs[locs.length - 1].longitude),
          waypoints,
          travelMode:        google.maps.TravelMode.WALKING,
          optimizeWaypoints: false,
        });
      } catch { return; }

      const renderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#38bdf8", strokeWeight: 6, strokeOpacity: 0.85 },
      });
      renderer.setDirections(result);
      routeRendererRef.current = renderer;
    },

    clearRoute() {
      routeRendererRef.current?.setMap(null);
      routeRendererRef.current = null;
    },

    getMapElement() {
      return containerRef.current;
    },
  }));

  useEffect(() => {
    return () => {
      markerMapRef.current.forEach((m) => m.setMap(null));
      routeRendererRef.current?.setMap(null);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Satellite map"
    />
  );
});

export default Map3D;
