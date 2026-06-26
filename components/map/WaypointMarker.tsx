import { View, Text, StyleSheet } from 'react-native';
import type { Waypoint } from '@/types/mission';

interface Props {
  waypoint: Waypoint;
}

export function WaypointMarker({ waypoint }: Props) {
  return (
    <View style={styles.marker}>
      <Text style={styles.seq}>{waypoint.sequence}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ff8c00', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  seq: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
