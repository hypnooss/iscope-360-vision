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
  '#14b8a6', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b',
  '#22c55e', '#6366f1', '#e11d48', '#0ea5e9', '#a855f7',
];

const RADIAN = Math.PI / 180;
const MIN_PERCENT_FOR_LABEL = 0.08; // 8%

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
      fill="hsl(var(--foreground))"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
    >
      {label} {value}
    </text>
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
    return (['critical', 'high', 'medium', 'low'] as SurfaceFindingSeverity[])
      .filter(s => counts[s] > 0)
      .map(s => ({ name: SEV_LABELS[s], value: counts[s], color: SEV_COLORS[s] }));
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
    const result = top.map(([name, value], i) => ({
      name, value, color: TECH_COLORS[i % TECH_COLORS.length],
    }));
    if (otherCount > 0) result.push({ name: 'Outros', value: otherCount, color: '#6b7280' });
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
          <div className="w-full h-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={85}
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
                  innerRadius={95}
                  outerRadius={130}
                  paddingAngle={1}
                  strokeWidth={0}
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {techData.map((entry, i) => (
                    <Cell key={`tech-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--popover-foreground))' }}
                  formatter={(value: number, name: string) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
