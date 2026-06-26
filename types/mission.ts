export type MissionStatus = 'draft' | 'uploaded' | 'active' | 'paused' | 'completed' | 'aborted';

export type WaypointAction =
  | 'navigate'
  | 'takeoff'
  | 'land'
  | 'loiter'
  | 'return_to_home';

// Flat structure matching the DB JSONB waypoint format.
// loiterSeconds maps to loiter_seconds in the stored JSON.
export interface Waypoint {
  id:            string;
  sequence:      number;
  lat:           number;
  lng:           number;
  altitude:      number;
  action:        WaypointAction;
  loiterSeconds: number | null;
}

export interface Mission {
  id:              string;
  name:            string;
  status:          MissionStatus;
  waypoints:       Waypoint[];
  assignedDroneIds: string[];
  assignedGroupId:  string | null;
  createdBy:       string;
  createdAt:       string;
  updatedAt:       string;
}
