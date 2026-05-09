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
  // "Take Me There" deep-link for mobile Google Maps navigation
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=walking`;

  // Copy coordinates to clipboard
  const copyCoords = () => {
    navigator.clipboard.writeText(`${location.latitude}, ${location.longitude}`);
  };

  return (
    <div className="absolute bottom-6 right-6 z-30 w-80 glass rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
      {/* Header */}
      <div className="relative">
        {/* Category colour strip */}
        <div className={`h-1 w-full cat-${location.category}`} />

        <div className="flex items-start justify-between px-4 pt-3 pb-2">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="font-bold text-base leading-tight">{location.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`cat-${location.category} text-xs px-2 py-0.5 rounded-full flex items-center gap-1`}>
                <Tag className="w-3 h-3" />
                {CATEGORY_LABELS[location.category] ?? location.category}
              </span>
              <span className="text-xs text-zinc-500">Day {location.day_number}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      {location.description && (
        <p className="px-4 pb-3 text-sm text-zinc-400 leading-relaxed">
          {location.description}
        </p>
      )}

      {/* Coordinates */}
      <button
        onClick={copyCoords}
        className="mx-4 mb-3 flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        <MapPin className="w-3 h-3" />
        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        <span className="ml-1 text-zinc-700">(tap to copy)</span>
      </button>

      {/* Media mood board */}
      {location.media_url && (
        <div className="px-4 pb-3">
          <MediaMoodBoard mediaUrl={location.media_url} locationName={location.name} />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 px-4 pb-4 pt-1">
        {/* Street View */}
        <button
          onClick={() => onStreetView(location)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl
                     bg-white/5 border border-white/10 text-zinc-300 text-sm font-medium
                     hover:bg-white/10 transition-colors"
        >
          <Eye className="w-4 h-4" />
          Street View
        </button>

        {/* Take Me There — mobile navigation deep-link */}
        <a
          href={navigationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl
                     bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors
                     text-white text-sm font-semibold"
        >
          <Navigation className="w-4 h-4" />
          Take Me There
        </a>
      </div>
    </div>
  );
}
