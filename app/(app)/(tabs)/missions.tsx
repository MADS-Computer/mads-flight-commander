import { useState, useCallback } from 'react';
import { FlatList, View, Text, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useMissions } from '@/hooks/useMissions';
import { useAuth } from '@/hooks/useAuth';
import { MissionCard } from '@/components/mission/MissionCard';
import type { MissionStatus } from '@/types/mission';

const STATUS_PRIORITY: Record<MissionStatus, number> = {
  active:    0,
  paused:    1,
  uploaded:  2,
  draft:     3,
  completed: 4,
  aborted:   5,
};

export default function MissionsScreen() {
  const missions    = useMissions();
  const { profile } = useAuth();
  const isOperator  = profile?.role === 'operator';
  const [refreshing, setRefreshing] = useState(false);

  const sorted = [...missions].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const t = setTimeout(() => setRefreshing(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MissionCard
            mission={item}
            onPress={() => router.push(`/(app)/mission/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<EmptyState isOperator={isOperator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFD700"
            colors={['#FFD700']}
          />
        }
      />

      {isOperator && (
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/(app)/mission/new')}
        >
          <Text style={styles.fabText}>+ New Mission</Text>
        </Pressable>
      )}
    </View>
  );
}

function EmptyState({ isOperator }: { isOperator: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No missions yet</Text>
      <Text style={styles.emptyHint}>
        {isOperator
          ? 'Tap + New Mission to plan a waypoint route and assign it to drones.'
          : 'No missions have been created yet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  list:      { padding: 16, paddingBottom: 100 },
  empty: {
    marginTop:         80,
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 32,
  },
  emptyTitle: { color: '#555566', fontSize: 16, fontWeight: '600' },
  emptyHint:  { color: '#33334a', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  fab: {
    position:          'absolute',
    bottom:            24,
    right:             24,
    backgroundColor:   '#FFD700',
    borderRadius:      24,
    paddingVertical:   12,
    paddingHorizontal: 20,
  },
  fabText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
