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

        panoInstanceRef.current = new google.maps.StreetViewPanorama(
          panoRef.current,
          {
            pano: data!.location!.pano,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: false,
            showRoadLabels: false,
            motionTracking: false,
            motionTrackingControl: false,
          }
        );
      }
    );

    return () => {
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
    <div className="absolute inset-0 z-50 bg-black animate-fade-in flex flex-col">
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-5 py-4
                      bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <button
          onClick={onClose}
          className="pointer-events-auto flex items-center gap-2 glass rounded-xl px-4 py-2
                     text-sm font-semibold hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Sky
        </button>
        <div className="pointer-events-auto glass rounded-xl px-4 py-2 text-sm text-zinc-300">
          Street View — <span className="font-medium text-white">{location.name}</span>
        </div>
      </div>

      {/* Street View container */}
      <div ref={panoRef} className="w-full h-full" />

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
      className="absolute inset-0 flex flex-col items-center justify-center
                 opacity-0 pointer-events-none transition-opacity duration-500"
    >
      <AlertCircle className="w-10 h-10 text-zinc-600 mb-3" />
      <p className="text-zinc-400 text-sm text-center max-w-xs">
        No Street View imagery available near{" "}
        <span className="font-medium text-zinc-200">{location.name}</span>.
      </p>
    </div>
  );
}
