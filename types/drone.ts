export type DroneStatus = 'idle' | 'armed' | 'flying' | 'returning' | 'error' | 'offline';

// Matches the `drones` table schema (camelCase version of snake_case DB columns)
export interface Drone {
  id: string;
  name: string;
  model: string;
  status: DroneStatus;

  // Live position — null until the first MAVLink packet is received
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  relativeAltitude: number | null;
  speed: number | null;
  heading: number | null;

  // Power
  batteryPercent: number | null;
  batteryVoltage: number | null;

  // GPS quality
  satelliteCount: number | null;
  signalStrength: number | null;

  // MAVLink
  systemId: number | null;

  // Relations
  groupId: string | null;
  assignedMissionId: string | null;

  // Housekeeping
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DroneGroup {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
