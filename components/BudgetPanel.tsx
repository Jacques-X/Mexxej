"use client";

import { useState } from "react";
import type { BudgetItem, BudgetCategory } from "@/types/trip";
import { addBudgetItem, deleteBudgetItem } from "@/lib/supabase";

const CATEGORIES: BudgetCategory[] = ["accommodation", "food", "activities", "transport", "shopping", "other"];

interface Props {
  tripId: string;
  items: BudgetItem[];
  onUpdate: (items: BudgetItem[]) => void;
}

export default function BudgetPanel({ tripId, items, onUpdate }: Props) {
  const [desc, setDesc]     = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat]       = useState<BudgetCategory>("other");
  const [currency, setCurrency] = useState("EUR");
  const [adding, setAdding] = useState(false);

  const total = items.reduce((s, i) => s + i.amount, 0);
  const byCategory = CATEGORIES.map(c => ({
    cat: c,
    sum: items.filter(i => i.category === c).reduce((s, i) => s + i.amount, 0),
  })).filter(x => x.sum > 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim() || !amount) return;
    setAdding(true);
    const item = await addBudgetItem({ trip_id: tripId, category: cat, description: desc.trim(), amount: parseFloat(amount), currency, paid_by: undefined, date: undefined, location_id: undefined });
    onUpdate([...items, item]);
    setDesc(""); setAmount("");
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await deleteBudgetItem(id);
    onUpdate(items.filter(i => i.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto" }}>

        {/* Summary */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--mxj-stroke)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="mxj-mono" style={{ color: "var(--mxj-muted)" }}>Total</span>
          <span className="mxj-display" style={{ fontSize: 28, color: "var(--mxj-ink)" }}>
            {total.toFixed(2)} <span style={{ fontSize: 14, opacity: 0.5 }}>{items[0]?.currency ?? "EUR"}</span>
          </span>
        </div>

        {/* By category */}
        {byCategory.length > 0 && (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--mxj-stroke)", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {byCategory.map(x => (
              <div key={x.cat} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="mxj-mono" style={{ color: "var(--mxj-red)", fontSize: 8 }}>{x.cat.toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{x.sum.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Items list */}
        {items.length === 0 ? (
          <p className="mxj-mono" style={{ color: "var(--mxj-faint)", textAlign: "center", padding: "32px 20px" }}>No expenses yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--mxj-stroke)" }}>
                  <td style={{ padding: "10px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.description}</div>
                    <div className="mxj-mono" style={{ color: "var(--mxj-red)", fontSize: 8, marginTop: 2 }}>{item.category.toUpperCase()}</div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap", fontSize: 14 }}>
                    {item.amount.toFixed(2)} <span style={{ color: "var(--mxj-muted)", fontSize: 11 }}>{item.currency}</span>
                  </td>
                  <td style={{ padding: "10px 20px 10px 0", width: 28 }}>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-faint)", padding: 0, display: "flex", alignItems: "center" }}
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
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ borderTop: "1px solid var(--mxj-stroke)", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div className="mxj-label">Description</div>
            <input className="mxj-input" placeholder="e.g. Hotel night" value={desc} onChange={e => setDesc(e.target.value)} required />
          </div>
          <div>
            <div className="mxj-label">Amount</div>
            <input className="mxj-input" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8 }}>
          <div>
            <div className="mxj-label">Category</div>
            <select className="mxj-select" value={cat} onChange={e => setCat(e.target.value as BudgetCategory)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="mxj-label">Currency</div>
            <input className="mxj-input" placeholder="EUR" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
          </div>
        </div>
        <button type="submit" disabled={adding} className="mxj-btn mxj-btn-primary" style={{ justifyContent: "center", padding: "11px 0" }}>
          {adding ? "Adding…" : "Add expense"}
        </button>
      </form>
    </div>
  );
}
