// Web-only: uses mapbox-gl-js directly. Metro resolves MapScreen.native.tsx on iOS/Android.
import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDroneStream } from '@/hooks/useDroneStream';
import type { Drone, DroneStatus } from '@/types/drone';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// ── Color / label maps ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<DroneStatus, string> = {
  idle:      '#888888',
  armed:     '#ff8c00',
  flying:    '#FFD700',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#444444',
};

const STATUS_LABEL: Record<DroneStatus, string> = {
  idle:      'IDLE',
  armed:     'ARMED',
  flying:    'FLYING',
  returning: 'RTH',
  error:     'ERROR',
  offline:   'OFFLINE',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function batteryColor(pct: number): string {
  if (pct > 50) return '#00e676';
  if (pct > 20) return '#ff8c00';
  return '#ff4444';
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── CSS injected once into <head> ─────────────────────────────────────────────

const MAP_CSS = `
@keyframes mads-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(255,215,0,0.9),  0 0 10px rgba(255,215,0,0.5); }
  70%  { box-shadow: 0 0 0 10px rgba(255,215,0,0),   0 0 18px rgba(255,215,0,0.3); }
  100% { box-shadow: 0 0 0 0   rgba(255,215,0,0),    0 0 10px rgba(255,215,0,0.5); }
}
.mads-dot-flying  { animation: mads-pulse 2s ease-out infinite; }
.mapboxgl-popup-content {
  background: transparent !important;
  padding: 0 !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}
.mapboxgl-popup-tip { display: none !important; }
.mapboxgl-ctrl-group {
  background: rgba(12,12,22,0.92) !important;
  border: 1px solid #1e1e38 !important;
  border-radius: 8px !important;
  overflow: hidden !important;
}
.mapboxgl-ctrl-group button {
  background: transparent !important;
  border-bottom: 1px solid #1e1e38 !important;
}
.mapboxgl-ctrl-group button:last-child { border-bottom: none !important; }
.mapboxgl-ctrl-icon { filter: invert(1) brightness(0.65) !important; }
`;

// ── Custom marker element ─────────────────────────────────────────────────────

function buildMarkerEl(drone: Drone): HTMLElement {
  const color    = STATUS_COLOR[drone.status];
  const isFlying = drone.status === 'flying';

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;';

  const dot = document.createElement('div');
  dot.className = isFlying ? 'mads-dot mads-dot-flying' : 'mads-dot';
  dot.style.cssText = [
    'width:14px;height:14px;border-radius:50%;',
    `background:${color};`,
    'border:2.5px solid rgba(255,255,255,0.85);',
    `box-shadow:0 0 10px ${color}88;`,
    'transition:transform 0.15s, box-shadow 0.15s;',
  ].join('');

  const lbl = document.createElement('div');
  lbl.textContent = drone.name;
  lbl.style.cssText = [
    'margin-top:4px;',
    'color:#fff;font-size:10px;font-weight:700;',
    'background:rgba(10,10,15,0.85);',
    'padding:1px 6px;border-radius:4px;',
    'white-space:nowrap;pointer-events:none;',
    `border:1px solid ${color}55;`,
    'letter-spacing:0.3px;',
  ].join('');

  dot.addEventListener('mouseenter', () => {
    dot.style.transform  = 'scale(1.35)';
    dot.style.boxShadow  = `0 0 18px ${color}cc`;
  });
  dot.addEventListener('mouseleave', () => {
    dot.style.transform  = '';
    dot.style.boxShadow  = `0 0 10px ${color}88`;
  });

  wrap.append(dot, lbl);
  return wrap;
}

// ── Popup HTML ────────────────────────────────────────────────────────────────

function buildPopupHTML(drone: Drone): string {
  const color = STATUS_COLOR[drone.status];
  const batt  = drone.batteryPercent;
  const bc    = batt != null ? batteryColor(batt) : '#555';

  const row = (label: string, val: string, valColor = '#c0c0d8') =>
    `<tr>
       <td style="color:#555566;padding:2px 0;font-size:10px;">${label}</td>
       <td style="color:${valColor};text-align:right;font-size:10px;">${val}</td>
     </tr>`;

  return `
<div style="
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:#12121f;
  border:1px solid #1e1e38;
  border-left:3px solid ${color};
  border-radius:8px;
  padding:12px 14px;
  min-width:190px;
  color:#fff;
">
  <div style="font-size:13px;font-weight:700;margin-bottom:6px;">${esc(drone.name)}</div>
  <div style="
    display:inline-block;
    background:${color}18;border:1px solid ${color}55;color:${color};
    font-size:9px;font-weight:800;letter-spacing:0.8px;
    border-radius:4px;padding:2px 7px;margin-bottom:10px;
  ">${STATUS_LABEL[drone.status]}</div>

  ${batt != null ? `
  <div style="margin-bottom:9px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
      <span style="color:#555566;font-size:10px;font-weight:700;letter-spacing:0.6px;">BATTERY</span>
      <span style="color:${bc};font-size:11px;font-weight:700;">${batt}%</span>
    </div>
    <div style="background:#1e1e38;border-radius:3px;height:5px;overflow:hidden;">
      <div style="background:${bc};width:${batt}%;height:100%;border-radius:3px;"></div>
    </div>
  </div>` : ''}

  <table style="width:100%;border-collapse:collapse;">
    ${drone.altitude   != null ? row('Altitude',  `${drone.altitude.toFixed(1)} m`) : ''}
    ${drone.speed      != null ? row('Speed',     `${drone.speed.toFixed(1)} m/s`) : ''}
    ${drone.heading    != null ? row('Heading',   `${Math.round(drone.heading)}°`) : ''}
    ${drone.satelliteCount != null ? row('Satellites', `${drone.satelliteCount}`) : ''}
    ${drone.lat != null && drone.lng != null
        ? row('GPS', `${drone.lat.toFixed(5)}, ${drone.lng.toFixed(5)}`, '#9090aa')
        : ''}
    ${drone.lastSeenAt
        ? row('Last seen', fmtTime(drone.lastSeenAt), '#44445a')
        : ''}
  </table>
  ${drone.model ? `<div style="color:#333344;font-size:10px;margin-top:7px;">${esc(drone.model)}</div>` : ''}
</div>`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MapScreen() {
  const drones       = useDroneStream();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef(new Map<string, mapboxgl.Marker>());
  const hasFitRef    = useRef(false);

  // ── Inject CSS once ──────────────────────────────────────────────────────
  useEffect(() => {
    // mapbox-gl CSS from CDN, version-matched to the installed JS package
    if (!document.getElementById('mapbox-gl-css')) {
      const link  = document.createElement('link');
      link.id     = 'mapbox-gl-css';
      link.rel    = 'stylesheet';
      link.href   = `https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl.css`;
      document.head.appendChild(link);
    }
    if (!document.getElementById('mads-map-css')) {
      const style       = document.createElement('style');
      style.id          = 'mads-map-css';
      style.textContent = MAP_CSS;
      document.head.appendChild(style);
    }
  }, []);

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container:   containerRef.current,
      style:       'mapbox://styles/mapbox/dark-v11',
      center:      [0, 20],
      zoom:        2,
      attributionControl: false,
    });

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left',
    );
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: true }),
      'top-right',
    );

    mapRef.current = map;

    return () => {
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current   = null;
      hasFitRef.current = false;
    };
  }, []);

  // ── Sync markers on every drones update ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const positioned = drones.filter(
      (d): d is Drone & { lat: number; lng: number } =>
        d.lat != null && d.lng != null,
    );
    const currentIds = new Set(positioned.map(d => d.id));

    // Remove markers whose drones disappeared or lost GPS
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const drone of positioned) {
      const lngLat: [number, number] = [drone.lng, drone.lat];
      const existing = markersRef.current.get(drone.id);

      if (existing) {
        // Smooth position update
        existing.setLngLat(lngLat);
        // Refresh popup
        existing.getPopup()?.setHTML(buildPopupHTML(drone));
        // Update dot color + pulse if status changed
        const dot = existing.getElement().querySelector('.mads-dot') as HTMLElement | null;
        if (dot) {
          const color = STATUS_COLOR[drone.status];
          dot.style.background  = color;
          dot.style.boxShadow   = `0 0 10px ${color}88`;
          if (drone.status === 'flying') {
            dot.classList.add('mads-dot-flying');
          } else {
            dot.classList.remove('mads-dot-flying');
          }
        }
      } else {
        const el    = buildMarkerEl(drone);
        const popup = new mapboxgl.Popup({
          offset:      [0, -4],
          closeButton: false,
          maxWidth:    '260px',
        }).setHTML(buildPopupHTML(drone));

        const marker = new mapboxgl.Marker({ element: el, anchor: 'top' })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set(drone.id, marker);
      }
    }

    // Auto-fit once when first drone positions arrive
    if (positioned.length > 0 && !hasFitRef.current) {
      hasFitRef.current = true;
      if (positioned.length === 1) {
        map.flyTo({ center: lngLat(positioned[0]), zoom: 13, duration: 1000 });
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        positioned.forEach(d => bounds.extend(lngLat(d)));
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1200 });
      }
    }
  }, [drones]);

  // ── Fit All handler ───────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = drones.filter(
      (d): d is Drone & { lat: number; lng: number } =>
        d.lat != null && d.lng != null,
    );
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: lngLat(pts[0]), zoom: 13, duration: 800 });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      pts.forEach(d => bounds.extend(lngLat(d)));
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
    }
  }, [drones]);

  // ── Status counts for HUD ─────────────────────────────────────────────────
  const counts = {
    flying:    drones.filter(d => d.status === 'flying').length,
    armed:     drones.filter(d => d.status === 'armed').length,
    returning: drones.filter(d => d.status === 'returning').length,
    error:     drones.filter(d => d.status === 'error').length,
    offline:   drones.filter(d => d.status === 'offline').length,
    total:     drones.length,
  };

  const noPosition = drones.length > 0 && !drones.some(d => d.lat != null);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0f' }}>
      {/* Map canvas */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* ── HUD pill bar ─────────────────────────────────────────────────── */}
      {counts.total > 0 && (
        <div style={{
          position: 'absolute', top: 12, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(10,10,15,0.88)',
            border: '1px solid #1e1e38',
            borderRadius: 20,
            padding: '6px 16px',
          }}>
            {counts.flying    > 0 && <HudPill color="#FFD700" label={`${counts.flying} flying`} />}
            {counts.armed     > 0 && <HudPill color="#ff8c00" label={`${counts.armed} armed`} />}
            {counts.returning > 0 && <HudPill color="#a020f0" label={`${counts.returning} returning`} />}
            {counts.error     > 0 && <HudPill color="#ff4444" label={`${counts.error} error`} />}
            {counts.offline   > 0 && <HudPill color="#555"    label={`${counts.offline} offline`} />}
            <div style={{
              width: 1, height: 14, background: '#1e1e38', margin: '0 2px',
            }} />
            <span style={{ color: '#44445a', fontSize: 11 }}>
              {counts.total} drone{counts.total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── Fit All button ────────────────────────────────────────────────── */}
      <FitButton onClick={fitAll} />

      {/* ── Empty / no-GPS overlays ───────────────────────────────────────── */}
      {noPosition && (
        <EmptyOverlay
          title="Waiting for GPS fix…"
          sub={`${counts.total} drone${counts.total !== 1 ? 's' : ''} connected, no position yet`}
        />
      )}
      {counts.total === 0 && (
        <EmptyOverlay
          title="No drones connected"
          sub="Start the MAVLink bridge server or run scripts/seed-drones.ts"
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HudPill({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', background: color,
      }} />
      <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function FitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute', bottom: 32, right: 16, zIndex: 10,
        background: 'rgba(12,12,22,0.92)',
        border: '1px solid #1e1e38',
        borderRadius: 8,
        padding: '8px 14px',
        color: '#FFD700',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.3px',
        fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,215,0,0.1)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,215,0,0.4)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(12,12,22,0.92)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e1e38';
      }}
    >
      <span style={{ fontSize: 14 }}>⊕</span> Fit All
    </button>
  );
}

function EmptyOverlay({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, pointerEvents: 'none',
    }}>
      <div style={{ color: '#555566', fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ color: '#33334a', fontSize: 12, textAlign: 'center', maxWidth: 280 }}>{sub}</div>
    </div>
  );
}

// ── Util ──────────────────────────────────────────────────────────────────────

function lngLat(d: { lng: number; lat: number }): [number, number] {
  return [d.lng, d.lat];
}
