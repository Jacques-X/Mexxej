"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Trip, TripLocation, DayNote, Reservation, BudgetItem, PackingItem, LocationCategory, ConciergeSuggestion } from "@/types/trip";
import {
  getLocationsByTrip, addLocation, deleteLocation, reorderLocations,
  getDayNotes, upsertDayNote, uploadMedia,
  getReservations, addReservation, updateReservation, deleteReservation,
  getBudgetItems, addBudgetItem, deleteBudgetItem,
  getPackingItems, addPackingItem, updatePackingItem, deletePackingItem,
} from "@/lib/supabase";

import Map3D, { type Map3DHandle } from "./Map3D";
import InfoCard from "./InfoCard";
import StreetViewPortal from "./StreetViewPortal";
import BudgetPanel from "./BudgetPanel";
import ReservationsPanel from "./ReservationsPanel";
import PackingPanel from "./PackingPanel";
import TravelConcierge from "./TravelConcierge";
import Logo from "./Logo";

// ── Types ──────────────────────────────────────────────────────
type ActiveTab = "map" | "reservations" | "budget" | "packing" | "concierge";

const CAT_OPTIONS: { value: LocationCategory; label: string }[] = [
  { value: "hotel",      label: "Hotel"       },
  { value: "restaurant", label: "Restaurant"  },
  { value: "attraction", label: "Attraction"  },
  { value: "transport",  label: "Transport"   },
  { value: "other",      label: "Other"       },
];

// ── Sortable stop row ──────────────────────────────────────────
function SortableStop({
  loc, isSelected, onClick,
}: {
  loc: TripLocation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: loc.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 20px",
        background: isSelected ? "var(--mxj-surface-2)" : "transparent",
        borderBottom: "1px solid var(--mxj-stroke)",
        cursor: "pointer",
        borderLeft: isSelected ? "2px solid var(--mxj-red)" : "2px solid transparent",
      }}
      onClick={onClick}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", color: "var(--mxj-faint)", flexShrink: 0, display: "flex", alignItems: "center" }}
        onClick={e => e.stopPropagation()}
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <rect x="0" y="0"  width="3" height="3" rx="0" />
          <rect x="7" y="0"  width="3" height="3" rx="0" />
          <rect x="0" y="5.5" width="3" height="3" rx="0" />
          <rect x="7" y="5.5" width="3" height="3" rx="0" />
          <rect x="0" y="11" width="3" height="3" rx="0" />
          <rect x="7" y="11" width="3" height="3" rx="0" />
        </svg>
      </span>

      {/* Crosshair marker */}
      <div className={`mxj-stop-marker${isSelected ? "" : " inactive"}`} />

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--mxj-ink)" }}>
          {loc.name}
        </div>
        {loc.arrival_time && (
          <div className="mxj-mono" style={{ color: "var(--mxj-muted)", fontSize: 9, marginTop: 2 }}>
            {loc.arrival_time}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Pin panel ──────────────────────────────────────────────
function AddPinPanel({
  tripId,
  days,
  onAdd,
  onClose,
}: {
  tripId: string;
  days: number[];
  onAdd: (loc: TripLocation) => void;
  onClose: () => void;
}) {
  const [name, setName]       = useState("");
  const [lat, setLat]         = useState("");
  const [lng, setLng]         = useState("");
  const [day, setDay]         = useState(days[0] ?? 1);
  const [cat, setCat]         = useState<LocationCategory>("attraction");
  const [desc, setDesc]       = useState("");
  const [arrival, setArrival] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [coordConfirm, setCoordConfirm] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Google Places autocomplete
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
        transport_mode: undefined, media_url: undefined,
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
  const mapRef            = useRef<Map3DHandle>(null);
  const apiKey            = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const [locations, setLocations]         = useState<TripLocation[]>([]);
  const [dayNotes, setDayNotes]           = useState<DayNote[]>([]);
  const [reservations, setReservations]   = useState<Reservation[]>([]);
  const [budgetItems, setBudgetItems]     = useState<BudgetItem[]>([]);
  const [packingItems, setPackingItems]   = useState<PackingItem[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<TripLocation | null>(null);
  const [streetViewLoc, setStreetViewLoc]       = useState<TripLocation | null>(null);
  const [activeTab, setActiveTab]               = useState<ActiveTab>("map");
  const [showSidebar, setShowSidebar]           = useState(true);
  const [showAddPin, setShowAddPin]             = useState(false);
  const [activeDay, setActiveDay]               = useState<number | null>(null);
  const [copied, setCopied]                     = useState(false);

  // Data load
  useEffect(() => {
    Promise.all([
      getLocationsByTrip(trip.id),
      getDayNotes(trip.id),
      getReservations(trip.id),
      getBudgetItems(trip.id),
      getPackingItems(trip.id),
    ]).then(([locs, notes, res, budget, packing]) => {
      setLocations(locs);
      setDayNotes(notes);
      setReservations(res);
      setBudgetItems(budget);
      setPackingItems(packing);
      if (locs.length) setActiveDay(locs[0].day_number);
    });
  }, [trip.id]);

  const days        = [...new Set(locations.map(l => l.day_number))].sort((a, b) => a - b);
  const displayDays = days.length ? days : [1];
  const filteredLocs = activeDay !== null ? locations.filter(l => l.day_number === activeDay) : locations;

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
    reorderLocations(reordered.map(l => ({ id: l.id, day_number: l.day_number, order_index: l.order_index })));
  }

  function handleAddSuggestion(s: ConciergeSuggestion) {
    setShowAddPin(true);
    setActiveTab("map");
  }

  async function handleDeleteLocation(id: string) {
    await deleteLocation(id);
    setLocations(prev => prev.filter(l => l.id !== id));
    if (selectedLocation?.id === id) setSelectedLocation(null);
  }

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const TAB_LABELS: Record<ActiveTab, string> = {
    map: "Route", reservations: "Bookings", budget: "Budget", packing: "Packing", concierge: "Concierge",
  };

  // ── Itinerary list ──
  const itineraryList = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={filteredLocs.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto" }}>
          {filteredLocs.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <p className="mxj-mono" style={{ color: "var(--mxj-faint)" }}>No stops on this day.</p>
              <button onClick={() => setShowAddPin(true)} className="mxj-btn mxj-btn-ghost" style={{ marginTop: 12, padding: "9px 16px", fontSize: 12 }}>
                Add first stop
              </button>
            </div>
          ) : (
            filteredLocs.map(loc => (
              <SortableStop
                key={loc.id}
                loc={loc}
                isSelected={selectedLocation?.id === loc.id}
                onClick={() => handleMarkerClick(loc)}
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
    </div>
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "var(--mxj-base)" }}>

      {/* ── Map ── */}
      <Map3D
        ref={mapRef}
        apiKey={apiKey}
        locations={locations}
        onMarkerClick={handleMarkerClick}
        destination={trip.destination}
      />

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
        {/* Sidebar toggle */}
        <button
          onClick={() => setShowSidebar(p => !p)}
          style={{ background: "none", border: "1px solid var(--mxj-stroke-strong)", cursor: "pointer", color: "var(--mxj-muted)", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          aria-label={showSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
            <rect x="0" y="0"  width="12" height="1.5" />
            <rect x="0" y="4.25" width="12" height="1.5" />
            <rect x="0" y="8.5" width="12" height="1.5" />
          </svg>
        </button>

        <Logo size={14} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="mxj-mono" style={{ fontSize: 10, color: "var(--mxj-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
            {trip.name.toUpperCase()}{trip.destination ? ` · ${trip.destination}` : ""}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={copyShareLink}
            className="mxj-btn mxj-btn-ghost"
            style={{ padding: "6px 12px", fontSize: 11 }}
          >
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
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <div
        className="hidden md:flex"
        style={{
          position: "absolute",
          top: 48,
          bottom: 0,
          left: 0,
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
                  onClose={() => setShowAddPin(false)}
                />
              </div>
            ) : (
              <>
                {/* Day tabs + add */}
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
        ) : activeTab === "budget" ? (
          <BudgetPanel tripId={trip.id} items={budgetItems} onUpdate={setBudgetItems} />
        ) : activeTab === "packing" ? (
          <PackingPanel tripId={trip.id} items={packingItems} onUpdate={setPackingItems} />
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
        className="md:hidden"
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
          className="md:hidden"
          style={{
            position: "fixed",
            bottom: 48,
            left: 0,
            right: 0,
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
                  onClose={() => setShowAddPin(false)}
                />
              </div>
            ) : (
              <>
                <div style={{ borderBottom: "1px solid var(--mxj-stroke)", flexShrink: 0 }}>{dayTabs}</div>
                {itineraryList}
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
          ) : activeTab === "budget" ? (
            <BudgetPanel tripId={trip.id} items={budgetItems} onUpdate={setBudgetItems} />
          ) : activeTab === "packing" ? (
            <PackingPanel tripId={trip.id} items={packingItems} onUpdate={setPackingItems} />
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
