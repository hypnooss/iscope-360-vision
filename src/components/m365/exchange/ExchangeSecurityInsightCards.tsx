import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/types/m365Insights';
import type { ExchangeInsight } from '@/hooks/useExchangeOnlineInsights';
import { AlertTriangle, AlertCircle, Info, Shield, Mail, Lightbulb } from 'lucide-react';

interface ExchangeSecurityInsightCardsProps {
  insights: ExchangeInsight[];
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

export function ExchangeSecurityInsightCards({ insights }: ExchangeSecurityInsightCardsProps) {
  const [selectedInsight, setSelectedInsight] = useState<ExchangeInsight | null>(null);

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const failInsights = insights
    .filter(i => i.status === 'fail' || i.status === 'warn')
    .sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

  if (failInsights.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Insights de Segurança
        </h2>
        <Badge variant="outline" className="text-xs">
          {failInsights.length} {failInsights.length === 1 ? 'insight' : 'insights'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {failInsights.map(insight => {
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
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] px-1.5 py-0 shrink-0', sevConfig.color)}
                  >
                    {sevConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground line-clamp-2">{insight.description}</p>
                {insight.affectedEntities && insight.affectedEntities.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {insight.affectedEntities.length} entidade(s) afetada(s)
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0">
          {selectedInsight && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0 bg-secondary">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">{selectedInsight.name}</SheetTitle>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5 py-0', SEVERITY_CONFIG[selectedInsight.severity].color)}
                      >
                        {SEVERITY_CONFIG[selectedInsight.severity].label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {selectedInsight.status === 'fail' ? 'Em falha' : selectedInsight.status === 'warn' ? 'Alerta' : 'OK'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-140px)]">
                <div className="p-6 space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">📋 Descrição</p>
                    <p className="text-sm">{selectedInsight.description}</p>
                  </div>

                  {selectedInsight.details && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">🔍 Detalhes</p>
                      <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedInsight.details}</p>
                    </div>
                  )}

                  {selectedInsight.technicalRisk && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">⚠️ Risco Técnico</p>
                      <p className="text-sm">{selectedInsight.technicalRisk}</p>
                    </div>
                  )}

                  {selectedInsight.businessImpact && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">💼 Impacto no Negócio</p>
                      <p className="text-sm text-muted-foreground">{selectedInsight.businessImpact}</p>
                    </div>
                  )}

                  {selectedInsight.recommendation && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        Recomendação
                      </p>
                      <p className="text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        {selectedInsight.recommendation}
                      </p>
                    </div>
                  )}

                  {selectedInsight.affectedEntities && selectedInsight.affectedEntities.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        👥 Entidades Afetadas ({selectedInsight.affectedEntities.length})
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {selectedInsight.affectedEntities.map((entity, i) => (
                          <div key={i} className="bg-secondary/30 p-2 rounded text-xs">
                            <span className="font-medium">{entity.name}</span>
                            <span className="text-muted-foreground ml-2">({entity.type})</span>
                            {entity.details && <p className="text-muted-foreground mt-0.5">{entity.details}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedInsight.criteria && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">📐 Critério</p>
                      <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{selectedInsight.criteria}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
