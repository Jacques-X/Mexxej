# CLAUDE.md — Mexxej codebase context

Read this before touching any file. It covers architecture, design rules,
known gotchas, and patterns not obvious from code alone.

---

## What this project is

**Mexxej** (Maltese: "guide / leader") is a collaborative group trip planner.
No accounts. Users create a trip, drop pins on a live Google satellite map,
organise stops by day, track bookings, and share via a secret URL.

**Stack:** Next.js 15 App Router · TypeScript · Supabase (Postgres + Storage)
· @vis.gl/react-google-maps · Gemini 2.0 Flash (AI concierge) · Tailwind CSS 3.4
· dnd-kit · Big Shoulders + JetBrains Mono (next/font/google)

---

## File structure

```
app/
  globals.css              <- All design tokens + utility classes (mxj- prefix)
  layout.tsx               <- Font loading: Big_Shoulders, JetBrains_Mono
  page.tsx                 <- Home page — create trip / recent trips table
  trip/[tripId]/page.tsx   <- Server component — loads trip, renders TripPlanner
  api/
    concierge/route.ts     <- Gemini 2.0 Flash AI endpoint (rate-limited)
    tiles/[...path]/route.ts <- Google 3D Tiles proxy (EEA workaround)
    routing/route.ts       <- Travel time proxy: OSRM (walk/cycle) + Transitous (transit)

components/
  Map3D.tsx                <- Google Maps wrapper — read carefully before editing
  TripPlanner.tsx          <- Main planner: map + sidebar + mobile sheet
  InfoCard.tsx             <- Floating location detail card
  StreetViewPortal.tsx     <- Full-screen street view overlay
  Logo.tsx                 <- Wordmark with survey dot
  ReservationsPanel.tsx / TravelConcierge.tsx
  BudgetPanel.tsx / PackingPanel.tsx  <- COMPONENTS EXIST but tabs removed from UI
  MediaMoodBoard.tsx / DeleteTripButton.tsx

lib/
  supabase.ts              <- ALL DB access goes here — typed Supabase helpers
  timeline.ts              <- Day timeline inference — wired into TripPlanner itinerary
  cinematicFlyover.ts      <- Screen-capture flyover  — not currently wired into UI

types/trip.ts              <- All shared TypeScript types
supabase/schema.sql        <- Source of truth for the DB schema
```

---

## Design system — Survey aesthetic

**The rule in one sentence:** Cool white + ink black + ordnance survey red.
Near-zero radii. No gradients. No blur.

### CSS variables — always use var(--mxj-…), never hardcode colours

```
--mxj-base          oklch(97.5% 0.004 200)   cool off-white page bg
--mxj-surface       oklch(100%  0     0)      pure white — panels, cards
--mxj-surface-2     oklch(96%   0.003 200)    inset areas, hover rows
--mxj-ink           oklch(11%   0.008 240)    near-black
--mxj-muted         oklch(46%   0.006 220)    secondary text
--mxj-faint         oklch(70%   0.005 210)    hints, placeholders
--mxj-stroke        oklch(84%   0.005 210)    default border
--mxj-stroke-strong oklch(68%   0.006 210)    emphasis border
--mxj-red           oklch(50%   0.220 24)     ordnance survey red — the only accent
--mxj-red-hover     oklch(44%   0.220 24)
--mxj-red-light     oklch(95%   0.040 24)     pale red fill
--mxj-danger-text   same as --mxj-red in this theme
--mxj-success       oklch(46%   0.140 150)
--mxj-r-sm/md/lg/xl 0px / 1px / 2px / 2px   near-zero radii
```

### Utility classes — all in globals.css

```
.mxj-display / .mxj-serif   Big Shoulders 900, uppercase, letter-spacing -0.01em
.mxj-mono                   JetBrains Mono 11px, tracking 0.06em
.mxj-panel / .mxj-glass     white surface + 1px stroke border, no blur
.mxj-panel-strong           white + 1px ink border + 3px/3px offset shadow
.mxj-btn                    uppercase Big Shoulders, 0px radius, 1px ink border
.mxj-btn-primary            ink bg + white text; hover turns red
.mxj-btn-ghost              transparent, muted border
.mxj-btn-danger             red border + red text
.mxj-chip                   mono 9px, uppercase, 0px radius
.mxj-input / .mxj-select    flat form controls, 0px radius
.mxj-label                  red mono 9px field label
.mxj-section-label          red mono + red bottom border
.mxj-stop-marker            crosshair pin: 10px square with red cross lines
.mxj-stop-marker.inactive   crosshair in stroke-strong colour
.mxj-info-card              absolute bottom-right card; mobile = fixed bottom sheet
.mxj-desktop / .mxj-mobile  responsive visibility — see Gotcha #1
```

### Absolute bans (enforced by `* { backdrop-filter: none !important }`)
- No glassmorphism / backdrop-filter / blur
- No CSS gradients
- No rgba() — always oklch() or var(--mxj-…)
- No border-radius above 2px
- No decorative box-shadow

---

## Known gotchas

### 1. Responsive classes — use mxj-desktop / mxj-mobile, not Tailwind md: prefixes

Tailwind md:hidden and hidden md:flex are unreliable here because CSS can be
served stale. These CSS classes are defined in globals.css with a real @media
rule and always work.

```tsx
// CORRECT
<div className="mxj-desktop">desktop only</div>
<div className="mxj-mobile">mobile only</div>

// AVOID — may silently fail
<div className="hidden md:flex">
<div className="md:hidden">
```

### 2. Map3D must be wrapped in `position: absolute; inset: 0`

If Map3D is an in-flow child it collapses to its natural height. Always wrap it.

```tsx
<div style={{ position: "absolute", inset: 0 }}>
  <Map3D ref={mapRef} ... />
</div>
```

### 3. Font name in next/font/google

"Big Shoulders Display" is exported as Big_Shoulders in Next.js 15.5.x.
Big_Shoulders_Display does not exist and causes a TypeScript error.

```ts
import { Big_Shoulders } from "next/font/google"; // correct
import { Big_Shoulders_Display } from "next/font/google"; // TS error
```

### 4. File writes in this dev environment — use Python or bash

The Edit/Write tools do not work on the mounted project directory. Use:

```bash
python3 << 'PY'
content = "..."
with open("/sessions/.../mnt/Mexxej/components/Foo.tsx", "w") as f:
    f.write(content)
PY
```

For files with single quotes, write a Python script to /outputs first, then run it.
The Read and Grep tools work fine on mounted paths.

### 5. Tiles proxy must run in US East

app/api/tiles/[...path]/route.ts proxies Google 3D Tiles to bypass the EEA IP
restriction. It must keep `preferredRegion: "iad1"`. The proxy rewrites tile
URLs in JSON responses so Cesium routes all requests through it. Do not remove
even if 3D tiles are not visibly used.

### 6. NEXT_PUBLIC_CESIUM_ION_TOKEN is in .env but currently unused

From an earlier CesiumJS version. The map now uses @vis.gl/react-google-maps.
Keep the token — it is needed if 3D tile layers are re-enabled in Map3D.

### 7. Dead code in lib/ — intentionally kept, ready to wire up

lib/cinematicFlyover.ts — tab screen-capture flyover via MediaRecorder.
Not wired into UI. Needs Map3DHandle.flyCameraAround.

### 8. Transport modes — walk / cycle / transit only (no drive)

"drive" was removed from TransportMode. The three supported modes are:
  walk    → OSRM foot profile (real road routing, no key)
  cycle   → OSRM bike profile (real road routing, no key)
  transit → Transitous community MOTIS server (real GTFS, no key, strong European coverage)

Travel times are fetched via GET /api/routing and cached in TripPlanner state
keyed `${fromId}:${toId}`. When a mode changes, that leg's cache entry is
cleared and re-fetched. If the routing call fails, the UI falls back to a
haversine straight-line estimate shown with "~est".

transport_mode is stored on the FROM location (representing mode to next stop).

### 8a. Transit leg details and scheduled times

For transit legs, /api/routing returns the full leg breakdown from Transitous:
- mode (WALK | BUS | RAIL | TRAM | SUBWAY | FERRY …)
- route (short name e.g. "IC 1", "42B")
- headsign (direction board e.g. "Zürich HB")
- agency (operator e.g. "SBB")
- fromStop / toStop (boarding / alighting station names)
- departTime / arriveTime (epoch ms — present when depart_date was passed)

Departure date/time passed to Transitous:
- depart_date: trip.start_date + (day_number − 1) days, falling back to today
- depart_time: arrival_time of the FROM stop + duration_minutes; omitted if
  the stop has no anchor time

The connector between stops shows a leg-breakdown row:
  🚶 5m  →  [🚆 IC 1 → Zürich HB  10:23–11:05]  →  🚶 2m

When epoch-ms times are present, dep–arr times replace the duration for
transit legs. Walk legs always show minutes.

**Timezone note:** departTime / arriveTime are "HH:MM" strings extracted from
ISO 8601 timestamps returned by MOTIS 2 (e.g. "2026-05-28T10:23:00+02:00" →
"10:23"). The timezone offset is baked into the ISO string by the server, so
the extracted time is always correct for the stop's local timezone regardless
of where the user's browser is. No client-side timezone conversion is needed.

### 9. Timeline system — wired into itinerary

lib/timeline.ts exports computeDayTimeline(stops, realTravelMinutes).
TripPlanner calls it per day and renders arrival/departure times inline.
Users can click any time or duration to edit it in-place; blur saves to DB.
Anchor: the first stop with arrival_time set; times cascade forward and backward.

### 10. StreetViewPortal exit button — zIndex required

The Google Street View panorama renders a full DOM layer that sits above
everything. The controls bar div must have zIndex: 10 and pointerEvents: "auto"
or the close button is unreachable.

```tsx
<div style={{
  position: "absolute", top: 16, left: 16, zIndex: 10,
  display: "flex", alignItems: "center", gap: 10,
  pointerEvents: "auto",
}}>
```

---

## Data loading pattern — Promise.allSettled

TripPlanner loads from three tables on mount. Use `Promise.allSettled` so that
one missing or RLS-failing table does not silently block the others.

```ts
Promise.allSettled([
  getLocationsByTrip(trip.id),
  getDayNotes(trip.id),
  getReservations(trip.id),
]).then(([locsR, notesR, resR]) => {
  const locs  = locsR.status  === "fulfilled" ? locsR.value  : [];
  const notes = notesR.status === "fulfilled" ? notesR.value : [];
  const res   = resR.status   === "fulfilled" ? resR.value   : [];
  setLocations(locs); setDayNotes(notes); setReservations(res);
  if (locs.length) setActiveDay(locs[0].day_number);
});
```

Never use `Promise.all` for multi-table loads — one rejection kills everything.

---

## Fire-and-forget DB writes — always add .catch

Inline edits (drag reorder, time edit, transport mode, stop edit, day note)
optimistically update state first and fire the DB write in the background.
These must never silently swallow errors:

```ts
updateLocation(id, patch).catch(console.error);   // ✓
reorderLocations(updates).catch(console.error);   // ✓
upsertDayNote(tripId, day, text).catch(console.error); // ✓ (called in debounce)
```

For destructive operations (delete), always await and guard state update:

```ts
async function handleDeleteLocation(id: string) {
  try {
    await deleteLocation(id);
  } catch {
    return; // DB failed — leave UI unchanged
  }
  setLocations(prev => prev.filter(l => l.id !== id));
}
```

---

## TripPlanner sidebar tabs

ActiveTab = `"map" | "reservations" | "concierge"`.
Budget and packing tabs were removed from the UI (components still exist).
The `···` overflow menu in the top bar exposes DeleteTripButton.

---

## Day notes — debounced upsert

Per-day notes are stored in `trip_day_notes` (UNIQUE on trip_id + day_number).
The textarea fires `handleDayNoteChange` which debounces 600ms then calls
`upsertDayNote`. Debounce timers are held in `noteTimers = useRef<Record<number, ...>>({})`.

---

## Add Day button

The sidebar day tabs row includes a `+ Day` button. It appends to `extraDays`
state (number[]). `displayDays` merges DB-derived days with extraDays:

```ts
const displayDays = [...new Set([...(days.length ? days : [1]), ...extraDays])]
  .sort((a, b) => a - b);
```

An extra day with no stops is valid — it just shows an empty itinerary.

---

## Inline stop editing (SortableStop)

The `SortableStop` component inside TripPlanner has an `editing` boolean state.
When active: drag handle is hidden, the name/timing row is replaced by an inline
form (name input, category select, description textarea, Save/Cancel buttons).
`saveEdit` calls `updateLocation` and falls back gracefully on error. Clicking
outside does not save — user must press Save or Cancel.

---

## Concierge → Add Pin pre-fill

When the concierge returns a suggestion and the user clicks "Add to trip",
`handleAddSuggestion` sets `pendingSuggestion` and opens AddPinPanel. The panel
receives `initialValues` (name, lat, lng, category) and skips the geocoding
step (`coordConfirm` starts `true`). On close the `pendingSuggestion` is cleared.

---

## Database

### Access model
No user auth. All tables have public RLS policies. Anyone with the trip ID
can read and write. secret_token exists for share URLs but is not currently
used as an access gate; access is by trips.id directly.

### Schema summary

```
trips
  id uuid PK, name, destination, secret_token UNIQUE,
  start_date, end_date, created_at

trip_locations
  id, trip_id FK->trips CASCADE, name, latitude, longitude,
  day_number, category, description, media_url,
  order_index, duration_minutes, arrival_time, transport_mode
  INDEX on (trip_id, day_number, order_index)

trip_day_notes
  id, trip_id FK->trips CASCADE, day_number, content, updated_at
  UNIQUE (trip_id, day_number)

trip_reservations
  id, trip_id FK->trips CASCADE, type, name, date, time,
  confirmation_code, notes, cost, currency, status

trip_budget_items
  id, trip_id FK->trips CASCADE, category, description, amount,
  currency, paid_by, date, location_id FK->trip_locations SET NULL

trip_packing_items
  id, trip_id FK->trips CASCADE, category, name, packed,
  assigned_to, order_index
```

All FK tables use `ON DELETE CASCADE` — deleting a trip removes all child rows.
Do NOT manually delete child rows before deleting the trip.

### lib/supabase.ts — key helpers

All DB access must go through this file. Key helpers:

```ts
createTrip(name, destination)    -> Trip   // generates secret_token via crypto.randomUUID()
getTripById(id)                  -> Trip | null
getTripsByIds(ids)               -> Trip[] // used by home page recent trips
updateTrip(id, updates)          -> Trip
deleteTrip(id)                   -> void   // CASCADE handles children — no manual cleanup
getLocationsByTrip(tripId)       -> TripLocation[]
addLocation(payload)             -> TripLocation
updateLocation(id, updates)      -> TripLocation
deleteLocation(id)               -> void
reorderLocations(updates)        -> void   // bulk order_index update
getDayNotes(tripId)              -> TripDayNote[]
upsertDayNote(tripId, day, text) -> TripDayNote
getReservations(tripId)          -> Reservation[]
addReservation(payload)          -> Reservation
updateReservation(id, updates)   -> Reservation
deleteReservation(id)            -> void
```

### Storage
Bucket trip-media: public read/upload/delete. Max 50 MB.
Types: JPEG, PNG, WebP, GIF, PDF, MP4.

### Realtime
trip_locations is on supabase_realtime. Clients get instant push
when another user adds or moves a pin.

---

## API routes

### POST /api/concierge
Gemini 2.0 Flash. Rate limit: 5 req/IP/60s in-memory.
Body: { messages, destination?, locations }
Response: { reasoning: string, suggestion: ConciergeSuggestion }
All user strings are sanitised before prompt embedding.

### GET /api/tiles/[...path]
Google 3D Tiles proxy. Requires preferredRegion: "iad1".
Rewrites absolute and relative tile URLs in JSON responses.
Binary tiles cached 24h; JSON manifests 5min.

### GET /api/routing
Travel time proxy. No API key required for any mode.
Params:
  from_lat, from_lng, to_lat, to_lng  (required)
  mode          walk | cycle | transit   (default: walk)
  depart_date   YYYY-MM-DD   optional — used for transit schedule lookup
  depart_time   HH:MM        optional — departure time from origin stop
Response:
  { minutes: number, real: boolean }              walk/cycle
  { minutes: number, real: boolean, legs: [...] } transit

  walk/cycle → OSRM router.project-osrm.org (foot/bike profiles)
  transit    → Transitous MOTIS 2 API  api.transitous.org/api/v5/plan

Each transit leg: { mode, minutes, route?, headsign?, agency?,
                    fromStop?, toStop?, departTime?, arriveTime? }
  departTime / arriveTime are "HH:MM" strings in local stop timezone,
  extracted directly from the ISO 8601 response (timezone offset is baked in).
  Present only when depart_date was given to the request.

Falls back gracefully — returns 502 on failure, client shows haversine estimate.

NOTE: Transitous migrated from OTP v1 (/api/v1/plan) to MOTIS 2 (/api/v5/plan)
in 2025. The response structure changed: itineraries are now at the root
(data.itineraries) rather than nested (data.plan.itineraries), and times are
ISO 8601 strings rather than epoch milliseconds.

---

## Environment variables

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   Google Maps + Places + 3D Tiles
NEXT_PUBLIC_SUPABASE_URL          Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     Supabase anon key (public-safe)
GEMINI_API_KEY                    Google AI Studio (server-side only)
NEXT_PUBLIC_CESIUM_ION_TOKEN      CesiumJS token (unused in current UI, keep it)
```

next.config.ts validates the first four at startup and throws on missing vars.

---

## Dev commands

```bash
npm run dev         # localhost:3000
npm run build       # production build (runs env var check)
npx tsc --noEmit    # type-check only
```

After editing globals.css: hard-refresh the browser. Next.js Fast Refresh
does not always re-evaluate CSS changes.

---

## Never do

- Use backdrop-filter, blur(), or any glassmorphism — globally banned
- Hardcode rgba() in components — use oklch() or var(--mxj-…)
- Set border-radius above 2px
- Import Big_Shoulders_Display — it is Big_Shoulders
- Use md:hidden / hidden md:flex — use mxj-mobile / mxj-desktop
- Place Map3D as an in-flow child — always wrap in position:absolute inset:0
- Remove the tiles proxy route
- Call supabase directly from components — always go through lib/supabase.ts
- Use Promise.all for multi-table loads — use Promise.allSettled
- Swallow DB errors silently — always .catch(console.error) on fire-and-forget writes
- Delete child rows manually before deleting a trip — CASCADE handles it
