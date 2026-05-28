-- ============================================================
-- Mexxej — Migration: add missing tables
-- Paste into Supabase → SQL Editor → Run
-- Safe to run multiple times (IF NOT EXISTS throughout).
-- ============================================================

-- ─── DAY NOTES ──────────────────────────────────────────────
create table if not exists trip_day_notes (
  id          uuid        primary key default uuid_generate_v4(),
  trip_id     uuid        not null references trips(id) on delete cascade,
  day_number  integer     not null,
  content     text        not null default '',
  updated_at  timestamptz default now(),
  unique(trip_id, day_number)
);

alter table trip_day_notes enable row level security;

do $$ begin
  create policy "open_day_notes"
    on trip_day_notes for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- ─── RESERVATIONS ───────────────────────────────────────────
create table if not exists trip_reservations (
  id                uuid        primary key default uuid_generate_v4(),
  trip_id           uuid        not null references trips(id) on delete cascade,
  type              text        not null default 'other'
                                check (type in ('flight','hotel','restaurant','activity','other')),
  name              text        not null,
  date              date,
  time              text,
  confirmation_code text,
  notes             text,
  cost              numeric(10,2),
  currency          text        default 'EUR',
  status            text        not null default 'confirmed'
                                check (status in ('confirmed','pending','cancelled')),
  created_at        timestamptz default now()
);

alter table trip_reservations enable row level security;

do $$ begin
  create policy "open_reservations"
    on trip_reservations for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists trip_reservations_trip_id_idx
  on trip_reservations(trip_id);

-- ─── BUDGET ─────────────────────────────────────────────────
create table if not exists trip_budget_items (
  id          uuid        primary key default uuid_generate_v4(),
  trip_id     uuid        not null references trips(id) on delete cascade,
  category    text        not null default 'other'
                          check (category in
                            ('accommodation','food','activities','transport','shopping','other')),
  description text        not null,
  amount      numeric(10,2) not null,
  currency    text        default 'EUR',
  paid_by     text,
  date        date,
  location_id uuid        references trip_locations(id) on delete set null,
  created_at  timestamptz default now()
);

alter table trip_budget_items enable row level security;

do $$ begin
  create policy "open_budget"
    on trip_budget_items for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists trip_budget_items_trip_id_idx
  on trip_budget_items(trip_id);

-- ─── PACKING LIST ───────────────────────────────────────────
create table if not exists trip_packing_items (
  id          uuid        primary key default uuid_generate_v4(),
  trip_id     uuid        not null references trips(id) on delete cascade,
  category    text        not null default 'other',
  name        text        not null,
  packed      boolean     not null default false,
  assigned_to text,
  order_index integer     not null default 0,
  created_at  timestamptz default now()
);

alter table trip_packing_items enable row level security;

do $$ begin
  create policy "open_packing"
    on trip_packing_items for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create index if not exists trip_packing_items_trip_id_idx
  on trip_packing_items(trip_id);

-- ─── transport_mode column (add if missing) ─────────────────
alter table trip_locations
  add column if not exists transport_mode text;
