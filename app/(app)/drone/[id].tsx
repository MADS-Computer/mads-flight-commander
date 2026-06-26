import { StyleSheet, View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDrone } from '@/hooks/useDroneStream';

export default function DroneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drone = useDrone(id);

  if (!drone) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FFD700" />
        <Text style={styles.loadingText}>Loading drone data...</Text>
      </View>
    );
  }

  const hasPosition = drone.lat != null && drone.lng != null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.nameRow}>
        <Text style={styles.droneName}>{drone.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[drone.status] }]}>
          <Text style={styles.statusText}>{drone.status.toUpperCase()}</Text>
        </View>
      </View>

      <Section title="Position">
        <Row label="Latitude"  value={hasPosition ? drone.lat!.toFixed(6)  : '—'} />
        <Row label="Longitude" value={hasPosition ? drone.lng!.toFixed(6)  : '—'} />
        <Row label="Altitude"  value={drone.altitude         != null ? `${drone.altitude.toFixed(1)} m`         : '—'} />
        <Row label="Rel. Alt"  value={drone.relativeAltitude != null ? `${drone.relativeAltitude.toFixed(1)} m` : '—'} />
      </Section>

      <Section title="Power">
        <Row label="Battery"  value={drone.batteryPercent != null ? `${drone.batteryPercent}%`                  : '—'} />
        <Row label="Voltage"  value={drone.batteryVoltage != null ? `${drone.batteryVoltage.toFixed(2)} V`      : '—'} />
      </Section>

      <Section title="Flight">
        <Row label="Speed"    value={drone.speed   != null ? `${drone.speed.toFixed(1)} m/s`     : '—'} />
        <Row label="Heading"  value={drone.heading != null ? `${drone.heading.toFixed(0)}°`       : '—'} />
      </Section>

      <Section title="GPS">
        <Row label="Satellites"     value={drone.satelliteCount != null ? `${drone.satelliteCount}` : '—'} />
        <Row label="Signal"         value={drone.signalStrength != null ? `${drone.signalStrength}%` : '—'} />
      </Section>

      <Section title="Info">
        <Row label="Model"      value={drone.model || '—'} />
        <Row label="System ID"  value={drone.systemId != null ? `${drone.systemId}` : '—'} />
        <Row label="Last seen"  value={drone.lastSeenAt ? new Date(drone.lastSeenAt).toLocaleTimeString() : 'Never'} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const STATUS_COLORS: Record<string, string> = {
  idle:      '#444444',
  armed:     '#ff8c00',
  flying:    '#FFD700',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#333333',
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a0f' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f', gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },
  content:     { padding: 16, gap: 16 },
  nameRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  droneName:   { color: '#fff', fontSize: 20, fontWeight: '700' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  section:     { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a4e' },
  sectionTitle:{ color: '#FFD700', fontSize: 12, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a4e' },
  rowLabel:    { color: '#888', fontSize: 14 },
  rowValue:    { color: '#fff', fontSize: 14, fontWeight: '600' },
});
