# PRODUCT.md — Mexxej product context

## Product purpose

Mexxej (Maltese: "guide / leader") is a collaborative group trip planner built
around a live Google satellite map. The core loop: create a trip, drop pins by
day, share a link — everyone in the group edits the same map, no account needed.

## Users

Small groups (2-6 people) planning leisure trips together. Opened on a laptop
at home — Sunday morning, kitchen table — before the trip begins. Comfortable
with web tools but not technical. They want speed, clarity, and the feeling of
having a plan.

## Register

Product (task-focused). The map is the product. The UI serves the map — it does
not compete with it.

## Features

**Core**
- Create a trip with a name and destination
- Drop location pins on the 3D satellite map, organised by day
- Drag-to-reorder stops within a day
- Click a pin to open the info card (name, category, description, coordinates, navigate button)
- Street View portal for any stop
- Share the trip via URL — anyone with the link can view and edit

**Panels (accessible via sidebar tabs)**
- Route: day-by-day stop list with crosshair markers and arrival times
- Bookings: flight/hotel/restaurant/activity reservations with status cycling
- Budget: expense tracker by category with running total
- Packing: checklist with progress bar, per-category grouping
- Concierge: AI assistant (Gemini 2.0 Flash) that suggests stops and can add them

**Ready but not wired into UI**
- Day timeline inference: haversine travel-time calculation between stops,
  cascade from arrival anchors (lib/timeline.ts)
- Cinematic flyover: screen-capture the tab while the camera orbits each stop
  and export as .webm (lib/cinematicFlyover.ts)

## Design — Survey aesthetic

**Reference:** Ordnance Survey maps, aviation sectional charts, Swiss Federal
Railways signage. Precision instruments. Things where information density is a
virtue and decoration is a liability.

**Palette:** Cool white base + ink black + ordnance survey red (oklch 50% 0.22 24).
Red is the only chromatic colour — used exclusively for active states, labels,
and primary CTAs.

**Typography:** Big Shoulders Display 900 for all headings and the wordmark.
system-ui for body. JetBrains Mono for coordinates, labels, and metadata.
Uppercase and tight tracking throughout — no italic, no decorative serif.

**Geometry:** 0-2px border-radius across the entire UI. Square buttons, square
chips, square pins. The crosshair stop marker (a square with cross lines) is
the visual signature of the design.

**Anti-references:**
- Dark glassmorphic travel apps (Wanderlog, Maps.me dark mode)
- White SaaS minimalism (Notion-style, Airtable-style)
- Editorial magazine aesthetics (Fraunces/Newsreader headlines, broadsheet grids)
- Navy + gold luxury travel clichés
- Warm parchment / amber instrument panel (prior iterations of this project)

## Tech stack

Next.js 15 App Router · TypeScript · Supabase (Postgres + Realtime + Storage)
· @vis.gl/react-google-maps · Gemini 2.0 Flash · Tailwind CSS 3.4 · dnd-kit

## What makes it unusual

Most travel apps start from "what should a travel app feel like" and land
somewhere familiar. Mexxej starts from the map. It is a cartographic instrument
that happens to plan trips — the UI looks like it belongs in a map room, not a
travel magazine.
