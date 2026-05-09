"use client";

// Gemini-powered AI travel concierge sidebar.
// Sends the current itinerary as context with every message.

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
          history: messages.slice(-6), // last 6 turns for context window efficiency
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      const assistantMsg: AssistantMessage = {
        role: "assistant",
        content: data.reasoning,
        suggestion: data.suggestion,
      };
      setMessages((prev) => [...prev, assistantMsg]);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <aside className="absolute top-[57px] bottom-0 right-0 z-20 w-80 glass border-l border-white/8 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
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
          className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`
                max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                ${msg.role === "user"
                  ? "bg-sky-500 text-white rounded-tr-sm"
                  : "bg-white/6 border border-white/8 text-zinc-200 rounded-tl-sm"}
              `}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Fly-to button for suggestions */}
              {msg.suggestion && (
                <button
                  onClick={() => onSuggestion(msg.suggestion!)}
                  className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold
                             text-sky-300 hover:text-white bg-sky-500/15 hover:bg-sky-500/25
                             border border-sky-500/30 rounded-lg px-3 py-1.5 transition-all w-full"
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

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/8">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about restaurants, hidden gems…"
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm
                       placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50
                       disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40
                       disabled:cursor-not-allowed text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-700 mt-2 text-center">
          Itinerary context: {locations.length} location{locations.length !== 1 ? "s" : ""}
        </p>
      </div>
    </aside>
  );
}
