import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCountryCode } from '@/lib/countryUtils';

interface EntraIdCountryMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  fullscreen?: boolean;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';

let geoCache: GeoJSON.FeatureCollection | null = null;

function MapResizer({ fullscreen }: { fullscreen?: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timer);
  }, [fullscreen, map]);

  return null;
}

function getIso2FromFeature(feature: GeoJSON.Feature): string | null {
  const props = feature.properties as Record<string, unknown> | null;
  if (!props) return null;

  const alpha2 = props.iso_a2;
  if (typeof alpha2 === 'string' && alpha2 !== '-99' && alpha2.length === 2) {
    return alpha2.toLowerCase();
  }

  const admin = props.admin;
  if (typeof admin === 'string') {
    return getCountryCode(admin);
  }

  return null;
}

function getFeatureName(feature: GeoJSON.Feature): string {
  const props = feature.properties as Record<string, unknown> | null;
  const admin = props?.admin;
  return typeof admin === 'string' ? admin : 'País';
}

export function EntraIdCountryMap({ loginCountriesSuccess, fullscreen = false }: EntraIdCountryMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(geoCache);

  const successMap = useMemo(() => {
    const mapped = new Map<string, number>();

    for (const item of loginCountriesSuccess) {
      const iso2 = getCountryCode(item.country);
      if (!iso2) continue;
      mapped.set(iso2, (mapped.get(iso2) ?? 0) + item.count);
    }

    return mapped;
  }, [loginCountriesSuccess]);

  useEffect(() => {
    if (geoCache) {
      setGeoData(geoCache);
      return;
    }

    let active = true;

    fetch(GEOJSON_URL)
      .then((response) => response.json())
      .then((data: GeoJSON.FeatureCollection) => {
        if (!active) return;
        geoCache = data;
        setGeoData(data);
      })
      .catch((error) => console.error('Failed to load country boundaries:', error));

    return () => {
      active = false;
    };
  }, []);

  const styleFeature = (feature?: GeoJSON.Feature): PathOptions => {
    if (!feature) return { weight: 0, fillOpacity: 0 };

    const iso2 = getIso2FromFeature(feature);
    const highlighted = iso2 ? successMap.has(iso2) : false;

    if (highlighted) {
      return {
        color: 'hsl(var(--primary))',
        fillColor: 'hsl(var(--primary))',
        fillOpacity: 0.32,
        weight: 2,
        opacity: 1,
      };
    }

    return {
      color: 'hsl(var(--border))',
      fillColor: 'transparent',
      fillOpacity: 0,
      weight: 0.6,
      opacity: 0.5,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: Layer) => {
    const iso2 = getIso2FromFeature(feature);
    const count = iso2 ? successMap.get(iso2) : undefined;

    if (count === undefined) return;

    layer.bindTooltip(
      `<strong>${getFeatureName(feature)}</strong><br />Login com Sucesso: ${count.toLocaleString()}`,
      {
        sticky: true,
        className: 'entra-map-tooltip',
      }
    );

    layer.on({
      mouseover: (event) => {
        const target = event.target as Layer & { setStyle?: (style: PathOptions) => void };
        target.setStyle?.({
          weight: 2.6,
          fillOpacity: 0.42,
        });
      },
      mouseout: (event) => {
        const target = event.target as Layer & { setStyle?: (style: PathOptions) => void };
        target.setStyle?.({
          weight: 2,
          fillOpacity: 0.32,
        });
      },
    });
  };

  const geoKey = useMemo(
    () => Array.from(successMap.entries()).map(([code, count]) => `${code}:${count}`).join('|'),
    [successMap]
  );

  return (
    <div className="h-full w-full overflow-hidden rounded-lg">
      <MapContainer
        center={[18, 0]}
        zoom={fullscreen ? 3 : 2}
        minZoom={2}
        maxZoom={6}
        zoomControl={fullscreen}
        attributionControl={false}
        scrollWheelZoom={fullscreen}
        dragging={fullscreen}
        doubleClickZoom={false}
        worldCopyJump={false}
        className="h-full w-full bg-background"
      >
        <MapResizer fullscreen={fullscreen} />
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} noWrap />
        {geoData && (
          <GeoJSON
            key={geoKey}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
