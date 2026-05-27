"use client";

import { useState } from "react";
import type { Reservation, ReservationType, ReservationStatus } from "@/types/trip";
import { addReservation, updateReservation, deleteReservation } from "@/lib/supabase";

const TYPES: ReservationType[] = ["flight", "hotel", "restaurant", "activity", "other"];
const STATUSES: ReservationStatus[] = ["confirmed", "pending", "cancelled"];

const STATUS_COLOR: Record<ReservationStatus, string> = {
  confirmed: "var(--mxj-success)",
  pending:   "var(--mxj-muted)",
  cancelled: "var(--mxj-danger-text)",
};

interface Props {
  tripId: string;
  reservations: Reservation[];
  onAdd:    (r: Reservation)                   => void;
  onUpdate: (id: string, r: Partial<Reservation>) => void;
  onDelete: (id: string)                       => void;
}

export default function ReservationsPanel({ tripId, reservations, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState("");
  const [type, setType]         = useState<ReservationType>("other");
  const [date, setDate]         = useState("");
  const [time, setTime]         = useState("");
  const [code, setCode]         = useState("");
  const [notes, setNotes]       = useState("");
  const [cost, setCost]         = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [saving, setSaving]     = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await addReservation({
      trip_id: tripId, type, name: name.trim(),
      date: date || undefined, time: time || undefined,
      confirmation_code: code || undefined,
      notes: notes || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      currency, status: "pending",
    });
    onAdd(r);
    setName(""); setType("other"); setDate(""); setTime(""); setCode(""); setNotes(""); setCost("");
    setShowForm(false); setSaving(false);
  }

  async function cycleStatus(id: string, current: ReservationStatus) {
    const next: ReservationStatus = current === "pending" ? "confirmed" : current === "confirmed" ? "cancelled" : "pending";
    await updateReservation(id, { status: next });
    onUpdate(id, { status: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto" }}>
        {reservations.length === 0 && !showForm ? (
          <p className="mxj-mono" style={{ color: "var(--mxj-faint)", textAlign: "center", padding: "32px 20px" }}>No bookings yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--mxj-stroke)" }}>
                  <td style={{ padding: "11px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 3, alignItems: "center" }}>
                      <span className="mxj-mono" style={{ color: "var(--mxj-red)", fontSize: 8 }}>{r.type.toUpperCase()}</span>
                      {r.date && <span className="mxj-mono" style={{ color: "var(--mxj-faint)", fontSize: 9 }}>{r.date}{r.time ? ` · ${r.time}` : ""}</span>}
                      {r.confirmation_code && <span className="mxj-mono" style={{ color: "var(--mxj-muted)", fontSize: 9 }}>#{r.confirmation_code}</span>}
                    </div>
                  </td>
                  <td style={{ padding: "11px 8px", textAlign: "right" }}>
                    <button
                      onClick={() => cycleStatus(r.id, r.status)}
                      className="mxj-mono"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, letterSpacing: "0.10em", color: STATUS_COLOR[r.status] }}
                    >
                      {r.status.toUpperCase()}
                    </button>
                  </td>
                  <td style={{ padding: "11px 20px 11px 0", width: 28 }}>
                    <button
                      onClick={async () => { await deleteReservation(r.id); onDelete(r.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-faint)", padding: 0, display: "flex" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
                        <path d="M3 3l10 10M13 3L3 13" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showForm && (
          <form onSubmit={handleAdd} style={{ padding: "16px 20px", borderTop: "1px solid var(--mxj-stroke)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="mxj-label">Name</div>
                <input className="mxj-input" placeholder="e.g. TAP Air Portugal" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <div className="mxj-label">Type</div>
                <select className="mxj-select" value={type} onChange={e => setType(e.target.value as ReservationType)}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div className="mxj-label">Date</div>
                <input className="mxj-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <div className="mxj-label">Time</div>
                <input className="mxj-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div>
                <div className="mxj-label">Confirmation #</div>
                <input className="mxj-input" placeholder="ABC123" value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <div>
                <div className="mxj-label">Cost</div>
                <input className="mxj-input" type="number" step="0.01" min="0" placeholder="0.00" value={cost} onChange={e => setCost(e.target.value)} />
              </div>
            </div>
            <div>
              <div className="mxj-label">Notes</div>
              <textarea className="mxj-input" rows={2} placeholder="Any notes…" value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="mxj-btn mxj-btn-primary" style={{ flex: 1, justifyContent: "center", padding: "11px 0" }}>
                {saving ? "Saving…" : "Save booking"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="mxj-btn mxj-btn-ghost" style={{ padding: "11px 16px" }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {!showForm && (
        <div style={{ borderTop: "1px solid var(--mxj-stroke)", padding: "14px 20px" }}>
          <button onClick={() => setShowForm(true)} className="mxj-btn mxj-btn-primary" style={{ width: "100%", justifyContent: "center", padding: "11px 0" }}>
            Add booking
          </button>
        </div>
      )}
    </div>
  );
}
