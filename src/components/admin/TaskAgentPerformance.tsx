import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface AgentPerformanceData {
  agent_name: string;
  total_tasks: number;
  avg_time_ms: number;
  completed: number;
  failed: number;
}

interface TaskAgentPerformanceProps {
  data: AgentPerformanceData[];
  isLoading?: boolean;
}

const chartConfig: ChartConfig = {
  avg_time_ms: { label: "Tempo Médio (ms)", color: "hsl(var(--primary))" },
  total_tasks: { label: "Total de Tarefas", color: "hsl(217, 91%, 60%)" },
};

export function TaskAgentPerformance({ data, isLoading }: TaskAgentPerformanceProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Performance por Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Performance por Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map(d => ({
    ...d,
    avg_time_s: d.avg_time_ms ? Math.round(d.avg_time_ms / 1000 * 10) / 10 : 0,
    success_rate: d.total_tasks > 0 ? Math.round((d.completed / d.total_tasks) * 100) : 0,
  }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base">Performance por Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                unit="s"
              />
              <YAxis 
                type="category" 
                dataKey="agent_name" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload as typeof formattedData[0];
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md">
                      <p className="font-medium">{data.agent_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Tempo médio: {data.avg_time_s}s
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total: {data.total_tasks} tarefas
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Taxa de sucesso: {data.success_rate}%
                      </p>
                    </div>
                  );
                }}
              />
              <Bar 
                dataKey="avg_time_s" 
                name="Tempo Médio (s)" 
                radius={[0, 4, 4, 0]}
              >
                {formattedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.success_rate >= 80 
                      ? "hsl(142, 76%, 36%)" 
                      : entry.success_rate >= 50 
                        ? "hsl(48, 96%, 53%)" 
                        : "hsl(0, 84%, 60%)"
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
