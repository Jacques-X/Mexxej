import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
      style={{
        background: "var(--mxj-bg)",
        color: "var(--mxj-ink)",
        overflowY: "auto",
        overflowX: "hidden",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      {/* Subtle map-grid background */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage: `
            linear-gradient(var(--mxj-stroke) 1px, transparent 1px),
            linear-gradient(90deg, var(--mxj-stroke) 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
          opacity: 0.55,
        }}
      />

      {/* Top nav */}
      <nav
        className="mxj-page-nav"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Logo size={20} />
        <span
          style={{
            fontSize: 11,
            color: "var(--mxj-faint)",
            letterSpacing: "0.04em",
          }}
        >
          no account · open by link
        </span>
      </nav>

      {/* Main column */}
      <div
        className="mxj-page-col"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1060,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 56,
        }}
      >
        {/* ── Hero ─────────────────────────────────────────── */}
        <div
          id="create"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(24px, 5vw, 72px)",
            flexWrap: "wrap",
            paddingTop: "clamp(16px, 4vw, 40px)",
          }}
        >
          {/* Left: headline */}
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--mxj-accent-deep)",
                background: "var(--mxj-accent-bg)",
                padding: "4px 12px",
                borderRadius: 999,
                marginBottom: 22,
                border: "1px solid var(--mxj-accent-border)",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <circle cx="6" cy="6" r="5" opacity="0.5" />
                <circle cx="6" cy="6" r="1.8" fill="currentColor" stroke="none" />
              </svg>
              Travel planner
            </div>

            <h1
              className="mxj-serif"
              style={{
                fontSize: "clamp(44px, 6.5vw, 78px)",
                lineHeight: 1.0,
                margin: 0,
                letterSpacing: "-0.03em",
                fontWeight: 400,
              }}
            >
              Plan a place,
              <br />
              <em style={{ color: "var(--mxj-accent)", fontStyle: "italic" }}>
                share the link.
              </em>
            </h1>

            <p
              style={{
                fontSize: 16,
                color: "var(--mxj-muted)",
                lineHeight: 1.65,
                marginTop: 22,
                maxWidth: "48ch",
              }}
            >
              No accounts, no logins. Build a trip itinerary and get a private
              link — anyone with it can view and edit in real time.
            </p>
          </div>

          {/* Right: create form card */}
          <div
            className="mxj-glass"
            style={{
              width: "min(360px, 100%)",
              borderRadius: "var(--mxj-r-xl)",
              padding: "28px 24px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "var(--mxj-ink)",
                }}
              >
                New trip
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--mxj-muted)",
                }}
              >
                Name it, pick a destination, hit create
              </p>
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
                className="mxj-btn mxj-btn-accent"
                style={{
                  padding: "12px 16px",
                  justifyContent: "center",
                  borderRadius: "var(--mxj-r-md)",
                  marginTop: 2,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
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
              <hr className="mxj-divider" style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--mxj-faint)",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                or open existing
              </span>
              <hr className="mxj-divider" style={{ flex: 1 }} />
            </div>

            <form action={openTrip} style={{ display: "flex", gap: 6 }}>
              <input
                className="mxj-input"
                name="id"
                placeholder="Paste trip ID…"
                style={{ fontFamily: "var(--mxj-mono)", fontSize: 12 }}
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

        {/* ── Saved trips ──────────────────────────────────── */}
        {trips.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <h2
                className="mxj-serif"
                style={{
                  fontSize: "clamp(26px, 3.5vw, 36px)",
                  margin: 0,
                  letterSpacing: "-0.025em",
                }}
              >
                Recent trips
              </h2>
              <span style={{ fontSize: 12, color: "var(--mxj-faint)" }}>
                {trips.length} trip{trips.length !== 1 ? "s" : ""} · stored
                locally
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))",
                gap: 16,
                marginTop: -24,
              }}
            >
              {trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  deleteAction={removeTripAction}
                />
              ))}

              {/* New trip tile */}
              <a
                href="#create"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  alignItems: "flex-start",
                  minHeight: 172,
                  border: "1.5px dashed var(--mxj-stroke-strong)",
                  background: "transparent",
                  borderRadius: "var(--mxj-r-xl)",
                  padding: "22px 22px",
                  color: "var(--mxj-muted)",
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={undefined}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "1.5px dashed var(--mxj-stroke-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    color: "var(--mxj-faint)",
                  }}
                >
                  +
                </span>
                <span
                  className="mxj-serif"
                  style={{
                    fontSize: 20,
                    color: "var(--mxj-ink)",
                    letterSpacing: "-0.02em",
                    marginTop: 4,
                  }}
                >
                  New trip
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--mxj-muted)",
                    lineHeight: 1.5,
                  }}
                >
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
    <div
      className="mxj-glass mxj-card"
      style={{
        borderRadius: "var(--mxj-r-xl)",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {/* Photo placeholder */}
      <div
        className="mxj-photo"
        style={{
          height: 116,
          borderRadius: 0,
          border: "none",
          borderBottom: "1px solid var(--mxj-stroke)",
        }}
      >
        <span style={{ position: "relative", zIndex: 1 }}>
          {(trip.destination ?? trip.name).toLowerCase()}
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "16px 20px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        {/* Title row */}
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
              className="mxj-serif"
              style={{
                fontSize: 22,
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
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

        {/* Destination */}
        {trip.destination && (
          <span
            style={{
              fontSize: 12,
              color: "var(--mxj-muted)",
              letterSpacing: "0.01em",
            }}
          >
            {trip.destination}
          </span>
        )}

        {/* Footer */}
        <a
          href={`/trip/${trip.id}`}
          style={{ textDecoration: "none", color: "inherit", marginTop: "auto" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 12,
              marginTop: 8,
              borderTop: "1px solid var(--mxj-stroke)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--mxj-accent-deep)",
                letterSpacing: "-0.01em",
              }}
            >
              Open trip →
            </span>
            <span style={{ fontSize: 11, color: "var(--mxj-faint)" }}>
              {formatDate(trip.created_at)}
            </span>
          </div>
        </a>
      </div>
    </div>
  );
}
