import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { deleteTrip } from "@/lib/supabase";
import type { Trip } from "@/types/trip";
import Logo from "@/components/Logo";
import DeleteTripButton from "@/components/DeleteTripButton";

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
  const destination = (formData.get("destination") as string)?.trim() || null;
  if (!name) return;
  const { data, error } = await supabase
    .from("trips")
    .insert({ name, destination })
    .select()
    .single();
  if (error) return;
  if (data) redirect(`/trip/${data.id}`);
}

async function openTrip(formData: FormData) {
  "use server";
  const id = (formData.get("id") as string)?.trim();
  if (id) redirect(`/trip/${id}`);
}

async function removeTripAction(formData: FormData) {
  "use server";
  const id = (formData.get("id") as string)?.trim();
  if (id) await deleteTrip(id);
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
    <main
      className="h-screen-safe"
      style={{
        background: "var(--mxj-bg)",
        color: "var(--mxj-ink)",
        overflowY: "auto",
        overflowX: "hidden",
        minHeight: "100vh",
      }}
    >
      {/* Subtle background radial glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 60% at 60% 20%, rgba(20,34,48,0.8) 0%, transparent 70%)",
      }} />

      {/* Top nav */}
      <nav className="mxj-page-nav" style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo size={20} />
        <span className="mxj-mono" style={{ fontSize: 10 }}>no account · open by link</span>
      </nav>

      {/* Main column */}
      <div className="mxj-page-col" style={{
        position: "relative", zIndex: 1,
        maxWidth: 980, margin: "0 auto",
        display: "flex", flexDirection: "column", gap: 28,
      }}>

        {/* Hero card */}
        <div id="create" className="mxj-glass mxj-hero-card" style={{
          borderRadius: 24,
          display: "flex", alignItems: "flex-end", gap: 28,
          flexWrap: "wrap",
        }}>
          {/* Left: headline + tagline */}
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <span className="mxj-mono" style={{ display: "block", marginBottom: 14 }}>
              itineraries · just a link, no account
            </span>
            <h1 className="mxj-serif" style={{
              fontSize: "clamp(40px, 5vw, 64px)",
              lineHeight: 0.95, margin: 0, letterSpacing: "-0.025em",
            }}>
              Plan a place,<br />
              <em style={{ color: "var(--mxj-accent)" }}>share the link.</em>
            </h1>
            <p style={{
              fontSize: 14, color: "var(--mxj-muted)",
              marginTop: 18, maxWidth: 440, lineHeight: 1.55,
            }}>
              No accounts, no logins. Make a trip, get a secret URL — anyone
              with the link can view and edit in real time.
            </p>
          </div>

          {/* Right: create form */}
          <div style={{ width: "min(340px, 100%)", display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mxj-mono" style={{ display: "block", marginBottom: 4 }}>start a new trip</span>
            <form action={createTrip} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                className="mxj-input"
                name="name"
                placeholder="Trip name"
                required
                autoComplete="off"
              />
              <input
                className="mxj-input"
                name="destination"
                placeholder="Destination (optional)"
                autoComplete="off"
              />
              <button
                type="submit"
                className="mxj-btn mxj-btn-accent"
                style={{ padding: "12px 16px", justifyContent: "center", borderRadius: 12 }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                Create trip
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <hr className="mxj-divider" style={{ flex: 1 }} />
              <span className="mxj-mono">or</span>
              <hr className="mxj-divider" style={{ flex: 1 }} />
            </div>

            <form action={openTrip} style={{ display: "flex", gap: 6 }}>
              <input
                className="mxj-input"
                name="id"
                placeholder="Open by trip ID…"
                style={{ fontFamily: "var(--mxj-mono)", fontSize: 12 }}
              />
              <button type="submit" className="mxj-btn mxj-btn-ghost" style={{ whiteSpace: "nowrap" }}>
                Open
              </button>
            </form>
          </div>
        </div>

        {/* Saved trips */}
        {trips.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h2 className="mxj-serif" style={{ fontSize: 28, margin: 0 }}>Saved on this device</h2>
              <span className="mxj-mono">{trips.length} trip{trips.length !== 1 ? "s" : ""} · stored locally</span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}>
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} deleteAction={removeTripAction} />
              ))}

              {/* New trip tile — scrolls back to the create form at top */}
              <a
                href="#create"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  alignItems: "flex-start",
                  minHeight: 160,
                  border: "1px dashed var(--mxj-stroke-strong)",
                  background: "transparent",
                  borderRadius: 18,
                  padding: 20,
                  color: "var(--mxj-muted)",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                  <span className="mxj-serif" style={{ fontSize: 22, color: "var(--mxj-ink)" }}>+ New trip</span>
                  <span style={{ fontSize: 13, fontFamily: "var(--mxj-sans)", color: "var(--mxj-muted)" }}>
                    Or paste a Mexxej link from a friend.
                  </span>
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function TripCard({
  trip,
  deleteAction,
}: {
  trip: Trip;
  deleteAction: (fd: FormData) => Promise<void>;
}) {
  return (
    <div className="mxj-glass" style={{
      borderRadius: 18,
      padding: 22,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      cursor: "pointer",
      position: "relative",
    }}>
      {/* Photo placeholder */}
      <div className="mxj-photo" style={{ height: 130 }}>
        <span style={{ position: "relative", zIndex: 1 }}>
          {(trip.destination ?? trip.name).toLowerCase()} · map view
        </span>
      </div>

      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <a
          href={`/trip/${trip.id}`}
          style={{ flex: 1, textDecoration: "none", color: "inherit" }}
        >
          <h3 className="mxj-serif" style={{ fontSize: 24, margin: 0, lineHeight: 1.1 }}>
            {trip.name}
          </h3>
        </a>
        <DeleteTripButton
          tripId={trip.id}
          tripName={trip.name}
          deleteAction={deleteAction}
        />
      </div>

      {/* Destination */}
      {trip.destination && (
        <span className="mxj-mono">{trip.destination}</span>
      )}

      {/* Footer */}
      <a
        href={`/trip/${trip.id}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 10,
          borderTop: "1px solid var(--mxj-stroke)",
        }}>
          <span className="mxj-mono">open →</span>
          <span className="mxj-mono">{formatDate(trip.created_at)}</span>
        </div>
      </a>
    </div>
  );
}
