-- ============================================================
-- Mexxej — Holiday Planner Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── TRIPS ──────────────────────────────────────────────────
create table if not exists trips (
  id            uuid        primary key default uuid_generate_v4(),
  name          text        not null,
  -- 24-char hex token becomes the "Secret URL" segment
  secret_token  text        unique not null
                            default encode(gen_random_bytes(12), 'hex'),
  destination   text,
  start_date    date,
  end_date      date,
  created_at    timestamptz default now()
);

-- ─── TRIP LOCATIONS ─────────────────────────────────────────
create table if not exists trip_locations (
  id            uuid        primary key default uuid_generate_v4(),
  trip_id       uuid        not null references trips(id) on delete cascade,
  name          text        not null,
  latitude      double precision not null,
  longitude     double precision not null,
  day_number    integer     not null default 1,
  category      text        not null default 'other'
                            check (category in
                              ('hotel','restaurant','attraction','transport','other')),
  description   text,
  -- Either a social URL (TikTok/Instagram) or a Supabase Storage path
  media_url     text,
  order_index   integer     not null default 0,
  created_at    timestamptz default now()
);

create index if not exists trip_locations_trip_id_idx
  on trip_locations(trip_id);

create index if not exists trip_locations_day_order_idx
  on trip_locations(trip_id, day_number, order_index);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
-- The "secret URL" model means no user auth; anyone with the
-- trip ID may read and write.  Tighten these if you add auth.

alter table trips          enable row level security;
alter table trip_locations enable row level security;

-- Trips: anyone can read; only the desktop planner inserts/updates
create policy "public_read_trips"
  on trips for select using (true);

create policy "public_insert_trips"
  on trips for insert with check (true);

create policy "public_update_trips"
  on trips for update using (true);

-- Locations: full CRUD (kiosk adds pins, mobile reads them)
create policy "public_read_locations"
  on trip_locations for select using (true);

create policy "public_insert_locations"
  on trip_locations for insert with check (true);

create policy "public_update_locations"
  on trip_locations for update using (true);

create policy "public_delete_locations"
  on trip_locations for delete using (true);

-- ─── REALTIME ───────────────────────────────────────────────
-- Mobile phones get instant updates when the planner adds pins
alter publication supabase_realtime add table trip_locations;

-- ─── STORAGE BUCKET ─────────────────────────────────────────
-- Run this block separately if the bucket doesn't yet exist

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-media',
  'trip-media',
  true,
  52428800,  -- 50 MB per file
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf','video/mp4']
)
on conflict (id) do nothing;

create policy "public_read_trip_media"
  on storage.objects for select
  using (bucket_id = 'trip-media');

create policy "public_upload_trip_media"
  on storage.objects for insert
  with check (bucket_id = 'trip-media');

create policy "public_delete_trip_media"
  on storage.objects for delete
  using (bucket_id = 'trip-media');

-- ─── SEED — optional example trip ───────────────────────────
-- Uncomment to get a demo trip when first setting up:
/*
insert into trips (name, destination, start_date, end_date)
values ('Summer in Rome', 'Rome, Italy', '2025-07-10', '2025-07-17')
returning id, secret_token;
*/
