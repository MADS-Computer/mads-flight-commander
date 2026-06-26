import { useEffect, useRef } from 'react';
import { Animated, Pressable, View, Text, StyleSheet } from 'react-native';
import type { Drone, DroneStatus } from '@/types/drone';
import { BatteryIndicator } from './BatteryIndicator';

// ── constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<DroneStatus, string> = {
  idle:      '#666677',
  armed:     '#ff8c00',
  flying:    '#00d4ff',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#333344',
};

const STATUS_LABEL: Record<DroneStatus, string> = {
  idle:      'IDLE',
  armed:     'ARMED',
  flying:    'FLYING',
  returning: 'RTH',
  error:     'ERROR',
  offline:   'OFFLINE',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function batteryColor(pct: number): string {
  if (pct > 50) return '#00e676';
  if (pct > 20) return '#ff8c00';
  return '#ff4444';
}

function signalColor(pct: number): string {
  if (pct > 70) return '#00e676';
  if (pct > 40) return '#ff8c00';
  return '#ff4444';
}

function cardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  return dirs[Math.round(deg / 45) % 8];
}

function fmtCoord(val: number, pos: string, neg: string): string {
  return `${Math.abs(val).toFixed(5)}° ${val >= 0 ? pos : neg}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
        {unit && value !== '—' ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

// ── main component ───────────────────────────────────────────────────────────

interface Props {
  drone:   Drone;
  onPress: () => void;
}

export function TelemetryCard({ drone, onPress }: Props) {
  const sc         = STATUS_COLOR[drone.status];
  const hasPos     = drone.lat != null && drone.lng != null;
  const hasData    = drone.batteryPercent != null || hasPos || drone.altitude != null;
  const isLive     = drone.lastSeenAt != null &&
                     (Date.now() - new Date(drone.lastSeenAt).getTime()) < 10_000;

  // ── flash overlay on each Realtime update ──────────────────────────────
  const flash         = useRef(new Animated.Value(0)).current;
  const prevUpdatedAt = useRef<string | null>(null);

  useEffect(() => {
    if (prevUpdatedAt.current !== null && prevUpdatedAt.current !== drone.updatedAt) {
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
    prevUpdatedAt.current = drone.updatedAt;
  }, [drone.updatedAt, flash]);

  const flashOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.10] });

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Drone ${drone.name}`}>
      <View style={[styles.card, { borderLeftColor: sc }]}>

        {/* Realtime update shimmer */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: sc, opacity: flashOpacity }]}
          pointerEvents="none"
        />

        {/* ── Header: name + live dot + status badge ───────────────────── */}
        <View style={styles.header}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{drone.name}</Text>
            {isLive && <View style={[styles.liveDot, { backgroundColor: sc }]} />}
          </View>
          <View style={[styles.badge, { backgroundColor: sc + '22', borderColor: sc + '88' }]}>
            <Text style={[styles.badgeText, { color: sc }]}>{STATUS_LABEL[drone.status]}</Text>
          </View>
        </View>

        {hasData ? (
          <>
            {/* ── Battery ──────────────────────────────────────────────── */}
            {drone.batteryPercent != null && (
              <View style={styles.section}>
                <View style={styles.batteryLabelRow}>
                  <SectionLabel text="BATTERY" />
                  <View style={styles.batteryValueRow}>
                    {drone.batteryVoltage != null && (
                      <Text style={styles.voltage}>{drone.batteryVoltage.toFixed(1)} V</Text>
                    )}
                    <Text style={[styles.batteryPct, { color: batteryColor(drone.batteryPercent) }]}>
                      {drone.batteryPercent}%
                    </Text>
                  </View>
                </View>
                <BatteryIndicator percent={drone.batteryPercent} height={10} />
              </View>
            )}

            {/* ── GPS coordinates ──────────────────────────────────────── */}
            {hasPos && (
              <View style={styles.section}>
                <SectionLabel text="GPS POSITION" />
                <Text style={styles.coords}>
                  {fmtCoord(drone.lat!, 'N', 'S')}{'   '}{fmtCoord(drone.lng!, 'E', 'W')}
                </Text>
              </View>
            )}

            {/* ── Metrics grid ─────────────────────────────────────────── */}
            <View style={styles.metricsRow}>
              <Metric
                label="ALTITUDE"
                value={drone.altitude != null ? drone.altitude.toFixed(1) : '—'}
                unit="m"
              />
              <View style={styles.divider} />
              <Metric
                label="SPEED"
                value={drone.speed != null ? drone.speed.toFixed(1) : '—'}
                unit="m/s"
              />
              <View style={styles.divider} />
              <Metric
                label="HEADING"
                value={drone.heading != null
                  ? `${Math.round(drone.heading)}° ${cardinal(drone.heading)}`
                  : '—'}
              />
              <View style={styles.divider} />
              <Metric
                label="SATS"
                value={drone.satelliteCount != null ? String(drone.satelliteCount) : '—'}
              />
            </View>

            {/* ── Footer: signal + timestamp ───────────────────────────── */}
            <View style={styles.footer}>
              <View style={styles.footerLeft}>
                {drone.signalStrength != null && (
                  <>
                    <Text style={styles.footerLabel}>Signal </Text>
                    <Text style={[styles.footerValue, { color: signalColor(drone.signalStrength) }]}>
                      {drone.signalStrength}%
                    </Text>
                  </>
                )}
              </View>
              {drone.lastSeenAt && (
                <Text style={styles.timestamp}>{fmtTime(drone.lastSeenAt)}</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.noDataRow}>
            <Text style={styles.noDataText}>Waiting for telemetry…</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     BORDER,
    borderLeftWidth: 3,
    overflow:        'hidden',
  },

  // Header
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 14,
    paddingTop:      13,
    paddingBottom:   11,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
    marginRight:   10,
  },
  name: {
    color:      '#ffffff',
    fontSize:   16,
    fontWeight: '700',
    flexShrink: 1,
  },
  liveDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  badge: {
    borderRadius:    6,
    borderWidth:     1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 0.6,
  },

  // Generic section wrapper
  section: {
    paddingHorizontal: 14,
    paddingBottom:     11,
    gap:               5,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
    paddingTop:        9,
  },
  sectionLabel: {
    color:         '#44445a',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.2,
  },

  // Battery
  batteryLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  batteryValueRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  voltage: {
    color:      '#555566',
    fontSize:   11,
    fontWeight: '500',
  },
  batteryPct: {
    fontSize:   13,
    fontWeight: '700',
  },

  // GPS
  coords: {
    color:         '#9090aa',
    fontSize:      12,
    letterSpacing: 0.3,
  },

  // Metrics
  metricsRow: {
    flexDirection:  'row',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  metric: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: 10,
    gap:            4,
  },
  divider: {
    width:           1,
    backgroundColor: BORDER,
    marginVertical:  8,
  },
  metricLabel: {
    color:         '#44445a',
    fontSize:      8,
    fontWeight:    '700',
    letterSpacing: 0.8,
  },
  metricValue: {
    color:      '#d8d8f0',
    fontSize:   13,
    fontWeight: '700',
  },
  metricUnit: {
    color:      '#666677',
    fontSize:   10,
    fontWeight: '400',
  },

  // Footer
  footer: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  footerLabel: {
    color:    '#44445a',
    fontSize: 11,
  },
  footerValue: {
    fontSize:   11,
    fontWeight: '600',
  },
  timestamp: {
    color:    '#33334a',
    fontSize: 11,
  },

  // No-data state
  noDataRow: {
    paddingHorizontal: 14,
    paddingBottom:     14,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
    paddingTop:        11,
  },
  noDataText: {
    color:    '#33334a',
    fontSize: 13,
  },
});
