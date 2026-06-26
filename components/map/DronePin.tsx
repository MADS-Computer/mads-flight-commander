import { Pressable, View, Text, StyleSheet } from 'react-native';
import type { Drone, DroneStatus } from '@/types/drone';

const STATUS_COLORS: Record<DroneStatus, string> = {
  idle:      '#888888',
  armed:     '#ff8c00',
  flying:    '#FFD700',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#444444',
};

function batteryColor(pct: number): string {
  if (pct > 50) return '#00e676';
  if (pct > 20) return '#ff8c00';
  return '#ff4444';
}

// Fixed pixel width for the battery track — avoids percentage-string TypeScript issues
const BATTERY_TRACK_W = 72;

interface Props {
  drone: Drone;
  onPress: () => void;
  selected?: boolean;
}

export function DronePin({ drone, onPress, selected = false }: Props) {
  const color  = STATUS_COLORS[drone.status];
  const pct    = drone.batteryPercent;
  const fillW  = pct != null ? Math.round(BATTERY_TRACK_W * Math.max(0, Math.min(100, pct)) / 100) : 0;

  return (
    // hitSlop makes the whole pin easy to tap on a crowded map
    <Pressable onPress={onPress} hitSlop={8} style={styles.root}>
      {/* ── Callout bubble ─────────────────────────── */}
      <View style={[
        styles.bubble,
        { borderColor: color },
        selected && styles.bubbleSelected,
      ]}>
        {/* Header row: status dot + name */}
        <View style={styles.header}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={styles.name} numberOfLines={1}>{drone.name}</Text>
        </View>

        {/* Battery row */}
        {pct != null ? (
          <View style={styles.batteryRow}>
            <View style={[styles.batteryTrack, { width: BATTERY_TRACK_W }]}>
              <View style={[styles.batteryFill, { width: fillW, backgroundColor: batteryColor(pct) }]} />
            </View>
            <Text style={[styles.batteryPct, { color: batteryColor(pct) }]}>{pct}%</Text>
          </View>
        ) : (
          <Text style={styles.noSignal}>No signal</Text>
        )}
      </View>

      {/* ── Downward-pointing arrow at the bottom-center ── */}
      {/* The MarkerView anchor is { x: 0.5, y: 1 }, so this tip sits  */}
      {/* exactly at the drone's lat/lng on the map.                    */}
      <View style={[styles.arrow, { borderTopColor: color }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },

  bubble: {
    backgroundColor:  '#0d0d1a',
    borderRadius:     10,
    borderWidth:      1.5,
    paddingHorizontal: 10,
    paddingVertical:  7,
    minWidth:         100,
    maxWidth:         160,
    gap:              5,
    // Subtle shadow so the pin stands out on a light map area
    shadowColor:      '#000',
    shadowOpacity:    0.6,
    shadowRadius:     4,
    shadowOffset:     { width: 0, height: 2 },
    elevation:        4,
  },

  bubbleSelected: {
    backgroundColor: '#1a1a3e',
  },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
  },

  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },

  name: {
    color:      '#ffffff',
    fontSize:   12,
    fontWeight: '700',
    flexShrink: 1,
  },

  batteryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },

  batteryTrack: {
    height:       5,
    backgroundColor: '#2a2a4e',
    borderRadius: 3,
    overflow:     'hidden',
  },

  batteryFill: {
    height:       '100%',
    borderRadius: 3,
  },

  batteryPct: {
    fontSize:   10,
    fontWeight: '700',
  },

  noSignal: {
    color:    '#555',
    fontSize: 10,
  },

  // CSS border-trick triangle — bottom-center pointer
  arrow: {
    width:            0,
    height:           0,
    borderLeftWidth:  7,
    borderRightWidth: 7,
    borderTopWidth:   9,
    borderLeftColor:  'transparent',
    borderRightColor: 'transparent',
    // borderTopColor set dynamically per drone
    marginTop:        -1,   // close the gap to the bubble bottom
  },
});
