export type MAVLinkMessageType =
  | 'HEARTBEAT'
  | 'GLOBAL_POSITION_INT'
  | 'SYS_STATUS'
  | 'BATTERY_STATUS'
  | 'GPS_RAW_INT'
  | 'ATTITUDE'
  | 'MISSION_ITEM_INT'
  | 'COMMAND_ACK';

export interface MAVLinkEnvelope<T = Record<string, unknown>> {
  droneId: string;
  systemId: number;
  componentId: number;
  messageType: MAVLinkMessageType;
  payload: T;
  timestamp: number;
}

export interface HeartbeatPayload {
  type: number;
  autopilot: number;
  baseMode: number;
  customMode: number;
  systemStatus: number;
}

export interface GlobalPositionPayload {
  lat: number;
  lon: number;
  alt: number;
  relativeAlt: number;
  vx: number;
  vy: number;
  vz: number;
  hdg: number;
}

export interface BatteryStatusPayload {
  batteryFunction: number;
  voltagesV: number[];
  currentCentimaps: number;
  currentConsumedMah: number;
  batteryRemaining: number;
}
