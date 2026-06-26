import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Drone, DroneStatus } from '@/types/drone';

// Supabase returns snake_case column names — map to camelCase for the app
function mapDrone(row: Record<string, unknown>): Drone {
  return {
    id:               row.id as string,
    name:             row.name as string,
    model:            (row.model as string) ?? '',
    status:           ((row.status as string) ?? 'offline') as DroneStatus,
    lat:              (row.lat as number | null) ?? null,
    lng:              (row.lng as number | null) ?? null,
    altitude:         (row.altitude as number | null) ?? null,
    relativeAltitude: (row.relative_altitude as number | null) ?? null,
    speed:            (row.speed as number | null) ?? null,
    heading:          (row.heading as number | null) ?? null,
    batteryPercent:   (row.battery_percent as number | null) ?? null,
    batteryVoltage:   (row.battery_voltage as number | null) ?? null,
    satelliteCount:   (row.satellite_count as number | null) ?? null,
    signalStrength:   (row.signal_strength as number | null) ?? null,
    systemId:         (row.system_id as number | null) ?? null,
    groupId:          (row.group_id as string | null) ?? null,
    assignedMissionId:(row.assigned_mission_id as string | null) ?? null,
    lastSeenAt:       (row.last_seen_at as string | null) ?? null,
    createdAt:        row.created_at as string,
    updatedAt:        row.updated_at as string,
  };
}

// Subscribes to all drone rows and streams realtime updates
export function useDroneStream(): Drone[] {
  const [drones, setDrones] = useState<Drone[]>([]);

  useEffect(() => {
    supabase
      .from('drones')
      .select('*')
      .then(({ data }) => {
        if (data) setDrones((data as Record<string, unknown>[]).map(mapDrone));
      });

    const channel = supabase
      .channel('drone-positions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drones' },
        (payload) => {
          const updated = mapDrone(payload.new as Record<string, unknown>);
          setDrones((prev) => {
            const idx = prev.findIndex((d) => d.id === updated.id);
            if (idx === -1) return [...prev, updated];
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return drones;
}

// Subscribes to a single drone row — used by the drone detail screen
export function useDrone(droneId: string): Drone | null {
  const [drone, setDrone] = useState<Drone | null>(null);

  useEffect(() => {
    supabase
      .from('drones')
      .select('*')
      .eq('id', droneId)
      .single()
      .then(({ data }) => {
        if (data) setDrone(mapDrone(data as Record<string, unknown>));
      });

    const channel = supabase
      .channel(`drone-${droneId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drones', filter: `id=eq.${droneId}` },
        (payload) => setDrone(mapDrone(payload.new as Record<string, unknown>))
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [droneId]);

  return drone;
}
