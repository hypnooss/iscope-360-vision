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
const COUNTRY_GEOJSON_BASE_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries';

const ISO2_TO_ISO3: Record<string, string> = {
  af: 'AFG', al: 'ALB', dz: 'DZA', ar: 'ARG', au: 'AUS', at: 'AUT', az: 'AZE', bd: 'BGD',
  by: 'BLR', be: 'BEL', bo: 'BOL', ba: 'BIH', br: 'BRA', bg: 'BGR', kh: 'KHM', cm: 'CMR',
  ca: 'CAN', cl: 'CHL', cn: 'CHN', co: 'COL', cr: 'CRI', hr: 'HRV', cu: 'CUB', cz: 'CZE',
  dk: 'DNK', do: 'DOM', ec: 'ECU', eg: 'EGY', ee: 'EST', et: 'ETH', fi: 'FIN', fr: 'FRA',
  ge: 'GEO', de: 'DEU', gh: 'GHA', gr: 'GRC', gt: 'GTM', hk: 'HKG', hu: 'HUN', in: 'IND',
  id: 'IDN', ir: 'IRN', iq: 'IRQ', ie: 'IRL', il: 'ISR', it: 'ITA', jp: 'JPN', jo: 'JOR',
  kz: 'KAZ', ke: 'KEN', kr: 'KOR', kw: 'KWT', lv: 'LVA', lb: 'LBN', ly: 'LBY', lt: 'LTU',
  lu: 'LUX', my: 'MYS', mx: 'MEX', md: 'MDA', mn: 'MNG', ma: 'MAR', mz: 'MOZ', mm: 'MMR',
  np: 'NPL', nl: 'NLD', nz: 'NZL', ng: 'NGA', kp: 'PRK', mk: 'MKD', no: 'NOR', pk: 'PAK',
  pa: 'PAN', py: 'PRY', pe: 'PER', ph: 'PHL', pl: 'POL', pt: 'PRT', qa: 'QAT', ro: 'ROU',
  ru: 'RUS', sa: 'SAU', sn: 'SEN', rs: 'SRB', sg: 'SGP', sk: 'SVK', si: 'SVN', za: 'ZAF',
  es: 'ESP', lk: 'LKA', se: 'SWE', ch: 'CHE', sy: 'SYR', tw: 'TWN', tz: 'TZA', th: 'THA',
  tn: 'TUN', tr: 'TUR', ua: 'UKR', ae: 'ARE', gb: 'GBR', us: 'USA', uy: 'URY', uz: 'UZB',
  ve: 'VEN', vn: 'VNM',
};

const featureCache = new Map<string, GeoJSON.FeatureCollection>();

function MapResizer({ fullscreen }: { fullscreen?: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timer);
  }, [fullscreen, map]);

  return null;
}

function resolveHslToken(tokenName: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value ? `hsl(${value})` : fallback;
}

export function EntraIdCountryMap({ loginCountriesSuccess, fullscreen = false }: EntraIdCountryMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [colors, setColors] = useState({
    primary: 'hsl(142 71% 45%)',
    border: 'hsl(217 19% 27%)',
    background: 'hsl(222 47% 6%)',
  });

  const successMap = useMemo(() => {
    const mapped = new Map<string, number>();

    for (const item of loginCountriesSuccess) {
      const iso2 = getCountryCode(item.country);
      if (!iso2) continue;
      mapped.set(iso2, (mapped.get(iso2) ?? 0) + item.count);
    }

    return mapped;
  }, [loginCountriesSuccess]);

  const successCountries = useMemo(
    () => Array.from(successMap.entries())
      .map(([iso2, count]) => ({ iso2, iso3: ISO2_TO_ISO3[iso2], count }))
      .filter((item): item is { iso2: string; iso3: string; count: number } => Boolean(item.iso3)),
    [successMap]
  );

  useEffect(() => {
    setColors({
      primary: resolveHslToken('--primary', 'hsl(142 71% 45%)'),
      border: resolveHslToken('--border', 'hsl(217 19% 27%)'),
      background: resolveHslToken('--background', 'hsl(222 47% 6%)'),
    });
  }, []);

  useEffect(() => {
    if (successCountries.length === 0) {
      setGeoData({ type: 'FeatureCollection', features: [] });
      return;
    }

    let cancelled = false;

    const missingCountries = successCountries.filter(({ iso3 }) => !featureCache.has(iso3));

    Promise.allSettled(
      missingCountries.map(async ({ iso3, iso2 }) => {
        const response = await fetch(`${COUNTRY_GEOJSON_BASE_URL}/${iso3}.geo.json`);
        if (!response.ok) throw new Error(`Failed to load ${iso3}`);
        const data = await response.json() as GeoJSON.FeatureCollection;
        const normalized: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: data.features.map((feature) => ({
            ...feature,
            properties: {
              ...(feature.properties ?? {}),
              iso2,
              iso3,
            },
          })),
        };
        featureCache.set(iso3, normalized);
      })
    ).then(() => {
      if (cancelled) return;

      const merged: GeoJSON.Feature[] = successCountries.flatMap(({ iso3 }) => {
        const collection = featureCache.get(iso3);
        return collection?.features ?? [];
      });

      setGeoData({ type: 'FeatureCollection', features: merged });
    }).catch((error) => {
      console.error('Failed to load highlighted countries:', error);
      if (!cancelled) setGeoData({ type: 'FeatureCollection', features: [] });
    });

    return () => {
      cancelled = true;
    };
  }, [successCountries]);

  const styleFeature = (): PathOptions => ({
    color: colors.primary,
    fillColor: colors.primary,
    fillOpacity: 0.3,
    weight: 2,
    opacity: 1,
  });

  const onEachFeature = (feature: GeoJSON.Feature, layer: Layer) => {
    const props = feature.properties as Record<string, unknown> | null;
    const iso2 = typeof props?.iso2 === 'string' ? props.iso2 : null;
    const count = iso2 ? successMap.get(iso2) : undefined;
    const name = typeof props?.name === 'string' ? props.name : 'País';

    if (count === undefined) return;

    layer.bindTooltip(`<strong>${name}</strong><br />Login com Sucesso: ${count.toLocaleString()}`, {
      sticky: true,
      className: 'entra-map-tooltip',
    });

    layer.on({
      mouseover: (event) => {
        const target = event.target as Layer & { setStyle?: (style: PathOptions) => void };
        target.setStyle?.({ weight: 2.8, fillOpacity: 0.42 });
      },
      mouseout: (event) => {
        const target = event.target as Layer & { setStyle?: (style: PathOptions) => void };
        target.setStyle?.({ weight: 2, fillOpacity: 0.3 });
      },
    });
  };

  return (
    <div
      className="w-full overflow-hidden rounded-lg"
      style={{ height: fullscreen ? '100%' : '200px' }}
    >
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
        style={{ height: '100%', width: '100%', background: colors.background }}
      >
        <MapResizer fullscreen={fullscreen} />
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} noWrap />
        {geoData && geoData.features.length > 0 && (
          <GeoJSON data={geoData} style={styleFeature} onEachFeature={onEachFeature} />
        )}
      </MapContainer>
    </div>
  );
}
