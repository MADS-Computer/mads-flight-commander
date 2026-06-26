import { Pressable, View, Text, StyleSheet } from 'react-native';
import type { Mission, MissionStatus } from '@/types/mission';

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

interface Props {
  mission: Mission;
  onPress: () => void;
}

export function MissionCard({ mission, onPress }: Props) {
  const sc = STATUS_COLOR[mission.status];

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Mission ${mission.name}`}>
      <View style={[styles.card, { borderLeftColor: sc }]}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{mission.name}</Text>
          <View style={[styles.badge, { backgroundColor: sc + '22', borderColor: sc + '88' }]}>
            <Text style={[styles.badgeText, { color: sc }]}>{STATUS_LABEL[mission.status]}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {mission.waypoints.length} waypoint{mission.waypoints.length !== 1 ? 's' : ''}
          {'  ·  '}
          {mission.assignedDroneIds.length} drone{mission.assignedDroneIds.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.time}>
          {new Date(mission.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f0f1e',
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#1e1e38',
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingTop:      13,
    paddingBottom:   12,
    gap:             4,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   2,
  },
  name: {
    color:      '#ffffff',
    fontSize:   15,
    fontWeight: '700',
    flex:       1,
    marginRight: 10,
  },
  badge: {
    borderRadius:    6,
    borderWidth:     1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 0.6,
  },
  meta: {
    color:    '#666677',
    fontSize: 12,
  },
  time: {
    color:    '#44445a',
    fontSize: 11,
  },
});
