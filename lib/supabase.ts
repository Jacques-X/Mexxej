import { createClient } from "@supabase/supabase-js";
import type { Trip, TripLocation } from "@/types/trip";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey);

// ─── Typed helpers ────────────────────────────────────────────

export async function getTripById(id: string): Promise<Trip | null> {
  const { data } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function getLocationsByTrip(
  tripId: string
): Promise<TripLocation[]> {
  const { data } = await supabase
    .from("trip_locations")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("order_index", { ascending: true });
  return data ?? [];
}

export async function addLocation(
  location: Omit<TripLocation, "id" | "created_at">
): Promise<TripLocation | null> {
  const { data } = await supabase
    .from("trip_locations")
    .insert(location)
    .select()
    .single();
  return data;
}

export async function deleteLocation(id: string): Promise<void> {
  await supabase.from("trip_locations").delete().eq("id", id);
}

export async function deleteTrip(id: string): Promise<void> {
  // trip_locations are removed first to satisfy FK constraints
  // (if the DB has ON DELETE CASCADE this is a no-op, but safe either way)
  await supabase.from("trip_locations").delete().eq("trip_id", id);
  await supabase.from("trips").delete().eq("id", id);
}

export async function uploadMedia(
  tripId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${tripId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("trip-media")
    .upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from("trip-media").getPublicUrl(path);
  return data.publicUrl;
}
