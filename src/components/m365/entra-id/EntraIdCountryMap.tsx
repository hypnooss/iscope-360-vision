import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { Layer, type PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCountryCode } from '@/lib/countryUtils';

interface EntraIdCountryMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  fullscreen?: boolean;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// ISO3 → ISO2 mapping for common countries (GeoJSON uses ISO_A3)
const ISO3_TO_ISO2: Record<string, string> = {
  AFG:'af',ALB:'al',DZA:'dz',ARG:'ar',AUS:'au',AUT:'at',AZE:'az',BGD:'bd',
  BLR:'by',BEL:'be',BOL:'bo',BIH:'ba',BRA:'br',BGR:'bg',KHM:'kh',CMR:'cm',
  CAN:'ca',CHL:'cl',CHN:'cn',COL:'co',CRI:'cr',HRV:'hr',CUB:'cu',CZE:'cz',
  DNK:'dk',DOM:'do',ECU:'ec',EGY:'eg',EST:'ee',ETH:'et',FIN:'fi',FRA:'fr',
  GEO:'ge',DEU:'de',GHA:'gh',GRC:'gr',GTM:'gt',HKG:'hk',HUN:'hu',IND:'in',
  IDN:'id',IRN:'ir',IRQ:'iq',IRL:'ie',ISR:'il',ITA:'it',JPN:'jp',JOR:'jo',
  KAZ:'kz',KEN:'ke',KOR:'kr',KWT:'kw',LVA:'lv',LBN:'lb',LBY:'ly',LTU:'lt',
  LUX:'lu',MYS:'my',MEX:'mx',MDA:'md',MNG:'mn',MAR:'ma',MOZ:'mz',MMR:'mm',
  NPL:'np',NLD:'nl',NZL:'nz',NGA:'ng',PRK:'kp',MKD:'mk',NOR:'no',PAK:'pk',
  PAN:'pa',PRY:'py',PER:'pe',PHL:'ph',POL:'pl',PRT:'pt',QAT:'qa',ROU:'ro',
  RUS:'ru',SAU:'sa',SEN:'sn',SRB:'rs',SGP:'sg',SVK:'sk',SVN:'si',ZAF:'za',
  ESP:'es',LKA:'lk',SWE:'se',CHE:'ch',SYR:'sy',TWN:'tw',TZA:'tz',THA:'th',
  TUN:'tn',TUR:'tr',UKR:'ua',ARE:'ae',GBR:'gb',USA:'us',URY:'uy',UZB:'uz',
  VEN:'ve',VNM:'vn',
};

function MapResizer({ fullscreen }: { fullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [fullscreen, map]);
  return null;
}

function getIso2FromFeature(feature: GeoJSON.Feature): string | null {
  const props = feature.properties;
  if (!props) return null;
  
  // Try ISO_A2 directly
  if (props.ISO_A2 && props.ISO_A2 !== '-99') return props.ISO_A2.toLowerCase();
  
  // Try ISO_A3 → ISO2
  if (props.ISO_A3 && ISO3_TO_ISO2[props.ISO_A3]) return ISO3_TO_ISO2[props.ISO_A3];
  
  // Try country name
  const name = props.ADMIN || props.name || props.NAME;
  if (name) {
    const code = getCountryCode(name);
    if (code) return code;
  }
  
  return null;
}

export function EntraIdCountryMap({ loginCountriesSuccess, fullscreen = false }: EntraIdCountryMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const cacheRef = useRef<GeoJSON.FeatureCollection | null>(null);

  // Build lookup: iso2 → count
  const successMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of loginCountriesSuccess) {
      const code = getCountryCode(c.country);
      if (code) m.set(code, (m.get(code) || 0) + c.count);
    }
    return m;
  }, [loginCountriesSuccess]);

  useEffect(() => {
    if (cacheRef.current) {
      setGeoData(cacheRef.current);
      return;
    }
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        cacheRef.current = data;
        setGeoData(data);
      })
      .catch(err => console.error('Failed to load GeoJSON:', err));
  }, []);

  const styleFeature = (feature?: GeoJSON.Feature): PathOptions => {
    if (!feature) return { fillOpacity: 0, weight: 0 };
    const iso2 = getIso2FromFeature(feature);
    const isHighlighted = iso2 ? successMap.has(iso2) : false;

    if (isHighlighted) {
      return {
        fillColor: 'hsl(142, 71%, 45%)',
        fillOpacity: 0.35,
        color: 'hsl(142, 71%, 45%)',
        weight: 1.5,
      };
    }
    return {
      fillColor: 'transparent',
      fillOpacity: 0,
      color: 'hsl(0, 0%, 30%)',
      weight: 0.3,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: Layer) => {
    const iso2 = getIso2FromFeature(feature);
    const count = iso2 ? successMap.get(iso2) : undefined;
    if (count !== undefined) {
      const name = feature.properties?.ADMIN || feature.properties?.name || feature.properties?.NAME || '';
      layer.bindTooltip(
        `<strong>${name}</strong><br/>Login com Sucesso: ${count.toLocaleString()}`,
        { sticky: true, className: 'entra-map-tooltip' }
      );

      (layer as any).on({
        mouseover: (e: any) => {
          e.target.setStyle({
            fillOpacity: 0.55,
            weight: 2.5,
          });
        },
        mouseout: (e: any) => {
          e.target.setStyle({
            fillOpacity: 0.35,
            weight: 1.5,
          });
        },
      });
    }
  };

  const mapHeight = fullscreen ? '100%' : '200px';

  // Use a unique key based on successMap to force GeoJSON re-render
  const geoKey = useMemo(() => {
    return Array.from(successMap.entries()).map(([k, v]) => `${k}:${v}`).join(',');
  }, [successMap]);

  return (
    <div style={{ height: mapHeight, width: '100%' }} className="rounded-lg overflow-hidden">
      <MapContainer
        center={[20, 0]}
        zoom={fullscreen ? 3 : 2}
        minZoom={2}
        maxZoom={6}
        zoomControl={fullscreen}
        attributionControl={false}
        scrollWheelZoom={fullscreen}
        dragging={fullscreen}
        doubleClickZoom={false}
        style={{ height: '100%', width: '100%', background: 'hsl(222, 47%, 6%)' }}
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
