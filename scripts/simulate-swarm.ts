/**
 * Swarm Simulator — animates the 3 seeded drones with realistic movement.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────────
 *  1. Run scripts/seed-drones.ts first to ensure Alpha-1, Beta-2, Gamma-3 exist.
 *  2. .env must contain SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *  npx tsx scripts/simulate-swarm.ts
 *
 * ── What it does ─────────────────────────────────────────────────────────────
 *  Tick every 2 seconds:
 *    Alpha-1  → circular orbit over Central Park (r ≈ 0.003°, alt 75-120 m)
 *    Gamma-3  → straight RTH toward home point, descending, faster battery drain
 *    Beta-2   → idle; every 30 ticks arms, patrols, returns to idle
 *  Each tick inserts a telemetry_history row and updates the drones table.
 *  Logs a compact status table to console.
 *  Ctrl+C exits cleanly.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve }      from 'path';

// ── Load .env ─────────────────────────────────────────────────────────────────

try {
  const lines = readFileSync(resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!(k in process.env)) process.env[k] = v.replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* no .env — rely on shell env */ }

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !key) {
  console.error('Error: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ── State ─────────────────────────────────────────────────────────────────────

interface DroneState {
  id?:         string;
  name:        string;
  system_id:   number;
  status:      string;
  lat:         number;
  lng:         number;
  altitude:    number;
  speed:       number;
  heading:     number;
  battery:     number;
  satellites:  number;
}

// Central Park home for Alpha-1
const ALPHA_HOME    = { lat: 40.7614, lng: -73.9776 };
// RTH target for Gamma-3
const GAMMA_HOME    = { lat: 40.7580, lng: -73.9855 };
const BETA_HOME     = { lat: 40.6892, lng: -73.9442 };
const BETA_WAYPOINT = { lat: 40.6950, lng: -73.9500 };

let state: DroneState[] = [
  { name: 'Alpha-1', system_id: 1, status: 'flying',    lat: ALPHA_HOME.lat, lng: ALPHA_HOME.lng, altitude: 90,  speed: 9,  heading: 0,   battery: 72, satellites: 14 },
  { name: 'Beta-2',  system_id: 2, status: 'idle',      lat: BETA_HOME.lat,  lng: BETA_HOME.lng,  altitude: 12,  speed: 0,  heading: 180, battery: 98, satellites: 12 },
  { name: 'Gamma-3', system_id: 3, status: 'returning', lat: 40.7282,        lng: -73.8449,       altitude: 45,  speed: 12, heading: 270, battery: 31, satellites: 11 },
];

let tick       = 0;
let alphaAngle = 0;
let betaPhase: 'idle' | 'patrol' | 'return' = 'idle';
let betaPhaseTimer = 0;
let gammaLanded    = false;

// ── Resolve UUIDs from system_id ──────────────────────────────────────────────

async function loadIds() {
  const { data } = await supabase
    .from('drones')
    .select('id, system_id')
    .in('system_id', [1, 2, 3]);

  if (!data?.length) {
    console.error('No drones found. Run scripts/seed-drones.ts first.');
    process.exit(1);
  }
  for (const row of data) {
    const d = state.find(s => s.system_id === row.system_id);
    if (d) d.id = row.id;
  }
  if (state.some(d => !d.id)) {
    console.error('Could not resolve all drone IDs. Run seed-drones.ts first.');
    process.exit(1);
  }
}

// ── Movement physics ──────────────────────────────────────────────────────────

function stepAlpha() {
  const d = state[0];
  // Circular orbit radius ≈ 0.003° (~300 m)
  const RADIUS    = 0.003;
  const ANG_SPEED = 2; // degrees per tick
  alphaAngle = (alphaAngle + ANG_SPEED) % 360;
  const rad   = (alphaAngle * Math.PI) / 180;
  d.lat       = ALPHA_HOME.lat + RADIUS * Math.sin(rad);
  d.lng       = ALPHA_HOME.lng + RADIUS * Math.cos(rad);
  d.heading   = (alphaAngle + 90) % 360;
  d.altitude  = 75 + 45 * (0.5 + 0.5 * Math.sin(rad));
  d.speed     = 8 + 4 * Math.abs(Math.sin(rad * 2));
  d.battery   = Math.max(0, d.battery - 0.1);
  if (d.battery === 0) d.status = 'error';
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function stepGamma() {
  const d = state[2];
  if (gammaLanded) return;
  const dToHome = dist(d, GAMMA_HOME);
  if (dToHome < 0.0005) {
    // Landed
    d.lat = GAMMA_HOME.lat; d.lng = GAMMA_HOME.lng;
    d.altitude = 0; d.speed = 0; d.status = 'idle';
    gammaLanded = true;
    return;
  }
  const STEP  = 0.0004;
  const dLat  = GAMMA_HOME.lat - d.lat;
  const dLng  = GAMMA_HOME.lng - d.lng;
  const norm  = Math.sqrt(dLat ** 2 + dLng ** 2);
  d.lat       += (dLat / norm) * STEP;
  d.lng       += (dLng / norm) * STEP;
  d.heading   = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  if (d.heading < 0) d.heading += 360;
  d.altitude  = Math.max(5, d.altitude - 1);
  d.speed     = 10 + 4 * Math.random();
  d.battery   = Math.max(0, d.battery - 0.2);
  if (d.battery < 5) d.status = 'error';
}

function stepBeta() {
  const d = state[1];
  betaPhaseTimer++;
  if (betaPhase === 'idle' && betaPhaseTimer >= 30) {
    betaPhase = 'patrol'; betaPhaseTimer = 0; d.status = 'armed';
  } else if (betaPhase === 'patrol') {
    const dToWp = dist(d, BETA_WAYPOINT);
    if (dToWp < 0.0005) {
      betaPhase = 'return'; betaPhaseTimer = 0; d.status = 'returning';
    } else {
      const STEP = 0.0002;
      const dLat = BETA_WAYPOINT.lat - d.lat;
      const dLng = BETA_WAYPOINT.lng - d.lng;
      const norm = Math.sqrt(dLat ** 2 + dLng ** 2);
      d.lat     += (dLat / norm) * STEP;
      d.lng     += (dLng / norm) * STEP;
      d.altitude = 25; d.speed = 6; d.status = 'flying';
    }
  } else if (betaPhase === 'return') {
    const dToHome = dist(d, BETA_HOME);
    if (dToHome < 0.0005) {
      betaPhase = 'idle'; betaPhaseTimer = 0;
      d.lat = BETA_HOME.lat; d.lng = BETA_HOME.lng;
      d.altitude = 12; d.speed = 0; d.status = 'idle';
    } else {
      const STEP = 0.0002;
      const dLat = BETA_HOME.lat - d.lat;
      const dLng = BETA_HOME.lng - d.lng;
      const norm = Math.sqrt(dLat ** 2 + dLng ** 2);
      d.lat     += (dLat / norm) * STEP;
      d.lng     += (dLng / norm) * STEP;
      d.altitude = Math.max(12, d.altitude - 1);
      d.speed = 5; d.status = 'returning';
    }
    d.battery = Math.max(90, d.battery - 0.05);
  }
  if (betaPhase === 'idle') { d.speed = 0; }
}

// ── Supabase writes ───────────────────────────────────────────────────────────

async function persist() {
  const now = new Date().toISOString();
  for (const d of state) {
    const row = {
      lat:              d.lat,
      lng:              d.lng,
      altitude:         d.altitude,
      speed:            d.speed,
      heading:          d.heading,
      battery_percent:  Math.round(d.battery),
      satellite_count:  d.satellites,
      status:           d.status,
      last_seen_at:     now,
      updated_at:       now,
    };

    // Update drones table
    await supabase.from('drones').update(row).eq('id', d.id!);

    // Insert telemetry history
    await supabase.from('telemetry').insert({
      drone_id:         d.id,
      lat:              d.lat,
      lng:              d.lng,
      altitude:         d.altitude,
      relative_altitude: d.altitude * 0.8,
      speed:            d.speed,
      heading:          d.heading,
      battery_percent:  Math.round(d.battery),
      battery_voltage:  (Math.round(d.battery) / 100) * 25.2,
      satellite_count:  d.satellites,
      signal_strength:  70 + Math.floor(Math.random() * 25),
      recorded_at:      now,
    });
  }
}

// ── Console log ───────────────────────────────────────────────────────────────

function logTable() {
  const header = `Tick ${String(tick).padStart(4)} ─────────────────────────────────────────`;
  const lines  = state.map(d =>
    `  ${d.name.padEnd(8)}  ${d.status.padEnd(10)}  ` +
    `batt=${String(Math.round(d.battery)).padStart(3)}%  ` +
    `alt=${String(d.altitude.toFixed(0)).padStart(4)}m  ` +
    `spd=${String(d.speed.toFixed(1)).padStart(5)}m/s  ` +
    `(${d.lat.toFixed(5)}, ${d.lng.toFixed(5)})`
  );
  console.log(`\n${header}`);
  lines.forEach(l => console.log(l));
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nMADS Swarm Simulator');
  console.log('Loading drone IDs from Supabase…');
  await loadIds();
  console.log(`Resolved IDs for ${state.map(d => d.name).join(', ')}`);
  console.log('Ticking every 2 s. Press Ctrl+C to stop.\n');

  const interval = setInterval(async () => {
    tick++;
    stepAlpha();
    stepBeta();
    stepGamma();
    logTable();
    try { await persist(); }
    catch (err) { console.error('Persist error:', err); }
  }, 2000);

  // Graceful exit
  const shutdown = () => {
    console.log('\n\nShutting down simulator…');
    clearInterval(interval);
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
