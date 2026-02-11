import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis } from 'recharts';
import { ScoreHistoryPoint } from '@/hooks/useDashboardStats';
import { useMemo } from 'react';

interface ScoreSparklineProps {
  data: ScoreHistoryPoint[];
}

function getColorForScore(score: number): string {
  if (score >= 90) return 'hsl(175, 80%, 45%)';
  if (score >= 75) return 'hsl(158, 64%, 52%)';
  if (score >= 60) return 'hsl(48, 96%, 53%)';
  return 'hsl(351, 95%, 72%)';
}

export function ScoreSparkline({ data }: ScoreSparklineProps) {
  const gradientId = useMemo(() => `sparkGradient-${Math.random().toString(36).slice(2, 8)}`, []);

  const gradientStops = useMemo(() => {
    if (data.length < 2) return [];
    const lastIndex = data.length - 1;
    return data.map((point, i) => ({
      offset: `${(i / lastIndex) * 100}%`,
      color: getColorForScore(point.score),
    }));
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="w-full h-[40px] flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">Sem histórico</span>
      </div>
    );
  }

  return (
    <div className="w-full h-[40px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              {gradientStops.map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
          <YAxis domain={[0, 100]} hide />
          <XAxis dataKey="date" hide />
          <Area
            type="monotone"
            dataKey="score"
            stroke={`url(#${gradientId})`}
            strokeWidth={2}
            fill="none"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
