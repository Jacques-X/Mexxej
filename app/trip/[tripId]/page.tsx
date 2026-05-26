// Server Component: fetches trip data, then hands off to the
// client-side TripPlanner which owns all interactive state.
import { notFound } from "next/navigation";
import {
  getTripById, getLocationsByTrip, getDayNotes,
  getReservations, getBudgetItems, getPackingItems,
} from "@/lib/supabase";
import TripPlanner from "@/components/TripPlanner";
import type { DayNote, Reservation, BudgetItem, PackingItem } from "@/types/trip";

interface Props {
  params: Promise<{ tripId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  return { title: trip ? `${trip.name} — Mexxej` : "Trip not found" };
}

export default async function TripPage({ params }: Props) {
  const { tripId } = await params;
  const [trip, locations, dayNotes, reservations, budgetItems, packingItems] = await Promise.all([
    getTripById(tripId),
    getLocationsByTrip(tripId),
    getDayNotes(tripId).catch((): DayNote[] => []),
    getReservations(tripId).catch((): Reservation[] => []),
    getBudgetItems(tripId).catch((): BudgetItem[] => []),
    getPackingItems(tripId).catch((): PackingItem[] => []),
  ]);

  if (!trip) notFound();

  return (
    <TripPlanner
      trip={trip}
      initialLocations={locations}
      initialDayNotes={dayNotes}
      initialReservations={reservations}
      initialBudgetItems={budgetItems}
      initialPackingItems={packingItems}
      mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
    />
  );
}
