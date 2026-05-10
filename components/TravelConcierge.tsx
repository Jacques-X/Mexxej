"use client";

import { useState, useRef, useEffect } from "react";
import type { Trip, TripLocation, ConciergeSuggestion, ConciergeMessage } from "@/types/trip";

interface Props {
  trip: Trip;
  locations: TripLocation[];
  onSuggestion: (suggestion: ConciergeSuggestion) => void;
  onClose: () => void;
}

interface AssistantMessage extends ConciergeMessage {
  suggestion?: ConciergeSuggestion;
}

export default function TravelConcierge({ trip, locations, onSuggestion, onClose }: Props) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: `Ask me for restaurant recommendations, hidden gems, or anything about your itinerary — I'll fly the camera right there.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: AssistantMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripName: trip.name,
          locations,
          message: text,
          history: messages.slice(-6),
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reasoning,
        suggestion: data.suggestion,
      }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the AI. Please try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    /*
     * Mobile: full-screen. Desktop: right sidebar below top bar.
     */
    <aside className="mxj-concierge-panel mxj-glass-strong animate-fade-in">
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        padding: "20px 22px 16px",
        paddingTop: "max(env(safe-area-inset-top, 0px), 20px)",
        borderBottom: "1px solid var(--mxj-stroke)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          {/* Gradient avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, var(--mxj-accent) 0%, var(--mxj-accent-soft) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            ✦
          </div>
          <div>
            <div className="mxj-serif" style={{ fontSize: 20, lineHeight: 1 }}>Concierge</div>
            <span className="mxj-mono" style={{ marginTop: 4, display: "block" }}>
              {locations.length} stop{locations.length !== 1 ? "s" : ""} in context
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", color: "var(--mxj-muted)",
            cursor: "pointer", padding: 4, display: "flex", alignItems: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className="scroll-touch scrollbar-thin"
        style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                background: msg.role === "user"
                  ? "rgba(232,140,100,0.18)"
                  : "rgba(246,239,228,0.06)",
                border: "1px solid " + (msg.role === "user"
                  ? "rgba(232,140,100,0.3)"
                  : "var(--mxj-stroke)"),
                fontSize: 14, lineHeight: 1.55,
                color: msg.role === "user" ? "#f6d0bb" : "var(--mxj-ink)",
              }}
            >
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg.content}</p>

              {msg.suggestion && (
                <button
                  onClick={() => onSuggestion(msg.suggestion!)}
                  className="mxj-btn"
                  style={{
                    marginTop: 10, width: "100%", justifyContent: "flex-start",
                    padding: "8px 12px",
                    background: "rgba(136,168,192,0.12)",
                    borderColor: "rgba(136,168,192,0.35)",
                    color: "var(--mxj-cool)",
                    fontSize: 12,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 14s5-4.5 5-9a5 5 0 10-10 0c0 4.5 5 9 5 9z"/><circle cx="8" cy="5.5" r="1.6"/>
                  </svg>
                  Fly to {msg.suggestion.name}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 16px",
              borderRadius: "4px 14px 14px 14px",
              background: "rgba(246,239,228,0.06)",
              border: "1px solid var(--mxj-stroke)",
              display: "flex", gap: 5, alignItems: "center",
            }}>
              {[0, 1, 2].map((n) => (
                <span key={n} className="mxj-pulse" style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "var(--mxj-muted)",
                  animationDelay: `${n * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 18px",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        borderTop: "1px solid var(--mxj-stroke)", flexShrink: 0,
        display: "flex", gap: 10, alignItems: "center",
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about restaurants, hidden gems…"
          disabled={loading}
          className="mxj-input"
          style={{ flex: 1, padding: "10px 14px", opacity: loading ? 0.5 : 1 }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: "var(--mxj-accent)", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: loading || !input.trim() ? "default" : "pointer",
            opacity: loading || !input.trim() ? 0.4 : 1,
            transition: "opacity 0.15s",
            color: "#1a1208",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M2 8L14 2l-4 12-2-5z" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
