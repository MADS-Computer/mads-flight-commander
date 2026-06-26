import { createClient } from '@supabase/supabase-js';
import type { TelemetryPayload } from './types.js';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceKey) {
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — telemetry will NOT be persisted'
  );
}

// Service-role client bypasses RLS
const supabase = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null;

export async function writeTelemetry(payload: TelemetryPayload): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('telemetry').insert({
    drone_id:          payload.droneId,
    recorded_at:       new Date(payload.timestamp).toISOString(),
    lat:               payload.position.latitude,
    lng:               payload.position.longitude,
    altitude:          payload.position.altitude,
    relative_altitude: payload.position.relativeAltitude,
    speed:             payload.speedMs,
    heading:           payload.headingDeg,
    battery_percent:   payload.batteryPercent,
    battery_voltage:   payload.batteryVoltage,
    satellite_count:   payload.satelliteCount,
    signal_strength:   payload.signalStrength,
    status:            payload.status,
  });

  if (error) {
    console.error('[supabase] telemetry write error:', error.message);
  }
}
