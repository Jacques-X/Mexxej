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
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface DayNote {
  id: string;
  trip_id: string;
  day_number: number;
  content: string;
  updated_at: string;
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

export type ReservationType = "flight" | "hotel" | "restaurant" | "activity" | "other";
export type ReservationStatus = "confirmed" | "pending" | "cancelled";

export interface Reservation {
  id: string;
  trip_id: string;
  type: ReservationType;
  name: string;
  date?: string;
  time?: string;
  confirmation_code?: string;
  notes?: string;
  cost?: number;
  currency: string;
  status: ReservationStatus;
  created_at: string;
}

export type BudgetCategory = "accommodation" | "food" | "activities" | "transport" | "shopping" | "other";

export interface BudgetItem {
  id: string;
  trip_id: string;
  category: BudgetCategory;
  description: string;
  amount: number;
  currency: string;
  paid_by?: string;
  date?: string;
  location_id?: string;
  created_at: string;
}

export type PackingCategory = "clothing" | "docs" | "electronics" | "toiletries" | "other";

export interface PackingItem {
  id: string;
  trip_id: string;
  category: PackingCategory;
  name: string;
  packed: boolean;
  assigned_to?: string;
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
