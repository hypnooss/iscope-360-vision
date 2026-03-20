import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, HardDrive, MemoryStick, Network, Clock, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  useAgentMetrics,
  formatBytes,
  formatUptime,
  formatLinkSpeed,
  getInterfaceNames,
  getInterfaceSpeed,
  buildInterfaceData,
  buildLegacyNetworkData,
  type TimeRange,
  type AgentMetricRow,
  type DiskPartition,
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

function AbsoluteTooltip({
  active,
  payload,
  label,
  usedKey,
  totalKey,
  unit,
  percentKey,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Record<string, unknown> }>;
  label?: string;
  usedKey: string;
  totalKey: string;
  unit: string;
  percentKey: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const used = row[usedKey] as number | null;
  const total = row[totalKey] as number | null;
  const pct = row[percentKey] as number | null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label ? format(new Date(label), "dd/MM HH:mm:ss") : ""}</p>
      {used != null && total != null && (
        <p className="font-semibold" style={{ color: getColor(pct) }}>
          {Number(used).toFixed(1)} / {Number(total).toFixed(1)} {unit}
        </p>
      )}
      {pct != null && (
        <p className="text-muted-foreground">{Number(pct).toFixed(1)}%</p>
      )}
    </div>
  );
}

function CpuTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: AgentMetricRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const pct = payload[0].value;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label ? format(new Date(label), "dd/MM HH:mm:ss") : ""}</p>
      <p className="font-semibold" style={{ color: getColor(pct) }}>
        {pct != null ? `${Number(pct).toFixed(1)}%` : "—"}
      </p>
      {row.cpu_count != null && (
        <p className="text-muted-foreground">{row.cpu_count} cores</p>
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
      {payload.map((p) => {
        const isRecv = p.dataKey === "recvRateNeg";
        const absVal = Math.abs(p.value);
        return (
          <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
            {isRecv ? "↓ Recebido" : "↑ Enviado"}: {formatBytes(absVal)}
          </p>
        );
      })}
    </div>
  );
}

/** Extract unique partition paths from metrics data */
function getPartitionPaths(metrics: AgentMetricRow[]): string[] {
  const paths = new Set<string>();
  for (const m of metrics) {
    if (m.disk_partitions && Array.isArray(m.disk_partitions)) {
      for (const p of m.disk_partitions) {
        paths.add(p.path);
      }
    }
  }
  return Array.from(paths).sort();
}

/** Build chart data for a specific partition */
function buildPartitionData(metrics: AgentMetricRow[], partitionPath: string) {
  return metrics.map((m) => {
    const part = m.disk_partitions?.find((p: DiskPartition) => p.path === partitionPath);
    return {
      time: m.collected_at,
      disk_used_gb: part?.used_gb ?? null,
      disk_total_gb: part?.total_gb ?? null,
      disk_percent: part?.percent ?? null,
    };
  });
}

interface Props {
  agentId: string;
}

export function AgentMonitorPanel({ agentId }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const { data: metrics = [], isLoading } = useAgentMetrics(agentId, timeRange);

  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const interfaceNames = useMemo(() => getInterfaceNames(metrics), [metrics]);
  const hasMultiInterfaces = interfaceNames.length > 0;
  const legacyNetworkData = useMemo(() => !hasMultiInterfaces ? buildLegacyNetworkData(metrics) : [], [metrics, hasMultiInterfaces]);
  const timeFmt = formatTime(timeRange);

  const partitionPaths = useMemo(() => getPartitionPaths(metrics), [metrics]);
  const hasMultiPartitions = partitionPaths.length > 1;

  // RAM total for reference line
  const ramTotal = latest?.ram_total_mb != null ? Number(latest.ram_total_mb) : null;

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

  // Format indicator values
  const cpuIndicator = latest?.cpu_percent != null
    ? `${Number(latest.cpu_percent).toFixed(1)}%${latest.cpu_count ? ` (${latest.cpu_count} cores)` : ""}`
    : null;

  const ramIndicator = latest?.ram_used_mb != null && latest?.ram_total_mb != null
    ? `${Number(latest.ram_used_mb).toLocaleString()} / ${Number(latest.ram_total_mb).toLocaleString()} MB (${Number(latest.ram_percent).toFixed(1)}%)`
    : null;

  const diskIndicator = latest?.disk_used_gb != null && latest?.disk_total_gb != null
    ? `${Number(latest.disk_used_gb).toFixed(1)} / ${Number(latest.disk_total_gb).toFixed(1)} GB (${Number(latest.disk_percent).toFixed(1)}%)`
    : null;

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
            value={cpuIndicator}
            color={getColor(latest?.cpu_percent != null ? Number(latest.cpu_percent) : null)}
          />
          <MetricIndicator
            icon={MemoryStick}
            label="RAM"
            value={ramIndicator}
            color={getColor(latest?.ram_percent != null ? Number(latest.ram_percent) : null)}
          />
          <MetricIndicator
            icon={HardDrive}
            label="Disco"
            value={diskIndicator}
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
          {/* CPU Chart — stays as percentage */}
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
                    content={<CpuTooltip />}
                    labelFormatter={(v) => v}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu_percent"
                    name="CPU %"
                    stroke="hsl(142, 76%, 36%)"
                    fill="hsl(142, 76%, 36%)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Legend verticalAlign="top" align="right" iconType="line" wrapperStyle={{ fontSize: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RAM Chart — absolute MB with total reference */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MemoryStick className="w-3 h-3" /> RAM (MB)
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
                  <YAxis
                    domain={[0, ramTotal ? Math.ceil(ramTotal * 1.05) : "auto"]}
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) => v >= 1024 ? `${(v / 1024).toFixed(1)}G` : `${v}`}
                  />
                  <Tooltip
                    content={
                      <AbsoluteTooltip usedKey="ram_used_mb" totalKey="ram_total_mb" unit="MB" percentKey="ram_percent" />
                    }
                    labelFormatter={(v) => v}
                  />
                  {ramTotal && (
                    <ReferenceLine
                      y={ramTotal}
                      stroke="hsl(217, 91%, 60%)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{ value: "Total", position: "right", fontSize: 9, fill: "hsl(217, 91%, 60%)" }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="ram_used_mb"
                    name="Usado"
                    stroke="hsl(217, 91%, 60%)"
                    fill="hsl(217, 91%, 60%)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Legend verticalAlign="top" align="right" iconType="line" wrapperStyle={{ fontSize: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Disk Charts — one per partition or single legacy */}
          {hasMultiPartitions ? (
            partitionPaths.map((path) => {
              const partData = buildPartitionData(metrics, path);
              const latestPart = latest?.disk_partitions?.find((p: DiskPartition) => p.path === path);
              const totalGb = latestPart?.total_gb ?? null;
              return (
                <div key={path} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <HardDrive className="w-3 h-3" /> Disco — {path}
                    {latestPart?.total_gb != null && (
                      <span className="text-muted-foreground/70">({Number(latestPart.total_gb).toFixed(0)} GB)</span>
                    )}
                  </p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={partData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis
                          dataKey="time"
                          tickFormatter={timeFmt}
                          tick={{ fontSize: 10 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          domain={[0, totalGb ? Math.ceil(totalGb * 1.05) : "auto"]}
                          tick={{ fontSize: 10 }}
                          className="fill-muted-foreground"
                        />
                        <Tooltip
                          content={
                            <AbsoluteTooltip usedKey="disk_used_gb" totalKey="disk_total_gb" unit="GB" percentKey="disk_percent" />
                          }
                          labelFormatter={(v) => v}
                        />
                        {totalGb && (
                          <ReferenceLine
                            y={totalGb}
                            stroke="hsl(25, 95%, 53%)"
                            strokeDasharray="4 4"
                            strokeOpacity={0.5}
                            label={{ value: "Total", position: "right", fontSize: 9, fill: "hsl(25, 95%, 53%)" }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="disk_used_gb"
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
              );
            })
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Disco
                {latest?.disk_total_gb != null && (
                  <span className="text-muted-foreground/70">({Number(latest.disk_total_gb).toFixed(0)} GB)</span>
                )}
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
                    <YAxis
                      domain={[0, latest?.disk_total_gb ? Math.ceil(Number(latest.disk_total_gb) * 1.05) : "auto"]}
                      tick={{ fontSize: 10 }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      content={
                        <AbsoluteTooltip usedKey="disk_used_gb" totalKey="disk_total_gb" unit="GB" percentKey="disk_percent" />
                      }
                      labelFormatter={(v) => v}
                    />
                    {latest?.disk_total_gb && (
                      <ReferenceLine
                        y={Number(latest.disk_total_gb)}
                        stroke="hsl(25, 95%, 53%)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        label={{ value: "Total", position: "right", fontSize: 9, fill: "hsl(25, 95%, 53%)" }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="disk_used_gb"
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
          )}

          {/* Network Charts — one per interface or single legacy */}
          {hasMultiInterfaces ? (
            interfaceNames.map((ifaceName) => {
              const ifaceData = buildInterfaceData(metrics, ifaceName);
              const linkSpeed = getInterfaceSpeed(metrics, ifaceName);
              return (
                <div key={ifaceName} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Network className="w-3 h-3" /> Rede — {ifaceName}
                    {linkSpeed != null && (
                      <span className="text-muted-foreground/70">({formatLinkSpeed(linkSpeed)})</span>
                    )}
                  </p>
                  <div className="h-48 w-full">
                    {ifaceData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ifaceData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="time" tickFormatter={timeFmt} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                          <YAxis tickFormatter={(v: number) => formatBytes(Math.abs(v)).replace("/s", "")} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                          <Tooltip content={<NetworkTooltip />} labelFormatter={(v) => v} />
                          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                          <Area type="monotone" dataKey="sentRate" stroke="hsl(262, 83%, 58%)" fill="hsl(262, 83%, 58%)" fillOpacity={0.15} strokeWidth={1.5} dot={false} name="Enviado" />
                          <Area type="monotone" dataKey="recvRateNeg" stroke="hsl(173, 80%, 40%)" fill="hsl(173, 80%, 40%)" fillOpacity={0.15} strokeWidth={1.5} dot={false} name="Recebido" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        Dados insuficientes para {ifaceName}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Network className="w-3 h-3" /> Rede
              </p>
              <div className="h-48 w-full">
                {legacyNetworkData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={legacyNetworkData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="time" tickFormatter={timeFmt} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tickFormatter={(v: number) => formatBytes(Math.abs(v)).replace("/s", "")} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <Tooltip content={<NetworkTooltip />} labelFormatter={(v) => v} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                      <Area type="monotone" dataKey="sentRate" stroke="hsl(262, 83%, 58%)" fill="hsl(262, 83%, 58%)" fillOpacity={0.15} strokeWidth={1.5} dot={false} name="Enviado" />
                      <Area type="monotone" dataKey="recvRateNeg" stroke="hsl(173, 80%, 40%)" fill="hsl(173, 80%, 40%)" fillOpacity={0.15} strokeWidth={1.5} dot={false} name="Recebido" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Dados insuficientes para calcular taxa de transferência
                  </div>
                )}
              </div>
            </div>
          )}
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
