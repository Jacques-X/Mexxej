export type LocationCategory =
  | "hotel"
  | "restaurant"
  | "attraction"
  | "transport"
  | "other";

export interface Trip {
  id: string;
  name: string;
  destination?: string;
  secret_token: string;
  created_at: string;
}

export interface TripLocation {
  id: string;
  trip_id: string;
  name: string;
  latitude: number;
  longitude: number;
  day_number: number;
  category: LocationCategory;
  description?: string;
  media_url?: string;
  order_index: number;
  created_at: string;
}

export interface ConciergeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConciergeSuggestion {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  category: LocationCategory;
}

export interface ConciergeResponse {
  reasoning: string;
  suggestion: ConciergeSuggestion;
}

export interface CameraPosition {
  center: { lat: number; lng: number; altitude?: number };
  tilt: number;
  heading: number;
  range: number;
}
