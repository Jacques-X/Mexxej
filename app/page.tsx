import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { deleteTrip } from "@/lib/supabase";
import type { Trip } from "@/types/trip";
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
  revalidatePath("/");
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
      className="mxj-amber"
      style={{
        minHeight: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* ── Nav ───────────────────────────────────────────── */}
      <nav
        className="mxj-page-nav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            style={{ opacity: 0.7 }}
          >
            <circle
              cx="10" cy="10" r="8.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <circle cx="10" cy="10" r="2" fill="currentColor" />
            <path
              d="M10 2v3M10 15v3M2 10h3M15 10h3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--mxj-ink)",
              lineHeight: 1,
            }}
          >
            Mexxej
          </span>
        </div>

        <span
          style={{
            fontSize: 11,
            color: "var(--mxj-faint)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          No account required
        </span>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <div
        id="create"
        className="mxj-page-col"
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: "clamp(32px, 6vw, 96px)",
          flexWrap: "wrap",
          paddingTop: "clamp(24px, 5vw, 56px)",
          paddingBottom: "clamp(40px, 8vw, 96px)",
        }}
      >
        {/* Left: headline */}
        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)",
              fontSize: "clamp(60px, 9.5vw, 124px)",
              fontWeight: 700,
              lineHeight: 0.92,
              margin: 0,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              color: "var(--mxj-ink)",
            }}
          >
            Plan a place,
            <br />
            <em
              style={{
                fontStyle: "italic",
                color: "var(--mxj-accent-bg)",
                fontWeight: 700,
              }}
            >
              share the link.
            </em>
          </h1>

          <p
            style={{
              fontSize: 15,
              color: "var(--mxj-muted)",
              lineHeight: 1.6,
              marginTop: 24,
              maxWidth: "42ch",
              fontWeight: 400,
            }}
          >
            No logins. Build a trip on a 3D map, get a private
            link — anyone with it can edit in real time.
          </p>
        </div>

        {/* Right: form card */}
        <div
          style={{
            width: "min(380px, 100%)",
            background: "var(--mxj-surface)",
            border: "none",
            borderRadius: "var(--mxj-r-lg)",
            padding: "28px 26px",
            boxShadow: "0 16px 64px oklch(40% 0.15 68 / 0.35), 0 2px 12px oklch(40% 0.15 68 / 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "var(--mxj-muted)",
                marginBottom: 6,
              }}
            >
              Start a new trip
            </p>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)",
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: "var(--mxj-ink)",
                lineHeight: 1,
              }}
            >
              New trip
            </h2>
          </div>

          <form
            action={createTrip}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
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
              style={{
                marginTop: 4,
                padding: "12px 16px",
                background: "var(--mxj-ink)",
                color: "var(--mxj-surface)",
                border: "none",
                borderRadius: "var(--mxj-r-md)",
                fontFamily: "var(--font-sans, 'Barlow', sans-serif)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                transition: "opacity 0.12s",
              }}
            >
              <svg
                width="12" height="12"
                viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
              Create trip
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 2,
            }}
          >
            <hr
              style={{
                flex: 1,
                height: 1,
                background: "var(--mxj-stroke)",
                border: "none",
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: "var(--mxj-faint)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              or open existing
            </span>
            <hr
              style={{
                flex: 1,
                height: 1,
                background: "var(--mxj-stroke)",
                border: "none",
              }}
            />
          </div>

          <form action={openTrip} style={{ display: "flex", gap: 6 }}>
            <input
              className="mxj-input"
              name="id"
              placeholder="Paste trip ID…"
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 11,
              }}
            />
            <button
              type="submit"
              className="mxj-btn"
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Open
            </button>
          </form>
        </div>
      </div>

      {/* ── Recent trips ─────────────────────────────────── */}
      {trips.length > 0 && (
        <div
          className="mxj-page-col"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            paddingTop: 0,
            borderTop: "1px solid var(--mxj-stroke)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              paddingTop: 32,
              paddingBottom: 24,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                margin: 0,
                color: "var(--mxj-ink)",
              }}
            >
              Recent trips
            </h2>
            <span
              style={{
                fontSize: 10,
                color: "var(--mxj-faint)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {trips.length} trip{trips.length !== 1 ? "s" : ""} · local
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
              gap: 12,
            }}
          >
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                deleteAction={removeTripAction}
              />
            ))}

            {/* Add new tile */}
            <a
              href="#create"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 12,
                minHeight: 160,
                border: "1px dashed var(--mxj-stroke-strong)",
                background: "transparent",
                borderRadius: "var(--mxj-r-lg)",
                padding: "20px",
                color: "var(--mxj-muted)",
                textDecoration: "none",
                transition: "border-color 0.12s",
              }}
            >
              <div
                style={{
                  width: 32, height: 32,
                  border: "1px dashed var(--mxj-stroke-strong)",
                  borderRadius: "var(--mxj-r-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  color: "var(--mxj-faint)",
                }}
              >
                +
              </div>
              <span
                style={{
                  fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: "var(--mxj-ink)",
                }}
              >
                New trip
              </span>
              <span style={{ fontSize: 12, color: "var(--mxj-muted)", lineHeight: 1.5 }}>
                Or paste a Mexxej link from a friend.
              </span>
            </a>
          </div>
        </div>
      )}
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
    <div
      className="mxj-card"
      style={{
        background: "var(--mxj-surface)",
        border: "none",
        borderRadius: "var(--mxj-r-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 20px oklch(40% 0.15 68 / 0.2)",
      }}
    >
      {/* Photo placeholder */}
      <div
        className="mxj-photo"
        style={{
          height: 110,
          borderRadius: 0,
          border: "none",
          borderBottom: "1px solid var(--mxj-stroke)",
        }}
      >
        <span style={{ position: "relative", zIndex: 1 }}>
          {(trip.destination ?? trip.name).toLowerCase()}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "14px 18px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <a
            href={`/trip/${trip.id}`}
            style={{ flex: 1, textDecoration: "none", color: "inherit" }}
          >
            <h3
              style={{
                fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                margin: 0,
                lineHeight: 1.1,
                color: "var(--mxj-ink)",
              }}
            >
              {trip.name}
            </h3>
          </a>
          <DeleteTripButton
            tripId={trip.id}
            tripName={trip.name}
            deleteAction={deleteAction}
          />
        </div>

        {trip.destination && (
          <span
            style={{
              fontSize: 11,
              color: "var(--mxj-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {trip.destination}
          </span>
        )}

        <a
          href={`/trip/${trip.id}`}
          style={{
            textDecoration: "none",
            color: "inherit",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 10,
              marginTop: 8,
              borderTop: "1px solid var(--mxj-stroke)",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--mxj-accent-deep)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Open →
            </span>
            <span
              className="mxj-mono"
              style={{ fontSize: 9 }}
            >
              {formatDate(trip.created_at)}
            </span>
          </div>
        </a>
      </div>
    </div>
  );
}
