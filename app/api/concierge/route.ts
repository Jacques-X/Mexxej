// Gemini AI Travel Concierge endpoint.
// Accepts the current itinerary + user message; returns a
// structured { reasoning, suggestion } JSON response.

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { TripLocation } from "@/types/trip";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── In-memory rate limiter: 5 requests per IP per 60 s ────────
const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (timestamps.length >= RATE_MAX) return true;
  rateLimitMap.set(ip, [...timestamps, now]);
  return false;
}

// Strip control characters and cap length to prevent prompt injection
function sanitizeForPrompt(s: string, maxLen = 300): string {
  return s
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .trim()
    .slice(0, maxLen);
}

// Structured output schema — Gemini will always return this shape
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    reasoning: {
      type: SchemaType.STRING,
      description: "Friendly, conversational explanation of the recommendation (2-4 sentences)",
    },
    suggestion: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Name of the suggested place" },
        latitude: { type: SchemaType.NUMBER, description: "WGS84 latitude" },
        longitude: { type: SchemaType.NUMBER, description: "WGS84 longitude" },
        description: {
          type: SchemaType.STRING,
          description: "One-sentence description of why this place is great",
        },
        category: {
          type: SchemaType.STRING,
          enum: ["hotel", "restaurant", "attraction", "transport", "other"],
        },
      },
      required: ["name", "latitude", "longitude", "description", "category"],
    },
  },
  required: ["reasoning", "suggestion"],
};

interface RequestBody {
  tripName: string;
  locations: TripLocation[];
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const body: RequestBody = await req.json();
  const { tripName, locations, message, history } = body;

  // Sanitize all user-supplied strings before embedding in the prompt
  const safeTripName = sanitizeForPrompt(tripName, 100);

  // Build a concise itinerary summary for the system prompt
  const itinerarySummary = locations
    .map(
      (l) =>
        `  Day ${l.day_number} | ${l.category} | ${sanitizeForPrompt(l.name, 100)} (${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)})${l.description ? ` — ${sanitizeForPrompt(l.description, 200)}` : ""}`
    )
    .join("\n");

  const systemPrompt = `You are an expert travel concierge AI for the trip "${safeTripName}".
Your role: suggest specific real-world places, restaurants, attractions, and hidden gems.
Always respond with valid coordinates for an actual existing location.
Be warm, enthusiastic, and specific — mention prices, opening times, or local tips when relevant.

Current itinerary:
${itinerarySummary || "  (no stops planned yet)"}

Respond ONLY with the JSON schema provided. Do not add any extra text outside the JSON.`;

  // Build Gemini chat history (Gemini uses "model" not "assistant")
  const chatHistory = history.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.8,
      maxOutputTokens: 1024,
    },
  });

  const chat = model.startChat({ history: chatHistory });

  let text: string;
  try {
    const result = await chat.sendMessage(message);
    text = result.response.text();
  } catch {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Concierge: failed to parse AI response", text);
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 502 }
    );
  }

  return NextResponse.json(parsed);
}
