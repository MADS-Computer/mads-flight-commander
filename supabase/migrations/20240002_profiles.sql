-- ─────────────────────────────────────────────
-- profiles
--
-- One row per authenticated user. Linked 1-to-1 with auth.users.
-- We never store passwords here — Supabase Auth owns that.
-- ─────────────────────────────────────────────

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text not null default '',
  role          user_role not null default 'observer',
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'observer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── RLS ──────────────────────────────────────

alter table public.profiles enable row level security;

-- Every authenticated user can read every profile (needed for operator lists, etc.)
create policy "profiles: authenticated read"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only update their own profile
create policy "profiles: own update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Prevent self-escalation: a user cannot set their own role to operator
create policy "profiles: no self role escalation"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    -- role unchanged, or an operator is granting the change
    role = (select role from public.profiles where id = auth.uid())
    or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'operator'
    )
  );
