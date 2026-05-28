import { createClient } from "@supabase/supabase-js";
import type {
  Trip, TripLocation, DayNote,
  Reservation, BudgetItem, PackingItem,
} from "@/types/trip";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey);

// ─── Typed helpers ────────────────────────────────────────────

export async function getTripById(id: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
}

export async function createTrip(
  name: string,
  destination: string
): Promise<Trip> {
  const secret_token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const { data, error } = await supabase
    .from("trips")
    .insert({ name, destination, secret_token })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getTripsByIds(ids: string[]): Promise<Trip[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateTrip(
  id: string,
  updates: Partial<Pick<Trip, "name" | "destination" | "start_date" | "end_date">>
): Promise<void> {
  const { error } = await supabase.from("trips").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getLocationsByTrip(
  tripId: string
): Promise<TripLocation[]> {
  const { data, error } = await supabase
    .from("trip_locations")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addLocation(
  location: Omit<TripLocation, "id" | "created_at" | "order_index">
): Promise<TripLocation | null> {
  // Query current max to avoid race condition from stale client-side counts
  const { data: maxRow } = await supabase
    .from("trip_locations")
    .select("order_index")
    .eq("trip_id", location.trip_id)
    .eq("day_number", location.day_number)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const order_index = maxRow ? maxRow.order_index + 1 : 0;

  const { data, error } = await supabase
    .from("trip_locations")
    .insert({ ...location, order_index })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function reorderLocations(
  updates: { id: string; day_number: number; order_index: number }[]
): Promise<void> {
  const { error } = await supabase
    .from("trip_locations")
    .upsert(updates, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function getDayNotes(tripId: string): Promise<DayNote[]> {
  const { data, error } = await supabase
    .from("trip_day_notes")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertDayNote(
  tripId: string,
  dayNumber: number,
  content: string
): Promise<void> {
  const { error } = await supabase
    .from("trip_day_notes")
    .upsert(
      { trip_id: tripId, day_number: dayNumber, content, updated_at: new Date().toISOString() },
      { onConflict: "trip_id,day_number" }
    );
  if (error) throw new Error(error.message);
}

export async function updateLocation(
  id: string,
  updates: Partial<Pick<TripLocation, "duration_minutes" | "arrival_time" | "transport_mode" | "name" | "description" | "category">>
): Promise<void> {
  const { error } = await supabase.from("trip_locations").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase.from("trip_locations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTrip(id: string): Promise<void> {
  // All child tables have ON DELETE CASCADE, so deleting the trip row
  // removes everything (locations, notes, reservations, budget, packing).
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Reservations ─────────────────────────────────────────

export async function getReservations(tripId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from("trip_reservations")
    .select("*")
    .eq("trip_id", tripId)
    .order("date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addReservation(
  reservation: Omit<Reservation, "id" | "created_at">
): Promise<Reservation> {
  const { data, error } = await supabase
    .from("trip_reservations")
    .insert(reservation)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateReservation(
  id: string,
  updates: Partial<Omit<Reservation, "id" | "trip_id" | "created_at">>
): Promise<void> {
  const { error } = await supabase
    .from("trip_reservations")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase.from("trip_reservations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Budget ───────────────────────────────────────────────

export async function getBudgetItems(tripId: string): Promise<BudgetItem[]> {
  const { data, error } = await supabase
    .from("trip_budget_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addBudgetItem(
  item: Omit<BudgetItem, "id" | "created_at">
): Promise<BudgetItem> {
  const { data, error } = await supabase
    .from("trip_budget_items")
    .insert(item)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const { error } = await supabase.from("trip_budget_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Packing ──────────────────────────────────────────────

export async function getPackingItems(tripId: string): Promise<PackingItem[]> {
  const { data, error } = await supabase
    .from("trip_packing_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("category", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addPackingItem(
  item: Omit<PackingItem, "id" | "created_at" | "order_index">
): Promise<PackingItem> {
  const { data: maxRow } = await supabase
    .from("trip_packing_items")
    .select("order_index")
    .eq("trip_id", item.trip_id)
    .eq("category", item.category)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const order_index = maxRow ? maxRow.order_index + 1 : 0;

  const { data, error } = await supabase
    .from("trip_packing_items")
    .insert({ ...item, order_index })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePackingItem(
  id: string,
  updates: Partial<Omit<PackingItem, "id" | "trip_id" | "created_at">>
): Promise<void> {
  const { error } = await supabase
    .from("trip_packing_items")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePackingItem(id: string): Promise<void> {
  const { error } = await supabase.from("trip_packing_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
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
