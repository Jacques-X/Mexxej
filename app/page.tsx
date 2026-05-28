"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTrip, getTripsByIds } from "@/lib/supabase";
import type { Trip } from "@/types/trip";
import Logo from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [tripName, setTripName]       = useState("");
  const [creating, setCreating]       = useState(false);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [error, setError]             = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("mxj_recent_trips");
    if (!stored) return;
    const ids: string[] = JSON.parse(stored);
    if (!ids.length) return;
    getTripsByIds(ids.slice(0, 6))
      .then(data => setRecentTrips(data))
      .catch(console.error);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!destination.trim() || !tripName.trim()) {
      setError("Both fields are required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const trip = await createTrip(tripName.trim(), destination.trim());
      const prev = JSON.parse(localStorage.getItem("mxj_recent_trips") ?? "[]");
      localStorage.setItem("mxj_recent_trips", JSON.stringify([trip.id, ...prev].slice(0, 10)));
      router.push(`/trip/${trip.id}`);
    } catch {
      setError("Failed to create trip. Try again.");
      setCreating(false);
    }
  }

  function dayCount(t: Trip) {
    if (!t.start_date || !t.end_date) return null;
    const diff = Math.round(
      (new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000
    );
    return diff > 0 ? diff + 1 : null;
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--mxj-base)", display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ── */}
      <header style={{
        padding: "20px 32px",
        borderBottom: "1px solid var(--mxj-stroke)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--mxj-surface)",
      }}>
        <Logo size={16} />
        <span className="mxj-mono" style={{ color: "var(--mxj-faint)" }}>
          35°53′N 14°30′E
        </span>
      </header>

      {/* ── Hero ── */}
      <section style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "clamp(40px, 8vh, 100px) clamp(24px, 6vw, 80px)",
        maxWidth: 900,
      }}>

        <p className="mxj-mono" style={{ color: "var(--mxj-red)", marginBottom: 16 }}>
          Group trip planner · no account needed
        </p>

        <h1
          className="mxj-display"
          style={{
            fontSize: "clamp(64px, 11vw, 128px)",
            lineHeight: 0.88,
            margin: "0 0 20px",
            color: "var(--mxj-ink)",
          }}
        >
          Plan<br />your<br /><span style={{ color: "var(--mxj-red)" }}>route.</span>
        </h1>

        <p style={{ fontSize: 15, color: "var(--mxj-muted)", marginBottom: 40, maxWidth: 380, lineHeight: 1.6 }}>
          Name a destination. Drop pins on a live 3D map. Share the link — everyone edits together.
        </p>

        {/* ── Form ── */}
        <form onSubmit={handleCreate} style={{ maxWidth: 520 }}>
          <div style={{ border: "1px solid var(--mxj-ink)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ padding: "14px 18px", borderRight: "1px solid var(--mxj-stroke-strong)" }}>
              <div className="mxj-label">Destination</div>
              <input
                className="mxj-input"
                style={{ border: "none", padding: 0, fontSize: 15, background: "transparent" }}
                placeholder="e.g. Lisbon, Portugal"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                required
              />
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div className="mxj-label">Trip name</div>
              <input
                className="mxj-input"
                style={{ border: "none", padding: 0, fontSize: 15, background: "transparent" }}
                placeholder="e.g. Summer 2025"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", borderLeft: "1px solid var(--mxj-ink)", borderRight: "1px solid var(--mxj-ink)", borderBottom: "1px solid var(--mxj-ink)" }}>
            <button
              type="submit"
              disabled={creating}
              className="mxj-btn mxj-btn-primary"
              style={{ borderRadius: 0, border: "none", padding: "13px 28px", fontSize: 14 }}
            >
              {creating ? "Creating…" : "Create route →"}
            </button>
          </div>

          {error && (
            <p className="mxj-mono" style={{ color: "var(--mxj-red)", marginTop: 8, fontSize: 11 }}>
              {error}
            </p>
          )}
        </form>
      </section>

      {/* ── Recent trips ── */}
      {recentTrips.length > 0 && (
        <section style={{
          borderTop: "1px solid var(--mxj-stroke)",
          padding: "24px clamp(24px, 6vw, 80px) 40px",
          background: "var(--mxj-surface)",
        }}>
          <p className="mxj-section-label" style={{ marginBottom: 16, display: "inline-block" }}>
            Recent routes
          </p>
          <table style={{ width: "100%", maxWidth: 680, borderCollapse: "collapse" }}>
            <tbody>
              {recentTrips.map(t => (
                <tr
                  key={t.id}
                  className="mxj-card"
                  style={{ borderTop: "1px solid var(--mxj-stroke)", cursor: "pointer" }}
                  onClick={() => router.push(`/trip/${t.id}`)}
                >
                  <td style={{ padding: "11px 0", fontWeight: 500, fontSize: 14, width: "45%" }}>
                    {t.name}
                  </td>
                  <td style={{ padding: "11px 0", color: "var(--mxj-muted)", fontSize: 13, width: "35%" }}>
                    {t.destination ?? "—"}
                  </td>
                  <td style={{ padding: "11px 0", textAlign: "right" }}>
                    <span className="mxj-mono" style={{ color: "var(--mxj-faint)" }}>
                      {dayCount(t) ? `${dayCount(t)} days` : "open dates"}
                    </span>
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid var(--mxj-stroke)" }} />
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
