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

// Lighter GeoJSON (~800KB vs 23MB)
const GEOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

let geoCache: GeoJSON.FeatureCollection | null = null;

function MapResizer({ fullscreen }: { fullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [fullscreen, map]);
  return null;
}

// Convert TopoJSON to GeoJSON
function topoToGeo(topo: any): GeoJSON.FeatureCollection {
  const objectKey = Object.keys(topo.objects)[0];
  const geometries = topo.objects[objectKey].geometries;
  const arcs = topo.arcs;

  function decodeArc(arcIndex: number): number[][] {
    const arc = arcs[arcIndex < 0 ? ~arcIndex : arcIndex];
    const coords: number[][] = [];
    let x = 0, y = 0;
    for (const [dx, dy] of arc) {
      x += dx;
      y += dy;
      coords.push([
        x * topo.transform.scale[0] + topo.transform.translate[0],
        y * topo.transform.scale[1] + topo.transform.translate[1],
      ]);
    }
    if (arcIndex < 0) coords.reverse();
    return coords;
  }

  function decodeRing(indices: number[]): number[][] {
    let coords: number[][] = [];
    for (const idx of indices) {
      const decoded = decodeArc(idx);
      // Skip first point of subsequent arcs to avoid duplicates
      coords = coords.concat(coords.length ? decoded.slice(1) : decoded);
    }
    return coords;
  }

  function decodeGeometry(geom: any): GeoJSON.Geometry | null {
    if (geom.type === 'Polygon') {
      return { type: 'Polygon', coordinates: geom.arcs.map(decodeRing) };
    }
    if (geom.type === 'MultiPolygon') {
      return {
        type: 'MultiPolygon',
        coordinates: geom.arcs.map((polygon: number[][]) => polygon.map(decodeRing)),
      };
    }
    return null;
  }

  const features: GeoJSON.Feature[] = [];
  for (const geom of geometries) {
    const geometry = decodeGeometry(geom);
    if (geometry) {
      features.push({
        type: 'Feature',
        properties: geom.properties || {},
        geometry,
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// World-atlas 110m uses numeric IDs; map ISO numeric → ISO alpha-2
const NUMERIC_TO_ISO2: Record<string, string> = {
  '004':'af','008':'al','012':'dz','032':'ar','036':'au','040':'at','031':'az',
  '050':'bd','112':'by','056':'be','068':'bo','070':'ba','076':'br','100':'bg',
  '116':'kh','120':'cm','124':'ca','152':'cl','156':'cn','170':'co','188':'cr',
  '191':'hr','192':'cu','203':'cz','208':'dk','214':'do','218':'ec','818':'eg',
  '233':'ee','231':'et','246':'fi','250':'fr','268':'ge','276':'de','288':'gh',
  '300':'gr','320':'gt','344':'hk','348':'hu','356':'in','360':'id','364':'ir',
  '368':'iq','372':'ie','376':'il','380':'it','392':'jp','400':'jo','398':'kz',
  '404':'ke','410':'kr','414':'kw','428':'lv','422':'lb','434':'ly','440':'lt',
  '442':'lu','458':'my','484':'mx','498':'md','496':'mn','504':'ma','508':'mz',
  '104':'mm','524':'np','528':'nl','554':'nz','566':'ng','408':'kp','807':'mk',
  '578':'no','586':'pk','591':'pa','600':'py','604':'pe','608':'ph','616':'pl',
  '620':'pt','634':'qa','642':'ro','643':'ru','682':'sa','686':'sn','688':'rs',
  '702':'sg','703':'sk','705':'si','710':'za','724':'es','144':'lk','752':'se',
  '756':'ch','760':'sy','158':'tw','834':'tz','764':'th','788':'tn','792':'tr',
  '804':'ua','784':'ae','826':'gb','840':'us','858':'uy','860':'uz','862':'ve',
  '704':'vn',
};

function getIso2FromFeature(feature: GeoJSON.Feature): string | null {
  const props = feature.properties;
  if (!props) return null;

  // Try direct ISO alpha-2 fields
  const alpha2 = props['ISO3166-1-Alpha-2'] || props['ISO_A2'] || props['iso_a2'];
  if (alpha2 && alpha2 !== '-99' && alpha2.length === 2) return alpha2.toLowerCase();

  // Try numeric ID (world-atlas format)
  const id = (feature as any).id || props.id;
  if (id && NUMERIC_TO_ISO2[String(id)]) return NUMERIC_TO_ISO2[String(id)];

  // Try ISO alpha-3
  const alpha3Fields = ['ISO3166-1-Alpha-3', 'ISO_A3', 'iso_a3'];
  for (const f of alpha3Fields) {
    if (props[f]) {
      const code = getCountryCode(props[f]);
      if (code) return code;
    }
  }

  // Try name
  const name = props.name || props.NAME || props.ADMIN;
  if (name) {
    const code = getCountryCode(name);
    if (code) return code;
  }

  return null;
}

export function EntraIdCountryMap({ loginCountriesSuccess, fullscreen = false }: EntraIdCountryMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(geoCache);

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
    if (geoCache) { setGeoData(geoCache); return; }
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then((data) => {
        // Detect TopoJSON vs GeoJSON
        const geo = data.type === 'Topology' ? topoToGeo(data) : data as GeoJSON.FeatureCollection;
        geoCache = geo;
        setGeoData(geo);
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
      color: 'hsl(0, 0%, 25%)',
      weight: 0.3,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: Layer) => {
    const iso2 = getIso2FromFeature(feature);
    const count = iso2 ? successMap.get(iso2) : undefined;
    if (count !== undefined) {
      const name = feature.properties?.name || feature.properties?.NAME || feature.properties?.ADMIN || '';
      layer.bindTooltip(
        `<strong>${name}</strong><br/>Login com Sucesso: ${count.toLocaleString()}`,
        { sticky: true, className: 'entra-map-tooltip' }
      );
      (layer as any).on({
        mouseover: (e: any) => {
          e.target.setStyle({ fillOpacity: 0.55, weight: 2.5 });
        },
        mouseout: (e: any) => {
          e.target.setStyle({ fillOpacity: 0.35, weight: 1.5 });
        },
      });
    }
  };

  const mapHeight = fullscreen ? '100%' : '200px';

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
