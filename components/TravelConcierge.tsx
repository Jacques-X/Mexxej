"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, Bot, Loader2, MapPin } from "lucide-react";
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
      content: `Hey! I'm your AI travel concierge for **${trip.name}**. Ask me for restaurant recommendations, hidden gems, or anything about your itinerary — I'll fly the camera right there.`,
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
     * Mobile:  full-screen overlay that slides in. Safe-area padding on
     *          top (notch/island) and bottom (home indicator).
     * Desktop: right-edge sidebar, 320 px wide, below the top bar.
     */
    <aside className="
      absolute z-30 glass flex flex-col animate-fade-in
      inset-x-0 bottom-0 top-0
      md:inset-x-auto md:top-[57px] md:right-0 md:w-80 md:border-l md:border-white/8
    ">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}
      >
        {/* On mobile pad the top for the notch; reset on desktop */}
        <div
          className="md:hidden absolute top-0 left-0 right-0"
          style={{ height: "env(safe-area-inset-top, 0px)" }}
        />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <Bot className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Travel Concierge</p>
            <p className="text-xs text-zinc-500">Powered by Gemini</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white active:text-white rounded-xl
                     flex items-center justify-center transition-colors"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`
              max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
              ${msg.role === "user"
                ? "bg-sky-500 text-white rounded-tr-sm"
                : "bg-white/6 border border-white/8 text-zinc-200 rounded-tl-sm"}
            `}>
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {msg.suggestion && (
                <button
                  onClick={() => onSuggestion(msg.suggestion!)}
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold
                             text-sky-300 active:text-white bg-sky-500/15 active:bg-sky-500/30
                             border border-sky-500/30 rounded-lg px-3 py-1.5 transition-all w-full"
                  style={{ minHeight: 44 }}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  Fly to {msg.suggestion.name}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/6 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — safe-bot padding ensures it clears the home indicator */}
      <div className="px-4 pt-2 pb-4 shrink-0 border-t border-white/8 safe-bot">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about restaurants, hidden gems…"
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm
                       placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50
                       disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-2xl bg-sky-500 active:bg-sky-600 disabled:opacity-40
                       disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center"
            style={{ minWidth: 48, minHeight: 48 }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-700 mt-2 text-center">
          {locations.length} location{locations.length !== 1 ? "s" : ""} in context
        </p>
      </div>
    </aside>
  );
}
