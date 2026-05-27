"use client";

import { useState, useRef, useEffect } from "react";
import type { ConciergeMessage, ConciergeSuggestion, TripLocation } from "@/types/trip";

interface Props {
  tripId: string;
  destination?: string;
  locations: TripLocation[];
  onAddSuggestion?: (s: ConciergeSuggestion) => void;
}

export default function TravelConcierge({ tripId, destination, locations, onAddSuggestion }: Props) {
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: ConciergeMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, destination, locations }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", content: data.reasoning ?? "No response." }]);
      if (data.suggestion && onAddSuggestion) onAddSuggestion(data.suggestion);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div className="scrollbar-thin scroll-touch" style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <p className="mxj-mono" style={{ color: "var(--mxj-faint)", textAlign: "center", marginTop: 32 }}>
            Ask the concierge anything about {destination ?? "your destination"}.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "82%",
            background: m.role === "user" ? "var(--mxj-ink)" : "var(--mxj-surface-2)",
            color: m.role === "user" ? "var(--mxj-surface)" : "var(--mxj-ink)",
            border: m.role === "assistant" ? "1px solid var(--mxj-stroke)" : "none",
            padding: "9px 13px",
            fontSize: 13,
            lineHeight: 1.55,
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", padding: "9px 13px", background: "var(--mxj-surface-2)", border: "1px solid var(--mxj-stroke)" }}>
            <span className="mxj-mono" style={{ color: "var(--mxj-faint)" }}>thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} style={{ borderTop: "1px solid var(--mxj-stroke)", display: "flex", gap: 0 }}>
        <input
          className="mxj-input"
          style={{ flex: 1, border: "none", padding: "12px 16px", fontSize: 13 }}
          placeholder="Ask anything…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="mxj-btn mxj-btn-primary"
          style={{ border: "none", borderLeft: "1px solid var(--mxj-stroke)", padding: "12px 18px", fontSize: 12 }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
