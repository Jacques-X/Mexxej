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


// ─── Inner map controller (has access to map instance) ────────
interface ControllerProps {
  locations: TripLocation[];
  onMarkerClick: (location: TripLocation) => void;
  initialCenter: { lat: number; lng: number };
  controllerRef: React.MutableRefObject<Map3DHandle | null>;
  destination?: string;
  hasInitialCenter: boolean;
}

function MapController({ locations, onMarkerClick, controllerRef, destination, hasInitialCenter }: ControllerProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const geocodingLib = useMapsLibrary("geocoding");
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

  // ── Geocode destination if no initialCenter ────────────────
  const geocodedRef = useRef(false);
  useEffect(() => {
    if (!map || !geocodingLib || hasInitialCenter || !destination || geocodedRef.current) return;
    geocodedRef.current = true;
    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: destination }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        map.panTo({ lat: loc.lat(), lng: loc.lng() });
        map.setZoom(12);
      }
    });
  }, [map, geocodingLib, destination, hasInitialCenter]);

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


  return (
    <APIProvider apiKey={apiKey} libraries={["places", "geocoding"]}>
      <GoogleMap
        style={{ width: "100%", height: "100%" }}
        defaultCenter={resolvedCenter}
        defaultZoom={13}
        mapTypeId="satellite"
        styles={[
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ]}
        disableDefaultUI
        gestureHandling="greedy"
        reuseMaps
      >
        <MapController
          locations={locations}
          onMarkerClick={onMarkerClick}
          initialCenter={resolvedCenter}
          controllerRef={controllerRef}
          destination={destination}
          hasInitialCenter={!!initialCenter}
        />
      </GoogleMap>
    </APIProvider>
  );
});

export default Map3D;
