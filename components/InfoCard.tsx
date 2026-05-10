"use client";

import type { TripLocation, LocationCategory } from "@/types/trip";
import MediaMoodBoard from "./MediaMoodBoard";

interface Props {
  location: TripLocation;
  onClose: () => void;
  onStreetView: (location: TripLocation) => void;
}

const CATEGORY_META: Record<LocationCategory, { label: string; glyph: string; color: string }> = {
  hotel:       { label: "Hotel",       glyph: "◑", color: "#d8a478" },
  restaurant:  { label: "Restaurant",  glyph: "◆", color: "#e88c64" },
  attraction:  { label: "Attraction",  glyph: "★", color: "#c8b894" },
  transport:   { label: "Transport",   glyph: "→", color: "#88a8c0" },
  other:       { label: "Other",       glyph: "·", color: "#9aa4b0" },
};

export default function InfoCard({ location, onClose, onStreetView }: Props) {
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=walking`;
  const meta = CATEGORY_META[location.category];

  const copyCoords = () => {
    navigator.clipboard.writeText(`${location.latitude}, ${location.longitude}`);
  };

  return (
    /*
     * Mobile: full-width anchored at bottom, rounded top corners.
     * Desktop: floating 440px card, bottom-right (via mxj-info-card class below).
     */
    <div className="mxj-glass mxj-info-card animate-slide-up">
      {/* Drag handle — mobile only */}
      <div className="md:hidden" style={{ padding: "8px 0", display: "flex", justifyContent: "center" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: "var(--mxj-stroke-strong)" }} />
      </div>

      {/* Photo placeholder */}
      <div className="mxj-photo" style={{ height: 220, borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
        <span style={{ position: "relative", zIndex: 1 }}>
          {location.name.toLowerCase()} · photo
        </span>
        {/* Close button overlaid on photo */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 2,
            width: 34, height: 34, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(16,22,30,0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--mxj-stroke)",
            cursor: "pointer", color: "var(--mxj-ink)",
          }}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div style={{ padding: "18px 22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Chips */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="mxj-chip">Day {location.day_number}</span>
          <span
            className="mxj-chip"
            style={{
              background: meta.color + "22",
              borderColor: meta.color + "55",
              color: meta.color,
            }}
          >
            {meta.glyph} {meta.label}
          </span>
        </div>

        {/* Name */}
        <h3 className="mxj-serif" style={{ fontSize: 36, margin: 0, lineHeight: 1.05 }}>
          {location.name}
        </h3>

        {/* Description */}
        {location.description && (
          <p style={{ fontSize: 14, color: "var(--mxj-muted)", lineHeight: 1.55, margin: 0 }}>
            {location.description}
          </p>
        )}

        <hr className="mxj-divider" />

        {/* Coordinates — tap to copy */}
        <button
          onClick={copyCoords}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, padding: 0,
          }}
        >
          <span className="mxj-mono">
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </span>
          <span className="mxj-mono" style={{ color: "var(--mxj-faint)" }}>· copy</span>
        </button>

        {/* Media */}
        {location.media_url && (
          <MediaMoodBoard mediaUrl={location.media_url} locationName={location.name} />
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            onClick={() => onStreetView(location)}
            className="mxj-btn mxj-btn-ghost"
            style={{ flex: 1, justifyContent: "center", padding: "12px 0" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="8" cy="6" r="2.5" /><path d="M3.5 14c.5-3 2.3-4.5 4.5-4.5s4 1.5 4.5 4.5" />
            </svg>
            Street View
          </button>

          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mxj-btn mxj-btn-accent"
            style={{ flex: 1, justifyContent: "center", padding: "12px 0", textDecoration: "none" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M3 8l10-5-3 12-2-5z" />
            </svg>
            Take Me There
          </a>
        </div>
      </div>
    </div>
  );
}
