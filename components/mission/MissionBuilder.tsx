// Web-only: interactive mapbox-gl-js mission builder.
// Metro picks MissionBuilder.native.tsx on iOS/Android.
import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { supabase }      from '@/lib/supabase';
import { useDroneStream } from '@/hooks/useDroneStream';
import { useAuth }        from '@/hooks/useAuth';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const LINE_SOURCE = 'waypoint-line';
const LINE_LAYER  = 'waypoint-line-layer';

type WP = { lng: number; lat: number; altitude: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWpMarkerEl(index: number): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'width:26px;height:26px;border-radius:50%;',
    'background:#FFD700;color:#000;',
    'display:flex;align-items:center;justify-content:center;',
    'font-size:11px;font-weight:800;',
    'border:2px solid rgba(255,255,255,0.9);',
    'box-shadow:0 0 0 3px rgba(255,215,0,0.3);',
    'cursor:grab;user-select:none;',
  ].join('');
  el.textContent = String(index + 1);
  return el;
}

function lineGeoJSON(wps: WP[]): GeoJSON.Feature {
  return {
    type:     'Feature',
    geometry: {
      type:        'LineString',
      coordinates: wps.map(wp => [wp.lng, wp.lat]),
    },
    properties: {},
  };
}

// ── Sidebar Waypoint Row ──────────────────────────────────────────────────────

function WpRow({
  wp, index, total,
  onChange, onDelete, onMoveUp, onMoveDown,
}: {
  wp:          WP;
  index:       number;
  total:       number;
  onChange:    (alt: number) => void;
  onDelete:    () => void;
  onMoveUp:    () => void;
  onMoveDown:  () => void;
}) {
  const [altStr, setAltStr] = useState(String(wp.altitude));

  return (
    <div style={{
      background:   '#0f0f1e',
      border:       '1px solid #1e1e38',
      borderRadius: 8,
      padding:      '8px 10px',
      display:      'flex',
      flexDirection: 'column',
      gap:          4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#FFD700', fontSize: 11, fontWeight: 700 }}>WP{index + 1}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {index > 0 && (
            <ArrowBtn label="↑" onClick={onMoveUp} />
          )}
          {index < total - 1 && (
            <ArrowBtn label="↓" onClick={onMoveDown} />
          )}
          <DelBtn onClick={onDelete} />
        </div>
      </div>
      <div style={{ color: '#555566', fontSize: 10 }}>
        {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#44445a', fontSize: 10, flexShrink: 0 }}>Alt (m)</span>
        <input
          type="number"
          value={altStr}
          style={{
            width:           '60px',
            background:      '#12121f',
            border:          '1px solid #2a2a4e',
            borderRadius:    4,
            color:           '#fff',
            fontSize:        11,
            padding:         '2px 6px',
            outline:         'none',
            fontFamily:      'inherit',
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAltStr(e.target.value)}
          onBlur={() => {
            const v = parseFloat(altStr);
            if (!isNaN(v) && v > 0) onChange(v);
            else setAltStr(String(wp.altitude));
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </div>
  );
}

function ArrowBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={iconBtnStyle}>
      {label}
    </button>
  );
}

function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ ...iconBtnStyle, color: '#ff4444' }}
    >×</button>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background:  'none',
  border:      '1px solid #1e1e38',
  borderRadius: 4,
  color:       '#888899',
  cursor:      'pointer',
  width:       22,
  height:      22,
  display:     'flex',
  alignItems:  'center',
  justifyContent: 'center',
  fontSize:    13,
  padding:     0,
  fontFamily:  'inherit',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function MissionBuilder() {
  const { session, profile } = useAuth();
  const allDrones = useDroneStream();
  const isOperator = profile?.role === 'operator';

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<mapboxgl.Marker[]>([]);

  const [waypoints,   setWaypoints]   = useState<WP[]>([]);
  const [missionName, setMissionName] = useState('');
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);

  // ── Inject CSS once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('mapbox-gl-css')) {
      const link  = document.createElement('link');
      link.id     = 'mapbox-gl-css';
      link.rel    = 'stylesheet';
      link.href   = `https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl.css`;
      document.head.appendChild(link);
    }
  }, []);

  // ── Init map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/dark-v11',
      center:    [-73.97, 40.76],
      zoom:      12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    map.on('load', () => {
      // Line source + layer for waypoint path
      map.addSource(LINE_SOURCE, { type: 'geojson', data: lineGeoJSON([]) });
      map.addLayer({
        id:     LINE_LAYER,
        type:   'line',
        source: LINE_SOURCE,
        paint:  {
          'line-color':      '#FFD700',
          'line-width':      2,
          'line-dasharray':  [4, 3],
          'line-opacity':    0.8,
        },
      });
    });

    // Click to place waypoint
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setWaypoints(prev => [...prev, { lng, lat, altitude: 50 }]);
    });

    mapRef.current = map;
    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Sync markers + line on waypoint change ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    // Add numbered markers
    for (let i = 0; i < waypoints.length; i++) {
      const wp  = waypoints[i];
      const el  = buildWpMarkerEl(i);
      const mkr = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);
      markersRef.current.push(mkr);
    }

    // Update line
    const source = map.getSource(LINE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(lineGeoJSON(waypoints));
  }, [waypoints]);

  // ── Waypoint mutation helpers ──────────────────────────────────────────
  const updateAltitude = useCallback((i: number, alt: number) => {
    setWaypoints(prev => prev.map((wp, idx) => idx === i ? { ...wp, altitude: alt } : wp));
  }, []);

  const deleteWaypoint = useCallback((i: number) => {
    setWaypoints(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const moveUp = useCallback((i: number) => {
    if (i === 0) return;
    setWaypoints(prev => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((i: number) => {
    setWaypoints(prev => {
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setWaypoints([]), []);

  function toggleDrone(id: string) {
    setAssignedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // ── Save mission ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!missionName.trim()) {
      Alert.alert('Name required', 'Enter a mission name before saving.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('missions')
      .insert({
        name:               missionName.trim(),
        status:             'draft',
        waypoints:          waypoints.map(wp => ({
          lat:            wp.lat,
          lng:            wp.lng,
          altitude:       wp.altitude,
          loiter_seconds: 0,
        })),
        assigned_drone_ids: assignedIds,
        assigned_group_id:  null,
        created_by:         session!.user.id,
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.replace(`/(app)/mission/${data.id}`);
  }

  if (!isOperator) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', color: '#555566', padding: 32, textAlign: 'center',
        fontFamily: 'sans-serif',
      }}>
        Observer mode — mission creation is restricted to operators.
      </div>
    );
  }

  return (
    <div style={{
      display:    'flex',
      height:     '100%',
      background: '#0a0a0f',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Map */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        {/* Click hint */}
        {waypoints.length === 0 && (
          <div style={{
            position:   'absolute',
            bottom:     24,
            left:       '50%',
            transform:  'translateX(-50%)',
            background: 'rgba(10,10,15,0.88)',
            border:     '1px solid #1e1e38',
            borderRadius: 8,
            padding:    '8px 16px',
            color:      '#888899',
            fontSize:   12,
            zIndex:     10,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            Click on the map to place waypoints
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{
        width:        320,
        display:      'flex',
        flexDirection: 'column',
        borderLeft:   '1px solid #1e1e38',
        background:   '#0a0a0f',
        overflow:     'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding:      '14px 16px 10px',
          borderBottom: '1px solid #1e1e38',
        }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            New Mission
          </div>
          <input
            type="text"
            placeholder="Mission name…"
            value={missionName}
            onChange={e => setMissionName(e.target.value)}
            maxLength={80}
            style={{
              width:        '100%',
              background:   '#0f0f1e',
              border:       '1px solid #1e1e38',
              borderRadius: 8,
              color:        '#fff',
              fontSize:     14,
              padding:      '8px 12px',
              outline:      'none',
              fontFamily:   'inherit',
              boxSizing:    'border-box',
            }}
          />
        </div>

        {/* Waypoints scrollable area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
          <div style={{
            display:       'flex',
            justifyContent: 'space-between',
            alignItems:    'center',
            marginBottom:  8,
          }}>
            <span style={{ color: '#44445a', fontSize: 9, fontWeight: 700, letterSpacing: 1.2 }}>
              WAYPOINTS ({waypoints.length})
            </span>
            {waypoints.length > 0 && (
              <button
                onClick={clearAll}
                style={{
                  background: 'none',
                  border:     '1px solid #ff444444',
                  borderRadius: 6,
                  color:      '#ff4444',
                  fontSize:   10,
                  padding:    '2px 8px',
                  cursor:     'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Clear All
              </button>
            )}
          </div>

          {waypoints.length === 0 ? (
            <div style={{ color: '#33334a', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
              No waypoints yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {waypoints.map((wp, i) => (
                <WpRow
                  key={i}
                  wp={wp}
                  index={i}
                  total={waypoints.length}
                  onChange={alt => updateAltitude(i, alt)}
                  onDelete={() => deleteWaypoint(i)}
                  onMoveUp={() => moveUp(i)}
                  onMoveDown={() => moveDown(i)}
                />
              ))}
            </div>
          )}

          {/* Drone assignment */}
          <div style={{ marginTop: 16 }}>
            <div style={{ color: '#44445a', fontSize: 9, fontWeight: 700, letterSpacing: 1.2, marginBottom: 8 }}>
              ASSIGN DRONES
              {assignedIds.length > 0 ? `  (${assignedIds.length})` : ''}
            </div>
            {allDrones.length === 0 ? (
              <div style={{ color: '#33334a', fontSize: 12 }}>No drones online</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allDrones.map(d => {
                  const sel = assignedIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDrone(d.id)}
                      style={{
                        background:   sel ? '#FFD70018' : '#0f0f1e',
                        border:       `1px solid ${sel ? '#FFD70088' : '#1e1e38'}`,
                        borderRadius: 20,
                        color:        sel ? '#FFD700' : '#666677',
                        fontSize:     12,
                        padding:      '4px 12px',
                        cursor:       'pointer',
                        fontFamily:   'inherit',
                        fontWeight:   sel ? 600 : 400,
                      }}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding:     '12px 12px 16px',
          borderTop:   '1px solid #1e1e38',
          display:     'flex',
          flexDirection: 'column',
          gap:         8,
        }}>
          <button
            disabled={saving}
            onClick={handleSave}
            style={{
              background:   saving ? '#888800' : '#FFD700',
              color:        '#000',
              border:       'none',
              borderRadius: 10,
              padding:      '12px 0',
              fontWeight:   700,
              fontSize:     14,
              cursor:       saving ? 'not-allowed' : 'pointer',
              opacity:      saving ? 0.7 : 1,
              fontFamily:   'inherit',
            }}
          >
            {saving ? 'Saving…' : 'Save Mission'}
          </button>
          <button
            onClick={() => router.back()}
            style={{
              background:   'transparent',
              border:       '1px solid #1e1e38',
              borderRadius: 10,
              color:        '#555566',
              padding:      '10px 0',
              fontSize:     13,
              cursor:       'pointer',
              fontFamily:   'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
