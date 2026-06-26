import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import type { Waypoint } from '@/types/mission';

interface Props {
  waypoints: Waypoint[];
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}

export function WaypointList({ waypoints, onRemove, readOnly }: Props) {
  return (
    <FlatList
      data={waypoints}
      keyExtractor={(w) => w.id}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={styles.seq}>
            <Text style={styles.seqText}>{item.sequence}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.action}>{item.action.replace(/_/g, ' ')}</Text>
            <Text style={styles.coords}>
              {item.lat.toFixed(5)}, {item.lng.toFixed(5)}{'  ·  '}{item.altitude}m
            </Text>
          </View>
          {!readOnly && onRemove && (
            <Pressable onPress={() => onRemove(item.id)} style={styles.remove} hitSlop={8}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e38',
  },
  seq: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: '#ff8c00',
    justifyContent:  'center',
    alignItems:      'center',
  },
  seqText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  info: { flex: 1 },
  action: {
    color:         '#c0c0d8',
    fontWeight:    '600',
    fontSize:      13,
    textTransform: 'capitalize',
  },
  coords: { color: '#666677', fontSize: 11, marginTop: 1 },
  remove: { padding: 6 },
  removeText: { color: '#ff4444', fontWeight: '700', fontSize: 14 },
});
