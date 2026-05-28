"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTrip } from "@/lib/supabase";

export default function DeleteTripButton({ tripId }: { tripId: string }) {
  const router   = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTrip(tripId);
      router.push("/");
    } catch {
      setDeleting(false);
      setConfirm(false);
    }
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="mxj-btn mxj-btn-danger"
        style={{ padding: "9px 16px", fontSize: 12 }}
      >
        Delete trip
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span className="mxj-mono" style={{ color: "var(--mxj-muted)", fontSize: 11 }}>Confirm?</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="mxj-btn mxj-btn-danger"
        style={{ padding: "9px 14px", fontSize: 12 }}
      >
        {deleting ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="mxj-btn mxj-btn-ghost"
        style={{ padding: "9px 14px", fontSize: 12 }}
      >
        Cancel
      </button>
    </div>
  );
}
