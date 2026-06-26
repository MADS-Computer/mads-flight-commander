import { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { supabase } from '@/lib/supabase';
import { useDroneStream } from '@/hooks/useDroneStream';
import { useAuth } from '@/hooks/useAuth';
import { WaypointList } from './WaypointList';
import type { Waypoint } from '@/types/mission';

// A draft waypoint only uses 'navigate'; action can be adjusted post-creation
type DraftWaypoint = Omit<Waypoint, 'loiterSeconds'> & { loiterSeconds: null };

function WaypointMapMarker({ seq }: { seq: number }) {
  return (
    <View style={styles.wpMapMarker} pointerEvents="none">
      <Text style={styles.wpMapMarkerText}>{seq}</Text>
    </View>
  );
}

export default function MissionBuilder() {
  const { session, profile } = useAuth();
  const allDrones = useDroneStream();
  const cameraRef = useRef<MapboxGL.Camera>(null);

  const [name, setName]           = useState('');
  const [altitude, setAltitude]   = useState(50);
  const [waypoints, setWaypoints] = useState<DraftWaypoint[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [saving, setSaving]       = useState(false);
  const { height: screenH }       = useWindowDimensions();
  const MAP_HEIGHT                = Math.round(screenH * 0.45);

  // Observer guard
  const isOperator = profile?.role === 'operator';

  // Auto-fit camera whenever waypoint count changes
  useEffect(() => {
    if (waypoints.length === 0) return;
    if (waypoints.length === 1) {
      cameraRef.current?.setCamera({
        centerCoordinate: [waypoints[0].lng, waypoints[0].lat],
        zoomLevel:        14,
        animationDuration: 400,
      });
      return;
    }
    const lngs = waypoints.map(w => w.lng);
    const lats  = waypoints.map(w => w.lat);
    cameraRef.current?.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      [60, 40, 80, 40],
      500,
    );
  }, [waypoints.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMapPress(e: any) {
    const geom = e?.geometry;
    if (!geom || geom.type !== 'Point') return;
    const [lng, lat] = geom.coordinates as [number, number];
    const newWp: DraftWaypoint = {
      id:           Math.random().toString(36).slice(2, 11),
      sequence:     waypoints.length + 1,
      lat,
      lng,
      altitude,
      action:       'navigate',
      loiterSeconds: null,
    };
    setWaypoints(prev => [...prev, newWp]);
  }

  function removeWaypoint(id: string) {
    setWaypoints(prev =>
      prev.filter(w => w.id !== id).map((w, i) => ({ ...w, sequence: i + 1 }))
    );
  }

  function toggleDrone(droneId: string) {
    setAssignedIds(prev =>
      prev.includes(droneId) ? prev.filter(id => id !== droneId) : [...prev, droneId]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter a mission name before saving.');
      return;
    }
    if (waypoints.length === 0) {
      Alert.alert('No waypoints', 'Tap the map to place at least one waypoint.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('missions')
      .insert({
        name:              name.trim(),
        status:            'draft',
        waypoints:         waypoints.map(w => ({
          id:            w.id,
          sequence:      w.sequence,
          action:        w.action,
          lat:           w.lat,
          lng:           w.lng,
          altitude:      w.altitude,
          loiter_seconds: null,
        })),
        assigned_drone_ids: assignedIds,
        assigned_group_id:  null,
        created_by:         session!.user.id,
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.replace(`/(app)/mission/${data.id}`);
  }

  if (!isOperator) {
    return (
      <View style={styles.centered}>
        <Text style={styles.accessDenied}>Observer mode — mission creation is restricted to operators.</Text>
      </View>
    );
  }

  const pathShape = waypoints.length >= 2 ? {
    type: 'FeatureCollection',
    features: [{
      type:     'Feature',
      geometry: {
        type:        'LineString',
        coordinates: waypoints.map(w => [w.lng, w.lat]),
      },
      properties: {},
    }],
  } : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'New Mission' }} />

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <View style={{ height: MAP_HEIGHT }}>
        <MapboxGL.MapView
          style={StyleSheet.absoluteFill}
          styleURL="mapbox://styles/mapbox/dark-v11"
          logoEnabled={false}
          attributionEnabled={false}
          onPress={handleMapPress}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: [-122.4194, 37.7749], zoomLevel: 11 }}
          />

          {pathShape && (
            <MapboxGL.ShapeSource id="builder-path" shape={pathShape as any}>
              <MapboxGL.LineLayer
                id="builder-line"
                style={{ lineColor: '#ff8c00', lineWidth: 2, lineDasharray: [4, 2] }}
              />
            </MapboxGL.ShapeSource>
          )}

          {waypoints.map(wp => (
            <MapboxGL.MarkerView
              key={wp.id}
              coordinate={[wp.lng, wp.lat]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <WaypointMapMarker seq={wp.sequence} />
            </MapboxGL.MarkerView>
          ))}
        </MapboxGL.MapView>

        {/* Instruction / count overlay */}
        <View style={styles.mapOverlay}>
          <View style={styles.mapHintPill}>
            <Text style={styles.mapHintText}>
              {waypoints.length === 0
                ? 'Tap map to add waypoints'
                : `${waypoints.length} waypoint${waypoints.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          {waypoints.length > 0 && (
            <Pressable
              style={styles.undoBtn}
              onPress={() =>
                setWaypoints(prev => prev.slice(0, -1))
              }
            >
              <Text style={styles.undoBtnText}>Undo</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.form}
        >
          {/* Mission name */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>MISSION NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter mission name…"
              placeholderTextColor="#44445a"
              maxLength={80}
              returnKeyType="done"
            />
          </View>

          {/* Altitude stepper */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DEFAULT ALTITUDE (m AGL)</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setAltitude(a => Math.max(5, a - 10))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.altValue}>{altitude}</Text>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setAltitude(a => Math.min(500, a + 10))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Waypoints list */}
          {waypoints.length > 0 && (
            <View style={styles.field}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>WAYPOINTS ({waypoints.length})</Text>
                <Pressable onPress={() => setWaypoints([])}>
                  <Text style={styles.clearText}>Clear all</Text>
                </Pressable>
              </View>
              <WaypointList waypoints={waypoints} onRemove={removeWaypoint} />
            </View>
          )}

          {/* Drone assignment */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              ASSIGN DRONES{assignedIds.length > 0 ? `  (${assignedIds.length} selected)` : ''}
            </Text>
            {allDrones.length === 0 ? (
              <Text style={styles.noDrones}>No drones online</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.droneScroll}>
                {allDrones.map(drone => {
                  const sel = assignedIds.includes(drone.id);
                  return (
                    <Pressable
                      key={drone.id}
                      style={[styles.droneChip, sel && styles.droneChipSel]}
                      onPress={() => toggleDrone(drone.id)}
                    >
                      <Text style={[styles.droneChipText, sel && styles.droneChipTextSel]}>
                        {drone.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Save */}
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Creating…' : 'Create Mission'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#0a0a0f' },
  accessDenied: { color: '#555566', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Waypoint marker on map
  wpMapMarker: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: '#ff8c00',
    borderWidth:     2,
    borderColor:     '#fff',
    justifyContent:  'center',
    alignItems:      'center',
  },
  wpMapMarkerText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Map overlay
  mapOverlay: {
    position:       'absolute',
    bottom:         12,
    left:           12,
    right:          12,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
  },
  mapHintPill: {
    flex:              1,
    backgroundColor:   '#0a0a0fcc',
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       '#2a2a4e',
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  mapHintText: { color: '#888899', fontSize: 12, textAlign: 'center' },
  undoBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     '#ff8c0066',
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  undoBtnText: { color: '#ff8c00', fontSize: 12, fontWeight: '600' },

  // Form
  form: { padding: 16, gap: 20, paddingBottom: 40 },
  field: { gap: 8 },
  fieldHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  fieldLabel: {
    color:         '#44445a',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.2,
  },
  clearText: { color: '#ff4444', fontSize: 11, fontWeight: '600' },

  // Text input
  input: {
    backgroundColor: SURFACE,
    borderWidth:     1,
    borderColor:     BORDER,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color:           '#fff',
    fontSize:        15,
  },

  // Altitude stepper
  stepper: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: SURFACE,
    borderWidth:    1,
    borderColor:    BORDER,
    borderRadius:   10,
    alignSelf:      'flex-start',
  },
  stepBtn: {
    width:          44,
    height:         44,
    justifyContent: 'center',
    alignItems:     'center',
  },
  stepBtnText: { color: '#FFD700', fontSize: 22, fontWeight: '300', lineHeight: 26 },
  altValue:    { color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 50, textAlign: 'center' },

  // Drone chips
  droneScroll: { flexGrow: 0 },
  droneChip: {
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     '#2a2a4e',
    paddingHorizontal: 14,
    paddingVertical:   8,
    marginRight:     8,
    backgroundColor: SURFACE,
  },
  droneChipSel: {
    borderColor:     '#FFD70088',
    backgroundColor: '#FFD70018',
  },
  droneChipText:    { color: '#666677', fontSize: 13 },
  droneChipTextSel: { color: '#FFD700', fontWeight: '600' },
  noDrones: { color: '#33334a', fontSize: 13 },

  // Save button
  saveBtn: {
    backgroundColor: '#FFD700',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
