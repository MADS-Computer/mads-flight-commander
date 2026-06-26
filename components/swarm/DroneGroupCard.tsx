import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { DroneGroup, Drone } from '@/types/drone';

interface Props {
  group: DroneGroup;
  drones: Drone[];
  onAssignMission?: () => void;
  canControl: boolean;
}

export function DroneGroupCard({ group, drones, onAssignMission, canControl }: Props) {
  const groupDrones = drones.filter((d) => d.groupId === group.id);
  const flyingCount = groupDrones.filter((d) => d.status === 'flying').length;

  return (
    <View style={[styles.card, { borderLeftColor: group.color, borderLeftWidth: 4 }]}>
      <Text style={styles.name}>{group.name}</Text>
      <Text style={styles.meta}>
        {groupDrones.length} drones · {flyingCount} flying
      </Text>
      {canControl && (
        <Pressable style={styles.assignBtn} onPress={onAssignMission}>
          <Text style={styles.assignText}>Assign Mission</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: '#2a2a4e' },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: '#888', fontSize: 13 },
  assignBtn: { marginTop: 8, backgroundColor: '#00d4ff', borderRadius: 8, padding: 10, alignItems: 'center' },
  assignText: { color: '#000', fontWeight: '700', fontSize: 13 },
});
