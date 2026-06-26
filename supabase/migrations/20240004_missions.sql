-- ─────────────────────────────────────────────
-- missions
--
-- waypoints is a JSONB array of objects:
-- [
--   {
--     "id": "<uuid>",
--     "sequence": 1,
--     "action": "navigate",          -- waypoint_action enum value
--     "lat": 37.7749,
--     "lng": -122.4194,
--     "altitude": 50.0,              -- metres AGL
--     "loiter_seconds": null
--   },
--   ...
-- ]
--
-- assigned_drone_ids is a UUID[] — drones currently assigned to this mission.
-- ─────────────────────────────────────────────

create table public.missions (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  status              mission_status not null default 'draft',
  waypoints           jsonb not null default '[]'::jsonb,
  assigned_drone_ids  uuid[] not null default '{}',
  assigned_group_id   uuid references public.drone_groups (id) on delete set null,
  created_by          uuid not null references public.profiles (id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index missions_status_idx      on public.missions (status);
create index missions_created_by_idx  on public.missions (created_by);
-- GIN index lets us efficiently query which drones are assigned
create index missions_drone_ids_gin   on public.missions using gin (assigned_drone_ids);
-- GIN index for waypoint queries (e.g. filter by action type)
create index missions_waypoints_gin   on public.missions using gin (waypoints);

create trigger missions_updated_at
  before update on public.missions
  for each row execute procedure public.set_updated_at();

-- Back-fill the FK from drones → missions now that missions exists
alter table public.drones
  add constraint drones_assigned_mission_id_fkey
  foreign key (assigned_mission_id)
  references public.missions (id)
  on delete set null;

-- ── Waypoint validation ───────────────────────

-- Ensure every waypoint element has the required fields and valid action value
create or replace function public.validate_waypoints(waypoints jsonb)
returns boolean language plpgsql immutable as $$
declare
  wp jsonb;
  valid_actions text[] := array['navigate','takeoff','land','loiter','return_to_home'];
begin
  if jsonb_typeof(waypoints) <> 'array' then return false; end if;
  for wp in select * from jsonb_array_elements(waypoints)
  loop
    if (wp->>'id') is null
    or (wp->>'sequence') is null
    or (wp->>'action') is null
    or not ((wp->>'action') = any(valid_actions))
    or (wp->>'lat') is null
    or (wp->>'lng') is null
    or (wp->>'altitude') is null
    then return false; end if;
  end loop;
  return true;
end;
$$;

alter table public.missions
  add constraint missions_waypoints_valid
  check (public.validate_waypoints(waypoints));

-- ── RLS ──────────────────────────────────────

alter table public.missions enable row level security;

-- All authenticated users can read missions
create policy "missions: authenticated read"
  on public.missions for select to authenticated using (true);

-- Only operators can create missions
create policy "missions: operator insert"
  on public.missions for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
    and created_by = auth.uid()
  );

-- Operators can update any mission; the creator can update their own draft
create policy "missions: operator or own draft update"
  on public.missions for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
    or (created_by = auth.uid() and status = 'draft')
  );

-- Only operators can delete missions
create policy "missions: operator delete"
  on public.missions for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'operator')
  );
