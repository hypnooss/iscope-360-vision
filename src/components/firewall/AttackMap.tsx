import { useState, useMemo } from 'react';
import { getCountryCoords } from '@/lib/countryUtils';
import type { TopCountry } from '@/types/analyzerInsights';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

// Detailed continent/region SVG paths (Natural Earth simplified, equirectangular 1000x500)
const CONTINENT_PATHS = [
  // North America
  "M 50,80 L 80,60 120,55 145,50 170,55 200,70 230,80 250,100 260,120 270,140 280,155 275,170 260,180 240,190 220,195 200,190 180,185 160,195 140,210 120,200 100,180 80,160 60,140 50,120 45,100 Z",
  // Central America & Caribbean
  "M 160,195 L 175,200 185,210 195,215 200,225 195,230 185,228 175,225 165,220 155,210 Z",
  // South America
  "M 195,230 L 210,225 230,230 250,245 265,265 275,290 280,320 275,350 265,375 250,395 235,405 220,400 205,385 195,365 190,340 185,310 190,280 195,255 Z",
  // Europe
  "M 440,55 L 460,50 480,48 500,50 520,55 535,60 545,70 540,80 530,90 520,95 510,100 500,105 490,110 475,115 460,110 450,100 445,90 440,80 435,70 Z",
  // British Isles
  "M 425,65 L 435,60 440,65 438,72 430,75 425,70 Z",
  // Scandinavia
  "M 480,30 L 495,25 510,28 515,40 510,50 500,48 490,42 485,35 Z",
  // Africa
  "M 440,130 L 460,120 480,115 500,118 520,125 540,140 555,160 560,185 555,210 550,240 540,270 525,300 510,320 495,335 480,340 465,335 450,320 440,300 435,275 430,250 432,225 435,200 438,175 440,150 Z",
  // Middle East
  "M 545,100 L 565,95 585,100 600,110 610,125 605,140 590,145 575,140 560,130 550,115 Z",
  // Central/South Asia
  "M 610,100 L 640,90 670,85 700,90 720,100 730,115 725,130 715,145 700,155 680,160 660,155 640,145 625,130 615,115 Z",
  // East Asia
  "M 720,65 L 745,55 770,50 795,55 810,65 815,80 810,95 800,105 785,110 770,108 755,100 740,90 730,80 Z",
  // Southeast Asia
  "M 710,155 L 730,150 750,155 765,165 775,180 770,195 755,205 740,200 725,190 715,175 Z",
  // Indonesia/Philippines archipelago
  "M 750,210 L 765,205 780,210 790,220 800,215 810,220 820,230 810,240 795,235 780,230 765,225 755,218 Z",
  // Japan/Korea
  "M 810,70 L 820,65 830,70 835,80 830,90 822,95 815,88 810,80 Z",
  // Russia/Siberia
  "M 535,30 L 570,20 620,15 670,12 720,15 770,20 820,25 860,35 880,45 870,55 840,55 800,50 760,45 720,40 680,38 640,40 600,45 570,50 550,48 540,40 Z",
  // Australia
  "M 770,310 L 800,300 830,305 855,315 870,330 875,350 865,370 845,380 820,385 795,380 775,365 765,345 760,325 Z",
  // New Zealand
  "M 890,375 L 898,370 905,375 905,385 900,392 893,388 890,380 Z",
  // Madagascar
  "M 555,320 L 565,315 570,325 568,340 560,345 555,335 Z",
  // Greenland
  "M 280,20 L 310,15 340,18 355,30 350,45 335,50 315,48 295,40 285,30 Z",
];

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
      <svg
        viewBox="0 0 1000 500"
        className="w-full h-auto rounded-lg border border-border/50 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--secondary)/0.5) 100%)' }}
      >
        {/* Subtle grid */}
        {[...Array(11)].map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 50} x2={1000} y2={i * 50} stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.2" />
        ))}
        {[...Array(21)].map((_, i) => (
          <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={500} stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.2" />
        ))}

        {/* Equator & prime meridian */}
        <line x1={0} y1={250} x2={1000} y2={250} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.15" strokeDasharray="8 4" />
        <line x1={500} y1={0} x2={500} y2={500} stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.15" strokeDasharray="8 4" />

        {/* Continent paths */}
        {CONTINENT_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="hsl(var(--muted))"
            fillOpacity="0.35"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="0.6"
            strokeOpacity="0.3"
          />
        ))}

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
