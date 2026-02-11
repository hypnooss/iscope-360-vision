import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { ScoreHistoryPoint } from '@/hooks/useDashboardStats';

interface ScoreSparklineProps {
  data: ScoreHistoryPoint[];
  color?: string;
}

export function ScoreSparkline({ data, color = 'hsl(175, 80%, 45%)' }: ScoreSparklineProps) {
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
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Bar
            dataKey="score"
            fill={color}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
            opacity={1}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
