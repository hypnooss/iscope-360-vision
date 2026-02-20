import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Eye } from 'lucide-react';
import type { SurfaceFinding, SurfaceFindingSeverity } from '@/lib/surfaceFindings';

/* ── Severity colors ── */
const SEV_COLORS: Record<SurfaceFindingSeverity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#60a5fa',
};

const SEV_LABELS: Record<SurfaceFindingSeverity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

/* ── Tech ring colors (distinct palette) ── */
const TECH_COLORS = [
  '#5b9aa9', '#7c8bb8', '#8a7fa8', '#6ba3a0', '#9ca3af',
  '#7a9b8d', '#8691a8', '#a0929b', '#6d97a8', '#8b8fa3',
];

const RADIAN = Math.PI / 180;
const MIN_PERCENT_FOR_LABEL = 0.10;
const MIN_PERCENT_FOR_OUTER_LABEL = 0.04;

function renderCustomLabel({
  cx, cy, midAngle, innerRadius, outerRadius, name, value, percent,
}: any) {
  if (percent < MIN_PERCENT_FOR_LABEL) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const label = name.length > 7 ? name.slice(0, 6) + '…' : name;

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
    >
      {label} {value}
    </text>
  );
}

function renderOuterLabel({
  cx, cy, midAngle, outerRadius, name, value, percent, payload,
}: any) {
  if (percent < MIN_PERCENT_FOR_OUTER_LABEL) return null;

  const color = payload?.color || '#888';
  const pct = (percent * 100).toFixed(0);

  // Point on the outer edge of the arc
  const ex1 = cx + outerRadius * Math.cos(-midAngle * RADIAN);
  const ey1 = cy + outerRadius * Math.sin(-midAngle * RADIAN);

  // Extended point (radial extension)
  const extRadius = outerRadius + 22;
  const ex2 = cx + extRadius * Math.cos(-midAngle * RADIAN);
  const ey2 = cy + extRadius * Math.sin(-midAngle * RADIAN);

  // Horizontal extension
  const isRight = midAngle <= 180;
  const horizLen = 28;
  const ex3 = isRight ? ex2 + horizLen : ex2 - horizLen;
  const ey3 = ey2;

  const textAnchor = isRight ? 'start' : 'end';
  const textX = isRight ? ex3 + 8 : ex3 - 8;

  return (
    <g>
      <polyline
        points={`${ex1},${ey1} ${ex2},${ey2} ${ex3},${ey3}`}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeOpacity={0.7}
      />
      <circle cx={ex3} cy={ey3} r={3} fill={color} />
      <text
        x={textX}
        y={ey3 - 1}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill="hsl(var(--foreground))"
      >
        {name}
      </text>
      <text
        x={textX}
        y={ey3 + 14}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={10}
        fill="hsl(var(--muted-foreground))"
      >
        {value} ({pct}%)
      </text>
    </g>
  );
}

/* ── Custom Tooltip ── */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const { name, value, payload: data } = entry;
  const color = data?.color || entry.color || '#888';
  const total = entry.payload?._total || 1;
  const pct = ((value / total) * 100).toFixed(1);
  const ring = entry.payload?._ring || '';

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-popover-foreground">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-semibold">{name}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {value} ({pct}%) · {ring}
      </div>
    </div>
  );
}

interface SeverityTechDonutProps {
  findings: SurfaceFinding[];
  assets: Array<{
    allTechs: string[];
    services: Array<{ product?: string; version?: string }>;
    webServices: Array<{ server?: string; technologies?: string[] }>;
  }>;
}

export function SeverityTechDonut({ findings, assets }: SeverityTechDonutProps) {
  const severityData = useMemo(() => {
    const counts: Record<SurfaceFindingSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) counts[f.severity]++;
    const total = findings.length || 1;
    return (['critical', 'high', 'medium', 'low'] as SurfaceFindingSeverity[])
      .filter(s => counts[s] > 0)
      .map(s => ({ name: SEV_LABELS[s], value: counts[s], color: SEV_COLORS[s], _total: total, _ring: 'Severidade' }));
  }, [findings]);

  const techData = useMemo(() => {
    const techCount = new Map<string, number>();
    for (const asset of assets) {
      const seen = new Set<string>();
      for (const tech of asset.allTechs) {
        const name = tech.split('/')[0].split(':')[0].trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        techCount.set(name, (techCount.get(name) || 0) + 1);
      }
    }
    const sorted = Array.from(techCount.entries()).sort((a, b) => b[1] - a[1]);
    const MAX_ITEMS = 8;
    const top = sorted.slice(0, MAX_ITEMS);
    const otherCount = sorted.slice(MAX_ITEMS).reduce((sum, [, c]) => sum + c, 0);
    const totalTech = sorted.reduce((sum, [, c]) => sum + c, 0) || 1;
    const result = top.map(([name, value], i) => ({
      name, value, color: TECH_COLORS[i % TECH_COLORS.length], _total: totalTech, _ring: 'Tecnologia',
    }));
    if (otherCount > 0) result.push({ name: 'Outros', value: otherCount, color: '#6b7280', _total: totalTech, _ring: 'Tecnologia' });
    return result;
  }, [assets]);

  const hasData = severityData.length > 0 || techData.length > 0;

  return (
    <Card className="border-border/50 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          Visão Geral
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0 pb-2">
        {!hasData ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sem dados para exibir</p>
        ) : (
          <div className="w-full h-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius="20%"
                  outerRadius="42%"
                  paddingAngle={2}
                  strokeWidth={0}
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {severityData.map((entry, i) => (
                    <Cell key={`sev-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                <Pie
                  data={techData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius="48%"
                  outerRadius="65%"
                  paddingAngle={1}
                  strokeWidth={0}
                  label={renderOuterLabel}
                  labelLine={false}
                >
                  {techData.map((entry, i) => (
                    <Cell key={`tech-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
