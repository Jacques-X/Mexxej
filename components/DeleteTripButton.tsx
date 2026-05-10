"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  tripId: string;
  tripName: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export default function DeleteTripButton({ tripId, tripName, deleteAction }: Props) {
  const [pending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(`Delete "${tripName}" and all its pins? This cannot be undone.`)) return;
    const fd = new FormData();
    fd.append("id", tripId);
    startTransition(() => deleteAction(fd));
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      aria-label={`Delete ${tripName}`}
      className="shrink-0 p-2 rounded-lg text-zinc-600 hover:text-red-400 active:text-red-500
                 hover:bg-red-500/10 active:bg-red-500/15 transition-colors disabled:opacity-40"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
