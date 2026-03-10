import { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getCountryCoords, getCountryCode } from '@/lib/countryUtils';
import { supabase } from '@/integrations/supabase/client';

interface EntraIdCountryMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  fullscreen?: boolean;
}

const FALLBACK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const STADIA_ATTRIBUTION = '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const SUCCESS_COLOR = '#22c55e';

function MapResizer({ fullscreen }: { fullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [fullscreen, map]);
  return null;
}

function FitWorldBounds() {
  const map = useMap();
  useEffect(() => {
    map.setView([20, 0], 2);
  }, [map]);
  return null;
}

export function EntraIdCountryMap({ loginCountriesSuccess, fullscreen = false }: EntraIdCountryMapProps) {
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

  const points = useMemo(() => {
    const result: { lat: number; lng: number; r: number; label: string; count: number }[] = [];

    for (const c of loginCountriesSuccess) {
      const raw = c.country?.trim().toLowerCase();
      if (!raw) continue;

      // Support both ISO2 codes and country names
      const iso2 = raw.length === 2 ? raw : getCountryCode(c.country);
      if (!iso2) continue;

      const coords = getCountryCoords(iso2);
      if (!coords) continue;

      const r = Math.max(4, Math.min(18, Math.log2(c.count + 1) * 3));
      result.push({ lat: coords[0], lng: coords[1], r, label: c.country, count: c.count });
    }

    return result;
  }, [loginCountriesSuccess]);

  const mapStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    background: '#0a0e17',
  };

  return (
    <div
      className="w-full overflow-hidden rounded-lg"
      style={{ height: fullscreen ? '100%' : '200px' }}
    >
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={fullscreen ? 6 : 4}
        zoomControl={!!fullscreen}
        dragging={!!fullscreen}
        scrollWheelZoom={!!fullscreen}
        doubleClickZoom={!!fullscreen}
        attributionControl={false}
        style={mapStyle}
      >
        <FitWorldBounds />
        <MapResizer fullscreen={fullscreen} />
        <TileLayer url={tileUrl} attribution={tileAttribution} noWrap />

        {points.map((p, i) => (
          <CircleMarker
            key={`success-${i}`}
            center={[p.lat, p.lng]}
            radius={p.r}
            pathOptions={{
              color: SUCCESS_COLOR,
              fillColor: SUCCESS_COLOR,
              fillOpacity: 0.35,
              weight: 1.5,
              opacity: 0.8,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <span className="text-xs">
                <strong>{p.label.toUpperCase()}</strong> — Login com Sucesso: {p.count.toLocaleString()}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
