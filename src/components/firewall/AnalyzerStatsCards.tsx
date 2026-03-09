import { Activity, Shield, ShieldAlert, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { AnalyzerSnapshot } from '@/types/analyzerInsights';

interface AnalyzerStatsCardsProps {
  snapshot: AnalyzerSnapshot;
}

export function AnalyzerStatsCards({ snapshot }: AnalyzerStatsCardsProps) {
  const metrics = snapshot.metrics;
  const totalEvents = metrics.totalEvents || 0;
  const totalDenied = metrics.totalDenied || 0;
  const authSuccesses = (metrics.firewallAuthSuccesses || 0) + (metrics.vpnSuccesses || 0);
  const authFailures = (metrics.firewallAuthFailures || 0) + (metrics.vpnFailures || 0);
  const totalAuth = authSuccesses + authFailures;

  const blockRate = totalEvents > 0 ? ((totalDenied / totalEvents) * 100).toFixed(1) : '0.0';
  const authSuccessRate = totalAuth > 0 ? ((authSuccesses / totalAuth) * 100).toFixed(0) : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Eventos Totais */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Eventos Totais</p>
              <p className="text-3xl font-bold">{totalEvents.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <Activity className="w-6 h-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Bloqueio */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Taxa de Bloqueio</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">{blockRate}%</p>
                <p className="text-xs text-muted-foreground">({totalDenied.toLocaleString()})</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10">
              <ShieldAlert className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autenticações */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Autenticações</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">{totalAuth.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{authSuccessRate}% OK</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10">
              <Shield className="w-6 h-6 text-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score de Segurança */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Score de Segurança</p>
              <p className="text-3xl font-bold">{snapshot.score || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
