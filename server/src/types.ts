export type DroneStatus = 'idle' | 'armed' | 'flying' | 'returning' | 'error' | 'offline';

export interface DronePosition {
  latitude: number;
  longitude: number;
  altitude: number;
  relativeAltitude: number;
}

export interface TelemetryPayload {
  droneId: string;
  systemId: number;
  timestamp: number;
  position: DronePosition;
  batteryPercent: number;
  batteryVoltage: number;
  speedMs: number;
  headingDeg: number;
  satelliteCount: number;
  signalStrength: number;
  status: DroneStatus;
}

export interface HeartbeatPayload {
  droneId: string;
  systemId: number;
  timestamp: number;
  type: number;
  autopilot: number;
  baseMode: number;
  customMode: number;
  systemStatus: number;
  status: DroneStatus;
}

export interface CommandPayload {
  droneId: string;
  command: string;
  params: Record<string, unknown>;
}

// Keyed by systemId → accumulated partial telemetry waiting to be flushed
export interface DroneState {
  systemId: number;
  droneId: string;
  lastHeartbeat: number;
  telemetry: Partial<TelemetryPayload>;
}

export interface ServerToClientEvents {
  telemetry: (payload: TelemetryPayload) => void;
  heartbeat: (payload: HeartbeatPayload) => void;
  droneOffline: (droneId: string) => void;
  commandAck: (payload: { droneId: string; command: string; result: number }) => void;
}

export interface ClientToServerEvents {
  command: (payload: CommandPayload) => void;
  subscribe: (droneId: string) => void;
  unsubscribe: (droneId: string) => void;
}
