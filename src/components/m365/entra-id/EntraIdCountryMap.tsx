import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { getCountryCode } from '@/lib/countryUtils';

interface EntraIdCountryMapProps {
  loginCountriesSuccess: { country: string; count: number }[];
  fullscreen?: boolean;
}

const GEO_URL = '/data/world-countries.geojson';

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  count: number;
};

function resolveHslToken(tokenName: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value ? `hsl(${value})` : fallback;
}

export function EntraIdCountryMap({ loginCountriesSuccess, fullscreen = false }: EntraIdCountryMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: '',
    count: 0,
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

  const primary = resolveHslToken('--primary', 'hsl(142 71% 45%)');
  const border = resolveHslToken('--border', 'hsl(217 19% 27%)');
  const foreground = resolveHslToken('--foreground', 'hsl(0 0% 98%)');
  const background = resolveHslToken('--background', 'hsl(222 47% 6%)');
  const card = resolveHslToken('--card', 'hsl(222 47% 8%)');
  const mutedForeground = resolveHslToken('--muted-foreground', 'hsl(215 20% 65%)');

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-background"
      style={{ height: fullscreen ? '100%' : '200px' }}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: fullscreen ? 155 : 125 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup center={[0, 12]} zoom={fullscreen ? 1.45 : 1.1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const props = geo.properties as Record<string, unknown>;
                const iso2 = typeof props.iso_a2 === 'string' ? props.iso_a2.toLowerCase() : null;
                const name = typeof props.admin === 'string' ? props.admin : 'País';
                const count = iso2 ? successMap.get(iso2) : undefined;
                const highlighted = count !== undefined;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(event) => {
                      if (count === undefined) return;
                      const rect = (event.currentTarget.ownerSVGElement?.getBoundingClientRect());
                      setTooltip({
                        visible: true,
                        x: event.clientX - (rect?.left ?? 0),
                        y: event.clientY - (rect?.top ?? 0),
                        name,
                        count,
                      });
                    }}
                    onMouseMove={(event) => {
                      if (count === undefined) return;
                      const rect = (event.currentTarget.ownerSVGElement?.getBoundingClientRect());
                      setTooltip((prev) => ({
                        ...prev,
                        x: event.clientX - (rect?.left ?? 0),
                        y: event.clientY - (rect?.top ?? 0),
                      }));
                    }}
                    onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
                    style={{
                      default: {
                        fill: highlighted ? primary : 'transparent',
                        fillOpacity: highlighted ? 0.28 : 0,
                        stroke: highlighted ? primary : border,
                        strokeWidth: highlighted ? 1.8 : 0.6,
                        outline: 'none',
                      },
                      hover: {
                        fill: highlighted ? primary : 'transparent',
                        fillOpacity: highlighted ? 0.4 : 0,
                        stroke: highlighted ? primary : border,
                        strokeWidth: highlighted ? 2.2 : 0.8,
                        outline: 'none',
                      },
                      pressed: {
                        fill: highlighted ? primary : 'transparent',
                        fillOpacity: highlighted ? 0.35 : 0,
                        stroke: highlighted ? primary : border,
                        strokeWidth: highlighted ? 2 : 0.7,
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(tooltip.x + 12, fullscreen ? window.innerWidth - 220 : 520),
            top: Math.max(tooltip.y - 12, 12),
            color: foreground,
            background: card,
          }}
        >
          <div className="font-medium">{tooltip.name}</div>
          <div style={{ color: mutedForeground }}>Login com Sucesso: {tooltip.count.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
