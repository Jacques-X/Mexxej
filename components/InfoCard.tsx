"use client";

import type { TripLocation, LocationCategory } from "@/types/trip";
import MediaMoodBoard from "./MediaMoodBoard";

interface Props {
  location: TripLocation;
  onClose: () => void;
  onStreetView: (location: TripLocation) => void;
  onDelete?: (id: string) => void;
}

const CAT_META: Record<LocationCategory, { label: string; glyph: string }> = {
  hotel:       { label: "Hotel",       glyph: "◼" },
  restaurant:  { label: "Restaurant",  glyph: "◼" },
  attraction:  { label: "Attraction",  glyph: "◼" },
  transport:   { label: "Transport",   glyph: "◼" },
  other:       { label: "Other",       glyph: "◼" },
};

export default function InfoCard({ location, onClose, onStreetView, onDelete }: Props) {
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=walking`;
  const meta   = CAT_META[location.category];

  const copyCoords = () => {
    navigator.clipboard.writeText(`${location.latitude}, ${location.longitude}`);
  };

  return (
    <div className="mxj-info-card animate-slide-up">
      {/* Mobile drag handle */}
      <div className="md:hidden" style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: 36, height: 3, background: "var(--mxj-stroke-strong)" }} />
      </div>

      <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="mxj-chip">Day {location.day_number}</span>
            <span className="mxj-chip" style={{ color: "var(--mxj-red)", borderColor: "var(--mxj-red-border)" }}>
              {meta.label}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid var(--mxj-stroke-strong)",
              cursor: "pointer", color: "var(--mxj-muted)",
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <h3 className="mxj-display" style={{ fontSize: "clamp(32px, 5vw, 44px)", margin: 0, lineHeight: 0.9, color: "var(--mxj-ink)" }}>
          {location.name}
        </h3>

        {/* Description */}
        {location.description && (
          <p style={{ fontSize: 13, color: "var(--mxj-muted)", lineHeight: 1.6, margin: 0 }}>
            {location.description}
          </p>
        )}

        <hr className="mxj-divider" />

        {/* Coordinates */}
        <button
          onClick={copyCoords}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0, textAlign: "left" }}
        >
          <span className="mxj-mono" style={{ color: "var(--mxj-muted)" }}>
            {location.latitude.toFixed(5)}°N, {location.longitude.toFixed(5)}°E
          </span>
          <span className="mxj-mono" style={{ color: "var(--mxj-faint)" }}>copy</span>
        </button>

        {/* Media */}
        {location.media_url && (
          <MediaMoodBoard mediaUrl={location.media_url} locationName={location.name} />
        )}

        <hr className="mxj-divider" />

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onStreetView(location)}
            className="mxj-btn mxj-btn-ghost"
            style={{ flex: 1, padding: "11px 0", justifyContent: "center" }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
              <circle cx="8" cy="6" r="2.5" /><path d="M3.5 14c.5-3 2.3-4.5 4.5-4.5s4 1.5 4.5 4.5" />
            </svg>
            Street View
          </button>
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mxj-btn mxj-btn-primary"
            style={{ flex: 1, padding: "11px 0", justifyContent: "center", textDecoration: "none" }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8l10-5-3 12-2-5z" />
            </svg>
            Navigate
          </a>
        </div>

        {onDelete && (
          <button
            onClick={() => { onDelete(location.id); onClose(); }}
            className="mxj-btn mxj-btn-danger"
            style={{ width: "100%", padding: "11px 0", justifyContent: "center" }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
              <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4M7 7v3M9 7v3" />
            </svg>
            Delete pin
          </button>
        )}
      </div>
    </div>
  );
}
