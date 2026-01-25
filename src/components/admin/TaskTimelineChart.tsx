import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimelineData {
  date: string;
  completed: number;
  failed: number;
  timeout: number;
}

interface TaskTimelineChartProps {
  data: TimelineData[];
  isLoading?: boolean;
}

const chartConfig: ChartConfig = {
  completed: { label: "Concluídas", color: "hsl(142, 76%, 36%)" },
  failed: { label: "Falhas", color: "hsl(0, 84%, 60%)" },
  timeout: { label: "Timeout", color: "hsl(25, 95%, 53%)" },
};

export function TaskTimelineChart({ data, isLoading }: TaskTimelineChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Execuções nos últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
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
          <CardTitle className="text-base">Execuções nos últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map(d => ({
    ...d,
    formattedDate: format(new Date(d.date), "dd/MM", { locale: ptBR }),
  }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base">Execuções nos últimos 7 dias</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorTimeout" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="formattedDate" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="completed"
                name="Concluídas"
                stackId="1"
                stroke="hsl(142, 76%, 36%)"
                fill="url(#colorCompleted)"
              />
              <Area
                type="monotone"
                dataKey="failed"
                name="Falhas"
                stackId="1"
                stroke="hsl(0, 84%, 60%)"
                fill="url(#colorFailed)"
              />
              <Area
                type="monotone"
                dataKey="timeout"
                name="Timeout"
                stackId="1"
                stroke="hsl(25, 95%, 53%)"
                fill="url(#colorTimeout)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
