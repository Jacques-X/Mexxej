"use client";

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { TripLocation, CameraPosition } from "@/types/trip";

// ─── Public API exposed via ref ───────────────────────────────
export interface Map3DHandle {
  flyCameraTo: (position: CameraPosition, durationMs?: number) => void;
  flyCameraAround: (position: CameraPosition, durationMs?: number, rounds?: number) => void;
  stopCamera: () => void;
  waitForAnimationEnd: () => Promise<void>;
  drawRoute: (locations: TripLocation[]) => Promise<void>;
  clearRoute: () => void;
  getMapElement: () => GmpMap3DElement | null;
}

interface Props {
  apiKey: string;
  locations: TripLocation[];
  onMarkerClick: (location: TripLocation) => void;
  initialCenter?: { lat: number; lng: number };
}

// Colour palette per category
const CATEGORY_COLORS: Record<string, string> = {
  hotel: "#a78bfa",
  restaurant: "#fbbf24",
  attraction: "#38bdf8",
  transport: "#34d399",
  other: "#94a3b8",
};

// Build a tiny SVG pin as a data-URI for gmp-marker-3d
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

// Encode a decoded polyline path for the 3D polyline element
function buildCoordinates(
  path: google.maps.LatLng[]
): Array<{ lat: number; lng: number; altitude: number }> {
  return path.map((p) => ({ lat: p.lat(), lng: p.lng(), altitude: 15 }));
}

// ─── Component ───────────────────────────────────────────────
const Map3D = forwardRef<Map3DHandle, Props>(function Map3D(
  { apiKey, locations, onMarkerClick, initialCenter },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapElRef = useRef<GmpMap3DElement | null>(null);
  const markersRef = useRef<Map<string, GmpMarker3DElement>>(new Map());
  const polylineRef = useRef<GmpPolyline3DElement | null>(null);
  const scriptLoadedRef = useRef(false);

  // ── Bootstrap Google Maps 3D ────────────────────────────────
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=alpha&libraries=maps3d,marker`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);

    return () => {
      // cleanup handled by React's strict-mode guard above
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // ── Initialise the <gmp-map-3d> element ─────────────────────
  const initMap = useCallback(async () => {
    if (!containerRef.current) return;

    await customElements.whenDefined("gmp-map-3d");

    const center = initialCenter ?? { lat: 41.9028, lng: 12.4964 }; // default: Rome

    const mapEl = document.createElement("gmp-map-3d") as GmpMap3DElement;
    // Start high and flat — the fly-in below drops into 3D
    mapEl.setAttribute("center", `${center.lat},${center.lng},0`);
    mapEl.setAttribute("tilt", "0");
    mapEl.setAttribute("heading", "0");
    mapEl.setAttribute("range", "1200000");
    mapEl.style.cssText = "width:100%;height:100%;display:block;";

    containerRef.current.appendChild(mapEl);
    mapElRef.current = mapEl;

    // Cinematic intro: swoop down into the destination
    await customElements.whenDefined("gmp-map-3d");
    setTimeout(() => {
      mapEl.flyCameraTo({
        endCamera: {
          center: { lat: center.lat, lng: center.lng, altitude: 200 },
          tilt: 67.5,
          heading: 0,
          range: 1400,
        },
        durationMilliseconds: 3500,
      });
    }, 400);
  }, [initialCenter]);

  // ── Sync markers whenever `locations` changes ─────────────
  useEffect(() => {
    const mapEl = mapElRef.current;
    if (!mapEl) return;

    const existing = markersRef.current;
    const incoming = new Set(locations.map((l) => l.id));

    // Remove stale markers
    existing.forEach((el, id) => {
      if (!incoming.has(id)) {
        el.remove();
        existing.delete(id);
      }
    });

    // Add / update markers
    locations.forEach((loc) => {
      const color = CATEGORY_COLORS[loc.category] ?? CATEGORY_COLORS.other;
      const letter = loc.name.charAt(0).toUpperCase();

      if (existing.has(loc.id)) return; // already present

      const marker = document.createElement(
        "gmp-marker-3d"
      ) as GmpMarker3DElement;
      marker.setAttribute(
        "position",
        `${loc.latitude},${loc.longitude},0`
      );
      marker.setAttribute("altitude-mode", "relative-to-mesh");
      marker.setAttribute("draws-when-occluded", "true");
      marker.title = loc.name;

      // Custom pin icon via slot
      const img = document.createElement("img");
      img.src = makePinSvg(color, letter);
      img.slot = "icon";
      img.width = 36;
      img.height = 48;
      marker.appendChild(img);

      marker.addEventListener("click", () => onMarkerClick(loc));

      mapEl.appendChild(marker);
      existing.set(loc.id, marker);
    });
  }, [locations, onMarkerClick]);

  // ── Imperative handle ─────────────────────────────────────
  useImperativeHandle(ref, () => ({
    flyCameraTo(position, durationMs = 3000) {
      mapElRef.current?.flyCameraTo({
        endCamera: position,
        durationMilliseconds: durationMs,
      });
    },

    flyCameraAround(position, durationMs = 10000, rounds = 1) {
      mapElRef.current?.flyCameraAround({
        camera: position,
        durationMilliseconds: durationMs,
        rounds,
      });
    },

    stopCamera() {
      mapElRef.current?.stopCameraAnimation();
    },

    waitForAnimationEnd() {
      return new Promise<void>((resolve) => {
        if (!mapElRef.current) return resolve();
        const handler = () => {
          mapElRef.current?.removeEventListener("gmp-animationend", handler);
          resolve();
        };
        mapElRef.current.addEventListener("gmp-animationend", handler);
      });
    },

    async drawRoute(locs: TripLocation[]) {
      const mapEl = mapElRef.current;
      if (!mapEl || locs.length < 2) return;

      // Clear old polyline
      polylineRef.current?.remove();

      const directionsService = new google.maps.DirectionsService();
      const waypoints = locs.slice(1, -1).map((l) => ({
        location: new google.maps.LatLng(l.latitude, l.longitude),
        stopover: false,
      }));

      let result: google.maps.DirectionsResult;
      try {
        result = await directionsService.route({
          origin: new google.maps.LatLng(locs[0].latitude, locs[0].longitude),
          destination: new google.maps.LatLng(
            locs[locs.length - 1].latitude,
            locs[locs.length - 1].longitude
          ),
          waypoints,
          travelMode: google.maps.TravelMode.WALKING,
          optimizeWaypoints: false,
        });
      } catch {
        return;
      }

      // Flatten all step paths
      const allPoints: google.maps.LatLng[] = [];
      result.routes[0].legs.forEach((leg) =>
        leg.steps.forEach((step) =>
          step.path?.forEach((p) => allPoints.push(p))
        )
      );

      const polyline = document.createElement(
        "gmp-polyline-3d"
      ) as unknown as GmpPolyline3DElement;
      polyline.setAttribute("altitude-mode", "relative-to-mesh");
      polyline.setAttribute("stroke-color", "#38bdf8");
      polyline.setAttribute("stroke-width", "8");
      polyline.setAttribute("stroke-opacity", "0.85");
      polyline.setAttribute("draws-when-occluded", "true");
      polyline.coordinates = buildCoordinates(allPoints);

      mapEl.appendChild(polyline);
      polylineRef.current = polyline;
    },

    clearRoute() {
      polylineRef.current?.remove();
      polylineRef.current = null;
    },

    getMapElement() {
      return mapElRef.current;
    },
  }));

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="3D interactive map"
    />
  );
});

export default Map3D;
