"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  supabase, addLocation, deleteLocation, updateLocation, reorderLocations, upsertDayNote,
  addReservation, updateReservation, deleteReservation,
  addBudgetItem, deleteBudgetItem,
  addPackingItem, updatePackingItem, deletePackingItem,
} from "@/lib/supabase";
import type {
  Trip, TripLocation, DayNote, LocationCategory, CameraPosition,
  Reservation, BudgetItem, PackingItem,
} from "@/types/trip";
import ReservationsPanel from "./ReservationsPanel";
import BudgetPanel from "./BudgetPanel";
import PackingPanel from "./PackingPanel";
import Map3D, { type Map3DHandle } from "./Map3D";
import InfoCard from "./InfoCard";
import StreetViewPortal from "./StreetViewPortal";
import TravelConcierge from "./TravelConcierge";
import Logo from "./Logo";
import { computeDayTimeline, formatMinutes, type StopTiming } from "@/lib/timeline";

type ActiveTab = "map" | "reservations" | "budget" | "packing";

interface Props {
  trip: Trip;
  initialLocations: TripLocation[];
  initialDayNotes: DayNote[];
  initialReservations: Reservation[];
  initialBudgetItems: BudgetItem[];
  initialPackingItems: PackingItem[];
  mapsApiKey: string;
}

const DAY_PALETTES = ["#e88c64", "#d8a478", "#88a8c0", "#c8b894", "#9aa4b0"];

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CATEGORY_META: Record<LocationCategory, { label: string; glyph: string; color: string }> = {
  hotel:       { label: "Hotel",       glyph: "◑", color: "#d8a478" },
  restaurant:  { label: "Restaurant",  glyph: "◆", color: "#e88c64" },
  attraction:  { label: "Attraction",  glyph: "★", color: "#c8b894" },
  transport:   { label: "Transport",   glyph: "→", color: "#88a8c0" },
  other:       { label: "Other",       glyph: "·", color: "#9aa4b0" },
};

const CATEGORY_OPTIONS: LocationCategory[] = [
  "hotel", "restaurant", "attraction", "transport", "other",
];

// Inline SVG icons matching the design system
const Ico = {
  back:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3l-5 5 5 5"/></svg>,
  share:   <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M5 5l3-3 3 3M3 10v3a1 1 0 001 1h8a1 1 0 001-1v-3"/></svg>,
  plus:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>,
  route:   <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="3" cy="3" r="1.5"/><circle cx="13" cy="13" r="1.5"/><path d="M3 5v3a3 3 0 003 3h4a3 3 0 003-3"/></svg>,
  sparkle: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M8 1.5L9 6l4.5 1L9 8l-1 4.5L7 8 2.5 7 7 6z"/></svg>,
  film:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M6 3v10M10 3v10M2 8h12"/></svg>,
  trash:   <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4M7 7v3M9 7v3"/></svg>,
  close:   <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>,
  pin:     <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 14s5-4.5 5-9a5 5 0 10-10 0c0 4.5 5 9 5 9z"/><circle cx="8" cy="5.5" r="1.6"/></svg>,
};

export default function TripPlanner({
  trip, initialLocations, initialDayNotes,
  initialReservations, initialBudgetItems, initialPackingItems,
  mapsApiKey,
}: Props) {
  const mapRef = useRef<Map3DHandle>(null);

  const [locations, setLocations] = useState<TripLocation[]>(initialLocations);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dayNotes, setDayNotes] = useState<Record<number, string>>(
    () => Object.fromEntries(initialDayNotes.map((n) => [n.day_number, n.content]))
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>("map");
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(initialBudgetItems);
  const [packingItems, setPackingItems] = useState<PackingItem[]>(initialPackingItems);
  const [activeLocation, setActiveLocation] = useState<TripLocation | null>(null);
  const [streetViewLocation, setStreetViewLocation] = useState<TripLocation | null>(null);
  const [showConcierge, setShowConcierge] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);
  const [routeVisible, setRouteVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<number | "all">("all");
  const [addForm, setAddForm] = useState({
    name: "", latitude: "", longitude: "",
    day_number: "1", category: "attraction" as LocationCategory,
    description: "", media_url: "",
  });

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setShowItinerary(true);
    }
  }, []);

  // Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "trip_locations", filter: `trip_id=eq.${trip.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLocations((prev) => [...prev, payload.new as TripLocation].sort(
              (a, b) => a.day_number - b.day_number || a.order_index - b.order_index
            ));
          } else if (payload.eventType === "DELETE") {
            setLocations((prev) => prev.filter((l) => l.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setLocations((prev) =>
              prev.map((l) => l.id === (payload.new as TripLocation).id ? payload.new as TripLocation : l)
            );
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trip.id]);

  const flyTo = useCallback((loc: TripLocation, tilt = 65, range = 800) => {
    const pos: CameraPosition = {
      center: { lat: loc.latitude, lng: loc.longitude, altitude: 100 },
      tilt, heading: 0, range,
    };
    mapRef.current?.flyCameraTo(pos, 3000);
  }, []);

  const handleMarkerClick = useCallback((loc: TripLocation) => {
    setActiveLocation(loc);
    setShowItinerary(false);
    flyTo(loc);
  }, [flyTo]);

  // ── Drag-and-drop sensors ─────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine if overId is a day-droppable (prefixed "day-") or a location id
    const overIsDay = overId.startsWith("day-");
    const targetDay = overIsDay
      ? parseInt(overId.replace("day-", ""), 10)
      : (locations.find((l) => l.id === overId)?.day_number ?? null);

    if (targetDay === null) return;

    const activeLoc = locations.find((l) => l.id === activeId);
    if (!activeLoc) return;

    let newLocations = [...locations];

    if (activeLoc.day_number !== targetDay) {
      // Cross-day move: change day_number, append at end of target day
      const targetDayLocs = newLocations.filter((l) => l.id !== activeId && l.day_number === targetDay);
      const newOrderIndex = targetDayLocs.length;
      newLocations = newLocations.map((l) =>
        l.id === activeId ? { ...l, day_number: targetDay, order_index: newOrderIndex } : l
      );
    } else {
      // Same-day reorder
      const dayLocs = newLocations.filter((l) => l.day_number === activeLoc.day_number);
      const oldIdx = dayLocs.findIndex((l) => l.id === activeId);
      const newIdx = dayLocs.findIndex((l) => l.id === overId);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = [...dayLocs];
      reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, activeLoc);
      const withNewIndexes = reordered.map((l, i) => ({ ...l, order_index: i }));

      newLocations = newLocations.map((l) => {
        const updated = withNewIndexes.find((u) => u.id === l.id);
        return updated ?? l;
      });
    }

    setLocations(newLocations.sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index));

    try {
      await reorderLocations(
        newLocations.map((l) => ({ id: l.id, day_number: l.day_number, order_index: l.order_index }))
      );
    } catch {
      // Rollback on failure
      setLocations(locations);
    }
  }, [locations]);

  const handleAddLocation = async () => {
    if (isAdding) return;

    const lat = parseFloat(addForm.latitude);
    const lng = parseFloat(addForm.longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setAddError("Invalid coordinates. Please search for a place again.");
      setTimeout(() => setAddError(null), 3000);
      return;
    }

    const nearby = locations.find((l) => distanceMeters(lat, lng, l.latitude, l.longitude) < 50);
    if (nearby) {
      setAddError(`"${nearby.name}" is already at this location.`);
      setTimeout(() => setAddError(null), 3000);
      return;
    }

    setIsAdding(true);
    try {
      const newLoc = await addLocation({
        trip_id: trip.id,
        name: addForm.name,
        latitude: lat,
        longitude: lng,
        day_number: parseInt(addForm.day_number),
        category: addForm.category,
        description: addForm.description || undefined,
        media_url: addForm.media_url || undefined,
      });
      if (newLoc) {
        setShowAddPanel(false);
        setAddForm({ name: "", latitude: "", longitude: "", day_number: "1", category: "attraction", description: "", media_url: "" });
        flyTo(newLoc);
      }
    } catch (err) {
      setAddError("Failed to add location. Please try again.");
      setTimeout(() => setAddError(null), 3000);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    const locationToDelete = locations.find((l) => l.id === id);
    try {
      await deleteLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
      if (activeLocation?.id === id) setActiveLocation(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError(`Failed to delete ${locationToDelete?.name || "location"}`);
      setTimeout(() => setDeleteError(null), 3000);
    }
  };

  const toggleRoute = async () => {
    if (routeVisible) {
      mapRef.current?.clearRoute();
      setRouteVisible(false);
    } else {
      await mapRef.current?.drawRoute(locations);
      setRouteVisible(true);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: trip.name, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const mapCenter = locations.length
    ? { lat: locations[0].latitude, lng: locations[0].longitude }
    : undefined;

  const byDay = locations.reduce<Record<number, TripLocation[]>>((acc, l) => {
    (acc[l.day_number] ??= []).push(l);
    return acc;
  }, {});
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);

  const filteredDays = dayFilter === "all" ? days : days.filter((d) => d === dayFilter);

  const stopCount = locations.length;
  const dayCount = days.length;

  // Shared itinerary list
  const activeDragLoc = activeDragId ? locations.find((l) => l.id === activeDragId) : null;

  const itineraryList = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
    <div className="overflow-y-auto scroll-touch scrollbar-thin" style={{ flex: 1, padding: "0 18px 18px" }}>
      {filteredDays.map((day) => {
        const dayLocs = byDay[day];
        const dayIdx = days.indexOf(day);
        const dayColor = DAY_PALETTES[dayIdx % DAY_PALETTES.length];
        const timings = computeDayTimeline(dayLocs);
        const timingById = Object.fromEntries(timings.map((t) => [t.locationId, t]));
        return (
          <DayDropZone key={day} dayNumber={day}>
            <div style={{ marginBottom: 14 }}>
              {/* Day header */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="mxj-serif" style={{ fontSize: 36, lineHeight: 0.9, color: dayColor }}>
                    {String(day).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="mxj-mono" style={{ marginBottom: 2 }}>Day {day}</div>
                  </div>
                </div>
                <span className="mxj-mono">{dayLocs.length} stop{dayLocs.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Day note */}
              <DayNoteField
                value={dayNotes[day] ?? ""}
                onChange={(v) => setDayNotes((prev) => ({ ...prev, [day]: v }))}
                onBlur={(v) => { if (v.trim()) upsertDayNote(trip.id, day, v).catch(() => {}); }}
              />

              {/* Stops */}
              <div style={{ paddingLeft: 4 }}>
                <SortableContext items={dayLocs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  {dayLocs.map((loc, idx) => {
                    const timing = timingById[loc.id];
                    const nextTiming = idx < dayLocs.length - 1 ? timingById[dayLocs[idx + 1].id] : null;
                    return (
                      <SortableStop
                        key={loc.id}
                        loc={loc}
                        timing={timing}
                        isActive={activeLocation?.id === loc.id}
                        isDragging={activeDragId === loc.id}
                        onMarkerClick={handleMarkerClick}
                        onDelete={handleDelete}
                        onUpdate={async (updates) => {
                          await updateLocation(loc.id, updates);
                          setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, ...updates } : l));
                        }}
                        travelToNextMin={nextTiming ? timing?.travelToNextMin : undefined}
                      />
                    );
                  })}
                </SortableContext>

                {/* Add stop ghost button */}
                <button
                  className="mxj-btn mxj-btn-ghost"
                  onClick={() => {
                    setAddForm((f) => ({ ...f, day_number: String(day) }));
                    setShowAddPanel(true);
                  }}
                  style={{ padding: "6px 10px", marginLeft: 14, marginTop: 4, fontFamily: "var(--mxj-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}
                >
                  {Ico.plus}<span>add stop</span>
                </button>
              </div>
            </div>
          </DayDropZone>
        );
      })}

      {locations.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--mxj-muted)" }}>
          <div className="mxj-mono">no stops yet</div>
          <div style={{ marginTop: 8, fontSize: 13 }}>Tap + to add your first location.</div>
        </div>
      )}
    </div>
    <DragOverlay>
      {activeDragLoc ? (
        <div
          className="mxj-stop mxj-glass"
          style={{ padding: "8px 10px", alignItems: "flex-start", borderRadius: 8, opacity: 0.95, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
        >
          <span className="mxj-drag-handle" style={{ opacity: 1 }}>⠿</span>
          <span className="mxj-stop-marker" style={{ background: CATEGORY_META[activeDragLoc.category].color, marginTop: 7, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{activeDragLoc.name}</span>
          </div>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  );

  // Day filter pill tabs
  const dayTabs = (
    <div className="mxj-pill-tabs" style={{ width: "100%" }} role="group" aria-label="Filter by day">
      <button
        className={`mxj-pill-tab ${dayFilter === "all" ? "is-active" : ""}`}
        style={{ flex: 1 }}
        onClick={() => setDayFilter("all")}
        aria-pressed={dayFilter === "all"}
      >
        All
      </button>
      {days.map((d) => (
        <button
          key={d}
          className={`mxj-pill-tab ${dayFilter === d ? "is-active" : ""}`}
          style={{ flex: 1 }}
          onClick={() => setDayFilter(d)}
          aria-pressed={dayFilter === d}
        >
          Day {d}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen-safe" style={{ position: "relative", overflow: "hidden", background: "var(--mxj-bg)" }}>

      {/* ── Full-screen 3D Map — always mounted, hidden on other tabs ── */}
      <div style={{ position: "absolute", inset: 0, visibility: activeTab === "map" ? "visible" : "hidden", pointerEvents: activeTab === "map" ? "auto" : "none" }}>
      <Map3D
        ref={mapRef}
        apiKey={mapsApiKey}
        locations={locations}
        onMarkerClick={handleMarkerClick}
        initialCenter={mapCenter}
        destination={trip.destination}
      />
      </div>

      {/* ── Non-map panels (mobile full-screen) ── */}
      {activeTab !== "map" && (
        <div className="md:hidden" style={{ position: "absolute", inset: 0, overflowY: "auto", background: "var(--mxj-bg)", paddingBottom: 64, zIndex: 5 }}>
          {activeTab === "reservations" && (
            <ReservationsPanel
              trip={trip}
              reservations={reservations}
              onAdd={async (r) => { const res = await addReservation(r); setReservations((p) => [...p, res]); }}
              onUpdate={async (id, updates) => { await updateReservation(id, updates); setReservations((p) => p.map((rv) => rv.id === id ? { ...rv, ...updates } : rv)); }}
              onDelete={async (id) => { await deleteReservation(id); setReservations((p) => p.filter((rv) => rv.id !== id)); }}
            />
          )}
          {activeTab === "budget" && (
            <BudgetPanel
              trip={trip}
              items={budgetItems}
              locations={locations}
              onAdd={async (item) => { const b = await addBudgetItem(item); setBudgetItems((p) => [...p, b]); }}
              onDelete={async (id) => { await deleteBudgetItem(id); setBudgetItems((p) => p.filter((b) => b.id !== id)); }}
            />
          )}
          {activeTab === "packing" && (
            <PackingPanel
              trip={trip}
              items={packingItems}
              onAdd={async (item) => { const p = await addPackingItem(item); setPackingItems((prev) => [...prev, p]); }}
              onUpdate={async (id, updates) => { await updatePackingItem(id, updates); setPackingItems((p) => p.map((i) => i.id === id ? { ...i, ...updates } : i)); }}
              onDelete={async (id) => { await deletePackingItem(id); setPackingItems((p) => p.filter((i) => i.id !== id)); }}
            />
          )}
        </div>
      )}

      {/* ════════ DESKTOP (md+) ════════ */}

      {/* Desktop top bar */}
      <div className="hidden md:flex" style={{
        position: "absolute", top: 20, left: 20, right: 20,
        justifyContent: "space-between", alignItems: "center", zIndex: 3,
        gap: 12, minWidth: 0,
      }}>
        {/* Left pill: back | Logo | trip info */}
        <div className="mxj-glass" style={{ borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, minWidth: 0, overflow: "hidden" }}>
          <a
            href="/"
            style={{ background: "none", border: "none", color: "var(--mxj-ink)", cursor: "pointer", display: "flex", textDecoration: "none", flexShrink: 0 }}
            title="Back"
          >
            {Ico.back}
          </a>
          <hr style={{ width: 1, height: 22, background: "var(--mxj-stroke)", border: "none", margin: 0, flexShrink: 0 }} />
          <Logo size={16} />
          <hr style={{ width: 1, height: 22, background: "var(--mxj-stroke)", border: "none", margin: 0, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div className="mxj-serif" style={{ fontSize: 18, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trip.name}</div>
            <span className="mxj-mono" style={{ whiteSpace: "nowrap" }}>
              {trip.destination ? `${trip.destination} · ` : ""}{dayCount > 0 ? `${dayCount} day${dayCount !== 1 ? "s" : ""} · ` : ""}{stopCount} stop{stopCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Right pill: share */}
        <button
          className="mxj-glass mxj-btn"
          style={{ borderRadius: 999, padding: "9px 16px", flexShrink: 0 }}
          onClick={handleShare}
        >
          {Ico.share}<span>Share</span>
        </button>
      </div>

      {/* Desktop itinerary sidebar */}
      <div
        className="hidden md:flex"
        style={{
          position: "absolute", top: 86, bottom: 20, left: 20,
          width: 380, zIndex: 3,
          flexDirection: "column",
          transform: showItinerary ? "translateX(0)" : "translateX(calc(-100% - 20px))",
          transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div className="mxj-glass" style={{ borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
          {/* Desktop tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--mxj-stroke)", flexShrink: 0 }}>
            {(["map", "reservations", "budget", "packing"] as ActiveTab[]).map((tab) => {
              const labels: Record<ActiveTab, string> = { map: "Itinerary", reservations: "Bookings", budget: "Budget", packing: "Packing" };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "12px 0", background: "none", border: "none",
                    borderBottom: activeTab === tab ? "2px solid var(--mxj-accent)" : "2px solid transparent",
                    color: activeTab === tab ? "var(--mxj-accent)" : "var(--mxj-muted)",
                    cursor: "pointer", fontSize: 10, fontFamily: "var(--mxj-mono)",
                    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: -1,
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
            <span className="mxj-mono" style={{ padding: "12px 14px", cursor: "pointer", fontSize: 11, color: "var(--mxj-muted)", flexShrink: 0 }} onClick={() => setShowItinerary(false)}>✕</span>
          </div>

          {activeTab === "map" ? (
            <>
              <div style={{ padding: "14px 22px 10px", flexShrink: 0 }}>
                {dayTabs}
              </div>
              <hr className="mxj-divider" />
              {itineraryList}
            </>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
              {activeTab === "reservations" && (
                <ReservationsPanel
                  trip={trip}
                  reservations={reservations}
                  onAdd={async (r) => { const res = await addReservation(r); setReservations((p) => [...p, res]); }}
                  onUpdate={async (id, updates) => { await updateReservation(id, updates); setReservations((p) => p.map((rv) => rv.id === id ? { ...rv, ...updates } : rv)); }}
                  onDelete={async (id) => { await deleteReservation(id); setReservations((p) => p.filter((rv) => rv.id !== id)); }}
                />
              )}
              {activeTab === "budget" && (
                <BudgetPanel
                  trip={trip}
                  items={budgetItems}
                  locations={locations}
                  onAdd={async (item) => { const b = await addBudgetItem(item); setBudgetItems((p) => [...p, b]); }}
                  onDelete={async (id) => { await deleteBudgetItem(id); setBudgetItems((p) => p.filter((b) => b.id !== id)); }}
                />
              )}
              {activeTab === "packing" && (
                <PackingPanel
                  trip={trip}
                  items={packingItems}
                  onAdd={async (item) => { const p = await addPackingItem(item); setPackingItems((prev) => [...prev, p]); }}
                  onUpdate={async (id, updates) => { await updatePackingItem(id, updates); setPackingItems((p) => p.map((i) => i.id === id ? { ...i, ...updates } : i)); }}
                  onDelete={async (id) => { await deletePackingItem(id); setPackingItems((p) => p.filter((i) => i.id !== id)); }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Show itinerary toggle (desktop, when hidden) */}
      {!showItinerary && (
        <button
          className="hidden md:flex mxj-glass"
          onClick={() => setShowItinerary(true)}
          title="Show itinerary"
          style={{
            position: "absolute", top: 94, left: 20, zIndex: 3,
            width: 40, height: 40, borderRadius: "50%",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--mxj-ink)",
            border: "1px solid var(--mxj-stroke)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
        </button>
      )}

      {/* Desktop right icon stack */}
      <div className="hidden md:flex" style={{
        position: "absolute", top: 86, right: 20,
        flexDirection: "column", gap: 10, zIndex: 3,
      }}>
        <IconCircle label="Add stop" onClick={() => setShowAddPanel(true)}>{Ico.plus}</IconCircle>
        <IconCircle label="Toggle route" active={routeVisible} onClick={toggleRoute}>{Ico.route}</IconCircle>
        <hr className="mxj-divider" style={{ width: 24, margin: "4px auto" }} />
        <IconCircle label="AI concierge" active={showConcierge} onClick={() => setShowConcierge((v) => !v)}>{Ico.sparkle}</IconCircle>
      </div>

      {/* ════════ MOBILE ════════ */}

      {/* Mobile top bar */}
      <div className="md:hidden flex" style={{
        position: "absolute",
        top: "max(14px, env(safe-area-inset-top, 14px))",
        left: 14, right: 14,
        gap: 8, zIndex: 3,
      }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <IconCircle size={38}>{Ico.back}</IconCircle>
        </a>
        <div className="mxj-glass" style={{ flex: 1, borderRadius: 19, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mxj-serif" style={{ fontSize: 15, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {trip.name}
            </div>
            <span className="mxj-mono" style={{ fontSize: 9 }}>
              {dayCount > 0 ? `${dayCount} day${dayCount !== 1 ? "s" : ""} · ` : ""}{stopCount} stop{stopCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <IconCircle size={38} onClick={handleShare}>{Ico.share}</IconCircle>
      </div>

      {/* Mobile right action stack */}
      <div className="md:hidden flex flex-col" style={{
        position: "absolute",
        top: "calc(max(14px, env(safe-area-inset-top, 14px)) + 60px)",
        right: 14,
        gap: 8, zIndex: 3,
      }}>
        <IconCircle size={40} active={routeVisible} onClick={toggleRoute}>{Ico.route}</IconCircle>
        <IconCircle size={40} active={showConcierge} onClick={() => setShowConcierge((v) => !v)}>{Ico.sparkle}</IconCircle>
      </div>

      {/* Mobile bottom sheet (always visible at mid) */}
      <div
        className="md:hidden mxj-glass-strong flex flex-col overflow-hidden"
        style={{
          position: "absolute",
          top: showItinerary ? "42vh" : "calc(100% - 88px)",
          left: 0, right: 0, bottom: 0,
          borderRadius: "24px 24px 0 0",
          zIndex: 4,
          transition: "top 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Handle */}
        <div
          style={{ padding: "8px 0", display: "flex", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          onClick={() => setShowItinerary((v) => !v)}
        >
          <div style={{ width: 38, height: 4, borderRadius: 2, background: "var(--mxj-stroke-strong)" }} />
        </div>

        <div style={{ padding: "4px 18px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 className="mxj-serif" style={{ fontSize: 22, margin: 0 }}>Itinerary</h2>
            <button
              className="mxj-btn"
              style={{ padding: "5px 10px", fontSize: 11 }}
              onClick={() => setShowAddPanel(true)}
            >
              {Ico.plus}<span>Add</span>
            </button>
          </div>
          {dayTabs}
        </div>

        {itineraryList}
      </div>

      {/* ── Overlays ── */}

      {activeLocation && (
        <div
          className="md:flex md:items-center md:justify-center"
          style={{ position: "absolute", inset: 0, zIndex: 30 }}
          onClick={(e) => { if (e.target === e.currentTarget) setActiveLocation(null); }}
        >
          <InfoCard
            location={activeLocation}
            onClose={() => setActiveLocation(null)}
            onStreetView={(loc) => setStreetViewLocation(loc)}
            onDelete={handleDelete}
          />
        </div>
      )}

      {showConcierge && (
        <div
          className="md:flex md:items-center md:justify-center"
          style={{ position: "absolute", inset: 0, zIndex: 30 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConcierge(false); }}
        >
          <TravelConcierge
            trip={trip}
            locations={locations}
            onSuggestion={(suggestion) => {
              mapRef.current?.flyCameraTo({
                center: { lat: suggestion.latitude, lng: suggestion.longitude, altitude: 200 },
                tilt: 65, heading: 0, range: 1000,
              });
            }}
            onClose={() => setShowConcierge(false)}
          />
        </div>
      )}

      {showAddPanel && (
        <AddPinPanel
          form={addForm}
          onChange={(k, v) => setAddForm((p) => ({ ...p, [k]: v }))}
          onSubmit={handleAddLocation}
          onClose={() => setShowAddPanel(false)}
          days={days.length > 0 ? days : [1]}
          isSubmitting={isAdding}
        />
      )}

      {streetViewLocation && (
        <StreetViewPortal
          location={streetViewLocation}
          onClose={() => setStreetViewLocation(null)}
        />
      )}

      {/* ── Tab bar (bottom on mobile, top of sidebar on desktop) ── */}
      <nav
        className="md:hidden mxj-glass-strong"
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          zIndex: 20,
          display: "flex",
          borderTop: "1px solid var(--mxj-stroke)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {(["map", "reservations", "budget", "packing"] as ActiveTab[]).map((tab) => {
          const labels: Record<ActiveTab, string> = { map: "Map", reservations: "Bookings", budget: "Budget", packing: "Packing" };
          const glyphs: Record<ActiveTab, React.ReactNode> = {
            map: <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 14s5-4.5 5-9a5 5 0 10-10 0c0 4.5 5 9 5 9z"/><circle cx="8" cy="5.5" r="1.6"/></svg>,
            reservations: <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 3V1M11 3V1M2 7h12"/></svg>,
            budget: <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 5v1.5M8 9.5V11M6.5 6.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9 8 8 8s-1.5.67-1.5 1.5S7.17 11 8 11"/></svg>,
            packing: <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="5" width="10" height="9" rx="1"/><path d="M6 5V3.5A1.5 1.5 0 0110 3.5V5"/><path d="M5 9l1.5 1.5L9 7"/></svg>,
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "10px 0", background: "none", border: "none",
                color: activeTab === tab ? "var(--mxj-accent)" : "var(--mxj-muted)",
                cursor: "pointer", fontSize: 9, fontFamily: "var(--mxj-mono)",
                letterSpacing: "0.06em", textTransform: "uppercase",
                borderTop: activeTab === tab ? "2px solid var(--mxj-accent)" : "2px solid transparent",
              }}
            >
              {glyphs[tab]}
              {labels[tab]}
            </button>
          );
        })}
      </nav>

{/* Add error toast */}
      {addError && (
        <div className="mxj-glass" style={{
          position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 50, borderRadius: 12, padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(224, 112, 112, 0.15)",
          border: "1px solid rgba(224, 112, 112, 0.4)",
          whiteSpace: "nowrap",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "#e07070", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#e07070" }}>{addError}</span>
        </div>
      )}

      {/* Delete error toast */}
      {deleteError && (
        <div className="mxj-glass" style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 50, borderRadius: 12, padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(224, 112, 112, 0.15)",
          border: "1px solid rgba(224, 112, 112, 0.4)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "#e07070", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#e07070" }}>{deleteError}</span>
        </div>
      )}
    </div>
  );
}

// ── Day note inline field ──
function DayNoteField({
  value, onChange, onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  if (!focused && !value) {
    return (
      <button
        onClick={() => setFocused(true)}
        className="mxj-mono"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--mxj-faint)", fontSize: 9, padding: "2px 0 8px",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}
      >
        + add day note
      </button>
    );
  }

  return (
    <textarea
      autoFocus={focused && !value}
      value={value}
      rows={2}
      placeholder="Day notes — logistics, tips, reminders…"
      className="mxj-input"
      style={{ width: "100%", resize: "none", fontSize: 12, marginBottom: 8, height: "auto" }}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { setFocused(false); onBlur(e.target.value); }}
    />
  );
}

// ── Sortable stop row ──
function SortableStop({
  loc, timing, travelToNextMin, isActive, isDragging, onMarkerClick, onDelete, onUpdate,
}: {
  loc: TripLocation;
  timing?: StopTiming;
  travelToNextMin?: number;
  isActive: boolean;
  isDragging: boolean;
  onMarkerClick: (loc: TripLocation) => void;
  onDelete: (id: string) => void;
  onUpdate: (updates: Partial<Pick<TripLocation, "duration_minutes" | "arrival_time">>) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: loc.id,
    data: { dayNumber: loc.day_number },
  });
  const [editingTime, setEditingTime] = useState(false);
  const [draftDuration, setDraftDuration] = useState(loc.duration_minutes != null ? String(loc.duration_minutes) : "");
  const [draftAnchor, setDraftAnchor] = useState(loc.arrival_time ?? "");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: "8px 10px",
    alignItems: "flex-start" as const,
    cursor: "pointer" as const,
    opacity: isDragging ? 0.35 : 1,
  };

  const arrLabel = timing?.arrivalMin != null ? formatMinutes(timing.arrivalMin) : null;
  const depLabel = timing?.departureMin != null ? formatMinutes(timing.departureMin) : null;

  async function saveTime(e: React.MouseEvent) {
    e.stopPropagation();
    const dur = draftDuration.trim() ? parseInt(draftDuration) : null;
    const anchor = draftAnchor.trim() || null;
    await onUpdate({ duration_minutes: isNaN(dur as number) ? null : dur, arrival_time: anchor });
    setEditingTime(false);
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`mxj-stop ${isActive ? "is-active" : ""}`}
        onClick={() => !isDragging && onMarkerClick(loc)}
      >
        <span
          className="mxj-drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder"
        >
          ⠿
        </span>
        <span
          className="mxj-stop-marker"
          style={{ background: CATEGORY_META[loc.category].color, marginTop: 7, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {loc.name}
            </span>
            <span className="mxj-mono" style={{ fontSize: 9, flexShrink: 0 }}>
              {CATEGORY_META[loc.category].glyph} {CATEGORY_META[loc.category].label}
            </span>
          </div>
          {loc.description && (
            <div className="mxj-mono" style={{ fontSize: 9, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {loc.description}
            </div>
          )}
          {/* Time row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
            {arrLabel && (
              <span className="mxj-mono" style={{ fontSize: 10, color: "var(--mxj-accent)" }}>{arrLabel}</span>
            )}
            {arrLabel && depLabel && (
              <span className="mxj-mono" style={{ fontSize: 9, color: "var(--mxj-faint)" }}>→</span>
            )}
            {depLabel && (
              <span className="mxj-mono" style={{ fontSize: 10, color: "var(--mxj-muted)" }}>{depLabel}</span>
            )}
            {loc.duration_minutes != null && (
              <span className="mxj-mono" style={{ fontSize: 9, color: "var(--mxj-faint)" }}>
                ({loc.duration_minutes < 60
                  ? `${loc.duration_minutes}m`
                  : `${Math.floor(loc.duration_minutes / 60)}h${loc.duration_minutes % 60 ? `${loc.duration_minutes % 60}m` : ""}`})
              </span>
            )}
            <button
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-faint)", fontSize: 10, padding: "0 2px", fontFamily: "var(--mxj-mono)" }}
              onClick={(e) => { e.stopPropagation(); setEditingTime((v) => !v); }}
              title="Set time / duration"
            >
              {loc.duration_minutes != null || loc.arrival_time ? "✎" : "+ time"}
            </button>
          </div>
          {editingTime && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label className="mxj-mono" style={{ fontSize: 9, color: "var(--mxj-muted)", width: 62 }}>Arrive at</label>
                <input
                  className="mxj-input"
                  type="time"
                  value={draftAnchor}
                  onChange={(e) => setDraftAnchor(e.target.value)}
                  style={{ flex: 1, padding: "3px 6px", fontSize: 11 }}
                />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label className="mxj-mono" style={{ fontSize: 9, color: "var(--mxj-muted)", width: 62 }}>Duration</label>
                <input
                  className="mxj-input"
                  type="number"
                  min="1"
                  placeholder="minutes"
                  value={draftDuration}
                  onChange={(e) => setDraftDuration(e.target.value)}
                  style={{ flex: 1, padding: "3px 6px", fontSize: 11 }}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="mxj-btn" style={{ flex: 1, padding: "4px 0", fontSize: 10 }} onClick={saveTime}>Save</button>
                <button className="mxj-btn mxj-btn-ghost" style={{ flex: 1, padding: "4px 0", fontSize: 10 }} onClick={(e) => { e.stopPropagation(); setEditingTime(false); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(loc.id); }}
          style={{
            background: "none", border: "none", color: "var(--mxj-faint)",
            cursor: "pointer", padding: "4px 6px", flexShrink: 0,
            display: "flex", alignItems: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e07070")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mxj-faint)")}
        >
          {Ico.trash}
        </button>
      </div>
      {/* Travel time connector */}
      {travelToNextMin !== undefined && travelToNextMin > 0 && (
        <div style={{ paddingLeft: 44, marginBottom: 2 }}>
          <span className="mxj-mono" style={{ fontSize: 9, color: "var(--mxj-faint)" }}>
            🚶 {travelToNextMin < 60 ? `${travelToNextMin} min walk` : `${Math.round(travelToNextMin / 60 * 10) / 10} h walk`}
          </span>
        </div>
      )}
    </>
  );
}

// ── Day drop zone ──
function DayDropZone({ dayNumber, children }: { dayNumber: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayNumber}` });
  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 8,
        transition: "background 0.15s",
        background: isOver ? "rgba(136,168,192,0.07)" : "transparent",
      }}
    >
      {children}
    </div>
  );
}

// ── Circular icon button ──
function IconCircle({
  children, label, size = 42, active, onClick, disabled,
}: {
  children: React.ReactNode;
  label?: string;
  size?: number;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={active ? "mxj-glass-strong" : "mxj-glass"}
      style={{
        width: size, height: size, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        color: active ? "var(--mxj-accent)" : "var(--mxj-ink)",
        border: "1px solid " + (active ? "rgba(232,140,100,0.6)" : "var(--mxj-stroke)"),
        background: "none",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── Add Pin panel ──
function AddPinPanel({
  form, onChange, onSubmit, onClose, days, isSubmitting, onPlaceSelectError,
}: {
  form: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  days: number[];
  isSubmitting?: boolean;
  onPlaceSelectError?: (error: string) => void;
}) {
  const acContainerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function attach() {
      const container = acContainerRef.current;
      if (!container) return;
      container.innerHTML = "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PAE = (google.maps.places as any).PlaceAutocompleteElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el: any = new PAE();
      container.appendChild(el);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      el.addEventListener("gmp-placeselect", async (e: any) => {
        try {
          // Places API (New): event.placePrediction → .toPlace() → fetchFields
          const prediction = e.placePrediction ?? e.place;
          const place = typeof prediction?.toPlace === "function" ? prediction.toPlace() : prediction;
          await place.fetchFields({ fields: ["displayName", "location"] });

          const name: string = place.displayName ?? "";
          // location is google.maps.LatLng in Places API (New)
          const loc = place.location;
          const lat: number = typeof loc?.lat === "function" ? loc.lat() : loc?.latitude ?? loc?.lat;
          const lng: number = typeof loc?.lng === "function" ? loc.lng() : loc?.longitude ?? loc?.lng;

          console.log("[PlaceSelect] name:", name, "lat:", lat, "lng:", lng);

          if (!isFinite(lat) || !isFinite(lng)) {
            console.error("[PlaceSelect] invalid coords", { loc, lat, lng });
            return;
          }
          onChangeRef.current("name", name);
          onChangeRef.current("latitude", String(lat));
          onChangeRef.current("longitude", String(lng));
        } catch (err) {
          console.error("Failed to select place:", err);
        }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ready = () => (typeof google !== "undefined" && (google.maps?.places as any)?.PlaceAutocompleteElement);

    if (ready()) {
      attach();
    } else {
      intervalId = setInterval(() => {
        if (ready()) {
          clearInterval(intervalId!);
          intervalId = null;
          attach();
        }
      }, 100);
      setTimeout(() => {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
      }, 15_000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  // Intentionally empty deps: re-running would tear down and recreate the
  // Google Places widget while the user is typing, causing a focus-loss bug.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const coordsLabel = form.latitude
    ? `${parseFloat(form.latitude).toFixed(4)}, ${parseFloat(form.longitude).toFixed(4)}`
    : null;

  const availableDays = days.length > 0 ? days : [1, 2, 3];

  return (
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 40,
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      className="animate-fade-in flex items-end md:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="mxj-glass-strong mxj-sheet-modal"
        style={{
          width: "100%", maxWidth: 420,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Handle */}
        <div className="md:hidden" style={{ padding: "8px 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: "var(--mxj-stroke-strong)" }} />
        </div>

        <div style={{ padding: "4px 22px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="mxj-serif" style={{ fontSize: 24, margin: 0 }}>Add Location</h2>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--mxj-muted)", cursor: "pointer", padding: 4 }}
            >
              {Ico.close}
            </button>
          </div>

          {/* Place search */}
          <div>
            <span className="mxj-mono" style={{ display: "block", marginBottom: 8 }}>Search place</span>
            <div ref={acContainerRef} className="mxj-place-ac" />
            {coordsLabel && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#7ec896", fontFamily: "var(--mxj-mono)", letterSpacing: "0.1em" }}>
                ✓ {coordsLabel}
              </div>
            )}
            {/* Manual fallback */}
            {!form.latitude && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, fontFamily: "var(--mxj-mono)", color: "var(--mxj-muted)", cursor: "pointer" }}>
                  Enter coordinates manually
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <input
                    className="mxj-input"
                    placeholder="Latitude"
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => onChange("latitude", e.target.value)}
                  />
                  <input
                    className="mxj-input"
                    placeholder="Longitude"
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => onChange("longitude", e.target.value)}
                  />
                </div>
              </details>
            )}
          </div>

          {/* Day pills */}
          <div>
            <span className="mxj-mono" style={{ display: "block", marginBottom: 8 }}>Day</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {availableDays.map((d) => (
                <button
                  key={d}
                  onClick={() => onChange("day_number", String(d))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: form.day_number === String(d) ? "rgba(232,140,100,0.6)" : "var(--mxj-stroke)",
                    background: form.day_number === String(d) ? "rgba(232,140,100,0.12)" : "transparent",
                    color: form.day_number === String(d) ? "var(--mxj-accent)" : "var(--mxj-muted)",
                    fontFamily: "var(--mxj-sans)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  Day {d}
                </button>
              ))}
              {/* Allow new day */}
              <button
                onClick={() => onChange("day_number", String(Math.max(...availableDays) + 1))}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px dashed var(--mxj-stroke)",
                  background: "transparent",
                  color: "var(--mxj-faint)",
                  fontFamily: "var(--mxj-sans)", fontSize: 13, cursor: "pointer",
                }}
              >
                + Day {Math.max(...availableDays) + 1}
              </button>
            </div>
          </div>

          {/* Category chips */}
          <div>
            <span className="mxj-mono" style={{ display: "block", marginBottom: 8 }}>Category</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORY_OPTIONS.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = form.category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => onChange("category", cat)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: "1px solid",
                      borderColor: active ? meta.color + "99" : "var(--mxj-stroke)",
                      background: active ? meta.color + "22" : "transparent",
                      color: active ? meta.color : "var(--mxj-muted)",
                      fontFamily: "var(--mxj-sans)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <span>{meta.glyph}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <span className="mxj-mono" style={{ display: "block", marginBottom: 8 }}>Notes</span>
            <textarea
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="What to do here, opening hours, tips…"
              rows={3}
              className="mxj-input"
              style={{ resize: "vertical", height: "auto" }}
            />
          </div>

          {/* Media URL */}
          <div>
            <span className="mxj-mono" style={{ display: "block", marginBottom: 8 }}>Media URL</span>
            <input
              type="text"
              value={form.media_url}
              onChange={(e) => onChange("media_url", e.target.value)}
              placeholder="TikTok / Instagram / PDF"
              className="mxj-input"
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              className="mxj-btn mxj-btn-ghost"
              style={{ flex: 1, justifyContent: "center", padding: "11px 0" }}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!form.latitude || !form.longitude || isSubmitting}
              className="mxj-btn mxj-btn-accent"
              style={{
                flex: 1, justifyContent: "center", padding: "11px 0",
                opacity: !form.latitude || !form.longitude || isSubmitting ? 0.4 : 1,
              }}
            >
              {Ico.pin} {isSubmitting ? "Adding…" : "Add pin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
