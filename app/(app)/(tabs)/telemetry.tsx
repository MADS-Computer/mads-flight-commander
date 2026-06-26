import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Text } from 'react-native';
import { router } from 'expo-router';
import { useDroneStream } from '@/hooks/useDroneStream';
import { TelemetryCard } from '@/components/telemetry/TelemetryCard';
import type { Drone, DroneStatus } from '@/types/drone';

// Operator-priority ordering: faults first, active next, idle, offline last
const PRIORITY: Record<DroneStatus, number> = {
  error:     0,
  flying:    1,
  armed:     2,
  returning: 3,
  idle:      4,
  offline:   5,
};

export default function TelemetryScreen() {
  const drones     = useDroneStream();
  const [refreshing, setRefreshing] = useState(false);

  const sorted = [...drones].sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status]);

  // Counts for the summary bar
  const counts = {
    flying:   drones.filter((d) => d.status === 'flying').length,
    armed:    drones.filter((d) => d.status === 'armed').length,
    error:    drones.filter((d) => d.status === 'error').length,
    offline:  drones.filter((d) => d.status === 'offline').length,
    total:    drones.length,
  };

  // Pull-to-refresh is cosmetic only — Realtime keeps cards live automatically
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const t = setTimeout(() => setRefreshing(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <TelemetryCard
            drone={item}
            onPress={() => router.push(`/(app)/drone/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={counts.total > 0 ? <SummaryBar counts={counts} /> : null}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00d4ff"
            colors={['#00d4ff']}
          />
        }
        // Keep all cards mounted so their Animated flash refs survive scroll
        removeClippedSubviews={false}
      />
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type Counts = { flying: number; armed: number; error: number; offline: number; total: number };

function SummaryBar({ counts }: { counts: Counts }) {
  return (
    <View style={styles.summary}>
      {counts.error   > 0 && <Pill count={counts.error}   label="Error"   color="#ff4444" />}
      {counts.flying  > 0 && <Pill count={counts.flying}  label="Flying"  color="#00d4ff" />}
      {counts.armed   > 0 && <Pill count={counts.armed}   label="Armed"   color="#ff8c00" />}
      {counts.offline > 0 && <Pill count={counts.offline} label="Offline" color="#444455" />}
      <Text style={styles.totalText}>{counts.total} drone{counts.total !== 1 ? 's' : ''}</Text>
    </View>
  );
}

function Pill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + '66', backgroundColor: color + '18' }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>
        {count} {label}
      </Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No drones connected</Text>
      <Text style={styles.emptyHint}>
        Start the MAVLink bridge server and connect your drones to see live telemetry here.
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#0a0a0f',
  },
  list: {
    padding:        14,
    paddingBottom:  40,
  },
  separator: {
    height: 10,
  },

  // Summary bar
  summary: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    alignItems:     'center',
    gap:            8,
    paddingBottom:  14,
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    borderRadius:      14,
    borderWidth:       1,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  pillDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },
  pillText: {
    fontSize:   11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  totalText: {
    marginLeft: 'auto' as const,
    color:      '#44445a',
    fontSize:   12,
  },

  // Empty state
  empty: {
    marginTop:         80,
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color:      '#555566',
    fontSize:   16,
    fontWeight: '600',
  },
  emptyHint: {
    color:      '#33334a',
    fontSize:   13,
    textAlign:  'center',
    lineHeight: 20,
  },
});
