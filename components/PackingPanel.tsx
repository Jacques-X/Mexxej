"use client";
import { useState } from "react";
import type { Trip, PackingItem, PackingCategory } from "@/types/trip";

interface Props {
  trip: Trip;
  items: PackingItem[];
  onAdd: (item: Omit<PackingItem, "id" | "created_at" | "order_index">) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<PackingItem, "id" | "trip_id" | "created_at">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CATEGORIES: PackingCategory[] = ["clothing", "docs", "electronics", "toiletries", "other"];
const CAT_LABELS: Record<PackingCategory, string> = { clothing: "Clothing", docs: "Documents", electronics: "Electronics", toiletries: "Toiletries", other: "Other" };
const CAT_ICONS: Record<PackingCategory, string> = { clothing: "👕", docs: "📄", electronics: "🔌", toiletries: "🧴", other: "📦" };

const PRESETS: Record<string, Array<{ category: PackingCategory; name: string }>> = {
  Beach: [
    { category: "clothing", name: "Swimsuit" }, { category: "clothing", name: "Sunglasses" }, { category: "clothing", name: "Flip flops" },
    { category: "toiletries", name: "Sunscreen SPF 50" }, { category: "toiletries", name: "After-sun lotion" },
    { category: "other", name: "Beach towel" }, { category: "other", name: "Snorkelling mask" },
    { category: "docs", name: "Passport" }, { category: "docs", name: "Travel insurance" },
  ],
  City: [
    { category: "clothing", name: "Comfortable walking shoes" }, { category: "clothing", name: "Rain jacket" },
    { category: "electronics", name: "Camera" }, { category: "electronics", name: "Power bank" }, { category: "electronics", name: "Universal adapter" },
    { category: "docs", name: "Passport" }, { category: "docs", name: "Hotel confirmation" },
    { category: "other", name: "Reusable water bottle" }, { category: "other", name: "Day bag" },
  ],
  Mountain: [
    { category: "clothing", name: "Hiking boots" }, { category: "clothing", name: "Thermal layers" }, { category: "clothing", name: "Waterproof jacket" },
    { category: "other", name: "Trekking poles" }, { category: "other", name: "First aid kit" }, { category: "other", name: "Headlamp" },
    { category: "toiletries", name: "Insect repellent" }, { category: "docs", name: "Passport" },
    { category: "electronics", name: "GPS device / offline maps" },
  ],
};

export default function PackingPanel({ trip, items, onAdd, onUpdate, onDelete }: Props) {
  const [newItems, setNewItems] = useState<Record<PackingCategory, string>>({} as Record<PackingCategory, string>);
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});
  const [loadingPreset, setLoadingPreset] = useState(false);

  const packedCount = items.filter((i) => i.packed).length;

  async function handleAddItem(cat: PackingCategory) {
    const name = (newItems[cat] ?? "").trim();
    if (!name) return;
    setNewItems((p) => ({ ...p, [cat]: "" }));
    await onAdd({ trip_id: trip.id, category: cat, name, packed: false, assigned_to: undefined });
  }

  async function applyPreset(preset: string) {
    const entries = PRESETS[preset];
    if (!entries) return;
    setLoadingPreset(true);
    for (const e of entries) {
      await onAdd({ trip_id: trip.id, category: e.category, name: e.name, packed: false, assigned_to: undefined });
    }
    setLoadingPreset(false);
  }

  async function togglePacked(item: PackingItem) {
    await onUpdate(item.id, { packed: !item.packed });
  }

  async function saveAssign(item: PackingItem) {
    const val = (assignMap[item.id] ?? "").trim();
    await onUpdate(item.id, { assigned_to: val || undefined });
    setAssignMap((p) => { const n = { ...p }; delete n[item.id]; return n; });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "18px 20px 10px", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="mxj-serif" style={{ margin: 0, fontSize: 22 }}>Packing</h2>
          {items.length > 0 && (
            <div style={{ fontSize: 11, fontFamily: "var(--mxj-mono)", color: "var(--mxj-muted)", marginTop: 2 }}>
              {packedCount}/{items.length} packed
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(PRESETS).map((p) => (
            <button key={p} className="mxj-btn" style={{ padding: "4px 10px", fontSize: 11 }} disabled={loadingPreset} onClick={() => applyPreset(p)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Overall progress bar */}
      {items.length > 0 && (
        <div style={{ margin: "0 20px 12px", height: 4, borderRadius: 2, background: "var(--mxj-stroke)", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ height: "100%", borderRadius: 2, background: "var(--mxj-accent)", width: `${(packedCount / items.length) * 100}%`, transition: "width 0.3s" }} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {items.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--mxj-muted)", fontSize: 13, padding: "32px 20px" }}>
            Nothing packed yet — use a preset or add items below.
          </p>
        )}
        {CATEGORIES.map((cat) => {
          const catItems = items.filter((i) => i.category === cat);
          const catPacked = catItems.filter((i) => i.packed).length;
          return (
            <div key={cat} style={{ marginBottom: 4 }}>
              <div style={{ padding: "6px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, fontFamily: "var(--mxj-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mxj-muted)" }}>
                  {CAT_ICONS[cat]} {CAT_LABELS[cat]}
                </span>
                {catItems.length > 0 && (
                  <span style={{ fontSize: 10, fontFamily: "var(--mxj-mono)", color: "var(--mxj-muted)" }}>{catPacked}/{catItems.length}</span>
                )}
              </div>
              {catItems.map((item) => {
                const isEditingAssign = item.id in assignMap;
                return (
                  <div key={item.id} style={{
                    padding: "8px 20px", borderBottom: "1px solid var(--mxj-stroke)",
                    display: "flex", alignItems: "center", gap: 10,
                    opacity: item.packed ? 0.55 : 1,
                  }}>
                    <button
                      onClick={() => togglePacked(item)}
                      style={{
                        width: 20, height: 20, borderRadius: 4, border: `2px solid ${item.packed ? "var(--mxj-accent)" : "var(--mxj-stroke-strong)"}`,
                        background: item.packed ? "var(--mxj-accent)" : "none", cursor: "pointer", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      aria-label={item.packed ? "Unpack" : "Pack"}
                    >
                      {item.packed && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <span style={{ flex: 1, fontSize: 14, color: "var(--mxj-ink)", textDecoration: item.packed ? "line-through" : "none" }}>{item.name}</span>
                    {item.assigned_to && !isEditingAssign && (
                      <span
                        style={{ fontSize: 10, fontFamily: "var(--mxj-mono)", padding: "1px 6px", borderRadius: 999, background: "var(--mxj-glass-bg)", border: "1px solid var(--mxj-stroke)", color: "var(--mxj-muted)", cursor: "pointer" }}
                        onClick={() => setAssignMap((p) => ({ ...p, [item.id]: item.assigned_to ?? "" }))}
                      >{item.assigned_to}</span>
                    )}
                    {isEditingAssign && (
                      <input
                        className="mxj-input"
                        style={{ width: 80, padding: "2px 6px", fontSize: 11 }}
                        value={assignMap[item.id]}
                        onChange={(e) => setAssignMap((p) => ({ ...p, [item.id]: e.target.value }))}
                        onBlur={() => saveAssign(item)}
                        onKeyDown={(e) => e.key === "Enter" && saveAssign(item)}
                        autoFocus
                        placeholder="Assign to"
                      />
                    )}
                    {!isEditingAssign && !item.assigned_to && (
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-muted)", fontSize: 11, padding: "2px 4px" }}
                        onClick={() => setAssignMap((p) => ({ ...p, [item.id]: "" }))} title="Assign to person">👤</button>
                    )}
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mxj-muted)", fontSize: 13, padding: "2px 4px" }} onClick={() => onDelete(item.id)} title="Delete">✕</button>
                  </div>
                );
              })}
              {/* Inline add row */}
              <div style={{ padding: "6px 20px", display: "flex", gap: 6 }}>
                <input
                  className="mxj-input"
                  style={{ flex: 1, padding: "5px 10px", fontSize: 12 }}
                  placeholder={`Add ${CAT_LABELS[cat].toLowerCase()} item…`}
                  value={newItems[cat] ?? ""}
                  onChange={(e) => setNewItems((p) => ({ ...p, [cat]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddItem(cat)}
                />
                <button className="mxj-btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => handleAddItem(cat)}>+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
