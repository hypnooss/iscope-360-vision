import { useState, useMemo } from 'react';
import { getCountryCode, getCountryCoords } from '@/lib/countryUtils';
import type { TopCountry } from '@/types/analyzerInsights';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AttackMapProps {
  deniedCountries: TopCountry[];
  authFailedCountries: TopCountry[];
  authSuccessCountries: TopCountry[];
}

// Simple equirectangular projection
function project(lat: number, lng: number, width: number, height: number): [number, number] {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

// Simplified world outline (major continents)
const WORLD_PATH = `M 77,18 L 83,18 85,20 89,19 92,16 96,18 102,19 108,21 111,22 115,24 119,27 121,31 120,35 
117,38 114,41 111,42 107,42 104,43 100,43 97,42 93,41 90,40 87,39 84,38 80,37 77,36 75,33 74,29 74,24 Z
M 26,23 L 31,22 36,21 40,22 43,24 46,27 47,31 46,35 44,38 41,40 38,41 35,41 32,40 29,39 27,37 25,34 24,30 25,26 Z
M 49,32 L 53,30 57,29 60,30 63,32 65,35 67,38 67,42 66,45 63,47 60,48 57,48 54,47 52,44 50,41 49,38 49,35 Z
M 60,60 L 63,57 67,55 71,56 74,58 76,62 77,66 76,70 73,73 70,74 67,73 64,71 62,67 61,63 Z
M 18,50 L 22,44 27,40 32,43 35,48 37,55 38,62 37,68 34,73 30,76 25,77 21,74 18,69 16,63 16,56 Z
M 118,60 L 123,57 128,56 133,58 136,61 138,66 137,72 134,76 129,78 124,77 120,73 118,68 117,64 Z`;

export function AttackMap({ deniedCountries, authFailedCountries, authSuccessCountries }: AttackMapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const width = 800;
  const height = 400;

  const points = useMemo(() => {
    const result: { x: number; y: number; r: number; color: string; label: string; count: number; type: string }[] = [];

    const addPoints = (countries: TopCountry[], color: string, type: string) => {
      for (const c of countries) {
        const coords = getCountryCoords(c.country);
        if (!coords) continue;
        const [x, y] = project(coords[0], coords[1], width, height);
        const r = Math.max(4, Math.min(20, Math.log2(c.count + 1) * 3));
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-secondary/20 rounded-lg border border-border/50">
        {/* Grid lines */}
        {[...Array(7)].map((_, i) => (
          <line key={`h${i}`} x1={0} y1={(i * height) / 6} x2={width} y2={(i * height) / 6} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
        ))}
        {[...Array(13)].map((_, i) => (
          <line key={`v${i}`} x1={(i * width) / 12} y1={0} x2={(i * width) / 12} y2={height} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
        ))}

        {/* Simplified continent outlines */}
        <path d={WORLD_PATH} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" transform={`scale(${width / 160}, ${height / 90})`} />

        {/* Attack points */}
        {points.map((p, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <g
                onMouseEnter={() => setHoveredPoint(`${p.type}_${p.label}`)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="cursor-pointer"
              >
                <circle cx={p.x} cy={p.y} r={p.r + 4} fill={p.color} opacity="0.15">
                  <animate attributeName="r" values={`${p.r + 2};${p.r + 8};${p.r + 2}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity="0.7" stroke={p.color} strokeWidth="1" />
                {hoveredPoint === `${p.type}_${p.label}` && (
                  <text x={p.x} y={p.y - p.r - 6} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="11" fontWeight="600">
                    {p.label}: {p.count}
                  </text>
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
