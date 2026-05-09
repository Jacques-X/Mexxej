// Server Component: fetches trip data, then hands off to the
// client-side TripPlanner which owns all interactive state.
import { notFound } from "next/navigation";
import { getTripById, getLocationsByTrip } from "@/lib/supabase";
import TripPlanner from "@/components/TripPlanner";

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
  const [trip, locations] = await Promise.all([
    getTripById(tripId),
    getLocationsByTrip(tripId),
  ]);

  if (!trip) notFound();

  return (
    <TripPlanner
      trip={trip}
      initialLocations={locations}
      mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
    />
  );
}
