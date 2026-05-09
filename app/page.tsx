// Root page: a minimal landing that lets you create a new trip
// or enter an existing trip ID.
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Globe } from "lucide-react";

async function createTrip(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const { data } = await supabase
    .from("trips")
    .insert({ name })
    .select()
    .single();
  if (data) redirect(`/trip/${data.id}`);
}

export default function HomePage() {
  return (
    <main className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_center,_#0f172a_0%,_#0a0a0f_70%)]">
      <div className="glass rounded-2xl p-10 w-full max-w-md space-y-8 animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <Globe className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mexxej</h1>
          <p className="text-sm text-zinc-400 text-center">
            Your immersive 3D group travel planner
          </p>
        </div>

        {/* Create a new trip */}
        <form action={createTrip} className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            New Trip
          </label>
          <input
            name="name"
            placeholder="Summer in Rome…"
            required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm
                       placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors
                       text-white font-semibold rounded-lg py-2.5 text-sm"
          >
            Create Trip →
          </button>
        </form>

        {/* Open an existing trip */}
        <form
          action={async (fd) => {
            "use server";
            const id = (fd.get("id") as string)?.trim();
            if (id) redirect(`/trip/${id}`);
          }}
          className="space-y-3"
        >
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Open Existing Trip
          </label>
          <input
            name="id"
            placeholder="Paste Trip ID…"
            required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm
                       font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-2
                       focus:ring-sky-500/50"
          />
          <button
            type="submit"
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors
                       text-zinc-300 font-semibold rounded-lg py-2.5 text-sm"
          >
            Open Trip
          </button>
        </form>
      </div>
    </main>
  );
}
