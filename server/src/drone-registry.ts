import type { DroneState, DroneStatus, TelemetryPayload } from './types.js';

const OFFLINE_TIMEOUT_MS = 5_000;

const registry = new Map<number, DroneState>();

export function getOrCreate(systemId: number): DroneState {
  let state = registry.get(systemId);
  if (!state) {
    state = {
      systemId,
      droneId: `drone-${systemId}`,
      lastHeartbeat: Date.now(),
      telemetry: {},
    };
    registry.set(systemId, state);
  }
  return state;
}

export function all(): DroneState[] {
  return Array.from(registry.values());
}

export function markHeartbeat(systemId: number): void {
  const state = registry.get(systemId);
  if (state) state.lastHeartbeat = Date.now();
}

export function buildTelemetry(state: DroneState): TelemetryPayload | null {
  const t = state.telemetry;
  if (!t.position) return null;

  return {
    droneId: state.droneId,
    systemId: state.systemId,
    timestamp: Date.now(),
    position: t.position ?? { latitude: 0, longitude: 0, altitude: 0, relativeAltitude: 0 },
    batteryPercent: t.batteryPercent ?? 0,
    batteryVoltage: t.batteryVoltage ?? 0,
    speedMs: t.speedMs ?? 0,
    headingDeg: t.headingDeg ?? 0,
    satelliteCount: t.satelliteCount ?? 0,
    signalStrength: t.signalStrength ?? 0,
    status: t.status ?? 'idle',
  };
}

export function droneIdForSystem(systemId: number): string {
  return registry.get(systemId)?.droneId ?? `drone-${systemId}`;
}

export function getOfflineDrones(): DroneState[] {
  const now = Date.now();
  return Array.from(registry.values()).filter(
    (s) => now - s.lastHeartbeat > OFFLINE_TIMEOUT_MS
  );
}

export function mavStatusToAppStatus(baseMode: number, customMode: number, systemStatus: number): DroneStatus {
  // MAV_MODE_FLAG_SAFETY_ARMED = 128
  const armed = (baseMode & 128) !== 0;
  // MAV_STATE: 0=uninit,1=boot,2=calibrating,3=standby,4=active,5=critical,6=emergency,7=poweroff,8=flight_termination
  if (systemStatus === 5 || systemStatus === 6) return 'error';
  if (!armed) return 'idle';
  // Custom modes for ArduCopter: 6=RTL, 0=stabilize,3=auto
  if (customMode === 6) return 'returning';
  return 'flying';
}
