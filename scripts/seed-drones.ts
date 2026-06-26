/**
 * Seed script — inserts 3 test drones into Supabase.
 *
 * ── How to run ────────────────────────────────────────────────────────────────
 *
 *  1. Add your service role key to the project root .env:
 *
 *       SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   ← Dashboard → Settings → API
 *
 *     SUPABASE_URL is read from EXPO_PUBLIC_SUPABASE_URL already in your .env.
 *     The service role key bypasses RLS so the insert doesn't need an auth session.
 *     Never commit it or expose it client-side.
 *
 *  2. Run from the project root:
 *
 *       npx tsx scripts/seed-drones.ts
 *
 *     tsx is downloaded on demand — no installation needed.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 *
 *  Re-running the script upserts on system_id (1, 2, 3).
 *  Existing rows are updated in place; no duplicates are created.
 *
 * ── What gets inserted ────────────────────────────────────────────────────────
 *
 *  Alpha-1   flying    Central Park, NY   72 % battery
 *  Beta-2    idle      Brooklyn, NY       98 % battery
 *  Gamma-3   returning Queens, NY         31 % battery (low — heading home)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve }      from 'path';

// ── Load .env from project root (no dotenv package needed) ───────────────────

try {
  const envPath = resolve(process.cwd(), '.env');
  const lines   = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!(k in process.env)) {
      // Strip surrounding quotes if present
      process.env[k] = v.replace(/^(['"])(.*)\1$/, '$2');
    }
  }
} catch {
  // No .env file — rely on env vars already set in the shell
}

// ── Supabase admin client ─────────────────────────────────────────────────────

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url) {
  console.error(
    '\nError: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) is not set.\n' +
    'Add it to .env at the project root.\n'
  );
  process.exit(1);
}

if (!key) {
  console.error(
    '\nError: SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
    'Add it to .env at the project root.\n' +
    'Find it in: Supabase Dashboard → Settings → API → service_role key\n'
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

// ── Seed data ─────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

const drones = [
  {
    // Active mission drone — high altitude, moving NE over Manhattan
    name:              'Alpha-1',
    model:             'DJI Matrice 300 RTK',
    status:            'flying',
    system_id:         1,
    lat:               40.7614,   // Central Park, New York
    lng:               -73.9776,
    altitude:          75.4,      // metres ASL
    relative_altitude: 60.2,      // metres AGL
    speed:             8.5,       // m/s ground speed
    heading:           45,        // degrees — NE
    battery_percent:   72,
    battery_voltage:   22.41,
    satellite_count:   14,
    signal_strength:   91,
    last_seen_at:      now,
  },
  {
    // Standby drone — on the ground, fully charged
    name:              'Beta-2',
    model:             'DJI Phantom 4 Pro',
    status:            'idle',
    system_id:         2,
    lat:               40.6892,   // Prospect Park, Brooklyn (~10 km from Alpha)
    lng:               -73.9442,
    altitude:          12.0,
    relative_altitude: 1.8,
    speed:             0,
    heading:           180,       // facing south
    battery_percent:   98,
    battery_voltage:   25.15,
    satellite_count:   12,
    signal_strength:   78,
    last_seen_at:      now,
  },
  {
    // Low-battery drone — returning to home point at speed
    name:              'Gamma-3',
    model:             'Autel EVO II Pro',
    status:            'returning',
    system_id:         3,
    lat:               40.7282,   // Flushing Meadows, Queens (~12 km from Alpha)
    lng:               -73.8449,
    altitude:          45.0,
    relative_altitude: 35.0,
    speed:             12.2,      // faster — RTH at max speed
    heading:           270,       // heading west toward home
    battery_percent:   31,        // low — triggered auto-RTH
    battery_voltage:   19.82,
    satellite_count:   11,
    signal_strength:   65,
    last_seen_at:      now,
  },
] as const;

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nConnecting to: ${url}`);
  console.log(`Upserting ${drones.length} drones…\n`);

  const { data, error } = await supabase
    .from('drones')
    .upsert(drones, { onConflict: 'system_id' })
    .select('id, name, status, battery_percent, lat, lng');

  if (error) {
    console.error('Supabase error:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint)    console.error('Hint:',    error.hint);
    process.exit(1);
  }

  if (!data?.length) {
    console.warn('No rows returned — check RLS or table name.');
    process.exit(1);
  }

  for (const d of data) {
    const pos = d.lat != null ? `${d.lat}, ${d.lng}` : 'no position';
    console.log(
      `  ✓  ${d.name.padEnd(10)}  ${d.status.padEnd(12)}  ` +
      `batt=${String(d.battery_percent).padStart(3)}%  pos=(${pos})`
    );
    console.log(`       id=${d.id}`);
  }

  console.log('\nDone. Open the app map to see the drones.\n');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
