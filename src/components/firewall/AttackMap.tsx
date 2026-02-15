import { useState, useMemo } from 'react';
import { getCountryCoords } from '@/lib/countryUtils';
import type { TopCountry } from '@/types/analyzerInsights';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import worldMapDark from '@/assets/world-map-dark.png';

interface AttackMapProps {
  deniedCountries: TopCountry[];
  authFailedCountries: TopCountry[];
  authSuccessCountries: TopCountry[];
  firewallLocation?: { lat: number; lng: number; label: string };
  fullscreen?: boolean;
}

// Equirectangular projection for 1000x500 viewBox
function project(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [x, y];
}

export function AttackMap({ deniedCountries, authFailedCountries, authSuccessCountries, firewallLocation, fullscreen }: AttackMapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const firewallPoint = useMemo(() => {
    if (!firewallLocation) return null;
    const [x, y] = project(firewallLocation.lat, firewallLocation.lng);
    return { x, y, label: firewallLocation.label };
  }, [firewallLocation]);

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
    <div className={fullscreen ? 'w-full h-full' : 'relative w-full'}>
      <div
        className={fullscreen
          ? 'w-full h-full overflow-hidden'
          : 'relative w-full rounded-lg border border-border/50 overflow-hidden'
        }
        style={{
          backgroundColor: fullscreen ? '#000' : undefined,
        }}
      >
        <svg
          viewBox="0 0 1000 500"
          className={fullscreen ? 'w-full h-full' : 'w-full h-auto relative z-10'}
          style={{ background: 'transparent' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Map image inside SVG for perfect alignment */}
          <image href={worldMapDark} x="0" y="0" width="1000" height="500" preserveAspectRatio="xMidYMid slice" />

          {/* SVG Filters for glow effects */}
          <defs>
            <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="impact-flash" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Subtle grid overlay */}
          {[...Array(11)].map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 50} x2={1000} y2={i * 50} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
          ))}
          {[...Array(21)].map((_, i) => (
            <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={500} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
          ))}

          {/* Equator & prime meridian */}
          <line x1={0} y1={250} x2={1000} y2={250} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="8 4" />
          <line x1={500} y1={0} x2={500} y2={500} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="8 4" />

          {/* Projectile paths and animated projectiles */}
          {firewallPoint && points.map((p, i) => {
            const pathD = `M${p.x},${p.y} L${firewallPoint.x},${firewallPoint.y}`;
            const glowFilter = p.color === '#ef4444' ? 'url(#glow-red)' : p.color === '#f97316' ? 'url(#glow-orange)' : 'url(#glow-green)';
            return (
              <g key={`proj-${i}`}>
                {/* Faint trail line */}
                <path d={pathD} stroke={p.color} strokeWidth="0.5" opacity="0.15" fill="none" />

                {/* 3 staggered projectiles */}
                {[0, 0.7, 1.4].map((delay, j) => (
                  <circle key={`bullet-${i}-${j}`} r={fullscreen ? 3 : 2.5} fill={p.color} opacity="0.9" filter={glowFilter}>
                    <animateMotion
                      path={pathD}
                      dur="2.5s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                      fill="freeze"
                    />
                    <animate attributeName="opacity" values="0;0.9;0.9;0" dur="2.5s" begin={`${delay}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            );
          })}

          {/* Impact flash at firewall point */}
          {firewallPoint && (
            <circle cx={firewallPoint.x} cy={firewallPoint.y} r={8} fill="white" opacity="0" filter="url(#impact-flash)">
              <animate attributeName="opacity" values="0;0.4;0" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="r" values="6;14;6" dur="0.8s" repeatCount="indefinite" />
            </circle>
          )}

          {/* Attack points with pulse */}
          {points.map((p, i) => {
            const glowFilter = p.color === '#ef4444' ? 'url(#glow-red)' : p.color === '#f97316' ? 'url(#glow-orange)' : 'url(#glow-green)';
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <g
                    onMouseEnter={() => setHoveredPoint(`${p.type}_${p.label}`)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="cursor-pointer"
                  >
                    {/* Outer pulse ring */}
                    <circle cx={p.x} cy={p.y} r={p.r + 4} fill={p.color} opacity="0.15">
                      <animate attributeName="r" values={`${p.r + 2};${p.r + 12};${p.r + 2}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.15;0.02;0.15" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {/* Inner glow */}
                    <circle cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity="0.6" filter={glowFilter} />
                    {/* Bright center */}
                    <circle cx={p.x} cy={p.y} r={p.r * 0.4} fill={p.color} opacity="0.95" />
                    {/* Hover label */}
                    {hoveredPoint === `${p.type}_${p.label}` && (
                      <>
                        <rect
                          x={p.x - 60} y={p.y - p.r - 24} width={120} height={18} rx={4}
                          fill="rgba(0,0,0,0.85)" stroke={p.color} strokeWidth="0.5"
                        />
                        <text x={p.x} y={p.y - p.r - 12} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">
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
            );
          })}

          {/* Firewall point */}
          {firewallPoint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <g className="cursor-pointer">
                  {/* Outer pulse */}
                  <circle cx={firewallPoint.x} cy={firewallPoint.y} r={16} fill="#06b6d4" opacity="0.1" filter="url(#glow-cyan)">
                    <animate attributeName="r" values="14;24;14" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.1;0.03;0.1" dur="3s" repeatCount="indefinite" />
                  </circle>
                  {/* Shield body */}
                  <circle cx={firewallPoint.x} cy={firewallPoint.y} r={10} fill="#06b6d4" opacity="0.7" filter="url(#glow-cyan)" />
                  <circle cx={firewallPoint.x} cy={firewallPoint.y} r={5} fill="#06b6d4" opacity="0.95" />
                  {/* Shield icon */}
                  <text x={firewallPoint.x} y={firewallPoint.y + 3.5} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">🛡</text>
                  {/* Permanent label */}
                  <rect
                    x={firewallPoint.x - 35} y={firewallPoint.y - 24} width={70} height={16} rx={4}
                    fill="#06b6d4" fillOpacity="0.85"
                  />
                  <text x={firewallPoint.x} y={firewallPoint.y - 13} textAnchor="middle" fill="white" fontSize="9" fontWeight="600">
                    Firewall
                  </text>
                </g>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{firewallPoint.label}</p>
                <p className="text-xs">Localização do Firewall</p>
              </TooltipContent>
            </Tooltip>
          )}
        </svg>
      </div>

      {/* Legend - only in inline mode */}
      {!fullscreen && (
        <div className="flex items-center gap-4 mt-3 justify-center text-xs text-muted-foreground flex-wrap">
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
          {firewallPoint && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#06b6d4' }} />
              Firewall
            </div>
          )}
        </div>
      )}
    </div>
  );
}
