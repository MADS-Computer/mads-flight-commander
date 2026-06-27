import { useCallback, useState, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDroneStream } from '@/hooks/useDroneStream';
import { TelemetryCard } from '@/components/telemetry/TelemetryCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Drone, DroneStatus } from '@/types/drone';

const PRIORITY: Record<DroneStatus, number> = {
  error:     0,
  flying:    1,
  armed:     2,
  returning: 3,
  idle:      4,
  offline:   5,
};

const STATUS_OPTIONS: Array<DroneStatus | 'all'> = [
  'all', 'flying', 'armed', 'returning', 'idle', 'error', 'offline',
];

export default function TelemetryScreen() {
  const drones     = useDroneStream();
  const [refreshing, setRefreshing] = useState(false);
  const [query,      setQuery]      = useState('');
  const [statusFilter, setStatusFilter] = useState<DroneStatus | 'all'>('all');

  const filtered = useMemo(() => {
    let list = [...drones];
    if (statusFilter !== 'all') {
      list = list.filter(d => d.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.model?.toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status]);
  }, [drones, query, statusFilter]);

  const counts = {
    flying:  drones.filter(d => d.status === 'flying').length,
    armed:   drones.filter(d => d.status === 'armed').length,
    error:   drones.filter(d => d.status === 'error').length,
    offline: drones.filter(d => d.status === 'offline').length,
    total:   drones.length,
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const t = setTimeout(() => setRefreshing(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <ErrorBoundary fallbackLabel="Telemetry failed to load">
      <View style={styles.container}>
        {/* ── Filter bar ─────────────────────────────────────────────────── */}
        <View style={styles.filterBar}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={15} color="#44445a" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search drones…"
              placeholderTextColor="#44445a"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            horizontal
            data={STATUS_OPTIONS}
            keyExtractor={s => s}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusChips}
            renderItem={({ item: s }) => {
              const active = statusFilter === s;
              const count  = s === 'all' ? drones.length
                           : drones.filter(d => d.status === s).length;
              return (
                <View
                  onStartShouldSetResponder={() => true}
                  onResponderGrant={() => setStatusFilter(s)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s === 'all' ? `All (${count})` : `${s[0].toUpperCase()}${s.slice(1)} (${count})`}
                  </Text>
                </View>
              );
            }}
          />
        </View>

        {/* ── Drone list ──────────────────────────────────────────────────── */}
        <FlatList
          data={filtered}
          keyExtractor={d => d.id}
          renderItem={({ item }) => (
            <TelemetryCard
              drone={item}
              onPress={() => router.push(`/(app)/drone/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={counts.total > 0 ? <SummaryBar counts={counts} /> : null}
          ListEmptyComponent={
            <EmptyState
              hasQuery={query.trim().length > 0 || statusFilter !== 'all'}
              hasAny={drones.length > 0}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFD700"
              colors={['#FFD700']}
            />
          }
          removeClippedSubviews={false}
        />
      </View>
    </ErrorBoundary>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type Counts = { flying: number; armed: number; error: number; offline: number; total: number };

function SummaryBar({ counts }: { counts: Counts }) {
  return (
    <View style={styles.summary}>
      {counts.error   > 0 && <Pill count={counts.error}   label="Error"   color="#ff4444" />}
      {counts.flying  > 0 && <Pill count={counts.flying}  label="Flying"  color="#FFD700" />}
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
      <Text style={[styles.pillText, { color }]}>{count} {label}</Text>
    </View>
  );
}

function EmptyState({ hasQuery, hasAny }: { hasQuery: boolean; hasAny: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>
        {hasQuery ? 'No matches' : hasAny ? 'No drones match filter' : 'No drones connected'}
      </Text>
      <Text style={styles.emptyHint}>
        {hasQuery
          ? 'Try a different name or status filter.'
          : 'Start the MAVLink bridge server to see live telemetry.'}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  filterBar: {
    backgroundColor: '#0a0a0f',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom:   8,
  },

  searchRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: SURFACE,
    margin:          12,
    marginBottom:    8,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     BORDER,
    height:          40,
  },
  searchInput: {
    flex:       1,
    color:      '#fff',
    fontSize:   14,
    paddingHorizontal: 10,
    height:     '100%',
  },

  statusChips: {
    paddingHorizontal: 12,
    gap:               8,
  },
  chip: {
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       BORDER,
    paddingHorizontal: 10,
    paddingVertical:   5,
    backgroundColor:   SURFACE,
  },
  chipActive: {
    borderColor:     '#FFD70088',
    backgroundColor: '#FFD70018',
  },
  chipText: {
    color:    '#44445a',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFD700',
  },

  list:      { padding: 14, paddingBottom: 40 },
  separator: { height: 10 },

  summary: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    alignItems:    'center',
    gap:           8,
    paddingBottom: 14,
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
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  totalText: { marginLeft: 'auto' as const, color: '#44445a', fontSize: 12 },

  empty: {
    marginTop: 80, alignItems: 'center', gap: 10, paddingHorizontal: 32,
  },
  emptyTitle: { color: '#555566', fontSize: 16, fontWeight: '600' },
  emptyHint:  { color: '#33334a', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
