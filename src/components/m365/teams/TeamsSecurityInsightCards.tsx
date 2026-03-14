import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/types/m365Insights';
import type { M365AnalyzerInsight } from '@/types/m365AnalyzerInsights';
import { AlertTriangle, AlertCircle, Info, Shield } from 'lucide-react';
import { DataSourceDot } from '@/components/m365/shared';
import { IncidentDetailSheet } from '@/components/m365/analyzer/IncidentDetailSheet';

interface TeamsSecurityInsightCardsProps {
  insights: M365AnalyzerInsight[];
  loading?: boolean;
}

const severityIcons: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
  info: Info,
};

const severityBorderColors: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
  info: 'border-l-slate-500',
};

export function TeamsSecurityInsightCards({ insights, loading }: TeamsSecurityInsightCardsProps) {
  const [selectedInsight, setSelectedInsight] = useState<M365AnalyzerInsight | null>(null);

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sorted = [...insights].sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

  if (loading || sorted.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Insights de Segurança
        </h2>
        <Badge variant="outline" className="text-xs">
          {sorted.length} {sorted.length === 1 ? 'insight' : 'insights'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map(insight => {
          const sevConfig = SEVERITY_CONFIG[insight.severity];
          const Icon = severityIcons[insight.severity] || Shield;

          return (
            <Card
              key={insight.id}
              className={cn(
                'border-l-4 cursor-pointer transition-all hover:shadow-md',
                severityBorderColors[insight.severity]
              )}
              onClick={() => setSelectedInsight(insight)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Icon className="w-5 h-5 shrink-0" />
                    <CardTitle className="text-sm font-semibold">{insight.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sevConfig?.color)}>
                      {sevConfig?.label ?? insight.severity}
                    </Badge>
                    <DataSourceDot source="analyzed" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2">
                  {insight.count != null && insight.count > 0 && (
                    <div className="bg-secondary/30 p-2 rounded text-xs">
                      <div className="text-muted-foreground">Ocorrências</div>
                      <div className="font-bold text-sm">{insight.count}</div>
                    </div>
                  )}
                  {insight.affectedUsers && insight.affectedUsers.length > 0 && (
                    <div className="bg-secondary/30 p-2 rounded text-xs">
                      <div className="text-muted-foreground">Usuários Afetados</div>
                      <div className="font-bold text-sm">{insight.affectedUsers.length}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <IncidentDetailSheet
        insight={selectedInsight}
        open={!!selectedInsight}
        onOpenChange={(open) => !open && setSelectedInsight(null)}
      />
    </div>
  );
}
