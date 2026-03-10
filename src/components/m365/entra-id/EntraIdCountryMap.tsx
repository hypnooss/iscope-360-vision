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
      const rawCountry = item.country?.trim().toLowerCase();
      if (!rawCountry) continue;

      const iso2 = rawCountry.length === 2 ? rawCountry : getCountryCode(item.country);
      if (!iso2) continue;

      mapped.set(iso2, (mapped.get(iso2) ?? 0) + item.count);
    }

    return mapped;
  }, [loginCountriesSuccess]);

  const primary = resolveHslToken('--primary', 'hsl(142 71% 45%)');
  const primarySoft = 'hsl(94 79% 66%)';
  const primaryStrong = 'hsl(118 84% 55%)';
  const border = resolveHslToken('--border', 'hsl(217 19% 27%)');
  const foreground = resolveHslToken('--foreground', 'hsl(0 0% 98%)');
  const card = resolveHslToken('--card', 'hsl(222 47% 8%)');
  const mutedForeground = resolveHslToken('--muted-foreground', 'hsl(215 20% 65%)');

  const highlightedCountryCount = successMap.size;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{
        height: fullscreen ? '100%' : '200px',
        background: 'radial-gradient(circle at center, hsl(202 37% 34% / 0.38) 0%, hsl(213 47% 13%) 46%, hsl(222 47% 6%) 100%)',
      }}
    >
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(hsl(0 0% 100% / 0.08) 0.8px, transparent 0.8px)', backgroundSize: '16px 16px' }} />

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: fullscreen ? 150 : 118 }}
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
      >
        <ZoomableGroup center={[0, 14]} zoom={fullscreen ? 1.5 : 1.08}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const props = geo.properties as Record<string, unknown>;
                const iso2 = typeof props.iso_a2 === 'string' ? props.iso_a2.toLowerCase() : null;
                const name = typeof props.admin === 'string' ? props.admin : 'País';
                const count = iso2 ? successMap.get(iso2) : undefined;
                const highlighted = count !== undefined;
                const highIntensity = highlighted && highlightedCountryCount > 1 && count === Math.max(...successMap.values());

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(event) => {
                      if (count === undefined) return;
                      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
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
                      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      setTooltip((prev) => ({
                        ...prev,
                        x: event.clientX - (rect?.left ?? 0),
                        y: event.clientY - (rect?.top ?? 0),
                      }));
                    }}
                    onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
                    style={{
                      default: {
                        fill: highlighted ? (highIntensity ? primaryStrong : primarySoft) : 'transparent',
                        fillOpacity: highlighted ? 0.95 : 0,
                        stroke: highlighted ? 'hsl(0 0% 88%)' : border,
                        strokeWidth: highlighted ? 1.1 : 0.65,
                        outline: 'none',
                      },
                      hover: {
                        fill: highlighted ? (highIntensity ? primaryStrong : primary) : 'transparent',
                        fillOpacity: highlighted ? 1 : 0,
                        stroke: highlighted ? 'hsl(0 0% 96%)' : border,
                        strokeWidth: highlighted ? 1.35 : 0.85,
                        outline: 'none',
                      },
                      pressed: {
                        fill: highlighted ? (highIntensity ? primaryStrong : primary) : 'transparent',
                        fillOpacity: highlighted ? 1 : 0,
                        stroke: highlighted ? 'hsl(0 0% 96%)' : border,
                        strokeWidth: highlighted ? 1.2 : 0.8,
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
            left: tooltip.x + 12,
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
