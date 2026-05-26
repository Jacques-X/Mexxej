# TREK Comparison & Mexxej Evolution Roadmap

## TREK Overview
**TREK** is a mature, self-hosted collaborative trip planner with 38 pages, 24 component directories, and a feature-rich ecosystem. Version 3.0.22+ with 100+ stars on GitHub.

### TREK Tech Stack
- **Frontend:** React 18 + React Router v6 + Vite (vs. Mexxej's Next.js 15)
- **State:** Zustand (vs. Mexxej's direct Supabase client)
- **Maps:** Leaflet + Mapbox GL (vs. Mexxej's Cesium 3D)
- **Styling:** Tailwind CSS (same as Mexxej)
- **Testing:** Vitest + Playwright (vs. Mexxej's none yet)
- **DB:** Custom backend with PostgreSQL (vs. Mexxej's Supabase)
- **Auth:** Custom auth with MFA support (vs. Mexxej's secret-token model)

---

## Feature Scope: TREK vs. Mexxej

### TREK Features (what we could adopt)

**Trip Planning**
- ✅ Drag-and-drop reordering of stops (Mexxej has basic add/delete)
- ✅ **Day notes** with timestamps and icons (Mexxej lacks this)
- ✅ Route optimization (auto-sort, export to Google Maps)
- ✅ **Weather forecasts** (16-day via Open-Meteo)
- ✅ Place ratings & hours (via Google Places)
- ❌ **Reservations tracker** — flights, hotels, restaurants with confirmation #s
- ❌ **Budget tracking** — category-based expenses, multi-currency, pie charts, per-person splits
- ❌ **Packing lists** — templates, user assignment, progress tracking
- ❌ **PDF export** — full trip plan with images, notes, cover page

**Collaboration & Sharing**
- ✅ Multi-user sharing (via secret URL in Mexxej, vs. TREK's fine-grained roles)
- ✅ Real-time sync (Supabase Realtime in Mexxej)
- ❌ Role-based permissions (viewer, editor, admin)
- ❌ User-specific task assignments
- ❌ In-app notifications for shared trips

**Travel Management**
- ❌ **Files & document management** — attach PDFs, tickets (≤50 MB per file)
- ❌ **Bag tracking** — optional weight distribution visualization

**Developer Experience**
- ✅ TREK has 40+ test files (Mexxej has 0)
- ✅ i18n support (11+ languages in TREK; Mexxej is English-only)
- ✅ Offline support via localStorage/IndexedDB
- ✅ PWA capability (vite-plugin-pwa)

---

## Mexxej's Current Strengths

1. **Photorealistic 3D maps** — Cesium + Google Photorealistic 3D Tiles is industry-leading; TREK uses 2D (Leaflet/Mapbox)
2. **AI-powered concierge** — Gemini suggestions; TREK has no AI features
3. **Minimal friction** — secret URL sharing, no login; TREK requires auth
4. **Modern Next.js 15** — server components, streaming, etc.; TREK uses React 18 SPA
5. **Supabase integration** — seamless realtime + storage; TREK uses custom backend

---

## UI/UX Insights from TREK

### Layout & Navigation
- **Bottom navigation** (mobile) + sidebar (desktop) — Mexxej uses fixed overlays
- **Dashboard** showing recent trips, stats, quick-access cards
- **Consistent icon set** (Lucide React) across all pages
- **Color-coded categories** (hotel, restaurant, attraction, etc.) with consistent palette

### Trip Planning Page
- **Left sidebar:** Day-by-day itinerary list with drag-to-reorder
- **Main canvas:** Full-screen interactive map
- **Right toolbar:** Action buttons (add pin, route, export, AI, etc.)
- **Info card modal:** Expanded location details (Mexxej does this)
- **Day filter pills:** Show only stops for selected day (Mexxej does this)

### Key Interaction Patterns
- **Drag-and-drop** for reordering stops across days
- **Place search** with autocomplete showing ratings, photos, hours
- **Inline editing** of stop names, descriptions, categories
- **Quick actions** (delete, duplicate, share, export)
- **Contextual popovers** vs. modal dialogs (less friction)
- **Toast notifications** for confirmations and errors

---

## Recommended Mexxej Roadmap (Priority Order)

### Phase 1: Core Polish (next sprint)
1. **Drag-and-drop reordering** of locations within/across days
   - Use `react-dnd` or native drag API
   - Update order_index on drop (already fixed race condition)
   
2. **Day notes** — timestamped, markdown-enabled notes per day
   - New table: `day_notes(id, trip_id, day_number, content, created_at)`
   - Show in day sidebar, collapsible

3. **Testing** — add Vitest + unit tests for critical paths
   - Start with `lib/supabase.ts` (10 tests)
   - Component tests for TripPlanner state logic

4. **Improve error messages** — surface geocoding failures, network errors, validation errors
   - Toast library: use existing mxj-glass toast component
   - Show user-friendly hints, not raw error codes

### Phase 2: Travel Management (2–3 months)
1. **Reservations tracker**
   - Form: flight/hotel/restaurant with dates, confirmation #, cost, notes, attachments
   - List view with calendar integration
   - Badge for "upcoming" vs. "past"

2. **Budget tracker**
   - Per-stop expenses by category (accommodation, food, activities, transport)
   - Exchange rate calculator (currency selection)
   - Split view for "my cost" vs. "shared with group"

3. **Packing list**
   - Template library (beach, hiking, winter, etc.)
   - Category-based (clothing, docs, electronics, toiletries)
   - User assignment (mark as "packed by Alice")
   - Progress indicator

### Phase 3: Polish & Distribution (3–4 months)
1. **PDF export** — full trip document
   - Cover page (trip name, dates, travelers)
   - Day-by-day itinerary with photos and notes
   - Budget summary
   - Packing list checklist

2. **Public trip share**
   - Option to publish trip as read-only public page
   - Shows route map, day-by-day itinerary, photos
   - Share link (no auth needed)
   - Analytics: view count, shared metrics

---

## UI/UX Improvements (Quick Wins)

### Layout Tweaks
1. **Sidebar collapsing** — Hide itinerary sidebar on small screens to maximize map space
2. **Keyboard shortcuts** — `n` = new pin, `r` = route, `c` = concierge, `?` = help
3. **Better empty states** — Show onboarding tips when trip has 0 locations
4. **Loading spinners** — Replace with skeleton screens for faster perceived load
5. **Map controls** — Add zoom/pan buttons for accessibility

### Visual Polish
1. **Location hover effects** — Highlight marker on map when hovering itinerary list
2. **Category color consistency** — Use the same color palette for markers, pills, badges
3. **Photo thumbnails** — Show preview of media_url in info card (currently just open external link)
4. **Weather forecast badge** — Show current/7-day weather for destination in top bar
5. **Trip stats** — In desktop top bar, show "5 stops · 3 days · 240 km"

### Accessibility
1. **Focus management** — Trap focus in modal dialogs, restore on close
2. **Keyboard nav** — Arrow keys to cycle through stops, Enter to open
3. **ARIA labels** — All iconography needs aria-label
4. **Color contrast** — Ensure all text passes WCAG AA

---

## Architecture Recommendations

### State Management
**Current:** Direct Supabase client in React components  
**Problem:** Hard to test, race conditions, no error boundary  
**Solution:** Adopt Zustand store (like TREK) for trip state
```typescript
// stores/tripStore.ts
const useTripStore = create((set) => ({
  trip: null,
  locations: [],
  isLoading: false,
  error: null,
  fetchTrip: async (tripId) => { /* ... */ },
  addLocation: async (loc) => { /* ... */ },
  updateLocation: async (id, updates) => { /* ... */ },
  deleteLocation: async (id) => { /* ... */ },
  reorderLocations: async (updates) => { /* ... */ },
}))
```

### Component Organization
```
components/
├── Layout/                 (AppShell, BottomNav, Sidebar)
├── TripPlanner/           (Map, Itinerary, InfoCard)
├── Modals/                (AddLocation, EditLocation, TravelConcierge)
├── Cards/                 (LocationCard, DayHeaderCard)
├── Shared/                (Toast, Button, Input, Select)
└── Icons/                 (auto-generated from Lucide)
```

### Testing Strategy
1. **Unit tests** — Zustand stores, utility functions
2. **Component tests** — Modal form submissions, state updates
3. **Integration tests** — Full trip flow (add → edit → reorder → delete)
4. **E2E tests** (later) — Playwright for critical user journeys

---

## New Feature Ideas (Inspired by TREK)

1. **Collaborative editing** — Show live cursors of other users in shared trips
2. **AI trip suggestions** — "Based on your interests, we recommend…"
3. **Multi-day routes** — Optimize itinerary order with TSP solver
4. **Instagram integration** — Embed posts/reels for locations
5. **Expense splitting** — Track who paid what, settle-up calculator
6. **Checklist categories** — Pre-populate by trip type (beach, city, mountain)
7. **Time zones** — Warn about long flights, adjust itinerary times
8. **Parking map** — Find parking near each location (if driving)

---

## Tech Debt to Address

1. ~~**NaN coordinates**~~ ✅ Fixed
2. ~~**Prompt injection**~~ ✅ Fixed
3. ~~**Race condition in order_index**~~ ✅ Fixed
4. ~~**Rate limiting**~~ ✅ Fixed
5. **No error boundaries** — Add React Error Boundary wrapper
6. **No request deduplication** — Multiple concurrent API calls for same trip
7. **No service worker** — Offline support would help on flaky connections
8. **No build-time env validation** — ✅ Fixed
9. **Cesium CDN loaded on homepage** — Lazy-load only on trip page
10. **No analytics** — Track feature usage (e.g., which locations are most-clicked)

---

## Design System Wins from TREK

1. **Lucide React icons** — 600+ icons, consistent styling, small footprint
2. **Responsive design** — Mobile-first with md/lg breakpoints
3. **Glass-morphism UI** — Semi-transparent panels (Mexxej already does this well)
4. **Dark mode support** — Leverage Tailwind's dark: prefix
5. **Accessibility-first** — ARIA attributes, semantic HTML

---

## Comparison Table

| Feature | Mexxej | TREK |
|---------|--------|------|
| **3D Maps** | ✅ Cesium (photorealistic) | ❌ 2D only |
| **AI Concierge** | ✅ Gemini | ❌ No |
| **Auth** | ❌ Secret URL | ✅ Full auth + MFA |
| **Reservations** | ❌ | ✅ |
| **Budget** | ❌ | ✅ |
| **Packing List** | ❌ | ✅ |
| **Drag-and-Drop** | ❌ | ✅ |
| **PDF Export** | ❌ | ✅ |
| **Weather** | ❌ | ✅ |
| **Tests** | ❌ | ✅ (40+ files) |
| **i18n** | ❌ | ✅ (11 languages) |
| **Offline** | ❌ | ✅ |
| **Real-time collab** | ✅ (Supabase) | ✅ (custom) |
| **Free to self-host** | ✅ | ✅ |

---

## Next Steps

1. **Pick one Phase 1 task** (drag-and-drop is highest ROI)
2. **Set up Zustand store** for trip state
3. **Add Vitest** and write 5–10 unit tests to establish pattern
4. **Implement day notes** feature
5. **Phase 2 priority:** Reservations → Budget → Packing lists (based on user needs)
