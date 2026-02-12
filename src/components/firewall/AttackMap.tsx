import { useState, useMemo } from 'react';
import { getCountryCoords } from '@/lib/countryUtils';
import type { TopCountry } from '@/types/analyzerInsights';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import worldMapDark from '@/assets/world-map-dark.png';

interface AttackMapProps {
  deniedCountries: TopCountry[];
  authFailedCountries: TopCountry[];
  authSuccessCountries: TopCountry[];
}

// Equirectangular projection for 1000x500 viewBox
function project(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [x, y];
}

export function AttackMap({ deniedCountries, authFailedCountries, authSuccessCountries }: AttackMapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const points = useMemo(() => {
    const result: { x: number; y: number; r: number; color: string; label: string; count: number; type: string }[] = [];

    const addPoints = (countries: TopCountry[], color: string, type: string) => {
      for (const c of countries) {
        const coords = getCountryCoords(c.country);
        if (!coords) continue;
        const [x, y] = project(coords[0], coords[1]);
        const r = Math.max(4, Math.min(18, Math.log2(c.count + 1) * 3));
        result.push({ x, y, r, color, label: c.country, count: c.count, type });
      }
    };

    addPoints(authSuccessCountries, '#22c55e', 'Sucesso Auth');
    addPoints(deniedCountries, '#ef4444', 'Tráfego Negado');
    addPoints(authFailedCountries, '#f97316', 'Falha Auth');

    return result;
  }, [deniedCountries, authFailedCountries, authSuccessCountries]);

  return (
    <div className="relative w-full">
      {/* Container with map background image */}
      <div
        className="relative w-full rounded-lg border border-border/50 overflow-hidden"
        style={{
          backgroundImage: `url(${worldMapDark})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-auto relative z-10"
          style={{ background: 'transparent' }}
        >
          {/* Subtle grid overlay */}
          {[...Array(11)].map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 50} x2={1000} y2={i * 50} stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.1" />
          ))}
          {[...Array(21)].map((_, i) => (
            <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={500} stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.1" />
          ))}

          {/* Equator & prime meridian */}
          <line x1={0} y1={250} x2={1000} y2={250} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.1" strokeDasharray="8 4" />
          <line x1={500} y1={0} x2={500} y2={500} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.1" strokeDasharray="8 4" />

          {/* Attack points with pulse */}
          {points.map((p, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <g
                  onMouseEnter={() => setHoveredPoint(`${p.type}_${p.label}`)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="cursor-pointer"
                >
                  {/* Outer pulse ring */}
                  <circle cx={p.x} cy={p.y} r={p.r + 4} fill={p.color} opacity="0.12">
                    <animate attributeName="r" values={`${p.r + 2};${p.r + 10};${p.r + 2}`} dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.12;0.03;0.12" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  {/* Inner glow */}
                  <circle cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity="0.6" />
                  {/* Bright center */}
                  <circle cx={p.x} cy={p.y} r={p.r * 0.4} fill={p.color} opacity="0.9" />
                  {/* Hover label */}
                  {hoveredPoint === `${p.type}_${p.label}` && (
                    <>
                      <rect
                        x={p.x - 60} y={p.y - p.r - 24} width={120} height={18} rx={4}
                        fill="hsl(var(--popover))" fillOpacity="0.9" stroke="hsl(var(--border))" strokeWidth="0.5"
                      />
                      <text x={p.x} y={p.y - p.r - 12} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10" fontWeight="600">
                        {p.label}: {p.count}
                      </text>
                    </>
                  )}
                </g>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{p.label}</p>
                <p className="text-xs">{p.type}: {p.count} eventos</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center text-xs text-muted-foreground">
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
      </div>
    </div>
  );
}
