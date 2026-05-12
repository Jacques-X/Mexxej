// Gemini AI Travel Concierge endpoint.
// Accepts the current itinerary + user message; returns a
// structured { reasoning, suggestion } JSON response.

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { TripLocation } from "@/types/trip";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
  const body: RequestBody = await req.json();
  const { tripName, locations, message, history } = body;

  // Build a concise itinerary summary for the system prompt
  const itinerarySummary = locations
    .map(
      (l) =>
        `  Day ${l.day_number} | ${l.category} | ${l.name} (${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)})${l.description ? ` — ${l.description}` : ""}`
    )
    .join("\n");

  const systemPrompt = `You are an expert travel concierge AI for the trip "${tripName}".
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
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: text },
      { status: 502 }
    );
  }

  return NextResponse.json(parsed);
}
