import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ShieldAlert, KeyRound, Globe, AlertTriangle, Search, Activity,
} from 'lucide-react';
import type { M365AnalyzerMetrics } from '@/types/m365AnalyzerInsights';

interface KPIItem {
  label: string;
  value: number;
  icon: React.ElementType;
  threshold: { warn: number; critical: number };
}

function getColor(value: number, t: { warn: number; critical: number }): string {
  if (value >= t.critical) return 'text-rose-400';
  if (value >= t.warn) return 'text-orange-400';
  if (value > 0) return 'text-warning';
  return 'text-emerald-400';
}

function getBg(value: number, t: { warn: number; critical: number }): string {
  if (value >= t.critical) return 'border-rose-500/30 bg-rose-500/5';
  if (value >= t.warn) return 'border-orange-500/30 bg-orange-500/5';
  if (value > 0) return 'border-warning/30 bg-warning/5';
  return 'border-emerald-500/20 bg-emerald-500/5';
}

interface Props {
  metrics: M365AnalyzerMetrics;
}

export function AnalyzerKPIRow({ metrics }: Props) {
  const kpis: KPIItem[] = [
    { label: 'Logins de Risco', value: metrics.securityRisk.highRiskSignIns, icon: ShieldAlert, threshold: { warn: 5, critical: 20 } },
    { label: 'Falhas MFA', value: metrics.securityRisk.mfaFailures, icon: KeyRound, threshold: { warn: 10, critical: 50 } },
    { label: 'Viagem Impossível', value: metrics.securityRisk.impossibleTravel, icon: Send, threshold: { warn: 1, critical: 3 } },
    { label: 'Alertas Correlac.', value: metrics.compromise.correlatedAlerts, icon: UserX, threshold: { warn: 2, critical: 5 } },
    { label: 'Logins Suspeitos', value: metrics.compromise.suspiciousLogins, icon: Search, threshold: { warn: 3, critical: 10 } },
    { label: 'Usuários Anômalos', value: metrics.behavioral.anomalousUsers, icon: Activity, threshold: { warn: 2, critical: 5 } },
  ];

  const allZero = kpis.every(k => k.value === 0);
  if (allZero) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {kpis.map((kpi) => {
        const color = getColor(kpi.value, kpi.threshold);
        const bg = getBg(kpi.value, kpi.threshold);
        return (
          <Card key={kpi.label} className={cn('glass-card border transition-all', bg)}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <kpi.icon className={cn('w-4 h-4 shrink-0', color)} />
              <div className="min-w-0">
                <p className={cn('text-lg font-bold leading-none', color)}>{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
