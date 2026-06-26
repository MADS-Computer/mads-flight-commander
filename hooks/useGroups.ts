import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DroneGroup } from '@/types/drone';

function mapGroup(row: Record<string, unknown>): DroneGroup {
  return {
    id:        row.id as string,
    name:      row.name as string,
    color:     (row.color as string) || '#00d4ff',
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// NOTE: drone_groups must be added to the supabase_realtime publication for live updates.
export function useGroups(): DroneGroup[] {
  const [groups, setGroups] = useState<DroneGroup[]>([]);

  useEffect(() => {
    supabase
      .from('drone_groups')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setGroups((data as Record<string, unknown>[]).map(mapGroup));
      });

    const channel = supabase
      .channel('drone-groups-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drone_groups' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setGroups(prev => prev.filter(g => g.id !== (payload.old as { id: string }).id));
            return;
          }
          const updated = mapGroup(payload.new as Record<string, unknown>);
          setGroups(prev => {
            const idx = prev.findIndex(g => g.id === updated.id);
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

  return groups;
}
