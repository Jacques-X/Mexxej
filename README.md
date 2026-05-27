# Mexxej

Group trip planner built around a live Google satellite map.
No accounts — create a trip, drop pins, share the link.

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd mexxej
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # Google Cloud Console — Maps JS API + Places API + Map Tiles API
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project Settings > API
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase project Settings > API
GEMINI_API_KEY=                    # Google AI Studio — gemini-2.0-flash
NEXT_PUBLIC_CESIUM_ION_TOKEN=      # ion.cesium.com — kept for future use
```

The dev server will throw at startup if any of the first four are missing.

### 3. Database

Run `supabase/schema.sql` in the Supabase SQL Editor once. It creates all
tables, indexes, RLS policies, a storage bucket, and enables Realtime.

### 4. Run

```bash
npm run dev
# open http://localhost:3000
```

## Architecture

```
app/page.tsx               Home — create trip, recent trips list
app/trip/[tripId]/page.tsx Trip planner — server component loads trip data
components/TripPlanner.tsx Main shell: map + sidebar + mobile sheet
components/Map3D.tsx       Google Maps (2D satellite) via @vis.gl/react-google-maps
lib/supabase.ts            All database access (typed helpers)
app/api/concierge/         Gemini AI concierge (rate-limited, sanitised)
app/api/tiles/             Google 3D Tiles proxy (EEA region workaround)
```

## Design system

Survey aesthetic: cool white · ink black · ordnance survey red. Near-zero radii.
No glassmorphism. All tokens live in `app/globals.css` as `--mxj-` CSS variables.
See `CLAUDE.md` for the full design reference and gotchas.

## Commands

```bash
npm run dev        # development server on :3000
npm run build      # production build
npm run lint       # ESLint
npx tsc --noEmit   # type-check without building
```

## Notes

- **No auth** — trips are accessed by UUID. Anyone with the link can edit.
- **Realtime** — `trip_locations` uses Supabase Realtime; pins sync live to all clients.
- **Tiles proxy** — `/api/tiles` proxies Google 3D Tiles through a US East Vercel
  function to bypass the EEA IP restriction on the Tiles API.
- **Dead code** — `lib/timeline.ts` and `lib/cinematicFlyover.ts` are fully built
  but not yet wired into the UI.
