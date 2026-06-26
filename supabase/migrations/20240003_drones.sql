-- ─────────────────────────────────────────────
-- drone_groups
-- ─────────────────────────────────────────────

create table public.drone_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#00d4ff',
  created_by  uuid not null references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger drone_groups_updated_at
  before update on public.drone_groups
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────
-- drones
--
-- Telemetry scalars (battery, position, speed) are stored directly on the
-- row so the live map can do a single SELECT/realtime subscription without
-- joining a separate telemetry table.  Full time-series telemetry history
-- lives in the separate `telemetry` table (migration 20240004).
-- ─────────────────────────────────────────────

create table public.drones (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  model               text not null default '',
  status              drone_status not null default 'offline',

  -- Live position (null until first heartbeat)
  lat                 double precision,
  lng                 double precision,
  altitude            double precision,         -- metres ASL
  relative_altitude   double precision,         -- metres AGL
  speed               double precision,         -- m/s ground speed
  heading             double precision,         -- degrees 0-359

  -- Power
  battery_percent     smallint check (battery_percent between 0 and 100),
  battery_voltage     numeric(5,3),             -- Volts

  -- GPS
  satellite_count     smallint,
  signal_strength     smallint check (signal_strength between 0 and 100),

  -- MAVLink identifiers
  system_id           smallint unique,          -- 1-255, set when drone connects
  mavlink_version     smallint default 2,

  -- Relations
  group_id            uuid references public.drone_groups (id) on delete set null,
  assigned_mission_id uuid,                     -- FK added after missions table exists

  -- Housekeeping
  last_seen_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index drones_group_id_idx on public.drones (group_id);
create index drones_status_idx   on public.drones (status);

create trigger drones_updated_at
  before update on public.drones
  for each row execute procedure public.set_updated_at();

-- ── RLS ──────────────────────────────────────

alter table public.drone_groups enable row level security;
alter table public.drones       enable row level security;

-- All authenticated users can read drones and groups
create policy "drone_groups: authenticated read"
  on public.drone_groups for select to authenticated using (true);

create policy "drones: authenticated read"
  on public.drones for select to authenticated using (true);

-- Only operators can mutate drones
create policy "drones: operator insert"
  on public.drones for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
  );

create policy "drones: operator update"
  on public.drones for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
  );

create policy "drones: operator delete"
  on public.drones for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
  );

-- Operators manage groups
create policy "drone_groups: operator write"
  on public.drone_groups for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
  );

-- ── Realtime ─────────────────────────────────

-- Allow the realtime publication to stream drone changes to authenticated clients.
-- Run after enabling Realtime on this table in the Supabase dashboard, or:
--   alter publication supabase_realtime add table public.drones;
