import { useRef, useEffect, useCallback, useState } from 'react';
import { StyleSheet, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { useDroneStream } from '@/hooks/useDroneStream';
import { DronePin } from './DronePin';
import type { Drone, DroneStatus } from '@/types/drone';

const STYLE_URL = 'mapbox://styles/mapbox/dark-v11';

const STATUS_COLORS: Record<DroneStatus, string> = {
  idle:      '#888888',
  armed:     '#ff8c00',
  flying:    '#00d4ff',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#444444',
};

export default function MapScreen() {
  const drones        = useDroneStream();
  const cameraRef     = useRef<MapboxGL.Camera>(null);
  const hasFitRef     = useRef(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [mapReady, setMapReady]       = useState(false);

  // ── Fit camera to show all positioned drones on first data load ──────────
  useEffect(() => {
    if (hasFitRef.current || !mapReady) return;

    const positioned = drones.filter((d): d is Drone & { lat: number; lng: number } =>
      d.lat != null && d.lng != null
    );
    if (positioned.length === 0) return;

    hasFitRef.current = true;

    if (positioned.length === 1) {
      cameraRef.current?.setCamera({
        centerCoordinate: [positioned[0].lng, positioned[0].lat],
        zoomLevel:        15,
        animationDuration: 800,
      });
      return;
    }

    const lngs = positioned.map((d) => d.lng);
    const lats  = positioned.map((d) => d.lat);
    cameraRef.current?.fitBounds(
      [Math.max(...lngs), Math.max(...lats)], // NE corner [lng, lat]
      [Math.min(...lngs), Math.min(...lats)], // SW corner [lng, lat]
      [96, 64, 96, 64],                       // padding [top, right, bottom, left]
      900
    );
  }, [drones, mapReady]);

  // ── Fit-all button handler ────────────────────────────────────────────────
  const handleFitAll = useCallback(() => {
    const positioned = drones.filter((d): d is Drone & { lat: number; lng: number } =>
      d.lat != null && d.lng != null
    );
    if (positioned.length === 0) return;

    if (positioned.length === 1) {
      cameraRef.current?.setCamera({
        centerCoordinate: [positioned[0].lng, positioned[0].lat],
        zoomLevel:        15,
        animationDuration: 600,
      });
      return;
    }

    const lngs = positioned.map((d) => d.lng);
    const lats  = positioned.map((d) => d.lat);
    cameraRef.current?.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      [96, 64, 96, 64],
      600
    );
  }, [drones]);

  // ── Status counts for the HUD ─────────────────────────────────────────────
  const flyingCount = drones.filter((d) => d.status === 'flying').length;
  const errorCount  = drones.filter((d) => d.status === 'error').length;

  return (
    <View style={styles.container}>
      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={STYLE_URL}
        compassEnabled
        compassViewMargins={{ x: 12, y: 72 }}
        scaleBarEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [0, 0], zoomLevel: 2 }}
        />

        {drones.map((drone) => {
          if (drone.lat == null || drone.lng == null) return null;
          return (
            <MapboxGL.MarkerView
              key={drone.id}
              id={drone.id}
              coordinate={[drone.lng, drone.lat]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <DronePin
                drone={drone}
                selected={selectedId === drone.id}
                onPress={() => {
                  setSelectedId(drone.id);
                  router.push(`/(app)/drone/${drone.id}`);
                }}
              />
            </MapboxGL.MarkerView>
          );
        })}
      </MapboxGL.MapView>

      {/* ── HUD: fleet status bar ───────────────────────────────────────── */}
      <View style={styles.hud} pointerEvents="box-none">
        <View style={styles.hudInner}>
          <HudPill color="#00d4ff" label={`${flyingCount} flying`} />
          {errorCount > 0 && <HudPill color="#ff4444" label={`${errorCount} error`} />}
          <HudPill color="#555" label={`${drones.length} total`} />
        </View>
      </View>

      {/* ── Fit-all button ──────────────────────────────────────────────── */}
      <Pressable
        style={styles.fitBtn}
        onPress={handleFitAll}
        accessibilityLabel="Fit all drones in view"
      >
        <Text style={styles.fitBtnText}>⊕</Text>
      </Pressable>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {mapReady && drones.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <ActivityIndicator color="#00d4ff" />
          <Text style={styles.emptyText}>Waiting for drones…</Text>
        </View>
      )}

      {/* ── Offline drone badge ─────────────────────────────────────────── */}
      {drones.some((d) => d.status === 'offline') && (
        <View style={styles.offlineBadge} pointerEvents="none">
          {drones
            .filter((d) => d.status === 'offline')
            .map((d) => (
              <View key={d.id} style={styles.offlinePill}>
                <View style={[styles.offlineDot, { backgroundColor: STATUS_COLORS.offline }]} />
                <Text style={styles.offlineName}>{d.name}</Text>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

function HudPill({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.hudPill}>
      <View style={[styles.hudDot, { backgroundColor: color }]} />
      <Text style={styles.hudLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  // HUD bar pinned to the top of the map
  hud: {
    position:       'absolute',
    top:            12,
    left:           0,
    right:          0,
    alignItems:     'center',
    pointerEvents:  'none',
  },
  hudInner: {
    flexDirection:    'row',
    backgroundColor:  'rgba(10,10,15,0.85)',
    borderRadius:     20,
    paddingHorizontal: 14,
    paddingVertical:  6,
    gap:              12,
    borderWidth:      1,
    borderColor:      '#2a2a4e',
  },
  hudPill: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  hudDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  hudLabel: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '600',
  },

  // Fit-all button — bottom right
  fitBtn: {
    position:         'absolute',
    bottom:           32,
    right:            16,
    width:            44,
    height:           44,
    borderRadius:     22,
    backgroundColor:  'rgba(10,10,15,0.9)',
    borderWidth:      1,
    borderColor:      '#2a2a4e',
    justifyContent:   'center',
    alignItems:       'center',
  },
  fitBtnText: {
    color:      '#00d4ff',
    fontSize:   22,
    lineHeight: 24,
  },

  // Centered loading/empty overlay
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            12,
  },
  emptyText: {
    color:    '#888',
    fontSize: 14,
  },

  // Offline drones listed at bottom-left
  offlineBadge: {
    position: 'absolute',
    bottom:   32,
    left:     16,
    gap:      6,
  },
  offlinePill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderRadius:    10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     '#333',
  },
  offlineDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  offlineName: {
    color:    '#888',
    fontSize: 12,
  },
});
