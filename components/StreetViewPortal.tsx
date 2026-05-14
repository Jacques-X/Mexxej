"use client";

// Full-screen Street View overlay.  Initialises google.maps.StreetViewPanorama
// inside a div overlay and tears it down on close.

import { useEffect, useRef } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import type { TripLocation } from "@/types/trip";

interface Props {
  location: TripLocation;
  onClose: () => void;
}

export default function StreetViewPortal({ location, onClose }: Props) {
  const panoRef = useRef<HTMLDivElement>(null);
  const panoInstanceRef = useRef<google.maps.StreetViewPanorama | null>(null);

  useEffect(() => {
    if (!panoRef.current) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function init() {
      if (!panoRef.current || typeof google === "undefined") return;
      const sv = new google.maps.StreetViewService();
      sv.getPanorama(
        {
          location: { lat: location.latitude, lng: location.longitude },
          radius: 50,
          preference: google.maps.StreetViewPreference.NEAREST,
        },
        (data, status) => {
          if (status !== google.maps.StreetViewStatus.OK || !panoRef.current) return;
          panoInstanceRef.current = new google.maps.StreetViewPanorama(panoRef.current, {
            pano: data!.location!.pano,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: false,
            showRoadLabels: false,
            motionTracking: false,
            motionTrackingControl: false,
          });
        }
      );
    }

    if (typeof google !== "undefined") {
      init();
    } else {
      intervalId = setInterval(() => {
        if (typeof google !== "undefined") {
          clearInterval(intervalId!);
          intervalId = null;
          init();
        }
      }, 100);
      timeoutId = setTimeout(() => {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
      }, 5_000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      panoInstanceRef.current = null;
    };
  }, [location]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "#000", animation: "fadeIn 0.25s ease-out", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
        pointerEvents: "none"
      }}>
        <button
          onClick={onClose}
          style={{
            pointerEvents: "auto",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(20, 28, 38, 0.55)",
            backdropFilter: "blur(24px)",
            borderRadius: 12, padding: "8px 16px",
            fontSize: 14, fontWeight: 600,
            color: "var(--mxj-ink)",
            border: "1px solid var(--mxj-stroke)",
            cursor: "pointer",
            transition: "background 0.15s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(20, 28, 38, 0.7)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(20, 28, 38, 0.55)")}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Return to Sky
        </button>
        <div style={{
          pointerEvents: "auto",
          background: "rgba(20, 28, 38, 0.55)",
          backdropFilter: "blur(24px)",
          borderRadius: 12, padding: "8px 16px",
          fontSize: 14,
          color: "rgba(246, 239, 228, 0.8)",
          border: "1px solid var(--mxj-stroke)"
        }}>
          Street View — <span style={{ fontWeight: 500, color: "var(--mxj-ink)" }}>{location.name}</span>
        </div>
      </div>

      {/* Street View container */}
      <div ref={panoRef} style={{ width: "100%", height: "100%" }} />

      {/* No Street View fallback — rendered as an overlay if pano stays empty */}
      <NoSVFallback panoRef={panoRef} location={location} />
    </div>
  );
}

// Shows a message if the panorama div has no child (Google's iframe)
// after 3 seconds — meaning no street view imagery is available.
function NoSVFallback({
  panoRef,
  location,
}: {
  panoRef: React.RefObject<HTMLDivElement | null>;
  location: TripLocation;
}) {
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!panoRef.current) return;
      // If Google injected its iframe the div will have children
      if (panoRef.current.childElementCount === 0 && fallbackRef.current) {
        fallbackRef.current.style.opacity = "1";
        fallbackRef.current.style.pointerEvents = "auto";
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [panoRef]);

  return (
    <div
      ref={fallbackRef}
      style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        opacity: 0, pointerEvents: "none",
        transition: "opacity 0.5s ease-out"
      }}
    >
      <AlertCircle style={{ width: 40, height: 40, color: "var(--mxj-faint)", marginBottom: 12 }} />
      <p style={{ color: "var(--mxj-muted)", fontSize: 14, textAlign: "center", maxWidth: 320, lineHeight: 1.55, margin: 0 }}>
        No Street View imagery available near{" "}
        <span style={{ fontWeight: 500, color: "var(--mxj-ink)" }}>{location.name}</span>.
      </p>
    </div>
  );
}
