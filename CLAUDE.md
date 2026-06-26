@AGENTS.md

# MADS Flight Commander

Cross-platform drone fleet management app. Targets iOS, Android, and Web via Expo (SDK 56 / React 19 / RN 0.85), plus Tauri for desktop.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 56, Expo Router v4 (file-based) |
| Language | TypeScript (strict) |
| Map | @rnmapbox/maps (Mapbox GL) |
| Realtime comms | socket.io-client → MAVLink bridge server |
| MAVLink | node-mavlink (backend bridge only — not in RN bundle) |
| Backend / Auth | Supabase (PostgreSQL + Realtime + Auth) |
| State | React Context + useReducer (no Zustand yet) |
| Desktop | Tauri (wraps the web build) |

## Auth Roles

- **operator** — full control: send missions, arm/disarm drones, assign swarm tasks
- **observer** — read-only: view map, telemetry, and mission status

Role is stored in `profiles.role` (Supabase) and enforced both client-side (UI gating) and server-side (RLS policies).

## Folder Structure

```
app/
  (auth)/           # unauthenticated screens (login)
    _layout.tsx
    login.tsx
  (app)/            # authenticated shell
    _layout.tsx     # auth guard — redirects to /login if no session
    (tabs)/
      _layout.tsx   # bottom tab bar
      map.tsx       # live map + drone overlays
      telemetry.tsx # per-drone telemetry dashboard
      missions.tsx  # waypoint mission planner
      swarm.tsx     # swarm task assignment
    drone/
      [id].tsx      # individual drone detail sheet

lib/
  supabase.ts       # Supabase client singleton
  mavlink.ts        # socket.io connection to MAVLink bridge; emits typed events

types/
  drone.ts          # Drone, TelemetrySnapshot, DroneStatus
  mission.ts        # Mission, Waypoint, MissionStatus
  mavlink.ts        # MAVLink message type envelopes
  auth.ts           # UserProfile, Role

hooks/
  useAuth.ts        # session, profile, role — wraps Supabase Auth
  useDroneStream.ts # subscribes to Supabase Realtime drone positions
  useMavlink.ts     # socket.io MAVLink event subscription
  useTelemetry.ts   # per-drone telemetry selector

components/
  map/
    DroneMarker.tsx
    WaypointMarker.tsx
    MissionPath.tsx
  telemetry/
    TelemetryCard.tsx
    BatteryIndicator.tsx
    GPSStatus.tsx
  mission/
    WaypointList.tsx
    MissionControls.tsx
  swarm/
    SwarmPanel.tsx
    DroneGroupCard.tsx
```

## Data Flow

```
MAVLink hardware
  → Node.js bridge (node-mavlink + socket.io server)
      → socket.io-client (app, lib/mavlink.ts)
          → useMavlink hook
              → Supabase Realtime write (operator only)
                  → useDroneStream hook → map + telemetry UI
```

## Key Conventions

- All Expo packages installed via `npx expo install` to get version-compatible packages.
- Non-Expo packages (`@supabase/supabase-js`, `socket.io-client`, `node-mavlink`) use `npm install`.
- Mapbox token stored in `.env` as `EXPO_PUBLIC_MAPBOX_TOKEN`; never committed.
- Supabase URL/anon key stored as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `node-mavlink` is a **server-side only** package — import it only in the backend bridge, never in the Expo bundle.
- Route guards live in `app/(app)/_layout.tsx`; never scatter auth checks across screens.
