"use client";

import { useState } from "react";
import type { PackingItem, PackingCategory } from "@/types/trip";
import { addPackingItem, updatePackingItem, deletePackingItem } from "@/lib/supabase";

const CATEGORIES: PackingCategory[] = ["clothing", "docs", "electronics", "toiletries", "other"];

interface Props {
  tripId: string;
  items: PackingItem[];
  onUpdate: (items: PackingItem[]) => void;
}

export default function PackingPanel({ tripId, items, onUpdate }: Props) {
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat]   = useState<PackingCategory>("other");
  const [adding, setAdding]   = useState(false);

  const packed   = items.filter(i => i.packed).length;
  const progress = items.length ? Math.round((packed / items.length) * 100) : 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const item = await addPackingItem({ trip_id: tripId, category: newCat, name: newName.trim(), packed: false, assigned_to: undefined });
    onUpdate([...items, item]);
    setNewName("");
    setAdding(false);
  }

  async function togglePacked(item: PackingItem) {
    await updatePackingItem(item.id, { packed: !item.packed });
    onUpdate(items.map(i => i.id === item.id ? { ...i, packed: !i.packed } : i));
  }

  async function handleDelete(id: string) {
    await deletePackingItem(id);
    onUpdate(items.filter(i => i.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Progress */}
      {items.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mxj-stroke)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="mxj-mono" style={{ color: "var(--mxj-muted)" }}>Packed</span>
            <span className="mxj-mono" style={{ color: "var(--mxj-ink)" }}>{packed}/{items.length}</span>
          </div>
          <div style={{ height: 3, background: "var(--mxj-stroke)", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress}%`, background: progress === 100 ? "var(--mxj-success)" : "var(--mxj-ink)", transition: "width 200ms" }} />
          </div>
        </div>
      )}

      {/* Items by category */}
      <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto" }}>
        {items.length === 0 ? (
          <p className="mxj-mono" style={{ color: "var(--mxj-faint)", textAlign: "center", padding: "32px 20px" }}>Packing list is empty.</p>
        ) : (
          CATEGORIES.filter(cat => items.some(i => i.category === cat)).map(cat => (
            <div key={cat}>
              <div style={{ padding: "10px 20px 6px", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mxj-mono" style={{ color: "var(--mxj-red)", fontSize: 9 }}>{cat.toUpperCase()}</span>
                <div style={{ flex: 1, height: 1, background: "var(--mxj-red)", opacity: 0.25 }} />
              </div>
              {items.filter(i => i.category === cat).map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", borderBottom: "1px solid var(--mxj-stroke)" }}>
                  <button
                    onClick={() => togglePacked(item)}
                    style={{
                      width: 16, height: 16, flexShrink: 0,
                      border: `1.5px solid ${item.packed ? "var(--mxj-ink)" : "var(--mxj-stroke-strong)"}`,
                      background: item.packed ? "var(--mxj-ink)" : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    aria-label={item.packed ? "Unpack" : "Pack"}
                  >
                    {item.packed && (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="square">
                        <path d="M2 5l2.5 2.5L8 3" />
                      </svg>
                    )}
                  </button>
                  <span style={{ flex: 1, fontSize: 13, color: item.packed ? "var(--mxj-faint)" : "var(--mxj-ink)", textDecoration: item.packed ? "line-through" : "none" }}>
                    {item.name}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-faint)", padding: 0, display: "flex" }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
                      <path d="M3 3l10 10M13 3L3 13" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ borderTop: "1px solid var(--mxj-stroke)", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
          <div>
            <div className="mxj-label">Item</div>
            <input className="mxj-input" placeholder="e.g. Passport" value={newName} onChange={e => setNewName(e.target.value)} required />
          </div>
          <div>
            <div className="mxj-label">Category</div>
            <select className="mxj-select" value={newCat} onChange={e => setNewCat(e.target.value as PackingCategory)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={adding} className="mxj-btn mxj-btn-primary" style={{ justifyContent: "center", padding: "11px 0" }}>
          {adding ? "Adding…" : "Add item"}
        </button>
      </form>
    </div>
  );
}
