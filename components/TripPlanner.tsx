"use client";

// Top-level client component: owns all shared state and wires
// together the map, sidebars, overlays, and Supabase Realtime.

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase, addLocation, deleteLocation } from "@/lib/supabase";
import type { Trip, TripLocation, LocationCategory, CameraPosition } from "@/types/trip";
import Map3D, { type Map3DHandle } from "./Map3D";
import InfoCard from "./InfoCard";
import StreetViewPortal from "./StreetViewPortal";
import TravelConcierge from "./TravelConcierge";
import { startCinematicFlyover } from "@/lib/cinematicFlyover";
import {
  MapPin, Bot, Film, Route, Share2, Plus, Trash2, X, ChevronLeft, ChevronRight,
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

  // ── State ─────────────────────────────────────────────────
  const [locations, setLocations] = useState<TripLocation[]>(initialLocations);
  const [activeLocation, setActiveLocation] = useState<TripLocation | null>(null);
  const [streetViewLocation, setStreetViewLocation] = useState<TripLocation | null>(null);
  const [showConcierge, setShowConcierge] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showItinerary, setShowItinerary] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [routeVisible, setRouteVisible] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", latitude: "", longitude: "",
    day_number: "1", category: "attraction" as LocationCategory,
    description: "", media_url: "",
  });

  // ── Supabase Realtime ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on(
        "postgres_changes",
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
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trip.id]);

  // ── Camera helpers ────────────────────────────────────────
  const flyTo = useCallback(
    (loc: TripLocation, tilt = 65, range = 800) => {
      const pos: CameraPosition = {
        center: { lat: loc.latitude, lng: loc.longitude, altitude: 100 },
        tilt,
        heading: 0,
        range,
      };
      mapRef.current?.flyCameraTo(pos, 3000);
    },
    []
  );

  // ── Marker click ──────────────────────────────────────────
  const handleMarkerClick = useCallback(
    (loc: TripLocation) => {
      setActiveLocation(loc);
      flyTo(loc);
    },
    [flyTo]
  );

  // ── Add location ──────────────────────────────────────────
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
      order_index: locations.filter(
        (l) => l.day_number === parseInt(addForm.day_number)
      ).length,
    });
    if (newLoc) {
      setShowAddPanel(false);
      setAddForm({ name: "", latitude: "", longitude: "", day_number: "1", category: "attraction", description: "", media_url: "" });
      flyTo(newLoc);
    }
  };

  // ── Delete location ───────────────────────────────────────
  const handleDelete = async (id: string) => {
    await deleteLocation(id);
    if (activeLocation?.id === id) setActiveLocation(null);
  };

  // ── Route toggle ──────────────────────────────────────────
  const toggleRoute = async () => {
    if (routeVisible) {
      mapRef.current?.clearRoute();
      setRouteVisible(false);
    } else {
      await mapRef.current?.drawRoute(locations);
      setRouteVisible(true);
    }
  };

  // ── Cinematic export ──────────────────────────────────────
  const handleCinematicExport = async () => {
    if (!mapRef.current) return;
    setIsRecording(true);
    try {
      await startCinematicFlyover(mapRef.current, locations);
    } finally {
      setIsRecording(false);
    }
  };

  // ── Share URL ─────────────────────────────────────────────
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  // ── Derive initial map centre ─────────────────────────────
  const mapCenter = locations.length
    ? { lat: locations[0].latitude, lng: locations[0].longitude }
    : undefined;

  // ── Group by day ──────────────────────────────────────────
  const byDay = locations.reduce<Record<number, TripLocation[]>>((acc, l) => {
    (acc[l.day_number] ??= []).push(l);
    return acc;
  }, {});
  const days = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">

      {/* ── Full-screen 3D Map ─────────────────────────────── */}
      <Map3D
        ref={mapRef}
        apiKey={mapsApiKey}
        locations={locations}
        onMarkerClick={handleMarkerClick}
        initialCenter={mapCenter}
        destination={trip.destination}
      />

      {/* ── Top bar ───────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3 glass border-b border-white/8 animate-fade-in">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">{trip.name}</span>
          <span className="text-xs text-zinc-500 font-mono hidden md:block">
            ID: {trip.id.slice(0, 8)}…
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ToolbarBtn
            icon={<Route className="w-4 h-4" />}
            label="Route"
            active={routeVisible}
            onClick={toggleRoute}
          />
          <ToolbarBtn
            icon={<Bot className="w-4 h-4" />}
            label="AI"
            active={showConcierge}
            onClick={() => setShowConcierge((v) => !v)}
          />
          <ToolbarBtn
            icon={<Film className="w-4 h-4" />}
            label={isRecording ? "Recording…" : "Export"}
            active={isRecording}
            onClick={handleCinematicExport}
            disabled={isRecording}
          />
          <ToolbarBtn
            icon={<Share2 className="w-4 h-4" />}
            label="Copy URL"
            onClick={handleShare}
          />
          <ToolbarBtn
            icon={<Plus className="w-4 h-4" />}
            label="Add Pin"
            onClick={() => setShowAddPanel(true)}
          />
        </div>
      </header>

      {/* ── Itinerary Sidebar (left) ───────────────────────── */}
      <aside
        className={`
          absolute top-[57px] bottom-0 left-0 z-20 w-72 glass border-r border-white/8
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${showItinerary ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <h2 className="text-sm font-semibold text-zinc-300">Itinerary</h2>
          <button
            onClick={() => setShowItinerary(false)}
            className="text-zinc-500 hover:text-white p-1 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto h-full pb-20 scrollbar-thin">
          {days.map((day) => (
            <div key={day} className="py-2">
              <p className="px-4 py-1 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Day {day}
              </p>
              {byDay[day].map((loc) => (
                <div
                  key={loc.id}
                  className={`
                    group flex items-start gap-3 px-4 py-2.5 cursor-pointer
                    transition-colors hover:bg-white/5
                    ${activeLocation?.id === loc.id ? "bg-white/8" : ""}
                  `}
                  onClick={() => handleMarkerClick(loc)}
                >
                  <div className={`cat-${loc.category} day-badge mt-0.5 shrink-0`}>
                    {loc.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{loc.name}</p>
                    {loc.description && (
                      <p className="text-xs text-zinc-500 truncate">{loc.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {locations.length === 0 && (
            <p className="px-4 py-6 text-sm text-zinc-600 text-center">
              No pins yet.<br />Add your first location →
            </p>
          )}
        </div>
      </aside>

      {/* Itinerary show button when collapsed */}
      {!showItinerary && (
        <button
          onClick={() => setShowItinerary(true)}
          className="absolute top-[70px] left-3 z-20 glass rounded-lg p-2 hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-zinc-300" />
        </button>
      )}

      {/* ── Info Card ─────────────────────────────────────── */}
      {activeLocation && (
        <InfoCard
          location={activeLocation}
          onClose={() => setActiveLocation(null)}
          onStreetView={(loc) => setStreetViewLocation(loc)}
        />
      )}

      {/* ── AI Concierge Sidebar (right) ───────────────────── */}
      {showConcierge && (
        <TravelConcierge
          trip={trip}
          locations={locations}
          onSuggestion={(suggestion) => {
            mapRef.current?.flyCameraTo({
              center: { lat: suggestion.latitude, lng: suggestion.longitude, altitude: 200 },
              tilt: 65,
              heading: 0,
              range: 1000,
            });
          }}
          onClose={() => setShowConcierge(false)}
        />
      )}

      {/* ── Add Pin Panel ─────────────────────────────────── */}
      {showAddPanel && (
        <AddPinPanel
          form={addForm}
          onChange={(k, v) => setAddForm((p) => ({ ...p, [k]: v }))}
          onSubmit={handleAddLocation}
          onClose={() => setShowAddPanel(false)}
        />
      )}

      {/* ── Street View Portal ────────────────────────────── */}
      {streetViewLocation && (
        <StreetViewPortal
          location={streetViewLocation}
          onClose={() => setStreetViewLocation(null)}
        />
      )}

      {/* ── Recording badge ───────────────────────────────── */}
      {isRecording && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-5 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow" />
          <span className="text-sm font-medium text-red-400">Recording Flyover…</span>
        </div>
      )}
    </div>
  );
}

// ── Small toolbar button ──────────────────────────────────────
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

// ── Add Pin slide-in panel ────────────────────────────────────
function AddPinPanel({
  form, onChange, onSubmit, onClose,
}: {
  form: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const fields: Array<{ key: string; label: string; placeholder: string; type?: string }> = [
    { key: "name", label: "Name", placeholder: "Trevi Fountain" },
    { key: "latitude", label: "Latitude", placeholder: "41.9009", type: "number" },
    { key: "longitude", label: "Longitude", placeholder: "12.4833", type: "number" },
    { key: "day_number", label: "Day", placeholder: "1", type: "number" },
    { key: "description", label: "Description", placeholder: "Optional note…" },
    { key: "media_url", label: "Media URL", placeholder: "TikTok/Instagram link or PDF" },
  ];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass rounded-2xl p-6 w-full max-w-sm space-y-4 animate-slide-up mx-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-400" /> Add Location
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {fields.map(({ key, label, placeholder, type }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">{label}</label>
            <input
              type={type ?? "text"}
              value={form[key]}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm
                         placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
        ))}

        <div className="space-y-1">
          <label className="text-xs text-zinc-400 font-medium">Category</label>
          <select
            value={form.category}
            onChange={(e) => onChange("category", e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm
                       text-zinc-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c} className="bg-zinc-900">
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-sm
                       text-zinc-400 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!form.name || !form.latitude || !form.longitude}
            className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50
                       text-white font-semibold text-sm transition-colors"
          >
            Add Pin
          </button>
        </div>
      </div>
    </div>
  );
}
