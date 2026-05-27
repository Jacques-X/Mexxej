import { notFound } from "next/navigation";
import { getTripById } from "@/lib/supabase";
import TripPlanner from "@/components/TripPlanner";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function TripPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();
  return <TripPlanner trip={trip} />;
}
