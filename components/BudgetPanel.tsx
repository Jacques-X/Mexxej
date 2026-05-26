"use client";
import { useState } from "react";
import type { Trip, BudgetItem, BudgetCategory, TripLocation } from "@/types/trip";

interface Props {
  trip: Trip;
  items: BudgetItem[];
  locations: TripLocation[];
  onAdd: (item: Omit<BudgetItem, "id" | "created_at">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CATEGORIES: BudgetCategory[] = ["accommodation", "food", "activities", "transport", "shopping", "other"];
const CAT_LABELS: Record<BudgetCategory, string> = { accommodation: "Accommodation", food: "Food", activities: "Activities", transport: "Transport", shopping: "Shopping", other: "Other" };
const CAT_ICONS: Record<BudgetCategory, string> = { accommodation: "🏨", food: "🍽", activities: "🎭", transport: "✈", shopping: "🛍", other: "📌" };
const CAT_COLORS: Record<BudgetCategory, string> = { accommodation: "#6c8eff", food: "#ff8c69", activities: "#9c6cff", transport: "#4caf81", shopping: "#f0c060", other: "#888" };

const EMPTY_FORM = { category: "other" as BudgetCategory, description: "", amount: "", currency: "EUR", paid_by: "", date: "", location_id: "" };

export default function BudgetPanel({ trip, items, locations, onAdd, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const total = items.reduce((s, i) => s + i.amount, 0);
  const byCat = CATEGORIES.reduce<Record<BudgetCategory, number>>((acc, c) => {
    acc[c] = items.filter((i) => i.category === c).reduce((s, i) => s + i.amount, 0);
    return acc;
  }, {} as Record<BudgetCategory, number>);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.description.trim() || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await onAdd({
        trip_id: trip.id,
        category: form.category,
        description: form.description.trim(),
        amount,
        currency: form.currency || "EUR",
        paid_by: form.paid_by.trim() || undefined,
        date: form.date || undefined,
        location_id: form.location_id || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "18px 20px 10px", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="mxj-serif" style={{ margin: 0, fontSize: 22 }}>Budget</h2>
        <button className="mxj-btn" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Summary card */}
      <div style={{ margin: "0 20px 14px", padding: "14px 16px", borderRadius: 12, background: "var(--mxj-glass-bg)", border: "1px solid var(--mxj-stroke)", flexShrink: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--mxj-ink)", marginBottom: 10 }}>
          {total.toLocaleString("en", { minimumFractionDigits: 2 })} <span style={{ fontSize: 14, fontWeight: 400, color: "var(--mxj-muted)" }}>total</span>
        </div>
        {/* Bar chart */}
        {total > 0 && (
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            {CATEGORIES.filter((c) => byCat[c] > 0).map((c) => (
              <div key={c} style={{ flex: byCat[c] / total, background: CAT_COLORS[c], minWidth: 4 }} title={`${CAT_LABELS[c]}: ${byCat[c].toLocaleString("en", { minimumFractionDigits: 2 })}`} />
            ))}
          </div>
        )}
        {total > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 8 }}>
            {CATEGORIES.filter((c) => byCat[c] > 0).map((c) => (
              <span key={c} style={{ fontSize: 10, fontFamily: "var(--mxj-mono)", color: "var(--mxj-muted)" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[c], marginRight: 4 }} />
                {CAT_LABELS[c]} {byCat[c].toLocaleString("en", { minimumFractionDigits: 2 })}
              </span>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ padding: "0 20px 16px", flexShrink: 0, borderBottom: "1px solid var(--mxj-stroke)" }}>
          <select className="mxj-input" style={{ width: "100%", marginBottom: 8, boxSizing: "border-box" }} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as BudgetCategory }))}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_ICONS[c]} {CAT_LABELS[c]}</option>)}
          </select>
          <input className="mxj-input" style={{ width: "100%", marginBottom: 8, boxSizing: "border-box" }} placeholder="Description *" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8, marginBottom: 8 }}>
            <input className="mxj-input" type="number" min="0.01" step="0.01" placeholder="Amount *" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required />
            <input className="mxj-input" placeholder="EUR" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase().slice(0, 3) }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input className="mxj-input" placeholder="Paid by" value={form.paid_by} onChange={(e) => setForm((p) => ({ ...p, paid_by: e.target.value }))} />
            <input className="mxj-input" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          </div>
          {locations.length > 0 && (
            <select className="mxj-input" style={{ width: "100%", marginBottom: 8, boxSizing: "border-box" }} value={form.location_id} onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}>
              <option value="">— Link to location (optional) —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <button className="mxj-btn" type="submit" disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Add Expense"}
          </button>
        </form>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {items.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--mxj-muted)", fontSize: 13, padding: "32px 20px" }}>
            No expenses yet — start tracking your trip budget.
          </p>
        )}
        {CATEGORIES.filter((c) => byCat[c] > 0).map((cat) => (
          <div key={cat}>
            <div style={{ padding: "6px 20px 4px", fontSize: 10, fontFamily: "var(--mxj-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mxj-muted)" }}>
              {CAT_ICONS[cat]} {CAT_LABELS[cat]}
            </div>
            {items.filter((i) => i.category === cat).map((item) => (
              <div key={item.id} style={{ padding: "10px 20px", borderBottom: "1px solid var(--mxj-stroke)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--mxj-ink)", fontWeight: 500, marginBottom: 2 }}>{item.description}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {item.paid_by && <span style={{ fontSize: 11, fontFamily: "var(--mxj-mono)", padding: "1px 6px", borderRadius: 999, background: "var(--mxj-glass-bg)", border: "1px solid var(--mxj-stroke)", color: "var(--mxj-muted)" }}>{item.paid_by}</span>}
                    {item.date && <span style={{ fontSize: 11, color: "var(--mxj-muted)" }}>{item.date}</span>}
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--mxj-ink)", flexShrink: 0 }}>
                  {item.amount.toLocaleString("en", { minimumFractionDigits: 2 })} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--mxj-muted)" }}>{item.currency}</span>
                </span>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-muted)", fontSize: 13, padding: "2px 4px", flexShrink: 0 }} onClick={() => onDelete(item.id)} title="Delete">✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
