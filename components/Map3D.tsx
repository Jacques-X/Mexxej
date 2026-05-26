"use client";

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  APIProvider,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import type { TripLocation, CameraPosition } from "@/types/trip";

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

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a2035" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9bc0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e1620" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1828" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#253050" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a2440" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e2d48" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e2d48" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1a2640" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2e4060" }] },
];

// ─── Inner map controller (has access to map instance) ────────
interface ControllerProps {
  locations: TripLocation[];
  onMarkerClick: (location: TripLocation) => void;
  initialCenter: { lat: number; lng: number };
  controllerRef: React.MutableRefObject<Map3DHandle | null>;
}

function MapController({ locations, onMarkerClick, initialCenter, controllerRef }: ControllerProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const markerMapRef = useRef(new globalThis.Map<string, google.maps.Marker>());
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  // ── Place / update markers ─────────────────────────────────
  const syncMarkers = useCallback(() => {
    if (!map || !mapsLib) return;

    const incoming = new Set(locations.map((l) => l.id));

    // Remove stale markers
    markerMapRef.current.forEach((marker, id) => {
      if (!incoming.has(id)) {
        marker.setMap(null);
        markerMapRef.current.delete(id);
      }
    });

    // Add new markers
    locations.forEach((loc) => {
      if (markerMapRef.current.has(loc.id)) return;
      const color = CATEGORY_COLORS[loc.category] ?? CATEGORY_COLORS.other;
      const marker = new google.maps.Marker({
        position: { lat: loc.latitude, lng: loc.longitude },
        map,
        title: loc.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        label: {
          text: loc.name.charAt(0).toUpperCase(),
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: "bold",
        },
      });
      marker.addListener("click", () => onClickRef.current(loc));
      markerMapRef.current.set(loc.id, marker);
    });
  }, [map, mapsLib, locations]);

  useEffect(() => { syncMarkers(); }, [syncMarkers]);

  // ── Imperative handle ──────────────────────────────────────
  useEffect(() => {
    if (!map) return;

    controllerRef.current = {
      flyCameraTo(position) {
        map.panTo({ lat: position.center.lat, lng: position.center.lng });
        if (position.range) {
          // Convert range (metres) to zoom level roughly
          const zoom = Math.round(Math.log2(591657550 / position.range)) + 1;
          map.setZoom(Math.max(3, Math.min(20, zoom)));
        }
      },

      flyCameraAround() {
        // No-op in 2D — orbit not supported
      },

      stopCamera() {
        // No-op
      },

      waitForAnimationEnd() {
        return Promise.resolve();
      },

      async drawRoute(locs) {
        if (!mapsLib || locs.length < 2) return;
        polylineRef.current?.setMap(null);
        polylineRef.current = new google.maps.Polyline({
          path: locs.map((l) => ({ lat: l.latitude, lng: l.longitude })),
          geodesic: true,
          strokeColor: "#38bdf8",
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map,
        });
      },

      clearRoute() {
        polylineRef.current?.setMap(null);
        polylineRef.current = null;
      },

      getMapElement() {
        return (map as unknown as { getDiv: () => HTMLElement }).getDiv?.() ?? null;
      },
    };
  }, [map, mapsLib, controllerRef]);

  // ── Cleanup ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      markerMapRef.current.forEach((m) => m.setMap(null));
      markerMapRef.current.clear();
      polylineRef.current?.setMap(null);
    };
  }, []);

  return null;
}

// ─── Component ───────────────────────────────────────────────
const Map3D = forwardRef<Map3DHandle, Props>(function Map3D(
  { apiKey, locations, onMarkerClick, initialCenter, destination },
  ref
) {
  const controllerRef = useRef<Map3DHandle | null>(null);
  const resolvedCenter = initialCenter ?? { lat: 41.9028, lng: 12.4964 };

  // Forward ref to the inner controller
  useImperativeHandle(ref, () => ({
    flyCameraTo: (...args) => controllerRef.current?.flyCameraTo(...args),
    flyCameraAround: (...args) => controllerRef.current?.flyCameraAround(...args),
    stopCamera: () => controllerRef.current?.stopCamera(),
    waitForAnimationEnd: () => controllerRef.current?.waitForAnimationEnd() ?? Promise.resolve(),
    drawRoute: (...args) => controllerRef.current?.drawRoute(...args) ?? Promise.resolve(),
    clearRoute: () => controllerRef.current?.clearRoute(),
    getMapElement: () => controllerRef.current?.getMapElement() ?? null,
  }));

  // Geocode destination to set initial center if no initialCenter provided
  const geocodedRef = useRef(false);
  useEffect(() => {
    if (initialCenter || geocodedRef.current || !destination) return;
    geocodedRef.current = true;
    // Wait for Google Maps to load
    const tryGeocode = () => {
      if (!(window as unknown as { google?: { maps?: unknown } }).google?.maps) {
        setTimeout(tryGeocode, 500);
        return;
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: destination }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          controllerRef.current?.flyCameraTo({
            center: { lat: loc.lat(), lng: loc.lng() },
            tilt: 0,
            heading: 0,
            range: 50000,
          });
        }
      });
    };
    tryGeocode();
  }, [destination, initialCenter]);

  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      <GoogleMap
        style={{ width: "100%", height: "100%" }}
        defaultCenter={resolvedCenter}
        defaultZoom={13}
        mapTypeId="roadmap"
        styles={MAP_STYLES}
        disableDefaultUI
        gestureHandling="greedy"
        reuseMaps
      >
        <MapController
          locations={locations}
          onMarkerClick={onMarkerClick}
          initialCenter={resolvedCenter}
          controllerRef={controllerRef}
        />
      </GoogleMap>
    </APIProvider>
  );
});

export default Map3D;
