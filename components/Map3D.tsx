"use client";

// Map — Cesium JS (CDN) with Google Photorealistic 3D Tiles.
// Tiles are proxied through /api/tiles to keep the API key server-side
// and work around the EEA IP restriction on tile.googleapis.com.
// Google Maps JS API is still loaded (places library) for PlaceAutocompleteElement.

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { TripLocation, CameraPosition } from "@/types/trip";

// Cesium loaded from CDN as a global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Cesium: any;

const CESIUM_VERSION = "1.125";
const CESIUM_CDN     = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

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

// ─── CameraPosition → Cesium HeadingPitchRange ────────────────
// Our tilt: 0 = nadir (straight down), 90 = horizontal
// Cesium pitch: 0 = horizontal, -90 = straight down
// So cesiumPitch = tilt - 90
function toCesiumHPR(position: CameraPosition) {
  return new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(position.heading),
    Cesium.Math.toRadians(position.tilt - 90),
    position.range,
  );
}

// ─── Component ───────────────────────────────────────────────
const Map3D = forwardRef<Map3DHandle, Props>(function Map3D(
  { apiKey, locations, onMarkerClick, initialCenter, destination },
  ref
) {
  const containerRef     = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef        = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerMapRef     = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeEntityRef   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitListenerRef = useRef<any>(null);
  const loadedRef        = useRef(false);

  const locationsRef     = useRef(locations);
  locationsRef.current   = locations;
  const onClickRef       = useRef(onMarkerClick);
  onClickRef.current     = onMarkerClick;

  // ── Marker management ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addMarker(viewer: any, loc: TripLocation) {
    if (markerMapRef.current.has(loc.id)) return;
    const C      = Cesium;
    const color  = CATEGORY_COLORS[loc.category] ?? CATEGORY_COLORS.other;
    const letter = loc.name.charAt(0).toUpperCase();

    const entity = viewer.entities.add({
      id:       loc.id,
      position: C.Cartesian3.fromDegrees(loc.longitude, loc.latitude),
      billboard: {
        image:                    makePinSvg(color, letter),
        width:                    36,
        height:                   48,
        verticalOrigin:           C.VerticalOrigin.BOTTOM,
        // CLAMP_TO_3D_TILE snaps the pin onto the photorealistic tile mesh
        // (CLAMP_TO_GROUND won't work when globe.show = false)
        heightReference:          C.HeightReference.CLAMP_TO_3D_TILE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    markerMapRef.current.set(loc.id, entity);
  }

  // ── Geocode via Google Maps (loaded for Places API anyway) ─
  async function geocodeDestination(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geocoder = new (window as any).google.maps.Geocoder();
      const result   = await geocoder.geocode({ address });
      if (result.results[0]) {
        const loc = result.results[0].geometry.location;
        return { lat: loc.lat(), lng: loc.lng() };
      }
    } catch { /* fall through */ }
    return null;
  }

  // ── Initialise Cesium Viewer + 3D Tiles ───────────────────
  const initCesium = useCallback(async () => {
    if (viewerRef.current || !containerRef.current) return;

    const C = Cesium;

    // Hidden div for Cesium credit display (required by ToS but we hide it)
    const creditEl = document.createElement("div");
    creditEl.style.display = "none";
    document.body.appendChild(creditEl);

    const viewer = new C.Viewer(containerRef.current, {
      baseLayerPicker:       false,
      geocoder:              false,
      homeButton:            false,
      sceneModePicker:       false,
      navigationHelpButton:  false,
      animation:             false,
      timeline:              false,
      fullscreenButton:      false,
      infoBox:               false,
      selectionIndicator:    false,
      creditContainer:       creditEl,
      // Prevent Cesium from making Ion requests — we use Google tiles only
      terrainProvider:       new C.EllipsoidTerrainProvider(),
      baseLayer:             false,
    });
    viewerRef.current = viewer;

    // Remove default imagery and all sky elements; 3D tiles provide the full scene
    viewer.imageryLayers.removeAll();
    viewer.scene.globe.show        = false;
    viewer.scene.skyBox.show       = false;
    viewer.scene.sun.show          = false;
    viewer.scene.moon.show         = false;
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.backgroundColor   = C.Color.fromCssColorString("#0e1620");

    // ── Load Google Photorealistic 3D Tiles via our proxy ──
    try {
      const tileset = await C.Cesium3DTileset.fromUrl("/api/tiles/root.json", {
        showCreditsOnScreen: false,
      });
      viewer.scene.primitives.add(tileset);
    } catch (err) {
      console.error("Failed to load Google Photorealistic 3D Tiles:", err);
    }

    // ── Initial camera position ────────────────────────────
    let center = initialCenter;
    if (!center && destination) {
      // Attempt to geocode only if google.maps is available by now
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.maps) {
        center = (await geocodeDestination(destination)) ?? undefined;
      }
    }
    center ??= { lat: 41.9028, lng: 12.4964 }; // Rome default

    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(center.lng, center.lat, 1200),
      orientation: {
        heading: C.Math.toRadians(0),
        pitch:   C.Math.toRadians(-55),
        roll:    0,
      },
      duration: 0,
    });

    // ── Place markers for existing locations ───────────────
    locationsRef.current.forEach((loc) => addMarker(viewer, loc));

    // ── Click handler ──────────────────────────────────────
    viewer.screenSpaceEventHandler.setInputAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (click: any) => {
        const picked = viewer.scene.pick(click.position);
        // picked.id is the Cesium Entity; entity's id prop is our location UUID
        if (picked?.id?.id) {
          const loc = locationsRef.current.find((l) => l.id === picked.id.id);
          if (loc) onClickRef.current(loc);
        }
      },
      C.ScreenSpaceEventType.LEFT_CLICK
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCenter, destination]);

  // ── Load Cesium CDN then Google Maps (places) ─────────────
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // Cesium needs to know where its workers/assets live before the script runs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).CESIUM_BASE_URL = `${CESIUM_CDN}/`;

    // Cesium widget CSS (hides default toolbar; we use our own UI)
    const link = document.createElement("link");
    link.rel   = "stylesheet";
    link.href  = `${CESIUM_CDN}/Widgets/widgets.css`;
    document.head.appendChild(link);

    // Cesium JS
    const scriptCesium    = document.createElement("script");
    scriptCesium.src      = `${CESIUM_CDN}/Cesium.js`;
    scriptCesium.onload   = () => initCesium();
    document.head.appendChild(scriptCesium);

    // Google Maps — needed for PlaceAutocompleteElement in AddPinPanel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__mxjMapsReady = () => { /* no 2D map to build */ };
    const scriptMaps = document.createElement("script");
    scriptMaps.src   = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=__mxjMapsReady`;
    document.head.appendChild(scriptMaps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers when locations prop changes ──────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || typeof Cesium === "undefined") return;

    const incoming = new Set(locations.map((l) => l.id));
    markerMapRef.current.forEach((entity, locId) => {
      if (!incoming.has(locId)) {
        viewer.entities.remove(entity);
        markerMapRef.current.delete(locId);
      }
    });
    locations.forEach((loc) => addMarker(viewer, loc));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  // ── Imperative API ────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    flyCameraTo(position, durationMs = 3000) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const C      = Cesium;
      const target = C.Cartesian3.fromDegrees(
        position.center.lng,
        position.center.lat,
        position.center.altitude ?? 0,
      );
      viewer.camera.flyToBoundingSphere(
        new C.BoundingSphere(target, 1),
        { duration: durationMs / 1000, offset: toCesiumHPR(position) }
      );
    },

    flyCameraAround(position, durationMs = 5000, rounds = 1) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const C      = Cesium;
      const target = C.Cartesian3.fromDegrees(
        position.center.lng,
        position.center.lat,
        position.center.altitude ?? 0,
      );
      const hpr         = toCesiumHPR(position);
      const startHead   = viewer.camera.heading;
      const totalDelta  = (rounds ?? 1) * C.Math.TWO_PI;
      const startTime   = Date.now();
      const ms          = durationMs ?? 5000;

      // Cancel any previous orbit
      if (orbitListenerRef.current) {
        viewer.scene.postRender.removeEventListener(orbitListenerRef.current);
      }

      // Lock camera to target and rotate heading each frame
      viewer.camera.lookAt(target, new C.HeadingPitchRange(startHead, hpr.pitch, hpr.range));
      orbitListenerRef.current = viewer.scene.postRender.addEventListener(() => {
        const t = Math.min((Date.now() - startTime) / ms, 1);
        viewer.camera.lookAt(
          target,
          new C.HeadingPitchRange(startHead + totalDelta * t, hpr.pitch, hpr.range)
        );
        if (t >= 1) {
          viewer.scene.postRender.removeEventListener(orbitListenerRef.current);
          orbitListenerRef.current = null;
          viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
        }
      });
    },

    stopCamera() {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.camera.cancelFlight();
      if (orbitListenerRef.current) {
        viewer.scene.postRender.removeEventListener(orbitListenerRef.current);
        orbitListenerRef.current = null;
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      }
    },

    waitForAnimationEnd() {
      return new Promise<void>((resolve) => {
        const viewer = viewerRef.current;
        if (!viewer) return resolve();

        // If we're in an orbit loop, poll until the listener clears
        if (orbitListenerRef.current) {
          const poll = setInterval(() => {
            if (!orbitListenerRef.current) { clearInterval(poll); resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(poll); resolve(); }, 12_000);
          return;
        }

        // Otherwise wait for the camera flight to settle
        const timeout = setTimeout(resolve, 5_000);
        const rem = viewer.camera.moveEnd.addEventListener(() => {
          clearTimeout(timeout);
          rem();
          resolve();
        });
      });
    },

    async drawRoute(locs) {
      const viewer = viewerRef.current;
      if (!viewer || locs.length < 2) return;
      // Remove previous
      if (routeEntityRef.current) {
        viewer.entities.remove(routeEntityRef.current);
        routeEntityRef.current = null;
      }
      const C = Cesium;
      // Flatten [lng, lat, lng, lat, …] for fromDegreesArray
      const positions = locs.flatMap((l) => [l.longitude, l.latitude]);
      routeEntityRef.current = viewer.entities.add({
        polyline: {
          positions:    C.Cartesian3.fromDegreesArray(positions),
          width:        6,
          material:     new C.ColorMaterialProperty(
            C.Color.fromCssColorString("#38bdf8").withAlpha(0.85)
          ),
          clampToGround: true,
        },
      });
    },

    clearRoute() {
      const viewer = viewerRef.current;
      if (!viewer || !routeEntityRef.current) return;
      viewer.entities.remove(routeEntityRef.current);
      routeEntityRef.current = null;
    },

    getMapElement() {
      return containerRef.current;
    },
  }));

  // ── Cleanup ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (orbitListenerRef.current && viewerRef.current) {
        viewerRef.current.scene.postRender.removeEventListener(orbitListenerRef.current);
      }
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ overflow: "hidden" }}
      aria-label="3D photorealistic map"
    />
  );
});

export default Map3D;
