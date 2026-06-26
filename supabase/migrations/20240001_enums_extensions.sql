-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────

create type user_role as enum ('operator', 'observer');

create type drone_status as enum (
  'idle',
  'armed',
  'flying',
  'returning',
  'error',
  'offline'
);

create type mission_status as enum (
  'draft',
  'uploaded',
  'active',
  'paused',
  'completed',
  'aborted'
);

create type waypoint_action as enum (
  'navigate',
  'takeoff',
  'land',
  'loiter',
  'return_to_home'
);
