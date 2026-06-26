-- ─────────────────────────────────────────────
-- telemetry (time-series history)
--
-- The MAVLink bridge writes one row per telemetry snapshot.
-- Live positions are mirrored on drones.lat/lng/etc for fast map queries.
-- This table is for dashboards, playback, and analytics.
--
-- For high-frequency drones (10 Hz), consider TimescaleDB or partitioning
-- by month. At 1 Hz per drone, 100 drones produce ~8.6M rows/day.
-- ─────────────────────────────────────────────

create table public.telemetry (
  id                uuid primary key default gen_random_uuid(),
  drone_id          uuid not null references public.drones (id) on delete cascade,
  recorded_at       timestamptz not null default now(),

  -- Position
  lat               double precision not null,
  lng               double precision not null,
  altitude          double precision not null,
  relative_altitude double precision,

  -- Flight
  speed             double precision,
  heading           double precision,

  -- Power
  battery_percent   smallint,
  battery_voltage   numeric(5,3),

  -- GPS
  satellite_count   smallint,
  signal_strength   smallint,

  -- Status at time of snapshot
  status            drone_status not null default 'idle'
);

-- Primary query patterns: latest N rows for a drone, and time-range scans
create index telemetry_drone_time_idx
  on public.telemetry (drone_id, recorded_at desc);

-- ── Auto-mirror live position onto the drones row ────────────────────────────

create or replace function public.mirror_telemetry_to_drone()
returns trigger language plpgsql security definer as $$
begin
  update public.drones set
    lat               = new.lat,
    lng               = new.lng,
    altitude          = new.altitude,
    relative_altitude = new.relative_altitude,
    speed             = new.speed,
    heading           = new.heading,
    battery_percent   = new.battery_percent,
    battery_voltage   = new.battery_voltage,
    satellite_count   = new.satellite_count,
    signal_strength   = new.signal_strength,
    status            = new.status,
    last_seen_at      = new.recorded_at
  where id = new.drone_id;
  return new;
end;
$$;

create trigger telemetry_mirror_to_drone
  after insert on public.telemetry
  for each row execute procedure public.mirror_telemetry_to_drone();

-- ── RLS ──────────────────────────────────────

alter table public.telemetry enable row level security;

-- All authenticated users can read telemetry history
create policy "telemetry: authenticated read"
  on public.telemetry for select to authenticated using (true);

-- Only operators can write telemetry (the bridge service uses a service-role key,
-- but this policy covers any authenticated writes)
create policy "telemetry: operator insert"
  on public.telemetry for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
  );
