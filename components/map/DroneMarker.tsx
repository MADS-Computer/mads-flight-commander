import { View, Text, StyleSheet } from 'react-native';
import type { Drone } from '@/types/drone';

interface Props {
  drone: Drone;
  onPress?: () => void;
}

// Placeholder — replace View with MapboxGL.MarkerView once map is configured
export function DroneMarker({ drone }: Props) {
  const statusColors: Record<Drone['status'], string> = {
    idle: '#888',
    armed: '#ff8c00',
    flying: '#00d4ff',
    returning: '#a020f0',
    error: '#ff4444',
    offline: '#333',
  };

  return (
    <View style={[styles.marker, { backgroundColor: statusColors[drone.status] }]}>
      <Text style={styles.label}>{drone.name.slice(0, 4)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  label: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
