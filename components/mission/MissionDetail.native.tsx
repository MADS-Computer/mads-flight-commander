import { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { supabase } from '@/lib/supabase';
import { useMission } from '@/hooks/useMissions';
import { useDroneStream } from '@/hooks/useDroneStream';
import { useAuth } from '@/hooks/useAuth';
import { WaypointList } from './WaypointList';
import type { MissionStatus } from '@/types/mission';
import type { DroneStatus } from '@/types/drone';

const STATUS_COLOR: Record<MissionStatus, string> = {
  draft:     '#555566',
  uploaded:  '#ff8c00',
  active:    '#00d4ff',
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

const DRONE_STATUS_COLOR: Record<DroneStatus, string> = {
  idle:      '#666677',
  armed:     '#ff8c00',
  flying:    '#00d4ff',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#333344',
};

function WaypointMarker({ seq }: { seq: number }) {
  return (
    <View style={styles.wpMarker}>
      <Text style={styles.wpMarkerText}>{seq}</Text>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

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
  const cameraRef  = useRef<MapboxGL.Camera>(null);
  const hasFitRef  = useRef(false);
  const [saving, setSaving] = useState(false);
  const { height: screenH } = useWindowDimensions();
  const MAP_HEIGHT = Math.round(screenH * 0.42);

  // Auto-fit camera to waypoints on first load
  useEffect(() => {
    if (hasFitRef.current || !mission || mission.waypoints.length === 0) return;
    hasFitRef.current = true;
    const wps = mission.waypoints;
    if (wps.length === 1) {
      cameraRef.current?.setCamera({
        centerCoordinate: [wps[0].lng, wps[0].lat],
        zoomLevel:        14,
        animationDuration: 600,
      });
    } else {
      const lngs = wps.map(w => w.lng);
      const lats  = wps.map(w => w.lat);
      cameraRef.current?.fitBounds(
        [Math.max(...lngs), Math.max(...lats)],
        [Math.min(...lngs), Math.min(...lats)],
        [60, 40, 60, 40],
        700,
      );
    }
  }, [mission]);

  async function transition(status: MissionStatus) {
    setSaving(true);
    await supabase.from('missions').update({ status }).eq('id', missionId);
    setSaving(false);
  }

  if (!mission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00d4ff" />
      </View>
    );
  }

  const sc = STATUS_COLOR[mission.status];
  const assignedDrones = allDrones.filter(d => mission.assignedDroneIds.includes(d.id));

  const pathShape = mission.waypoints.length >= 2 ? {
    type: 'FeatureCollection',
    features: [{
      type:     'Feature',
      geometry: {
        type:        'LineString',
        coordinates: mission.waypoints.map(w => [w.lng, w.lat]),
      },
      properties: {},
    }],
  } : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: mission.name }} />

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <View style={{ height: MAP_HEIGHT }}>
        <MapboxGL.MapView
          style={StyleSheet.absoluteFill}
          styleURL="mapbox://styles/mapbox/dark-v11"
          logoEnabled={false}
          attributionEnabled={false}
        >
          <MapboxGL.Camera ref={cameraRef} />

          {pathShape && (
            <MapboxGL.ShapeSource id="mission-detail-path" shape={pathShape as any}>
              <MapboxGL.LineLayer
                id="mission-detail-line"
                style={{ lineColor: '#00d4ff', lineWidth: 2, lineDasharray: [4, 2] }}
              />
            </MapboxGL.ShapeSource>
          )}

          {mission.waypoints.map(wp => (
            <MapboxGL.MarkerView
              key={wp.id}
              coordinate={[wp.lng, wp.lat]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <WaypointMarker seq={wp.sequence} />
            </MapboxGL.MarkerView>
          ))}
        </MapboxGL.MapView>

        {/* Status pill overlay */}
        <View style={styles.mapHeader}>
          <View style={[styles.statusPill, { backgroundColor: sc + '22', borderColor: sc + '66' }]}>
            <View style={[styles.statusDot, { backgroundColor: sc }]} />
            <Text style={[styles.statusText, { color: sc }]}>{STATUS_LABEL[mission.status]}</Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Operator controls */}
        {isOperator && (
          <View style={styles.controls}>
            {mission.status === 'draft' && (
              <ActionButton label="Mark Ready" color="#ff8c00" disabled={saving}
                onPress={() => transition('uploaded')} />
            )}
            {mission.status === 'uploaded' && (
              <>
                <ActionButton label="Start Mission" color="#00d4ff" disabled={saving}
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
                <ActionButton label="Resume" color="#00d4ff" disabled={saving}
                  onPress={() => transition('active')} />
                <ActionButton label="Abort Mission" color="#ff4444" disabled={saving}
                  onPress={() => transition('aborted')} />
              </>
            )}
          </View>
        )}

        {/* Waypoints */}
        <View style={styles.section}>
          <SectionLabel text={`WAYPOINTS  (${mission.waypoints.length})`} />
          {mission.waypoints.length === 0
            ? <Text style={styles.emptyText}>No waypoints defined</Text>
            : <WaypointList waypoints={mission.waypoints} readOnly />
          }
        </View>

        {/* Assigned drones */}
        <View style={styles.section}>
          <SectionLabel text={`ASSIGNED DRONES  (${mission.assignedDroneIds.length})`} />
          {mission.assignedDroneIds.length === 0 ? (
            <Text style={styles.emptyText}>No drones assigned</Text>
          ) : assignedDrones.length > 0 ? (
            assignedDrones.map(d => (
              <View key={d.id} style={styles.droneRow}>
                <View style={[styles.droneDot, { backgroundColor: DRONE_STATUS_COLOR[d.status] }]} />
                <Text style={styles.droneName}>{d.name}</Text>
                <Text style={[styles.droneStatus, { color: DRONE_STATUS_COLOR[d.status] }]}>
                  {d.status.toUpperCase()}
                </Text>
              </View>
            ))
          ) : (
            // Drones not yet loaded — show IDs as fallback
            mission.assignedDroneIds.map(id => (
              <Text key={id} style={styles.droneIdFallback} numberOfLines={1}>{id}</Text>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },

  // Waypoint marker on map
  wpMarker: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#ff8c00',
    borderWidth:     2,
    borderColor:     '#fff',
    justifyContent:  'center',
    alignItems:      'center',
  },
  wpMarkerText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Map header overlay
  mapHeader: {
    position:   'absolute',
    top:        12,
    left:       12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    borderRadius:  20,
    borderWidth:   1,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  // Content scroll
  scroll: { padding: 16, gap: 20, paddingBottom: 40 },

  // Operator controls
  controls: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
  },
  actionBtn: {
    flex:          1,
    minWidth:      120,
    borderRadius:  10,
    borderWidth:   1,
    paddingVertical: 12,
    alignItems:    'center',
  },
  actionBtnText: { fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },

  // Section
  section: { gap: 10 },
  sectionLabel: {
    color:         '#44445a',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.2,
  },
  emptyText: { color: '#33334a', fontSize: 13 },

  // Drone rows
  droneRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   SURFACE,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       BORDER,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  droneDot:       { width: 8, height: 8, borderRadius: 4 },
  droneName:      { color: '#c0c0d8', fontSize: 13, fontWeight: '600', flex: 1 },
  droneStatus:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  droneIdFallback:{ color: '#44445a', fontSize: 11, fontFamily: 'monospace', paddingVertical: 4 },
});
