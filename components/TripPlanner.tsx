"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Trip, TripLocation, DayNote, Reservation, LocationCategory, ConciergeSuggestion, TransitLeg } from "@/types/trip";
import {
  getLocationsByTrip, addLocation, deleteLocation, reorderLocations,
  getDayNotes, upsertDayNote,
  updateLocation,
  getReservations, addReservation, updateReservation, deleteReservation,
} from "@/lib/supabase";
import { computeDayTimeline, formatMinutes, TRANSPORT_META, type TransportMode, type StopTiming } from "@/lib/timeline";

import Map3D, { type Map3DHandle } from "./Map3D";
import InfoCard from "./InfoCard";
import StreetViewPortal from "./StreetViewPortal";
import ReservationsPanel from "./ReservationsPanel";
import TravelConcierge from "./TravelConcierge";
import Logo from "./Logo";
import DeleteTripButton from "./DeleteTripButton";

// ── Types ──────────────────────────────────────────────────────
type ActiveTab = "map" | "reservations" | "concierge";

const CAT_OPTIONS: { value: LocationCategory; label: string }[] = [
  { value: "hotel",      label: "Hotel"       },
  { value: "restaurant", label: "Restaurant"  },
  { value: "attraction", label: "Attraction"  },
  { value: "transport",  label: "Transport"   },
  { value: "other",      label: "Other"       },
];

const MODES: TransportMode[] = ["walk", "cycle", "transit"];

// ── Fetch real travel time + leg breakdown ─────────────────────
const LEG_EMOJI: Record<string, string> = {
  WALK: "🚶", BUS: "🚌", RAIL: "🚆", TRAM: "🚃",
  SUBWAY: "🚇", FERRY: "⛴", GONDOLA: "🚡", CABLE_CAR: "🚟", FUNICULAR: "🚞",
};

/** Returns YYYY-MM-DD for the calendar day of a given leg (day 1 = trip start date). */
function getLegDepartDate(tripStartDate: string | undefined, dayNumber: number): string {
  const base = tripStartDate ? new Date(tripStartDate) : new Date();
  base.setUTCDate(base.getUTCDate() + (dayNumber - 1));
  return base.toISOString().substring(0, 10);
}

/** Returns HH:MM departure time from a stop (arrival + duration), or undefined. */
function getStopDepartTime(loc: TripLocation): string | undefined {
  if (!loc.arrival_time) return undefined;
  const [h, m] = loc.arrival_time.split(":").map(Number);
  const depMin = h * 60 + m + (loc.duration_minutes ?? 0);
  return `${String(Math.floor(depMin / 60) % 24).padStart(2, "0")}:${String(depMin % 60).padStart(2, "0")}`;
}

/** Formats an epoch-ms timestamp as HH:MM in the browser's local timezone. */
function formatEpochTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function fetchRouteInfo(
  from: TripLocation,
  to: TripLocation,
  mode: TransportMode,
  departDate?: string,
  departTime?: string,
): Promise<{ minutes: number; legs?: TransitLeg[] } | null> {
  try {
    let url = `/api/routing?from_lat=${from.latitude}&from_lng=${from.longitude}&to_lat=${to.latitude}&to_lng=${to.longitude}&mode=${mode}`;
    if (departDate) url += `&depart_date=${departDate}`;
    if (departTime) url += `&depart_time=${encodeURIComponent(departTime)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { minutes?: number; legs?: TransitLeg[] };
    if (data.minutes == null) return null;
    return { minutes: data.minutes, legs: data.legs };
  } catch {
    return null;
  }
}

// ── Sortable stop row ──────────────────────────────────────────
function SortableStop({
  loc,
  next,
  timing,
  isSelected,
  onClick,
  onUpdateLoc,
  transitLegs,
}: {
  loc: TripLocation;
  next: TripLocation | null;
  timing: StopTiming | null;
  isSelected: boolean;
  onClick: () => void;
  onUpdateLoc: (id: string, updates: Partial<TripLocation>) => void;
  transitLegs?: TransitLeg[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: loc.id });

  const [editingTime, setEditingTime] = useState(false);
  const [editingDur, setEditingDur]   = useState(false);
  const [tempTime, setTempTime]       = useState(loc.arrival_time ?? "");
  const [tempDur, setTempDur]         = useState(String(loc.duration_minutes ?? ""));
  const [editing, setEditing]         = useState(false);
  const [editName, setEditName]       = useState(loc.name);
  const [editCat, setEditCat]         = useState<LocationCategory>(loc.category);
  const [editDesc, setEditDesc]       = useState(loc.description ?? "");

  const mode: TransportMode = (loc.transport_mode as TransportMode | null) ?? "walk";

  function cycleMode() {
    const idx  = MODES.indexOf(mode);
    const nxt  = MODES[(idx + 1) % MODES.length];
    onUpdateLoc(loc.id, { transport_mode: nxt });
    updateLocation(loc.id, { transport_mode: nxt }).catch(console.error);
  }

  function saveTime() {
    setEditingTime(false);
    const val = tempTime || undefined;
    onUpdateLoc(loc.id, { arrival_time: val ?? null });
    updateLocation(loc.id, { arrival_time: val }).catch(console.error);
  }

  function saveDur() {
    setEditingDur(false);
    const val = tempDur ? parseInt(tempDur) : undefined;
    onUpdateLoc(loc.id, { duration_minutes: val ?? null });
    updateLocation(loc.id, { duration_minutes: val });
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!editName.trim()) return;
    setEditing(false);
    onUpdateLoc(loc.id, { name: editName.trim(), category: editCat, description: editDesc });
    updateLocation(loc.id, { name: editName.trim(), category: editCat, description: editDesc }).catch(console.error);
  }

  const arrLabel = timing?.arrivalMin != null ? formatMinutes(timing.arrivalMin) : null;
  const depLabel = timing?.departureMin != null ? formatMinutes(timing.departureMin) : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "10px 20px",
          background: isSelected ? "var(--mxj-surface-2)" : "transparent",
          borderBottom: next ? "none" : "1px solid var(--mxj-stroke)",
          borderLeft: isSelected ? "2px solid var(--mxj-red)" : "2px solid transparent",
          cursor: editing ? "default" : "pointer",
        }}
        onClick={editing ? undefined : onClick}
      >
        {!editing && (
          <span
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", color: "var(--mxj-faint)", flexShrink: 0, paddingTop: 2, display: "flex", alignItems: "center" }}
            onClick={e => e.stopPropagation()}
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <rect x="0" y="0"   width="3" height="3" />
              <rect x="7" y="0"   width="3" height="3" />
              <rect x="0" y="5.5" width="3" height="3" />
              <rect x="7" y="5.5" width="3" height="3" />
              <rect x="0" y="11"  width="3" height="3" />
              <rect x="7" y="11"  width="3" height="3" />
            </svg>
          </span>
        )}

        <div className={`mxj-stop-marker${isSelected && !editing ? "" : " inactive"}`} style={{ marginTop: 3 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <form onSubmit={saveEdit} style={{ display: "flex", flexDirection: "column", gap: 6 }} onClick={e => e.stopPropagation()}>
              <input
                className="mxj-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{ fontSize: 12 }}
                autoFocus
                required
              />
              <select
                className="mxj-select"
                value={editCat}
                onChange={e => setEditCat(e.target.value as LocationCategory)}
                style={{ fontSize: 11 }}
              >
                {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <textarea
                className="mxj-input"
                rows={2}
                placeholder="Notes..."
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                style={{ resize: "none", fontSize: 11 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit" className="mxj-btn mxj-btn-primary" style={{ flex: 1, justifyContent: "center", padding: "7px 0", fontSize: 10 }}>Save</button>
                <button type="button" onClick={e => { e.stopPropagation(); setEditing(false); }} className="mxj-btn mxj-btn-ghost" style={{ padding: "7px 10px", fontSize: 10 }}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--mxj-ink)" }}>
                  {loc.name}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setEditing(true); setEditName(loc.name); setEditCat(loc.category); setEditDesc(loc.description ?? ""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-faint)", padding: "0 2px", fontSize: 11, flexShrink: 0, lineHeight: 1 }}
                  title="Edit stop"
                >
                  ✎
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                {editingTime ? (
                  <input
                    autoFocus
                    type="time"
                    className="mxj-input"
                    style={{ width: 90, fontSize: 11, padding: "2px 6px" }}
                    value={tempTime}
                    onChange={e => setTempTime(e.target.value)}
                    onBlur={saveTime}
                    onKeyDown={e => { if (e.key === "Enter") saveTime(); if (e.key === "Escape") setEditingTime(false); }}
                  />
                ) : arrLabel ? (
                  <span
                    className="mxj-mono"
                    style={{ fontSize: 10, color: "var(--mxj-ink)", cursor: "text", borderBottom: "1px dashed var(--mxj-stroke-strong)" }}
                    onClick={() => { setTempTime(loc.arrival_time ?? ""); setEditingTime(true); }}
                    title="Click to edit arrival time"
                  >
                    {arrLabel}
                    {depLabel && <> → {depLabel}</>}
                  </span>
                ) : (
                  <button
                    className="mxj-mono"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-faint)", fontSize: 9, padding: 0 }}
                    onClick={() => { setTempTime(""); setEditingTime(true); }}
                  >
                    + set time
                  </button>
                )}

                {editingDur ? (
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    className="mxj-input"
                    style={{ width: 60, fontSize: 11, padding: "2px 6px" }}
                    value={tempDur}
                    placeholder="min"
                    onChange={e => setTempDur(e.target.value)}
                    onBlur={saveDur}
                    onKeyDown={e => { if (e.key === "Enter") saveDur(); if (e.key === "Escape") setEditingDur(false); }}
                  />
                ) : loc.duration_minutes ? (
                  <span
                    className="mxj-mono"
                    style={{ fontSize: 9, color: "var(--mxj-muted)", cursor: "text" }}
                    onClick={() => { setTempDur(String(loc.duration_minutes ?? "")); setEditingDur(true); }}
                    title="Click to edit duration"
                  >
                    {loc.duration_minutes}min
                  </span>
                ) : (
                  <button
                    className="mxj-mono"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-faint)", fontSize: 9, padding: 0 }}
                    onClick={() => { setTempDur(""); setEditingDur(true); }}
                  >
                    + duration
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {next && (
        <div
          style={{ borderBottom: "1px solid var(--mxj-stroke)", background: "var(--mxj-base)" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Main mode row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 20px 5px 42px" }}>
            <button
              onClick={cycleMode}
              title={`Mode: ${TRANSPORT_META[mode].label} — click to change`}
              style={{ background: "none", border: "1px solid var(--mxj-stroke)", cursor: "pointer", fontSize: 13, padding: "2px 6px", lineHeight: 1 }}
            >
              {TRANSPORT_META[mode].icon}
            </button>
            {timing && (
              <span className="mxj-mono" style={{ fontSize: 9, color: timing.travelIsReal ? "var(--mxj-muted)" : "var(--mxj-faint)" }}>
                {timing.travelToNextMin}min
                {!timing.travelIsReal && <span style={{ opacity: 0.6 }}> ~est</span>}
              </span>
            )}
            <span className="mxj-mono" style={{ fontSize: 8, color: "var(--mxj-faint)", letterSpacing: "0.06em" }}>
              {TRANSPORT_META[mode].label.toUpperCase()}
            </span>
          </div>
          {/* Transit leg breakdown — shown when real leg data is available */}
          {mode === "transit" && transitLegs && transitLegs.length > 0 && (
            <div style={{ padding: "0 20px 6px 42px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {transitLegs.map((leg, idx) => (
                <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {idx > 0 && (
                    <span className="mxj-mono" style={{ fontSize: 8, color: "var(--mxj-stroke-strong)", margin: "0 2px" }}>→</span>
                  )}
                  <span
                    className="mxj-mono"
                    style={{
                      fontSize: 8,
                      color: leg.mode === "WALK" ? "var(--mxj-faint)" : "var(--mxj-muted)",
                      display: "inline-flex", alignItems: "center", gap: 3,
                      background: leg.mode !== "WALK" ? "var(--mxj-surface)" : "transparent",
                      border: leg.mode !== "WALK" ? "1px solid var(--mxj-stroke)" : "none",
                      padding: leg.mode !== "WALK" ? "1px 5px" : "0",
                    }}
                    title={[leg.fromStop, leg.toStop].filter(Boolean).join(" → ") || leg.agency || undefined}
                  >
                    <span>{LEG_EMOJI[leg.mode] ?? "🚌"}</span>
                    {leg.route && (
                      <span style={{ color: "var(--mxj-red)", fontWeight: 600 }}>{leg.route}</span>
                    )}
                    {leg.headsign && (
                      <span style={{ color: "var(--mxj-faint)" }}>→ {leg.headsign}</span>
                    )}
                    {/* Show scheduled dep–arr when available; fall back to duration */}
                    {leg.mode !== "WALK" && leg.departTime != null ? (
                      <span style={{ color: "var(--mxj-ink)", fontWeight: 500 }}>
                        {formatEpochTime(leg.departTime)}
                        {leg.arriveTime != null && (
                          <span style={{ color: "var(--mxj-muted)", fontWeight: 400 }}>–{formatEpochTime(leg.arriveTime)}</span>
                        )}
                      </span>
                    ) : (
                      <span>{leg.minutes}m</span>
                    )}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Add Pin panel ──────────────────────────────────────────────
function AddPinPanel({
  tripId,
  days,
  onAdd,
  onClose,
  initialValues,
}: {
  tripId: string;
  days: number[];
  onAdd: (loc: TripLocation) => void;
  onClose: () => void;
  initialValues?: { name: string; lat: string; lng: string; category: LocationCategory };
}) {
  const [name, setName]       = useState(initialValues?.name ?? "");
  const [lat, setLat]         = useState(initialValues?.lat  ?? "");
  const [lng, setLng]         = useState(initialValues?.lng  ?? "");
  const [day, setDay]         = useState(days[0] ?? 1);
  const [cat, setCat]         = useState<LocationCategory>(initialValues?.category ?? "attraction");
  const [desc, setDesc]       = useState("");
  const [arrival, setArrival] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [coordConfirm, setCoordConfirm] = useState(!!(initialValues?.lat));
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!inputRef.current || typeof google === "undefined") return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, { fields: ["geometry", "name"] });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.geometry?.location) {
        const la = place.geometry.location.lat();
        const lo = place.geometry.location.lng();
        setLat(la.toFixed(6));
        setLng(lo.toFixed(6));
        if (place.name) setName(place.name);
        setCoordConfirm(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const la = parseFloat(lat), lo = parseFloat(lng);
    if (!name.trim() || isNaN(la) || isNaN(lo)) {
      setError("Name and valid coordinates are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const loc = await addLocation({
        trip_id: tripId, name: name.trim(), latitude: la, longitude: lo,
        day_number: day, category: cat,
        description: desc || undefined,
        arrival_time: arrival || undefined,
        duration_minutes: duration ? parseInt(duration) : undefined,
        transport_mode: "walk", media_url: undefined,
      });
      if (loc) { onAdd(loc); onClose(); }
    } catch {
      setError("Failed to add location.");
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mxj-section-label">Add stop</span>
        <button onClick={onClose} style={{ background: "none", border: "1px solid var(--mxj-stroke-strong)", cursor: "pointer", color: "var(--mxj-muted)", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div className="mxj-label">Search or enter name</div>
          <input ref={inputRef} className="mxj-input" placeholder="e.g. Torre de Belém" value={name} onChange={e => { setName(e.target.value); setCoordConfirm(false); }} required />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div className="mxj-label">Latitude</div>
            <input className="mxj-input" placeholder="38.6916" value={lat} onChange={e => setLat(e.target.value)} />
          </div>
          <div>
            <div className="mxj-label">Longitude</div>
            <input className="mxj-input" placeholder="-9.2160" value={lng} onChange={e => setLng(e.target.value)} />
          </div>
        </div>

        {coordConfirm && (
          <p className="mxj-mono" style={{ color: "var(--mxj-success)", fontSize: 9, margin: 0 }}>
            ✓ Coordinates set from map search
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div className="mxj-label">Day</div>
            <select className="mxj-select" value={day} onChange={e => setDay(parseInt(e.target.value))}>
              {days.map(d => <option key={d} value={d}>Day {d}</option>)}
              <option value={Math.max(...days, 0) + 1}>Day {Math.max(...days, 0) + 1} (new)</option>
            </select>
          </div>
          <div>
            <div className="mxj-label">Category</div>
            <select className="mxj-select" value={cat} onChange={e => setCat(e.target.value as LocationCategory)}>
              {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div className="mxj-label">Arrival time</div>
            <input className="mxj-input" type="time" value={arrival} onChange={e => setArrival(e.target.value)} />
          </div>
          <div>
            <div className="mxj-label">Duration (min)</div>
            <input className="mxj-input" type="number" min="0" placeholder="60" value={duration} onChange={e => setDuration(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="mxj-label">Notes</div>
          <textarea className="mxj-input" rows={2} placeholder="Any notes about this stop…" value={desc} onChange={e => setDesc(e.target.value)} style={{ resize: "none" }} />
        </div>

        {error && <p className="mxj-mono" style={{ color: "var(--mxj-red)", fontSize: 9, margin: 0 }}>{error}</p>}

        <button type="submit" disabled={saving} className="mxj-btn mxj-btn-primary" style={{ justifyContent: "center", padding: "12px 0" }}>
          {saving ? "Adding…" : "Add to route"}
        </button>
      </form>
    </div>
  );
}

// ── Main planner ───────────────────────────────────────────────
export default function TripPlanner({ trip }: { trip: Trip }) {
  const mapRef       = useRef<Map3DHandle>(null);
  const noteTimers   = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const [locations, setLocations]         = useState<TripLocation[]>([]);
  const [dayNotes, setDayNotes]           = useState<DayNote[]>([]);
  const [reservations, setReservations]   = useState<Reservation[]>([]);

  // Real travel time cache: `${fromId}:${toId}` → minutes
  const [travelTimes, setTravelTimes]       = useState<Record<string, number>>({});
  // Transit leg details cache: `${fromId}:${toId}` → legs (transit mode only)
  const [transitDetails, setTransitDetails] = useState<Record<string, TransitLeg[]>>({});

  const [selectedLocation, setSelectedLocation] = useState<TripLocation | null>(null);
  const [streetViewLoc, setStreetViewLoc]       = useState<TripLocation | null>(null);
  const [activeTab, setActiveTab]               = useState<ActiveTab>("map");
  const [showSidebar, setShowSidebar]           = useState(true);
  const [showAddPin, setShowAddPin]             = useState(false);
  const [activeDay, setActiveDay]               = useState<number | null>(null);
  const [copied, setCopied]                     = useState(false);
  const [showDeleteMenu, setShowDeleteMenu]     = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<ConciergeSuggestion | null>(null);
  const [extraDays, setExtraDays]               = useState<number[]>([]);

  // Data load — allSettled so one missing table never blocks the rest
  useEffect(() => {
    Promise.allSettled([
      getLocationsByTrip(trip.id),
      getDayNotes(trip.id),
      getReservations(trip.id),
    ]).then(([locsR, notesR, resR]) => {
      const locs  = locsR.status  === "fulfilled" ? locsR.value  : [];
      const notes = notesR.status === "fulfilled" ? notesR.value : [];
      const res   = resR.status   === "fulfilled" ? resR.value   : [];
      setLocations(locs);
      setDayNotes(notes);
      setReservations(res);
      if (locs.length) setActiveDay(locs[0].day_number);
    });
  }, [trip.id]);

  // Fetch real travel times for all consecutive pairs
  useEffect(() => {
    const days = [...new Set(locations.map(l => l.day_number))];
    days.forEach(d => {
      const dayLocs = locations
        .filter(l => l.day_number === d)
        .sort((a, b) => a.order_index - b.order_index);
      for (let i = 0; i < dayLocs.length - 1; i++) {
        const from = dayLocs[i];
        const to   = dayLocs[i + 1];
        const mode = (from.transport_mode as TransportMode | null) ?? "walk";
        const key  = `${from.id}:${to.id}`;
        // Only fetch if not already cached for this mode
        const cacheKey = `${key}:${mode}`;
        if ((window as unknown as Record<string, boolean>)[`rt_${cacheKey}`]) continue;
        (window as unknown as Record<string, boolean>)[`rt_${cacheKey}`] = true;
        // Compute departure context for realistic schedule lookup
        const departDate = getLegDepartDate(trip.start_date, from.day_number);
        const departTime = getStopDepartTime(from);

        fetchRouteInfo(from, to, mode, departDate, departTime).then(info => {
          if (info != null) {
            setTravelTimes(prev => ({ ...prev, [key]: info.minutes }));
            if (info.legs) {
              setTransitDetails(prev => ({ ...prev, [key]: info.legs! }));
            }
          }
        });
      }
    });
  // trip.start_date included so schedule dates are recomputed if the trip header is edited
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, trip.start_date]);

  const days        = [...new Set(locations.map(l => l.day_number))].sort((a, b) => a - b);
  const displayDays = [...new Set([...(days.length ? days : [1]), ...extraDays])].sort((a, b) => a - b);
  const filteredLocs = activeDay !== null ? locations.filter(l => l.day_number === activeDay) : locations;

  // Update a location in local state and invalidate cached travel times for its legs
  function handleUpdateLoc(id: string, updates: Partial<TripLocation>) {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    // If transport_mode changed, clear cached travel times for legs involving this stop
    if (updates.transport_mode != null) {
      setTravelTimes(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          const [fromId] = k.split(":");
          if (fromId === id) delete next[k];
        });
        // Also clear window cache flag so it re-fetches
        Object.keys(window).forEach(k => {
          if (k.startsWith(`rt_${id}:`)) delete (window as unknown as Record<string, unknown>)[k];
        });
        return next;
      });
      setTransitDetails(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          const [fromId] = k.split(":");
          if (fromId === id) delete next[k];
        });
        return next;
      });
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function handleMarkerClick(loc: TripLocation) {
    setSelectedLocation(loc);
    setActiveDay(loc.day_number);
    mapRef.current?.flyCameraTo({
      center: { lat: loc.latitude, lng: loc.longitude, altitude: 300 },
      tilt: 60, heading: 0, range: 600,
    }, 1200);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const dayLocs   = filteredLocs;
    const oldIdx    = dayLocs.findIndex(l => l.id === active.id);
    const newIdx    = dayLocs.findIndex(l => l.id === over.id);
    const reordered = arrayMove(dayLocs, oldIdx, newIdx).map((l, i) => ({ ...l, order_index: i }));
    setLocations(prev => {
      const others = prev.filter(l => l.day_number !== activeDay);
      return [...others, ...reordered].sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index);
    });
    reorderLocations(reordered.map(l => ({ id: l.id, day_number: l.day_number, order_index: l.order_index }))).catch(console.error);
  }

  function handleAddSuggestion(s: ConciergeSuggestion) {
    setPendingSuggestion(s);
    setShowAddPin(true);
    setActiveTab("map");
    setShowSidebar(true);
  }

  async function handleDeleteLocation(id: string) {
    try {
      await deleteLocation(id);
    } catch {
      return; // DB delete failed — leave UI unchanged
    }
    setLocations(prev => prev.filter(l => l.id !== id));
    if (selectedLocation?.id === id) setSelectedLocation(null);
  }

  function handleDayNoteChange(dayNum: number, noteContent: string) {
    setDayNotes(prev => {
      const idx = prev.findIndex(n => n.day_number === dayNum);
      if (idx >= 0) return prev.map(n => n.day_number === dayNum ? { ...n, content: noteContent } : n);
      return [...prev, { id: "", trip_id: trip.id, day_number: dayNum, content: noteContent, updated_at: "" }];
    });
    clearTimeout(noteTimers.current[dayNum]);
    noteTimers.current[dayNum] = setTimeout(() => {
      upsertDayNote(trip.id, dayNum, noteContent).catch(console.error);
    }, 600);
  }

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const TAB_LABELS: Record<ActiveTab, string> = {
    map: "Route", reservations: "Bookings", concierge: "Concierge",
  };

  // ── Itinerary list ──
  const sortedFilteredLocs = [...filteredLocs].sort((a, b) => a.order_index - b.order_index);
  const dayTimeline = computeDayTimeline(sortedFilteredLocs, travelTimes);

  const itineraryList = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedFilteredLocs.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto" }}>
          {sortedFilteredLocs.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <p className="mxj-mono" style={{ color: "var(--mxj-faint)" }}>No stops on this day.</p>
              <button onClick={() => setShowAddPin(true)} className="mxj-btn mxj-btn-ghost" style={{ marginTop: 12, padding: "9px 16px", fontSize: 12 }}>
                Add first stop
              </button>
            </div>
          ) : (
            sortedFilteredLocs.map((loc, i) => (
              <SortableStop
                key={loc.id}
                loc={loc}
                next={sortedFilteredLocs[i + 1] ?? null}
                timing={dayTimeline[i] ?? null}
                isSelected={selectedLocation?.id === loc.id}
                onClick={() => handleMarkerClick(loc)}
                onUpdateLoc={handleUpdateLoc}
                transitLegs={(() => {
                  const nextLoc = sortedFilteredLocs[i + 1];
                  return nextLoc ? transitDetails[`${loc.id}:${nextLoc.id}`] : undefined;
                })()}
              />
            ))
          )}
        </div>
      </SortableContext>
    </DndContext>
  );

  // ── Day tabs ──
  const dayTabs = (
    <div className="scrollbar-thin" style={{ display: "flex", gap: 0, overflowX: "auto", flexShrink: 0 }}>
      {displayDays.map(d => (
        <button
          key={d}
          onClick={() => setActiveDay(d)}
          style={{
            padding: "8px 14px",
            background: "none",
            border: "none",
            borderBottom: activeDay === d ? "2px solid var(--mxj-red)" : "2px solid transparent",
            color: activeDay === d ? "var(--mxj-ink)" : "var(--mxj-muted)",
            cursor: "pointer",
            fontFamily: "var(--mxj-mono)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Day {d}
        </button>
      ))}
      <button
        onClick={() => {
          const next = Math.max(...displayDays, 0) + 1;
          setExtraDays(p => [...p, next]);
          setActiveDay(next);
        }}
        style={{
          padding: "8px 12px",
          background: "none",
          border: "none",
          borderBottom: "2px solid transparent",
          color: "var(--mxj-faint)",
          cursor: "pointer",
          fontFamily: "var(--mxj-mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        + Day
      </button>
    </div>
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "var(--mxj-base)" }}>

      {/* ── Map — fills entire viewport ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <Map3D
          ref={mapRef}
          apiKey={apiKey}
          locations={locations}
          onMarkerClick={handleMarkerClick}
          destination={trip.destination}
        />
      </div>

      {/* ── Street view overlay ── */}
      {streetViewLoc && (
        <StreetViewPortal location={streetViewLoc} onClose={() => setStreetViewLoc(null)} />
      )}

      {/* ── Top bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
        height: 48,
        background: "var(--mxj-surface)",
        borderBottom: "1px solid var(--mxj-ink)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
      }}>
        <button
          onClick={() => setShowSidebar(p => !p)}
          style={{ background: "none", border: "1px solid var(--mxj-stroke-strong)", cursor: "pointer", color: "var(--mxj-muted)", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          aria-label={showSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
            <rect x="0" y="0"    width="12" height="1.5" />
            <rect x="0" y="4.25" width="12" height="1.5" />
            <rect x="0" y="8.5"  width="12" height="1.5" />
          </svg>
        </button>

        <Logo size={14} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="mxj-mono" style={{ fontSize: 10, color: "var(--mxj-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
            {trip.name.toUpperCase()}{trip.destination ? ` · ${trip.destination}` : ""}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, position: "relative" }}>
          <button onClick={copyShareLink} className="mxj-btn mxj-btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
              <rect x="2" y="5" width="9" height="9" /><path d="M5 5V3h8v8h-2" />
            </svg>
            {copied ? "Copied!" : "Share"}
          </button>
          <button
            onClick={() => { setShowAddPin(true); setShowSidebar(true); setActiveTab("map"); }}
            className="mxj-btn mxj-btn-primary"
            style={{ padding: "6px 14px", fontSize: 11 }}
          >
            + Add stop
          </button>
          {/* ⋯ overflow menu */}
          <button
            onClick={() => setShowDeleteMenu(p => !p)}
            className="mxj-btn mxj-btn-ghost"
            style={{ padding: "6px 10px", fontSize: 14, lineHeight: 1 }}
            title="More options"
          >
            ···
          </button>
          {showDeleteMenu && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              background: "var(--mxj-surface)", border: "1px solid var(--mxj-ink)",
              padding: "12px 16px", zIndex: 30, minWidth: 180,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <DeleteTripButton tripId={trip.id} />
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <div
        className="mxj-desktop"
        style={{
          position: "absolute",
          top: 48, bottom: 0, left: 0,
          width: 360,
          zIndex: 4,
          flexDirection: "column",
          transform: showSidebar ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
          background: "var(--mxj-surface)",
          borderRight: "1px solid var(--mxj-ink)",
        }}
      >
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--mxj-stroke)", flexShrink: 0, overflowX: "auto" }}>
          {(Object.keys(TAB_LABELS) as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "11px 0",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--mxj-red)" : "2px solid transparent",
                color: activeTab === tab ? "var(--mxj-ink)" : "var(--mxj-muted)",
                cursor: "pointer",
                fontFamily: "var(--mxj-mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                marginBottom: -1,
                flexShrink: 0,
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "map" ? (
          <>
            {showAddPin ? (
              <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto" }}>
                <AddPinPanel
                  tripId={trip.id}
                  days={displayDays}
                  onAdd={loc => { setLocations(p => [...p, loc]); setSelectedLocation(loc); }}
                  onClose={() => { setShowAddPin(false); setPendingSuggestion(null); }}
                  initialValues={pendingSuggestion ? { name: pendingSuggestion.name, lat: String(pendingSuggestion.latitude), lng: String(pendingSuggestion.longitude), category: pendingSuggestion.category } : undefined}
                />
              </div>
            ) : (
              <>
                <div style={{ borderBottom: "1px solid var(--mxj-stroke)", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>{dayTabs}</div>
                  <button
                    onClick={() => setShowAddPin(true)}
                    className="mxj-mono"
                    style={{ background: "none", border: "none", borderLeft: "1px solid var(--mxj-stroke)", cursor: "pointer", padding: "0 14px", height: "100%", color: "var(--mxj-muted)", fontSize: 11, flexShrink: 0 }}
                    title="Add stop"
                  >
                    +
                  </button>
                </div>
                {itineraryList}
                {activeDay !== null && !showAddPin && (
                  <div style={{ borderTop: "1px solid var(--mxj-stroke)", padding: "10px 20px", flexShrink: 0 }}>
                    <div className="mxj-label" style={{ marginBottom: 4 }}>Day note</div>
                    <textarea
                      className="mxj-input"
                      rows={2}
                      placeholder="Notes for this day..."
                      value={dayNotes.find(n => n.day_number === activeDay)?.content ?? ""}
                      onChange={e => handleDayNoteChange(activeDay, e.target.value)}
                      style={{ resize: "none", fontSize: 12, width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                )}
              </>
            )}
          </>
        ) : activeTab === "reservations" ? (
          <ReservationsPanel
            tripId={trip.id}
            reservations={reservations}
            onAdd={r => setReservations(p => [...p, r])}
            onUpdate={(id, u) => setReservations(p => p.map(r => r.id === id ? { ...r, ...u } : r))}
            onDelete={id => setReservations(p => p.filter(r => r.id !== id))}
          />
        ) : (
          <TravelConcierge
            tripId={trip.id}
            destination={trip.destination}
            locations={locations}
            onAddSuggestion={handleAddSuggestion}
          />
        )}
      </div>

      {/* ── Info card ── */}
      {selectedLocation && !streetViewLoc && (
        <InfoCard
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onStreetView={loc => setStreetViewLoc(loc)}
          onDelete={handleDeleteLocation}
        />
      )}

      {/* ── Mobile bottom nav ── */}
      <nav
        className="mxj-mobile"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 15,
          background: "var(--mxj-surface)",
          borderTop: "1px solid var(--mxj-ink)",
          display: "flex",
        }}
      >
        {(Object.keys(TAB_LABELS) as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setShowSidebar(true); }}
            style={{
              flex: 1,
              padding: "12px 0",
              background: "none",
              border: "none",
              borderTop: activeTab === tab && showSidebar ? "2px solid var(--mxj-red)" : "2px solid transparent",
              color: activeTab === tab && showSidebar ? "var(--mxj-ink)" : "var(--mxj-muted)",
              cursor: "pointer",
              fontFamily: "var(--mxj-mono)",
              fontSize: 8,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {/* ── Mobile sidebar sheet ── */}
      {showSidebar && (
        <div
          className="mxj-mobile"
          style={{
            position: "fixed",
            bottom: 48, left: 0, right: 0,
            height: "55vh",
            zIndex: 14,
            background: "var(--mxj-surface)",
            borderTop: "1px solid var(--mxj-ink)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 36, height: 3, background: "var(--mxj-stroke-strong)" }} />
          </div>

          {activeTab === "map" ? (
            showAddPin ? (
              <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto" }}>
                <AddPinPanel
                  tripId={trip.id}
                  days={displayDays}
                  onAdd={loc => { setLocations(p => [...p, loc]); setSelectedLocation(loc); }}
                  onClose={() => { setShowAddPin(false); setPendingSuggestion(null); }}
                  initialValues={pendingSuggestion ? { name: pendingSuggestion.name, lat: String(pendingSuggestion.latitude), lng: String(pendingSuggestion.longitude), category: pendingSuggestion.category } : undefined}
                />
              </div>
            ) : (
              <>
                <div style={{ borderBottom: "1px solid var(--mxj-stroke)", flexShrink: 0 }}>{dayTabs}</div>
                {itineraryList}
                {activeDay !== null && !showAddPin && (
                  <div style={{ borderTop: "1px solid var(--mxj-stroke)", padding: "10px 20px", flexShrink: 0 }}>
                    <div className="mxj-label" style={{ marginBottom: 4 }}>Day note</div>
                    <textarea
                      className="mxj-input"
                      rows={2}
                      placeholder="Notes for this day..."
                      value={dayNotes.find(n => n.day_number === activeDay)?.content ?? ""}
                      onChange={e => handleDayNoteChange(activeDay, e.target.value)}
                      style={{ resize: "none", fontSize: 12, width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                )}
              </>
            )
          ) : activeTab === "reservations" ? (
            <ReservationsPanel
              tripId={trip.id}
              reservations={reservations}
              onAdd={r => setReservations(p => [...p, r])}
              onUpdate={(id, u) => setReservations(p => p.map(r => r.id === id ? { ...r, ...u } : r))}
              onDelete={id => setReservations(p => p.filter(r => r.id !== id))}
            />
          ) : (
            <TravelConcierge
              tripId={trip.id}
              destination={trip.destination}
              locations={locations}
              onAddSuggestion={handleAddSuggestion}
            />
          )}
        </div>
      )}
    </div>
  );
}
