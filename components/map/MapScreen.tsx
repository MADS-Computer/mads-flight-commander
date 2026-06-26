// Web fallback — @rnmapbox/maps is native-only.
// Shows a live drone list with coordinates and battery instead.
import { FlatList, StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useDroneStream } from '@/hooks/useDroneStream';
import type { Drone } from '@/types/drone';

export default function MapScreen() {
  const drones = useDroneStream();

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Live Map — open on iOS or Android for the interactive Mapbox view
        </Text>
      </View>

      <FlatList
        data={drones}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DroneRow drone={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No drones connected</Text>
        }
      />
    </View>
  );
}

function DroneRow({ drone }: { drone: Drone }) {
  const hasPos = drone.lat != null && drone.lng != null;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/(app)/drone/${drone.id}`)}
    >
      <View style={[styles.statusStrip, { backgroundColor: STATUS_BG[drone.status] }]} />
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.name}>{drone.name}</Text>
          <Text style={[styles.status, { color: STATUS_BG[drone.status] }]}>
            {drone.status.toUpperCase()}
          </Text>
        </View>
        {hasPos ? (
          <Text style={styles.coords}>
            {drone.lat!.toFixed(5)}, {drone.lng!.toFixed(5)}
            {drone.altitude != null ? `  ·  ${drone.altitude.toFixed(0)} m` : ''}
          </Text>
        ) : (
          <Text style={styles.noPos}>No position</Text>
        )}
        {drone.batteryPercent != null && (
          <Text style={[styles.battery, { color: batteryColor(drone.batteryPercent) }]}>
            ▋ {drone.batteryPercent}%
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function batteryColor(pct: number) {
  if (pct > 50) return '#00e676';
  if (pct > 20) return '#ff8c00';
  return '#ff4444';
}

const STATUS_BG: Record<Drone['status'], string> = {
  idle:      '#888',
  armed:     '#ff8c00',
  flying:    '#FFD700',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#333',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  banner: {
    backgroundColor: '#1a1a2e',
    padding:         12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  bannerText: { color: '#888', fontSize: 12, textAlign: 'center' },
  list:       { padding: 12, gap: 10 },
  row: {
    flexDirection:   'row',
    backgroundColor: '#1a1a2e',
    borderRadius:    10,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     '#2a2a4e',
  },
  statusStrip: { width: 4 },
  rowContent:  { flex: 1, padding: 12, gap: 3 },
  rowHeader:   { flexDirection: 'row', justifyContent: 'space-between' },
  name:        { color: '#fff', fontSize: 14, fontWeight: '600' },
  status:      { fontSize: 11, fontWeight: '700' },
  coords:      { color: '#888', fontSize: 11, fontFamily: 'monospace' },
  noPos:       { color: '#444', fontSize: 11 },
  battery:     { fontSize: 11, fontWeight: '600' },
  empty:       { color: '#555', textAlign: 'center', marginTop: 48 },
});
