import { useMemo, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap, SVGOverlay } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCountryCoords } from '@/lib/countryUtils';
import type { TopCountry } from '@/types/analyzerInsights';
import { supabase } from '@/integrations/supabase/client';

interface AttackMapProps {
  deniedCountries: TopCountry[];
  authFailedCountries: TopCountry[];       // FW auth failures (legacy compat)
  authFailedVpnCountries?: TopCountry[];   // VPN auth failures (new)
  authSuccessCountries: TopCountry[];
  outboundCountries?: TopCountry[];        // Outbound connections (FW → destination)
  firewallLocation?: { lat: number; lng: number; label: string };
  fullscreen?: boolean;
}

const FALLBACK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const STADIA_ATTRIBUTION = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Color palette for the 5 layers
const COLORS = {
  denied: '#ef4444',      // Red — denied traffic
  fw_fail: '#f97316',     // Orange — FW auth failure
  vpn_fail: '#eab308',    // Yellow — VPN auth failure
  auth_success: '#22c55e',// Green — auth success
  outbound: '#38bdf8',    // Sky blue — outbound connections (FW → destination)
};

// SVG overlay with animated projectiles — synced to Leaflet's projection
function ProjectileOverlay({
  inboundPoints,
  outboundPoints,
  firewallLocation,
  fullscreen,
}: {
  inboundPoints: { lat: number; lng: number; color: string; label: string; count: number; type: string }[];
  outboundPoints: { lat: number; lng: number; color: string; label: string; count: number; type: string }[];
  firewallLocation: { lat: number; lng: number; label: string };
  fullscreen?: boolean;
}) {
  const map = useMap();

  const bounds: LatLngBounds = useMemo(
    () => new LatLngBounds([-90, -180], [90, 180]),
    []
  );

  const toSVG = (lat: number, lng: number): [number, number] => {
    const point = map.latLngToLayerPoint([lat, lng]);
    const topLeft = map.latLngToLayerPoint([90, -180]);
    return [point.x - topLeft.x, point.y - topLeft.y];
  };

  const fw = toSVG(firewallLocation.lat, firewallLocation.lng);

  return (
    <SVGOverlay bounds={bounds} zIndex={400}>
      <svg style={{ overflow: 'visible', width: '100%', height: '100%' }}>
        <defs>
          {['red', 'orange', 'yellow', 'green', 'sky'].map(color => (
            <filter key={color} id={`lf-glow-${color}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          <filter id="lf-impact" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Inbound projectiles: origin → firewall */}
        {inboundPoints.map((p, i) => {
          const [px, py] = toSVG(p.lat, p.lng);
          const pathD = `M${px},${py} L${fw[0]},${fw[1]}`;
          const glowId =
            p.color === COLORS.denied ? 'url(#lf-glow-red)'
            : p.color === COLORS.fw_fail ? 'url(#lf-glow-orange)'
            : p.color === COLORS.vpn_fail ? 'url(#lf-glow-yellow)'
            : 'url(#lf-glow-green)';

          return (
            <g key={`inbound-${i}`}>
              <path d={pathD} stroke={p.color} strokeWidth="0.8" opacity="0.15" fill="none" />
              {[0, 0.7, 1.4].map((delay, j) => (
                <circle key={j} r={fullscreen ? 3 : 2.5} fill={p.color} opacity="0.9" filter={glowId}>
                  <animateMotion path={pathD} dur="2.5s" begin={`${delay}s`} repeatCount="indefinite" fill="freeze" />
                  <animate attributeName="opacity" values="0;0.9;0.9;0" dur="2.5s" begin={`${delay}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
          );
        })}

        {/* Outbound projectiles: firewall → destination */}
        {outboundPoints.map((p, i) => {
          const [px, py] = toSVG(p.lat, p.lng);
          // Reversed path: firewall → destination
          const pathD = `M${fw[0]},${fw[1]} L${px},${py}`;

          return (
            <g key={`outbound-${i}`}>
              <path d={pathD} stroke={COLORS.outbound} strokeWidth="0.8" opacity="0.15" fill="none" />
              {[0, 0.9, 1.8].map((delay, j) => (
                <circle key={j} r={fullscreen ? 3 : 2.5} fill={COLORS.outbound} opacity="0.85" filter="url(#lf-glow-sky)">
                  <animateMotion path={pathD} dur="3s" begin={`${delay}s`} repeatCount="indefinite" fill="freeze" />
                  <animate attributeName="opacity" values="0;0.85;0.85;0" dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
          );
        })}

        {/* Impact flash at firewall */}
        <circle cx={fw[0]} cy={fw[1]} r={8} fill="white" opacity="0" filter="url(#lf-impact)">
          <animate attributeName="opacity" values="0;0.4;0" dur="0.8s" repeatCount="indefinite" />
          <animate attributeName="r" values="6;14;6" dur="0.8s" repeatCount="indefinite" />
        </circle>
      </svg>
    </SVGOverlay>
  );
}

function FitWorldBounds() {
  const map = useMap();
  useEffect(() => {
    map.setView([20, 0], 3, { animate: false });
  }, [map]);
  return null;
}

function MapResizer({ fullscreen }: { fullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.setView([20, 0], 3, { animate: false });
    }, 200);
  }, [fullscreen, map]);
  return null;
}

export function AttackMap({
  deniedCountries,
  authFailedCountries,
  authFailedVpnCountries = [],
  authSuccessCountries,
  outboundCountries = [],
  firewallLocation,
  fullscreen,
}: AttackMapProps) {
  const [tileUrl, setTileUrl] = useState(FALLBACK_TILE_URL);
  const [tileAttribution, setTileAttribution] = useState(FALLBACK_ATTRIBUTION);

  useEffect(() => {
    supabase.functions.invoke('get-map-config').then(({ data }) => {
      if (data?.stadia_api_key) {
        setTileUrl(`https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${data.stadia_api_key}`);
        setTileAttribution(STADIA_ATTRIBUTION);
      }
    }).catch(() => {});
  }, []);

  const inboundPoints = useMemo(() => {
    const result: { lat: number; lng: number; r: number; color: string; label: string; count: number; type: string }[] = [];

    const addPoints = (countries: TopCountry[], color: string, type: string) => {
      for (const c of countries) {
        const coords = getCountryCoords(c.country);
        if (!coords) continue;
        const r = Math.max(4, Math.min(18, Math.log2(c.count + 1) * 3));
        result.push({ lat: coords[0], lng: coords[1], r, color, label: c.country, count: c.count, type });
      }
    };

    addPoints(authSuccessCountries, COLORS.auth_success, 'Sucesso Auth');
    addPoints(deniedCountries, COLORS.denied, 'Tráfego Negado');
    addPoints(authFailedCountries, COLORS.fw_fail, 'Falha Auth Firewall');
    addPoints(authFailedVpnCountries, COLORS.vpn_fail, 'Falha Auth VPN');

    return result;
  }, [deniedCountries, authFailedCountries, authFailedVpnCountries, authSuccessCountries]);

  const outboundPoints = useMemo(() => {
    const result: { lat: number; lng: number; r: number; color: string; label: string; count: number; type: string }[] = [];
    for (const c of outboundCountries) {
      const coords = getCountryCoords(c.country);
      if (!coords) continue;
      const r = Math.max(4, Math.min(14, Math.log2(c.count + 1) * 2.5));
      result.push({ lat: coords[0], lng: coords[1], r, color: COLORS.outbound, label: c.country, count: c.count, type: 'Saída' });
    }
    return result;
  }, [outboundCountries]);

  const allPoints = [...inboundPoints, ...outboundPoints];

  const mapStyle: React.CSSProperties = {
    height: fullscreen ? '100%' : '240px',
    width: '100%',
    background: '#222222',
    borderRadius: fullscreen ? '0' : '8px',
  };

  return (
    <div className={fullscreen ? 'w-full h-full' : 'relative w-full'}>
      <MapContainer
        center={[20, 0]}
        zoom={3}
        zoomSnap={0.5}
        minZoom={1}
        maxZoom={fullscreen ? 8 : 4}
        worldCopyJump={false}
        zoomControl={!!fullscreen}
        dragging={!!fullscreen}
        scrollWheelZoom={!!fullscreen}
        doubleClickZoom={!!fullscreen}
        attributionControl={false}
        style={mapStyle}
      >
        <FitWorldBounds />
        <MapResizer fullscreen={fullscreen} />

        <TileLayer url={tileUrl} attribution={tileAttribution} noWrap={true} />

        {/* Trail lines */}
        {firewallLocation && inboundPoints.map((p, i) => (
          <Polyline
            key={`line-in-${i}`}
            positions={[[p.lat, p.lng], [firewallLocation.lat, firewallLocation.lng]]}
            pathOptions={{ color: p.color, weight: 1, opacity: 0.2, dashArray: '4 4' }}
          />
        ))}
        {firewallLocation && outboundPoints.map((p, i) => (
          <Polyline
            key={`line-out-${i}`}
            positions={[[firewallLocation.lat, firewallLocation.lng], [p.lat, p.lng]]}
            pathOptions={{ color: COLORS.outbound, weight: 1, opacity: 0.2, dashArray: '4 4' }}
          />
        ))}

        {/* Country markers — inbound */}
        {inboundPoints.map((p, i) => (
          <CircleMarker
            key={`pt-in-${i}`}
            center={[p.lat, p.lng]}
            radius={p.r}
            pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.65, weight: 1.5, opacity: 0.9 }}
          >
            <Tooltip direction="top" offset={[0, -p.r]} opacity={1}>
              <span className="font-semibold">{p.label}</span><br />
              <span className="text-xs">{p.type}: {p.count} eventos</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Country markers — outbound */}
        {outboundPoints.map((p, i) => (
          <CircleMarker
            key={`pt-out-${i}`}
            center={[p.lat, p.lng]}
            radius={p.r}
            pathOptions={{ color: COLORS.outbound, fillColor: COLORS.outbound, fillOpacity: 0.55, weight: 1.5, opacity: 0.8, dashArray: '3 3' }}
          >
            <Tooltip direction="top" offset={[0, -p.r]} opacity={1}>
              <span className="font-semibold">{p.label}</span><br />
              <span className="text-xs">Saída: {p.count} conexões</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Firewall marker */}
        {firewallLocation && (
          <CircleMarker
            center={[firewallLocation.lat, firewallLocation.lng]}
            radius={10}
            pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.8, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -12]} permanent opacity={1}>
              🛡 {firewallLocation.label}
            </Tooltip>
          </CircleMarker>
        )}

        {/* Animated projectiles overlay */}
        {firewallLocation && (inboundPoints.length > 0 || outboundPoints.length > 0) && (
          <ProjectileOverlay
            inboundPoints={inboundPoints}
            outboundPoints={outboundPoints}
            firewallLocation={firewallLocation}
            fullscreen={fullscreen}
          />
        )}
      </MapContainer>

      {/* Legend — inline mode only */}
      {!fullscreen && (
        <div className="flex items-center gap-3 mt-3 justify-center text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS.denied }} />
            Tráfego Negado
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS.fw_fail }} />
            Falha Auth FW
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS.vpn_fail }} />
            Falha Auth VPN
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS.auth_success }} />
            Sucesso Auth
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS.outbound }} />
            Saída
          </div>
          {firewallLocation && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#06b6d4' }} />
              Firewall
            </div>
          )}
        </div>
      )}
    </div>
  );
}
