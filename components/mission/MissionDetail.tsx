// Web fallback — @rnmapbox/maps is native-only.
// Shows mission info and waypoint list without the map.
import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useMission } from '@/hooks/useMissions';
import { useDroneStream } from '@/hooks/useDroneStream';
import { useAuth } from '@/hooks/useAuth';
import { WaypointList } from './WaypointList';
import type { MissionStatus } from '@/types/mission';

const STATUS_COLOR: Record<MissionStatus, string> = {
  draft:     '#555566',
  uploaded:  '#ff8c00',
  active:    '#FFD700',
  paused:    '#a020f0',
  completed: '#00e676',
  aborted:   '#ff4444',
};

const STATUS_LABEL: Record<MissionStatus, string> = {
  draft:     'DRAFT',
  uploaded:  'READY',
  active:    'ACTIVE',
  paused:    'PAUSED',
  completed: 'DONE',
  aborted:   'ABORTED',
};

function ActionButton({
  label, color, onPress, disabled,
}: {
  label: string; color: string; onPress: () => void; disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, { borderColor: color + '88', backgroundColor: color + '18' }]}
    >
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

interface Props {
  missionId: string;
}

export default function MissionDetail({ missionId }: Props) {
  const mission    = useMission(missionId);
  const allDrones  = useDroneStream();
  const { profile } = useAuth();
  const isOperator = profile?.role === 'operator';
  const [saving, setSaving] = useState(false);

  async function transition(status: MissionStatus) {
    setSaving(true);
    await supabase.from('missions').update({ status }).eq('id', missionId);
    setSaving(false);
  }

  if (!mission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FFD700" />
      </View>
    );
  }

  const sc = STATUS_COLOR[mission.status];
  const assignedDrones = allDrones.filter(d => mission.assignedDroneIds.includes(d.id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: mission.name }} />

      {/* Web map banner */}
      <View style={styles.mapBanner}>
        <Text style={styles.mapBannerText}>
          Open on iOS or Android to view waypoints on the interactive map.
        </Text>
      </View>

      {/* Status */}
      <View style={[styles.statusBar, { borderLeftColor: sc }]}>
        <View style={[styles.statusBadge, { backgroundColor: sc + '22', borderColor: sc + '66' }]}>
          <Text style={[styles.statusText, { color: sc }]}>{STATUS_LABEL[mission.status]}</Text>
        </View>
        <Text style={styles.missionName}>{mission.name}</Text>
      </View>

      {/* Operator controls */}
      {isOperator && (
        <View style={styles.controls}>
          {mission.status === 'draft' && (
            <ActionButton label="Mark Ready" color="#ff8c00" disabled={saving}
              onPress={() => transition('uploaded')} />
          )}
          {mission.status === 'uploaded' && (
            <>
              <ActionButton label="Start Mission" color="#FFD700" disabled={saving}
                onPress={() => transition('active')} />
              <ActionButton label="Reset to Draft" color="#555566" disabled={saving}
                onPress={() => transition('draft')} />
            </>
          )}
          {mission.status === 'active' && (
            <>
              <ActionButton label="Pause" color="#a020f0" disabled={saving}
                onPress={() => transition('paused')} />
              <ActionButton label="Abort Mission" color="#ff4444" disabled={saving}
                onPress={() => transition('aborted')} />
            </>
          )}
          {mission.status === 'paused' && (
            <>
              <ActionButton label="Resume" color="#FFD700" disabled={saving}
                onPress={() => transition('active')} />
              <ActionButton label="Abort Mission" color="#ff4444" disabled={saving}
                onPress={() => transition('aborted')} />
            </>
          )}
        </View>
      )}

      {/* Waypoints */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>WAYPOINTS  ({mission.waypoints.length})</Text>
        {mission.waypoints.length === 0
          ? <Text style={styles.emptyText}>No waypoints defined</Text>
          : <WaypointList waypoints={mission.waypoints} readOnly />
        }
      </View>

      {/* Assigned drones */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          ASSIGNED DRONES  ({mission.assignedDroneIds.length})
        </Text>
        {mission.assignedDroneIds.length === 0 ? (
          <Text style={styles.emptyText}>No drones assigned</Text>
        ) : assignedDrones.length > 0 ? (
          assignedDrones.map(d => (
            <Text key={d.id} style={styles.droneItem}>{d.name} — {d.status}</Text>
          ))
        ) : (
          mission.assignedDroneIds.map(id => (
            <Text key={id} style={styles.droneIdFallback}>{id}</Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  scroll:    { padding: 16, gap: 20, paddingBottom: 40 },

  mapBanner: {
    backgroundColor:  '#1a1a2e',
    borderRadius:     8,
    padding:          12,
    borderWidth:      1,
    borderColor:      '#2a2a4e',
  },
  mapBannerText: { color: '#555566', fontSize: 12, textAlign: 'center' },

  statusBar: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    borderLeftWidth: 3,
    paddingLeft:   12,
  },
  statusBadge: {
    borderRadius:    6,
    borderWidth:     1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  missionName: { color: '#fff', fontSize: 16, fontWeight: '700' },

  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flex:          1,
    minWidth:      120,
    borderRadius:  10,
    borderWidth:   1,
    paddingVertical: 12,
    alignItems:    'center',
  },
  actionBtnText: { fontWeight: '700', fontSize: 13 },

  section:      { gap: 10 },
  sectionLabel: { color: '#44445a', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  emptyText:    { color: '#33334a', fontSize: 13 },
  droneItem:    { color: '#c0c0d8', fontSize: 13, paddingVertical: 3 },
  droneIdFallback: { color: '#44445a', fontSize: 11, fontFamily: 'monospace', paddingVertical: 3 },
});
