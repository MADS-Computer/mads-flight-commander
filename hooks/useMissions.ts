import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Mission, MissionStatus, Waypoint, WaypointAction } from '@/types/mission';

function mapWaypoint(wp: Record<string, unknown>): Waypoint {
  return {
    id:           wp.id as string,
    sequence:     wp.sequence as number,
    lat:          wp.lat as number,
    lng:          wp.lng as number,
    altitude:     wp.altitude as number,
    action:       wp.action as WaypointAction,
    loiterSeconds:(wp.loiter_seconds as number | null) ?? null,
  };
}

export function mapMission(row: Record<string, unknown>): Mission {
  return {
    id:              row.id as string,
    name:            row.name as string,
    status:          (row.status as string) as MissionStatus,
    waypoints:       ((row.waypoints as Record<string, unknown>[]) ?? []).map(mapWaypoint),
    assignedDroneIds:(row.assigned_drone_ids as string[]) ?? [],
    assignedGroupId: (row.assigned_group_id as string | null) ?? null,
    createdBy:       row.created_by as string,
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
  };
}

// NOTE: the missions table must be added to the supabase_realtime publication in the
// Supabase dashboard (Database → Replication) for realtime updates to arrive.
export function useMissions(): Mission[] {
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    supabase
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setMissions((data as Record<string, unknown>[]).map(mapMission));
      });

    const channel = supabase
      .channel('missions-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setMissions(prev => prev.filter(m => m.id !== (payload.old as { id: string }).id));
            return;
          }
          const updated = mapMission(payload.new as Record<string, unknown>);
          setMissions(prev => {
            const idx = prev.findIndex(m => m.id === updated.id);
            if (idx === -1) return [updated, ...prev];
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return missions;
}

export function useMission(id: string): Mission | null {
  const [mission, setMission] = useState<Mission | null>(null);

  useEffect(() => {
    supabase
      .from('missions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setMission(mapMission(data as Record<string, unknown>));
      });

    const channel = supabase
      .channel(`mission-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'missions', filter: `id=eq.${id}` },
        (payload) => setMission(mapMission(payload.new as Record<string, unknown>))
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  return mission;
}
