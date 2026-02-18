import { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap, SVGOverlay } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCountryCoords } from '@/lib/countryUtils';
import type { TopCountry } from '@/types/analyzerInsights';

const WORLD_BOUNDS = new LatLngBounds([-90, -180], [90, 180]);

interface AttackMapProps {
  deniedCountries: TopCountry[];
  authFailedCountries: TopCountry[];
  authSuccessCountries: TopCountry[];
  firewallLocation?: { lat: number; lng: number; label: string };
  fullscreen?: boolean;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// SVG overlay with animated projectiles — synced to Leaflet's projection
function ProjectileOverlay({
  points,
  firewallLocation,
  fullscreen,
}: {
  points: { lat: number; lng: number; color: string; label: string; count: number; type: string }[];
  firewallLocation: { lat: number; lng: number; label: string };
  fullscreen?: boolean;
}) {
  const map = useMap();
  const svgRef = useRef<SVGSVGElement>(null);

  // Wide bounds to cover the whole world
  const bounds: LatLngBounds = useMemo(
    () => new LatLngBounds([-90, -180], [90, 180]),
    []
  );

  // Convert lat/lng to SVG pixel coords relative to the overlay bounds
  const toSVG = (lat: number, lng: number): [number, number] => {
    const point = map.latLngToLayerPoint([lat, lng]);
    const topLeft = map.latLngToLayerPoint([90, -180]);
    return [point.x - topLeft.x, point.y - topLeft.y];
  };

  const fw = toSVG(firewallLocation.lat, firewallLocation.lng);

  return (
    <SVGOverlay bounds={bounds} zIndex={400}>
      <svg ref={svgRef} style={{ overflow: 'visible', width: '100%', height: '100%' }}>
        <defs>
          <filter id="lf-glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="lf-glow-orange" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="lf-glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="lf-impact" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {points.map((p, i) => {
          const [px, py] = toSVG(p.lat, p.lng);
          const pathD = `M${px},${py} L${fw[0]},${fw[1]}`;
          const glowId =
            p.color === '#ef4444' ? 'url(#lf-glow-red)'
            : p.color === '#f97316' ? 'url(#lf-glow-orange)'
            : 'url(#lf-glow-green)';

          return (
            <g key={`proj-${i}`}>
              {/* Trail */}
              <path d={pathD} stroke={p.color} strokeWidth="0.8" opacity="0.15" fill="none" />
              {/* Staggered projectiles */}
              {[0, 0.7, 1.4].map((delay, j) => (
                <circle key={j} r={fullscreen ? 3 : 2.5} fill={p.color} opacity="0.9" filter={glowId}>
                  <animateMotion path={pathD} dur="2.5s" begin={`${delay}s`} repeatCount="indefinite" fill="freeze" />
                  <animate attributeName="opacity" values="0;0.9;0.9;0" dur="2.5s" begin={`${delay}s`} repeatCount="indefinite" />
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

// Fit world bounds to container on mount — eliminates repeated world copies
function FitWorldBounds() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([[-75, -180], [85, 180]], { animate: false });
  }, [map]);
  return null;
}

// Force map to invalidate size when fullscreen changes
function MapResizer({ fullscreen }: { fullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [fullscreen, map]);
  return null;
}

export function AttackMap({
  deniedCountries,
  authFailedCountries,
  authSuccessCountries,
  firewallLocation,
  fullscreen,
}: AttackMapProps) {
  const points = useMemo(() => {
    const result: { lat: number; lng: number; r: number; color: string; label: string; count: number; type: string }[] = [];

    const addPoints = (countries: TopCountry[], color: string, type: string) => {
      for (const c of countries) {
        const coords = getCountryCoords(c.country);
        if (!coords) continue;
        const r = Math.max(4, Math.min(18, Math.log2(c.count + 1) * 3));
        result.push({ lat: coords[0], lng: coords[1], r, color, label: c.country, count: c.count, type });
      }
    };

    addPoints(authSuccessCountries, '#22c55e', 'Sucesso Auth');
    addPoints(deniedCountries, '#ef4444', 'Tráfego Negado');
    addPoints(authFailedCountries, '#f97316', 'Falha Auth');

    return result;
  }, [deniedCountries, authFailedCountries, authSuccessCountries]);

  const mapStyle: React.CSSProperties = {
    height: fullscreen ? '100%' : '240px',
    width: '100%',
    background: '#0a0e1a',
    borderRadius: fullscreen ? '0' : '8px',
  };

  return (
    <div className={fullscreen ? 'w-full h-full' : 'relative w-full'}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={1}
        maxZoom={fullscreen ? 8 : 4}
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1.0}
        worldCopyJump={false}
        zoomControl={false}
        dragging={!!fullscreen}
        scrollWheelZoom={false}
        doubleClickZoom={!!fullscreen}
        attributionControl={false}
        style={mapStyle}
      >
        <FitWorldBounds />
        <MapResizer fullscreen={fullscreen} />

        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} noWrap={true} />

        {/* Trail lines */}
        {firewallLocation && points.map((p, i) => (
          <Polyline
            key={`line-${i}`}
            positions={[[p.lat, p.lng], [firewallLocation.lat, firewallLocation.lng]]}
            pathOptions={{ color: p.color, weight: 1, opacity: 0.2, dashArray: '4 4' }}
          />
        ))}

        {/* Country markers */}
        {points.map((p, i) => (
          <CircleMarker
            key={`pt-${i}`}
            center={[p.lat, p.lng]}
            radius={p.r}
            pathOptions={{
              color: p.color,
              fillColor: p.color,
              fillOpacity: 0.65,
              weight: 1.5,
              opacity: 0.9,
            }}
          >
            <Tooltip direction="top" offset={[0, -p.r]} opacity={1}>
              <span className="font-semibold">{p.label}</span><br />
              <span className="text-xs">{p.type}: {p.count} eventos</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Firewall marker */}
        {firewallLocation && (
          <CircleMarker
            center={[firewallLocation.lat, firewallLocation.lng]}
            radius={10}
            pathOptions={{
              color: '#06b6d4',
              fillColor: '#06b6d4',
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} permanent opacity={1}>
              🛡 {firewallLocation.label}
            </Tooltip>
          </CircleMarker>
        )}

        {/* Animated projectiles overlay */}
        {firewallLocation && points.length > 0 && (
          <ProjectileOverlay
            points={points}
            firewallLocation={firewallLocation}
            fullscreen={fullscreen}
          />
        )}
      </MapContainer>

      {/* Legend — inline mode only */}
      {!fullscreen && (
        <div className="flex items-center gap-4 mt-3 justify-center text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            Tráfego Negado
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
            Falha Auth
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            Sucesso Auth
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
