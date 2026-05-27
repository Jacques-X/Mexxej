"use client";

import { useEffect, useRef } from "react";
import type { TripLocation } from "@/types/trip";

interface Props {
  location: TripLocation;
  onClose: () => void;
}

export default function StreetViewPortal({ location, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || typeof google === "undefined") return;
    const sv = new google.maps.StreetViewPanorama(containerRef.current, {
      position: { lat: location.latitude, lng: location.longitude },
      pov: { heading: 0, pitch: 0 },
      zoom: 1,
      addressControl: false,
      fullscreenControl: false,
      motionTracking: false,
      motionTrackingControl: false,
    });
    void sv;
  }, [location]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column" }}>
      <div ref={containerRef} style={{ flex: 1 }} />

      {/* Controls bar */}
      <div style={{
        position: "absolute", top: 16, left: 16,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button
          onClick={onClose}
          className="mxj-btn"
          style={{ padding: "9px 16px", fontSize: 12, background: "var(--mxj-surface)" }}
        >
          ← Back to map
        </button>
        <div style={{
          background: "var(--mxj-surface)",
          border: "1px solid var(--mxj-stroke-strong)",
          padding: "6px 12px",
        }}>
          <span className="mxj-mono" style={{ color: "var(--mxj-ink)", fontSize: 11 }}>
            {location.name.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
