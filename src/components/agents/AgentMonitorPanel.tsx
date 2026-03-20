import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, HardDrive, MemoryStick, Network, Clock, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useAgentMetrics,
  computeNetworkRates,
  formatBytes,
  formatUptime,
  type TimeRange,
  type AgentMetricRow,
} from "@/hooks/useAgentMetrics";
import { format } from "date-fns";

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];

function getColor(value: number | null): string {
  if (value == null) return "hsl(var(--muted-foreground))";
  if (value < 60) return "hsl(142, 76%, 36%)";
  if (value < 80) return "hsl(45, 93%, 47%)";
  return "hsl(0, 84%, 60%)";
}

function formatTime(timeRange: TimeRange) {
  return (ts: string) => {
    const d = new Date(ts);
    if (timeRange === "7d") return format(d, "dd/MM HH:mm");
    return format(d, "HH:mm");
  };
}

function MetricIndicator({
  icon: Icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold" style={color ? { color } : undefined}>
          {value != null ? `${value}${suffix || ""}` : "—"}
        </p>
      </div>
    </div>
  );
}

function PercentTooltip({
  active,
  payload,
  label,
  usedKey,
  totalKey,
  usedUnit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: AgentMetricRow }>;
  label?: string;
  usedKey: keyof AgentMetricRow;
  totalKey: keyof AgentMetricRow;
  usedUnit: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const pct = payload[0].value;
  const used = row[usedKey] as number | null;
  const total = row[totalKey] as number | null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label ? format(new Date(label), "dd/MM HH:mm:ss") : ""}</p>
      <p className="font-semibold" style={{ color: getColor(pct) }}>
        {pct != null ? `${Number(pct).toFixed(1)}%` : "—"}
      </p>
      {used != null && total != null && (
        <p className="text-muted-foreground">
          {Number(used).toFixed(1)} / {Number(total).toFixed(1)} {usedUnit}
        </p>
      )}
    </div>
  );
}

function NetworkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label ? format(new Date(label), "dd/MM HH:mm:ss") : ""}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.dataKey === "sentRate" ? "↑ Enviado" : "↓ Recebido"}: {formatBytes(p.value)}
        </p>
      ))}
    </div>
  );
}

interface Props {
  agentId: string;
}

export function AgentMonitorPanel({ agentId }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const { data: metrics = [], isLoading } = useAgentMetrics(agentId, timeRange);

  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const networkData = useMemo(() => computeNetworkRates(metrics), [metrics]);
  const timeFmt = formatTime(timeRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Monitoramento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Monitoramento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma métrica recebida ainda.</p>
            <p className="text-xs mt-1">O módulo monitor envia dados a cada 60 segundos.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = metrics.map((m) => ({
    ...m,
    time: m.collected_at,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5" />
          Monitoramento
          {latest?.hostname && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({latest.hostname})
            </span>
          )}
        </CardTitle>
        <div className="flex gap-1">
          {TIME_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={timeRange === opt.value ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setTimeRange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricIndicator
            icon={Cpu}
            label="CPU"
            value={latest?.cpu_percent != null ? Number(latest.cpu_percent).toFixed(1) : null}
            suffix="%"
            color={getColor(latest?.cpu_percent != null ? Number(latest.cpu_percent) : null)}
          />
          <MetricIndicator
            icon={MemoryStick}
            label="RAM"
            value={latest?.ram_percent != null ? Number(latest.ram_percent).toFixed(1) : null}
            suffix="%"
            color={getColor(latest?.ram_percent != null ? Number(latest.ram_percent) : null)}
          />
          <MetricIndicator
            icon={HardDrive}
            label="Disco"
            value={latest?.disk_percent != null ? Number(latest.disk_percent).toFixed(1) : null}
            suffix="%"
            color={getColor(latest?.disk_percent != null ? Number(latest.disk_percent) : null)}
          />
          <MetricIndicator
            icon={Clock}
            label="Uptime"
            value={latest?.uptime_seconds != null ? formatUptime(Number(latest.uptime_seconds)) : null}
          />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CPU Chart */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Cpu className="w-3 h-3" /> CPU (%)
            </p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={timeFmt}
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip
                    content={
                      <PercentTooltip usedKey="cpu_percent" totalKey="cpu_count" usedUnit="cores" />
                    }
                    labelFormatter={(v) => v}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu_percent"
                    stroke="hsl(142, 76%, 36%)"
                    fill="hsl(142, 76%, 36%)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RAM Chart */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MemoryStick className="w-3 h-3" /> RAM (%)
            </p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={timeFmt}
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip
                    content={
                      <PercentTooltip usedKey="ram_used_mb" totalKey="ram_total_mb" usedUnit="MB" />
                    }
                    labelFormatter={(v) => v}
                  />
                  <Area
                    type="monotone"
                    dataKey="ram_percent"
                    stroke="hsl(217, 91%, 60%)"
                    fill="hsl(217, 91%, 60%)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Disk Chart */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> Disco (%)
            </p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={timeFmt}
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip
                    content={
                      <PercentTooltip usedKey="disk_used_gb" totalKey="disk_total_gb" usedUnit="GB" />
                    }
                    labelFormatter={(v) => v}
                  />
                  <Area
                    type="monotone"
                    dataKey="disk_percent"
                    stroke="hsl(25, 95%, 53%)"
                    fill="hsl(25, 95%, 53%)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Network Chart */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Network className="w-3 h-3" /> Rede
            </p>
            <div className="h-48 w-full">
              {networkData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={networkData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={timeFmt}
                      tick={{ fontSize: 10 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tickFormatter={(v) => formatBytes(v).replace("/s", "")}
                      tick={{ fontSize: 10 }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip content={<NetworkTooltip />} labelFormatter={(v) => v} />
                    <Line
                      type="monotone"
                      dataKey="sentRate"
                      stroke="hsl(262, 83%, 58%)"
                      strokeWidth={1.5}
                      dot={false}
                      name="Enviado"
                    />
                    <Line
                      type="monotone"
                      dataKey="recvRate"
                      stroke="hsl(173, 80%, 40%)"
                      strokeWidth={1.5}
                      dot={false}
                      name="Recebido"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Dados insuficientes para calcular taxa de transferência
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        {latest && (
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-2 border-t border-border/50">
            {latest.os_info && <span>OS: {latest.os_info}</span>}
            {latest.monitor_version && <span>Monitor v{latest.monitor_version}</span>}
            {latest.process_count != null && <span>{latest.process_count} processos</span>}
            <span>{metrics.length} pontos no período</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
