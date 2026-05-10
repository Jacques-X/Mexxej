"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase, addLocation, deleteLocation } from "@/lib/supabase";
import type { Trip, TripLocation, LocationCategory, CameraPosition } from "@/types/trip";
import Map3D, { type Map3DHandle } from "./Map3D";
import InfoCard from "./InfoCard";
import StreetViewPortal from "./StreetViewPortal";
import TravelConcierge from "./TravelConcierge";
import { startCinematicFlyover } from "@/lib/cinematicFlyover";
import {
  MapPin, Bot, Film, Route, Share2, Plus, Trash2, X,
  ChevronLeft, ChevronRight, LayoutList,
} from "lucide-react";

interface Props {
  trip: Trip;
  initialLocations: TripLocation[];
  mapsApiKey: string;
}

const CATEGORY_OPTIONS: LocationCategory[] = [
  "hotel", "restaurant", "attraction", "transport", "other",
];

export default function TripPlanner({ trip, initialLocations, mapsApiKey }: Props) {
  const mapRef = useRef<Map3DHandle>(null);

  const [locations, setLocations] = useState<TripLocation[]>(initialLocations);
  const [activeLocation, setActiveLocation] = useState<TripLocation | null>(null);
  const [streetViewLocation, setStreetViewLocation] = useState<TripLocation | null>(null);
  const [showConcierge, setShowConcierge] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [routeVisible, setRouteVisible] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", latitude: "", longitude: "",
    day_number: "1", category: "attraction" as LocationCategory,
    description: "", media_url: "",
  });

  // Open itinerary sidebar on desktop by default
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
    setShowItinerary(false); // focus on selected pin
    flyTo(loc);
  }, [flyTo]);

  const handleAddLocation = async () => {
    const newLoc = await addLocation({
      trip_id: trip.id,
      name: addForm.name,
      latitude: parseFloat(addForm.latitude),
      longitude: parseFloat(addForm.longitude),
      day_number: parseInt(addForm.day_number),
      category: addForm.category,
      description: addForm.description || undefined,
      media_url: addForm.media_url || undefined,
      order_index: locations.filter((l) => l.day_number === parseInt(addForm.day_number)).length,
    });
    if (newLoc) {
      setShowAddPanel(false);
      setAddForm({ name: "", latitude: "", longitude: "", day_number: "1", category: "attraction", description: "", media_url: "" });
      flyTo(newLoc);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteLocation(id);
    if (activeLocation?.id === id) setActiveLocation(null);
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

  const handleCinematicExport = async () => {
    if (!mapRef.current) return;
    setIsRecording(true);
    try { await startCinematicFlyover(mapRef.current, locations); }
    finally { setIsRecording(false); }
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

  // Shared itinerary list — rendered inside both desktop sidebar and mobile sheet
  const itineraryItems = (
    <div className="overflow-y-auto scroll-touch flex-1 pb-4">
      {days.map((day) => (
        <div key={day} className="py-1">
          <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">
            Day {day}
          </p>
          {byDay[day].map((loc) => (
            <button
              key={loc.id}
              onClick={() => handleMarkerClick(loc)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left
                transition-colors active:bg-white/10
                ${activeLocation?.id === loc.id ? "bg-white/8" : "hover:bg-white/5"}
              `}
            >
              <span className={`cat-${loc.category} day-badge shrink-0`}>
                {loc.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{loc.name}</span>
                {loc.description && (
                  <span className="block text-xs text-zinc-500 truncate mt-0.5">{loc.description}</span>
                )}
              </span>
              {/* 44×44 touch target for delete */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleDelete(loc.id); } }}
                className="shrink-0 flex items-center justify-center rounded-xl text-zinc-600
                           hover:text-red-400 active:text-red-400 transition-colors"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      ))}
      {locations.length === 0 && (
        <p className="px-4 py-10 text-sm text-zinc-600 text-center leading-relaxed">
          No stops yet.<br />Tap + to add your first location.
        </p>
      )}
    </div>
  );

  return (
    <div className="relative w-screen overflow-hidden bg-black h-screen-safe">

      {/* ── Full-screen 3D Map ──────────────────────────────── */}
      <Map3D
        ref={mapRef}
        apiKey={mapsApiKey}
        locations={locations}
        onMarkerClick={handleMarkerClick}
        initialCenter={mapCenter}
        destination={trip.destination}
      />

      {/* ── Desktop top bar (md+) ───────────────────────────── */}
      <header className="hidden md:flex absolute top-0 left-0 right-0 z-20 items-center justify-between px-5 py-3 glass border-b border-white/8 animate-fade-in">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold tracking-tight">{trip.name}</span>
          <span className="text-xs text-zinc-500 font-mono">{trip.id.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolbarBtn icon={<Route className="w-4 h-4" />} label="Route" active={routeVisible} onClick={toggleRoute} />
          <ToolbarBtn icon={<Bot className="w-4 h-4" />} label="AI" active={showConcierge} onClick={() => setShowConcierge((v) => !v)} />
          <ToolbarBtn icon={<Film className="w-4 h-4" />} label={isRecording ? "Recording…" : "Export"} active={isRecording} onClick={handleCinematicExport} disabled={isRecording} />
          <ToolbarBtn icon={<Share2 className="w-4 h-4" />} label="Share" onClick={handleShare} />
          <ToolbarBtn icon={<Plus className="w-4 h-4" />} label="Add Pin" onClick={() => setShowAddPanel(true)} />
        </div>
      </header>

      {/* ── Mobile compact floating top bar ─────────────────── */}
      <header
        className="md:hidden absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 animate-fade-in"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 14px)", paddingBottom: 10 }}
      >
        <span className="glass rounded-2xl px-3.5 py-2 text-sm font-bold tracking-tight max-w-[60vw] truncate leading-none">
          {trip.name}
        </span>
        <button
          onClick={handleShare}
          className="glass rounded-2xl text-zinc-300 active:bg-white/15 transition-colors flex items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {/* ── Desktop itinerary sidebar (md+) ─────────────────── */}
      <aside className={`
        hidden md:flex flex-col
        absolute top-[57px] bottom-0 left-0 z-20 w-72 glass border-r border-white/8
        transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${showItinerary ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-300">Itinerary</h2>
          <button
            onClick={() => setShowItinerary(false)}
            className="text-zinc-500 hover:text-white p-1.5 rounded-lg transition-colors"
            style={{ minWidth: 32, minHeight: 32 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        {itineraryItems}
      </aside>

      {!showItinerary && (
        <button
          onClick={() => setShowItinerary(true)}
          className="hidden md:flex absolute top-[70px] left-3 z-20 glass rounded-lg p-2 hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-zinc-300" />
        </button>
      )}

      {/* ── Mobile itinerary bottom sheet ───────────────────── */}
      <div
        className={`
          md:hidden absolute inset-x-0 z-30 above-nav
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${showItinerary ? "translate-y-0" : "translate-y-full"}
        `}
      >
        <div className="glass rounded-t-3xl flex flex-col max-h-[65vh]">
          <div className="sheet-handle" />
          <div className="flex items-center justify-between px-4 pb-2 shrink-0">
            <h2 className="text-sm font-semibold text-zinc-300">Itinerary</h2>
            <button
              onClick={() => setShowItinerary(false)}
              className="text-zinc-500 active:text-white rounded-xl flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {itineraryItems}
        </div>
      </div>

      {/* ── Info Card ────────────────────────────────────────── */}
      {activeLocation && (
        <InfoCard
          location={activeLocation}
          onClose={() => setActiveLocation(null)}
          onStreetView={(loc) => setStreetViewLocation(loc)}
        />
      )}

      {/* ── AI Concierge ─────────────────────────────────────── */}
      {showConcierge && (
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
      )}

      {/* ── Add Pin panel ─────────────────────────────────────── */}
      {showAddPanel && (
        <AddPinPanel
          form={addForm}
          onChange={(k, v) => setAddForm((p) => ({ ...p, [k]: v }))}
          onSubmit={handleAddLocation}
          onClose={() => setShowAddPanel(false)}
        />
      )}

      {/* ── Street View Portal ────────────────────────────────── */}
      {streetViewLocation && (
        <StreetViewPortal
          location={streetViewLocation}
          onClose={() => setStreetViewLocation(null)}
        />
      )}

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <nav className="md:hidden absolute bottom-0 inset-x-0 z-20 glass border-t border-white/8 safe-bot">
        <div className="flex items-center justify-around h-14 px-1">
          <MobileNavBtn
            icon={<LayoutList className="w-5 h-5" />}
            label="Places"
            active={showItinerary}
            onClick={() => {
              setActiveLocation(null);
              setShowItinerary((v) => !v);
            }}
          />
          {/* Primary add button */}
          <button
            onClick={() => setShowAddPanel(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-sky-500 active:bg-sky-600 transition-colors px-4"
            style={{ minHeight: 44 }}
            aria-label="Add location"
          >
            <Plus className="w-5 h-5 text-white" />
            <span className="text-[10px] font-semibold text-white/90">Add</span>
          </button>
          <MobileNavBtn
            icon={<Route className="w-5 h-5" />}
            label="Route"
            active={routeVisible}
            onClick={toggleRoute}
          />
          <MobileNavBtn
            icon={<Bot className="w-5 h-5" />}
            label="AI"
            active={showConcierge}
            onClick={() => setShowConcierge((v) => !v)}
          />
        </div>
      </nav>

      {/* ── Recording badge ───────────────────────────────────── */}
      {isRecording && (
        <div className="absolute bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-5 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow" />
          <span className="text-sm font-medium text-red-400">Recording Flyover…</span>
        </div>
      )}
    </div>
  );
}

// ── Desktop toolbar button ────────────────────────────────────
function ToolbarBtn({
  icon, label, active, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
        transition-all disabled:opacity-50
        ${active
          ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
          : "bg-white/5 text-zinc-400 border border-white/8 hover:bg-white/10 hover:text-white"}
      `}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

// ── Mobile bottom nav button ──────────────────────────────────
function MobileNavBtn({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors px-3
        ${active ? "text-sky-400" : "text-zinc-500 active:text-zinc-200"}`}
      style={{ minWidth: 56, minHeight: 44 }}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// ── Add Pin panel — bottom sheet on mobile, centered modal on desktop ──
function AddPinPanel({
  form, onChange, onSubmit, onClose,
}: {
  form: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ac: any = null;

    function attach() {
      if (!searchRef.current) return;
      ac = new google.maps.places.Autocomplete(searchRef.current, {
        fields: ["name", "geometry"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const name: string = place.name ?? searchRef.current?.value ?? "";
        onChangeRef.current("name", name);
        onChangeRef.current("latitude", place.geometry.location.lat().toString());
        onChangeRef.current("longitude", place.geometry.location.lng().toString());
      });
    }

    if (typeof google !== "undefined" && google.maps?.places) {
      attach();
    } else {
      const id = setInterval(() => {
        if (typeof google !== "undefined" && google.maps?.places) {
          clearInterval(id);
          attach();
        }
      }, 100);
      return () => clearInterval(id);
    }

    return () => {
      if (ac) google.maps.event.clearInstanceListeners(ac);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const coordsLabel = form.latitude
    ? `${parseFloat(form.latitude).toFixed(4)}, ${parseFloat(form.longitude).toFixed(4)}`
    : null;

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50";

  return (
    // items-end = sheet slides up from bottom on mobile; md:items-center = centered modal on desktop
    <div
      className="absolute inset-0 z-40 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full glass overflow-y-auto scroll-touch rounded-t-3xl safe-bot md:overflow-visible md:rounded-2xl md:max-w-sm md:mx-4 md:w-full">
        {/* Drag handle — mobile only */}
        <div className="sheet-handle md:hidden" />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4 text-sky-400" /> Add Location
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-500 active:text-white rounded-xl flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Place search */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Search place</label>
            <input
              ref={searchRef}
              type="text"
              defaultValue={form.name}
              placeholder="Trevi Fountain, Rome…"
              onChange={(e) => {
                if (!e.target.value) {
                  onChangeRef.current("name", "");
                  onChangeRef.current("latitude", "");
                  onChangeRef.current("longitude", "");
                }
              }}
              className={inputCls}
              autoFocus
            />
            {coordsLabel && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span> {coordsLabel}
              </p>
            )}
          </div>

          {/* Day */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Day</label>
            <input
              type="number"
              value={form.day_number}
              min="1"
              onChange={(e) => onChange("day_number", e.target.value)}
              placeholder="1"
              className={inputCls}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Category</label>
            <select
              value={form.category}
              onChange={(e) => onChange("category", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-zinc-900">
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="Optional note…"
              className={inputCls}
            />
          </div>

          {/* Media URL */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Media URL</label>
            <input
              type="text"
              value={form.media_url}
              onChange={(e) => onChange("media_url", e.target.value)}
              placeholder="TikTok / Instagram / PDF"
              className={inputCls}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm
                         text-zinc-400 active:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!form.latitude || !form.longitude}
              className="flex-1 py-3 rounded-xl bg-sky-500 active:bg-sky-600 disabled:opacity-40
                         text-white font-semibold text-sm transition-colors"
            >
              Add Pin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
