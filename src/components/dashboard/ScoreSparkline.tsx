import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ScoreHistoryPoint } from '@/hooks/useDashboardStats';

interface ScoreSparklineProps {
  data: ScoreHistoryPoint[];
  color?: string;
}

export function ScoreSparkline({ data, color = 'hsl(175, 80%, 45%)' }: ScoreSparklineProps) {
  if (data.length < 2) {
    return (
      <div className="w-[120px] h-[48px] flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">Sem histórico</span>
      </div>
    );
  }

  return (
    <div className="w-[120px] h-[48px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${color.replace(/[^a-z0-9]/gi, '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
