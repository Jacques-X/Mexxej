"use client";

// Map3D — CesiumJS + Google Photorealistic 3D Tiles
// Same approach as Armatur: Cesium.createGooglePhotorealistic3DTileset()
// gives real satellite textures; gmp-map-3d (alpha) did not.

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { TripLocation, CameraPosition } from "@/types/trip";

// Cesium is loaded from CDN at runtime — declare as any
declare const Cesium: any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── Public API exposed via ref ───────────────────────────────
export interface Map3DHandle {
  flyCameraTo: (position: CameraPosition, durationMs?: number) => void;
  flyCameraAround: (position: CameraPosition, durationMs?: number, rounds?: number) => void;
  stopCamera: () => void;
  waitForAnimationEnd: () => Promise<void>;
  drawRoute: (locations: TripLocation[]) => Promise<void>;
  clearRoute: () => void;
  getMapElement: () => null;
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

// Convert gmp-map-3d CameraPosition to Cesium flyTo params
function cesiumCamera(pos: CameraPosition) {
  const altOffset = pos.range * Math.cos((pos.tilt * Math.PI) / 180);
  return {
    destination: Cesium.Cartesian3.fromDegrees(
      pos.center.lng,
      pos.center.lat,
      (pos.center.altitude ?? 0) + altOffset
    ),
    orientation: {
      heading: Cesium.Math.toRadians(pos.heading),
      pitch: Cesium.Math.toRadians(pos.tilt - 90), // gmp tilt 0=top-down; Cesium pitch -90=top-down
      roll: 0,
    },
  };
}

// ─── Component ───────────────────────────────────────────────
const Map3D = forwardRef<Map3DHandle, Props>(function Map3D(
  { apiKey, locations, onMarkerClick, initialCenter, destination },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const entityMapRef = useRef<Map<string, string>>(new Map()); // locationId → cesium entity id
  const routeEntityIdRef = useRef<string | null>(null);
  const cesiumReadyRef = useRef(false);
  const mapsReadyRef = useRef(false);

  // ── Load Cesium from CDN ─────────────────────────────────
  useEffect(() => {
    if (cesiumReadyRef.current) return;
    cesiumReadyRef.current = true;

    const CESIUM_VERSION = "1.121";
    const CESIUM_BASE =
      `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/`;

    // Must be set BEFORE Cesium.js loads so workers resolve correctly
    (window as any).CESIUM_BASE_URL = CESIUM_BASE; // eslint-disable-line @typescript-eslint/no-explicit-any

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${CESIUM_BASE}Widgets/widgets.css`;
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = `${CESIUM_BASE}Cesium.js`;
    script.async = true;
    script.onload = () => initCesium();
    script.onerror = () => { cesiumReadyRef.current = false; };
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load Google Maps (DirectionsService + StreetView only) ──
  useEffect(() => {
    if (mapsReadyRef.current) return;
    mapsReadyRef.current = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    document.head.appendChild(script);
  }, [apiKey]);

  // ── Wait for Google Maps SDK to be available ─────────────
  function waitForGoogleMaps(timeoutMs = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof google !== "undefined") return resolve();
      const id = setInterval(() => {
        if (typeof google !== "undefined") { clearInterval(id); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(id); reject(new Error("Google Maps SDK failed to load")); }, timeoutMs);
    });
  }

  // ── Geocode a place name → { lat, lng } ──────────────────
  async function geocode(
    address: string
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      await waitForGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address });
      if (result.results[0]) {
        const loc = result.results[0].geometry.location;
        return { lat: loc.lat(), lng: loc.lng() };
      }
    } catch {
      // fall through
    }
    return null;
  }

  // ── Initialise Cesium viewer — mirrors Armatur exactly ──
  const initCesium = useCallback(async () => {
    if (!containerRef.current || viewerRef.current) return;

    const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;

    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    } else {
      Cesium.Ion.defaultAccessToken = "";
    }

    const viewerOptions: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: false,
      imageryProvider: false, // no Bing — Google 3D tiles take over
    };

    if (ionToken) {
      viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
    }

    const viewer = new Cesium.Viewer(containerRef.current, viewerOptions);
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // Try Google Photorealistic 3D Tiles on top of the base layer
    if (apiKey) {
      Cesium.GoogleMaps.defaultApiKey = apiKey;
      Cesium.createGooglePhotorealistic3DTileset()
        .then((tileset: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          viewer.scene.primitives.add(tileset);
          viewer.scene.globe.show = false; // hide flat globe; tiles take over
        })
        .catch(() => {
          // Google 3D tiles blocked (EEA restriction) — fall back to OSM Buildings
          Cesium.createOsmBuildingsAsync()
            .then((osmTileset: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              viewer.scene.primitives.add(osmTileset);
            })
            .catch(() => { /* Ion token missing or no network — Bing-only fallback */ });
        });
    }

    // Resolve the starting coordinate:
    // 1. First location in itinerary  2. Geocoded destination  3. Fallback (Rome)
    let center = initialCenter;
    if (!center && destination) {
      center = (await geocode(destination)) ?? undefined;
    }
    center ??= { lat: 41.9028, lng: 12.4964 };

    // Position camera close enough that tiles load immediately (no blue void)
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat, 8_000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
    });

    // Cinematic swoop into street level
    setTimeout(() => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(center!.lng, center!.lat, 600),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-25), roll: 0 },
        duration: 3.5,
      });
    }, 600);

    // Click handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const picked = viewer.scene.pick(event.position);
      if (Cesium.defined(picked?.id?.id)) {
        const locId: string = picked.id.id;
        containerRef.current?.dispatchEvent(
          new CustomEvent("cesium-marker-click", { detail: locId, bubbles: true })
        );
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;
  }, [apiKey, initialCenter, destination]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for marker clicks (avoids stale closure) ──────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const locId = (e as CustomEvent).detail as string;
      const loc = locations.find((l) => l.id === locId);
      if (loc) onMarkerClick(loc);
    };
    el.addEventListener("cesium-marker-click", handler);
    return () => el.removeEventListener("cesium-marker-click", handler);
  }, [locations, onMarkerClick]);

  // ── Sync markers whenever locations change ────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const incoming = new Set(locations.map((l) => l.id));

    // Remove stale entities
    entityMapRef.current.forEach((cesiumId, locId) => {
      if (!incoming.has(locId)) {
        viewer.entities.removeById(cesiumId);
        entityMapRef.current.delete(locId);
      }
    });

    // Add new entities
    locations.forEach((loc) => {
      if (entityMapRef.current.has(loc.id)) return;
      const color = CATEGORY_COLORS[loc.category] ?? CATEGORY_COLORS.other;
      const letter = loc.name.charAt(0).toUpperCase();

      const entity = viewer.entities.add({
        id: loc.id,
        position: Cesium.Cartesian3.fromDegrees(loc.longitude, loc.latitude, 0),
        billboard: {
          image: makePinSvg(color, letter),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          width: 36,
          height: 48,
        },
        label: {
          text: loc.name,
          font: "bold 12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -52),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });

      entityMapRef.current.set(loc.id, entity.id as string);
    });
  }, [locations]);

  // ── Imperative handle ────────────────────────────────────
  useImperativeHandle(ref, () => ({
    flyCameraTo(position, durationMs = 3000) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.camera.flyTo({ ...cesiumCamera(position), duration: durationMs / 1000 });
    },

    flyCameraAround(position, durationMs = 10000, rounds = 1) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const cam = cesiumCamera(position);
      viewer.camera.flyTo({
        ...cam,
        orientation: {
          ...cam.orientation,
          heading: Cesium.Math.toRadians(position.heading + 360 * rounds),
        },
        duration: durationMs / 1000,
      });
    },

    stopCamera() {
      viewerRef.current?.camera.cancelFlight();
    },

    waitForAnimationEnd() {
      return new Promise<void>((resolve) => {
        const viewer = viewerRef.current;
        if (!viewer) return resolve();
        const timeout = setTimeout(resolve, 8_000);
        const remove = viewer.camera.moveEnd.addEventListener(() => {
          clearTimeout(timeout);
          remove();
          resolve();
        });
      });
    },

    async drawRoute(locs) {
      const viewer = viewerRef.current;
      if (!viewer || locs.length < 2) return;
      if (typeof google === "undefined") return;

      // Clear existing route
      if (routeEntityIdRef.current) {
        viewer.entities.removeById(routeEntityIdRef.current);
        routeEntityIdRef.current = null;
      }

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

      const positions: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
      result.routes[0].legs.forEach((leg) =>
        leg.steps.forEach((step) =>
          step.path?.forEach((p) =>
            positions.push(Cesium.Cartesian3.fromDegrees(p.lng(), p.lat(), 15))
          )
        )
      );

      const entity = viewer.entities.add({
        polyline: {
          positions,
          width: 6,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.fromCssColorString("#38bdf8"),
          }),
          clampToGround: false,
          depthFailMaterial: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.4)
          ),
        },
      });
      routeEntityIdRef.current = entity.id as string;
    },

    clearRoute() {
      const viewer = viewerRef.current;
      if (!viewer || !routeEntityIdRef.current) return;
      viewer.entities.removeById(routeEntityIdRef.current);
      routeEntityIdRef.current = null;
    },

    getMapElement() {
      return null;
    },
  }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
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
