import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Trip } from "@/types/trip";
import { Globe, MapPin, Plus, ArrowRight, Calendar } from "lucide-react";

async function getTrips(): Promise<Trip[]> {
  const { data } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function createTrip(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const { data, error } = await supabase
    .from("trips")
    .insert({ name })
    .select()
    .single();
  if (error) {
    console.error("Failed to create trip:", error.message);
    return;
  }
  if (data) redirect(`/trip/${data.id}`);
}

async function openTrip(formData: FormData) {
  "use server";
  const id = (formData.get("id") as string)?.trim();
  if (id) redirect(`/trip/${id}`);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function HomePage() {
  const trips = await getTrips();

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0f172a_0%,_#0a0a0f_60%)] flex flex-col items-center justify-start p-6 pt-16">
      <div className="w-full max-w-lg space-y-8 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <Globe className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Mexxej</h1>
          <p className="text-sm text-zinc-400">Your immersive 3D group travel planner</p>
        </div>

        {/* Existing trips */}
        {trips.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 px-1">
              Your Trips
            </h2>
            <div className="space-y-2">
              {trips.map((trip) => (
                <a
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  className="glass rounded-xl px-4 py-3 flex items-center gap-4
                             hover:bg-white/8 active:bg-white/12 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 shrink-0">
                    <MapPin className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{trip.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-500">
                      <Calendar className="w-3 h-3" />
                      {formatDate(trip.created_at)}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300
                                        group-hover:translate-x-0.5 transition-all shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Create new trip */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-400" />
            New Trip
          </h2>
          <form action={createTrip} className="flex gap-2">
            <input
              name="name"
              placeholder="Summer in Rome…"
              required
              autoComplete="off"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm
                         placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            <button
              type="submit"
              className="shrink-0 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors
                         text-white font-semibold rounded-lg px-4 py-2.5 text-sm"
            >
              Create →
            </button>
          </form>
        </div>

        {/* Open by ID (collapsed, power-user escape hatch) */}
        <details className="group">
          <summary className="text-xs text-zinc-600 hover:text-zinc-400 cursor-pointer
                              transition-colors text-center list-none">
            Open by Trip ID ↓
          </summary>
          <form action={openTrip} className="flex gap-2 mt-3">
            <input
              name="id"
              placeholder="Paste Trip ID…"
              required
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
                         text-sm font-mono placeholder:text-zinc-600 focus:outline-none
                         focus:ring-2 focus:ring-sky-500/50"
            />
            <button
              type="submit"
              className="shrink-0 bg-white/5 border border-white/10 hover:bg-white/10
                         transition-colors text-zinc-300 font-semibold rounded-lg px-4
                         py-2.5 text-sm"
            >
              Open
            </button>
          </form>
        </details>

      </div>
    </main>
  );
}
