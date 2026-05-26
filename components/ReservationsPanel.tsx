"use client";
import { useState } from "react";
import type { Trip, Reservation, ReservationType, ReservationStatus } from "@/types/trip";

interface Props {
  trip: Trip;
  reservations: Reservation[];
  onAdd: (r: Omit<Reservation, "id" | "created_at">) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<Reservation, "id" | "trip_id" | "created_at">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TYPE_ORDER: ReservationType[] = ["flight", "hotel", "restaurant", "activity", "other"];
const TYPE_LABELS: Record<ReservationType, string> = { flight: "Flights", hotel: "Hotels", restaurant: "Restaurants", activity: "Activities", other: "Other" };
const TYPE_ICONS: Record<ReservationType, string> = { flight: "✈", hotel: "🏨", restaurant: "🍽", activity: "🎭", other: "📌" };
const STATUS_COLORS: Record<ReservationStatus, string> = { confirmed: "#4caf81", pending: "#e9a84c", cancelled: "#888" };

const EMPTY_FORM = {
  type: "other" as ReservationType,
  name: "",
  date: "",
  time: "",
  confirmation_code: "",
  notes: "",
  cost: "",
  currency: "EUR",
  status: "confirmed" as ReservationStatus,
};

export default function ReservationsPanel({ trip, reservations, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<Record<string, ReservationStatus>>({});

  const grouped = TYPE_ORDER.reduce<Record<ReservationType, Reservation[]>>((acc, t) => {
    acc[t] = reservations.filter((r) => r.type === t);
    return acc;
  }, {} as Record<ReservationType, Reservation[]>);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        trip_id: trip.id,
        type: form.type,
        name: form.name.trim(),
        date: form.date || undefined,
        time: form.time || undefined,
        confirmation_code: form.confirmation_code.trim() || undefined,
        notes: form.notes.trim() || undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        currency: form.currency || "EUR",
        status: form.status,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: Reservation) {
    setEditingId(r.id);
    setEditStatus((p) => ({ ...p, [r.id]: r.status }));
  }

  async function saveStatus(r: Reservation, status: ReservationStatus) {
    setEditStatus((p) => ({ ...p, [r.id]: status }));
    await onUpdate(r.id, { status });
    setEditingId(null);
  }

  const hasAny = reservations.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "18px 20px 10px", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="mxj-serif" style={{ margin: 0, fontSize: 22 }}>Bookings</h2>
        <button className="mxj-btn" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ padding: "0 20px 16px", flexShrink: 0, borderBottom: "1px solid var(--mxj-stroke)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <select className="mxj-input" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ReservationType }))}>
              {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <select className="mxj-input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ReservationStatus }))}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <input className="mxj-input" style={{ width: "100%", marginBottom: 8, boxSizing: "border-box" }} placeholder="Name / description *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input className="mxj-input" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            <input className="mxj-input" type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} />
          </div>
          <input className="mxj-input" style={{ width: "100%", marginBottom: 8, boxSizing: "border-box" }} placeholder="Confirmation code" value={form.confirmation_code} onChange={(e) => setForm((p) => ({ ...p, confirmation_code: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8, marginBottom: 8 }}>
            <input className="mxj-input" type="number" min="0" step="0.01" placeholder="Cost" value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} />
            <input className="mxj-input" placeholder="EUR" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase().slice(0, 3) }))} />
          </div>
          <textarea className="mxj-input" style={{ width: "100%", marginBottom: 10, boxSizing: "border-box", resize: "vertical", minHeight: 54 }} placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          <button className="mxj-btn" type="submit" disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save Booking"}
          </button>
        </form>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {!hasAny && (
          <p style={{ textAlign: "center", color: "var(--mxj-muted)", fontSize: 13, padding: "32px 20px" }}>
            No bookings yet — add flights, hotels, and restaurants.
          </p>
        )}
        {TYPE_ORDER.filter((t) => grouped[t].length > 0).map((type) => (
          <div key={type} style={{ marginBottom: 4 }}>
            <div style={{ padding: "6px 20px 4px", fontSize: 10, fontFamily: "var(--mxj-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mxj-muted)" }}>
              {TYPE_ICONS[type]} {TYPE_LABELS[type]}
            </div>
            {grouped[type].map((r) => {
              const status = editStatus[r.id] ?? r.status;
              return (
                <div key={r.id} style={{ padding: "10px 20px", borderBottom: "1px solid var(--mxj-stroke)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--mxj-ink)" }}>{r.name}</span>
                      <span style={{ fontSize: 10, fontFamily: "var(--mxj-mono)", padding: "2px 7px", borderRadius: 999, background: STATUS_COLORS[status] + "22", color: STATUS_COLORS[status], border: `1px solid ${STATUS_COLORS[status]}44` }}>
                        {status}
                      </span>
                    </div>
                    {(r.date || r.time) && (
                      <div style={{ fontSize: 12, color: "var(--mxj-muted)", marginTop: 2 }}>
                        {r.date}{r.date && r.time ? " · " : ""}{r.time}
                      </div>
                    )}
                    {r.confirmation_code && (
                      <div style={{ fontSize: 11, fontFamily: "var(--mxj-mono)", color: "var(--mxj-faint)", marginTop: 2 }}>
                        {r.confirmation_code}
                      </div>
                    )}
                    {r.cost != null && (
                      <div style={{ fontSize: 12, color: "var(--mxj-muted)", marginTop: 2 }}>
                        {r.cost.toLocaleString("en", { minimumFractionDigits: 2 })} {r.currency}
                      </div>
                    )}
                    {r.notes && (
                      <div style={{ fontSize: 12, color: "var(--mxj-muted)", marginTop: 3 }}>{r.notes}</div>
                    )}
                    {editingId === r.id && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        {(["confirmed", "pending", "cancelled"] as ReservationStatus[]).map((s) => (
                          <button key={s} className="mxj-btn" style={{ padding: "3px 8px", fontSize: 10, background: status === s ? STATUS_COLORS[s] : undefined }}
                            onClick={() => saveStatus(r, s)}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-muted)", fontSize: 13, padding: "2px 4px" }}
                      onClick={() => setEditingId(editingId === r.id ? null : r.id)} title="Change status">✎</button>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-muted)", fontSize: 13, padding: "2px 4px" }}
                      onClick={() => onDelete(r.id)} title="Delete">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
