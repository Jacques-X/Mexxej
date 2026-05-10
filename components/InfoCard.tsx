"use client";

import { X, Navigation, Eye, MapPin, Tag } from "lucide-react";
import type { TripLocation } from "@/types/trip";
import MediaMoodBoard from "./MediaMoodBoard";

interface Props {
  location: TripLocation;
  onClose: () => void;
  onStreetView: (location: TripLocation) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  restaurant: "Restaurant",
  attraction: "Attraction",
  transport: "Transport",
  other: "Other",
};

export default function InfoCard({ location, onClose, onStreetView }: Props) {
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=walking`;

  const copyCoords = () => {
    navigator.clipboard.writeText(`${location.latitude}, ${location.longitude}`);
  };

  return (
    /*
     * Mobile:  full-width card anchored just above the bottom nav bar
     *          (`above-nav`), rounded top corners only.
     * Desktop: floating card in the bottom-right corner (`md:bottom-6 md:right-6`),
     *          fully rounded, 320 px wide.
     */
    <div className="
      absolute z-30 glass overflow-hidden shadow-2xl animate-slide-up
      left-0 right-0 above-nav rounded-t-3xl
      md:left-auto md:right-6 md:bottom-6 md:w-80 md:rounded-2xl
    ">
      {/* Category colour strip */}
      <div className={`h-1 w-full cat-${location.category}`} />

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        {/* Drag handle — mobile only */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20 md:hidden" />

        <div className="flex-1 min-w-0 pr-3 mt-1">
          <h3 className="font-bold text-base leading-tight">{location.name}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`cat-${location.category} text-xs px-2 py-0.5 rounded-full flex items-center gap-1`}>
              <Tag className="w-3 h-3" />
              {CATEGORY_LABELS[location.category] ?? location.category}
            </span>
            <span className="text-xs text-zinc-500">Day {location.day_number}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-xl text-zinc-500 hover:text-white active:text-white
                     hover:bg-white/10 active:bg-white/10 transition-colors flex items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      {location.description && (
        <p className="px-4 pb-3 text-sm text-zinc-400 leading-relaxed">
          {location.description}
        </p>
      )}

      {/* Coordinates — tap to copy */}
      <button
        onClick={copyCoords}
        className="mx-4 mb-3 flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 active:text-zinc-400 transition-colors"
      >
        <MapPin className="w-3 h-3" />
        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        <span className="ml-1 text-zinc-700">· tap to copy</span>
      </button>

      {/* Media mood board */}
      {location.media_url && (
        <div className="px-4 pb-3">
          <MediaMoodBoard mediaUrl={location.media_url} locationName={location.name} />
        </div>
      )}

      {/* Action buttons — 44px min height for iOS touch targets */}
      <div className="flex gap-2 px-4 pb-5 pt-1">
        <button
          onClick={() => onStreetView(location)}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl
                     bg-white/5 border border-white/10 text-zinc-300 text-sm font-medium
                     hover:bg-white/10 active:bg-white/15 transition-colors"
          style={{ minHeight: 48 }}
        >
          <Eye className="w-4 h-4" />
          Street View
        </button>

        <a
          href={navigationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl
                     bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors
                     text-white text-sm font-semibold"
          style={{ minHeight: 48 }}
        >
          <Navigation className="w-4 h-4" />
          Take Me There
        </a>
      </div>
    </div>
  );
}
