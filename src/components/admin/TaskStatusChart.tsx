import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface StatusData {
  status: string;
  count: number;
  label: string;
}

interface TaskStatusChartProps {
  data: StatusData[];
  isLoading?: boolean;
}

const chartConfig: ChartConfig = {
  pending: { label: "Pendentes", color: "hsl(48, 96%, 53%)" },
  running: { label: "Executando", color: "hsl(217, 91%, 60%)" },
  completed: { label: "Concluídas", color: "hsl(142, 76%, 36%)" },
  failed: { label: "Falhas", color: "hsl(0, 84%, 60%)" },
  timeout: { label: "Timeout", color: "hsl(25, 95%, 53%)" },
  cancelled: { label: "Canceladas", color: "hsl(0, 0%, 45%)" },
};

const COLORS: Record<string, string> = {
  pending: "hsl(48, 96%, 53%)",
  running: "hsl(217, 91%, 60%)",
  completed: "hsl(142, 76%, 36%)",
  failed: "hsl(0, 84%, 60%)",
  timeout: "hsl(25, 95%, 53%)",
  cancelled: "hsl(0, 0%, 45%)",
};

export function TaskStatusChart({ data, isLoading }: TaskStatusChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredData = data.filter(d => d.count > 0);

  if (filteredData.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Sem dados disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base">Distribuição por Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="count"
                nameKey="label"
              >
                {filteredData.map((entry) => (
                  <Cell 
                    key={`cell-${entry.status}`} 
                    fill={COLORS[entry.status] || "hsl(var(--muted))"} 
                  />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
