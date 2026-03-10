import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/types/m365Insights';
import type { M365AnalyzerInsight } from '@/types/m365AnalyzerInsights';
import { AlertTriangle, AlertCircle, Info, Shield, Users } from 'lucide-react';

interface EntraIdSecurityInsightCardsProps {
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

export function EntraIdSecurityInsightCards({ insights, loading }: EntraIdSecurityInsightCardsProps) {
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
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] px-1.5 py-0 shrink-0', sevConfig?.color)}
                  >
                    {sevConfig?.label ?? insight.severity}
                  </Badge>
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
                  {insight.metadata && Object.entries(insight.metadata).map(([key, value]) => {
                    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
                      return (
                        <div key={key} className="bg-secondary/30 p-2 rounded text-xs">
                          <div className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</div>
                          <div className="font-bold text-sm">{String(value)}</div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0">
          {selectedInsight && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0 bg-secondary">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">{selectedInsight.name}</SheetTitle>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5 py-0', SEVERITY_CONFIG[selectedInsight.severity]?.color)}
                      >
                        {SEVERITY_CONFIG[selectedInsight.severity]?.label ?? selectedInsight.severity}
                      </Badge>
                      {selectedInsight.count != null && selectedInsight.count > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {selectedInsight.count} ocorrência(s)
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-140px)]">
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    {selectedInsight.count != null && selectedInsight.count > 0 && (
                      <div className="bg-secondary/30 p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground">Ocorrências</div>
                        <div className="font-bold text-lg">{selectedInsight.count}</div>
                      </div>
                    )}
                    {selectedInsight.affectedUsers && selectedInsight.affectedUsers.length > 0 && (
                      <div className="bg-secondary/30 p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground">Usuários Afetados</div>
                        <div className="font-bold text-lg">{selectedInsight.affectedUsers.length}</div>
                      </div>
                    )}
                    {selectedInsight.metadata && Object.entries(selectedInsight.metadata).map(([key, value]) => {
                      if (key === 'businessImpact') return null;
                      if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '')) {
                        return (
                          <div key={key} className="bg-secondary/30 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</div>
                            <div className="font-bold text-lg">{String(value)}</div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {selectedInsight.description && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">🎯 O que está acontecendo?</p>
                      <p className="text-sm">{selectedInsight.description}</p>
                    </div>
                  )}

                  {selectedInsight.details && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">❓ Por que isso é um risco?</p>
                      <p className="text-sm">{selectedInsight.details}</p>
                    </div>
                  )}

                  {selectedInsight.recommendation && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">✅ Boas práticas recomendadas</p>
                      <ul className="space-y-1 mt-1">
                        {selectedInsight.recommendation
                          .split(/(?:\. |\n|; )/)
                          .filter(s => s.trim().length > 0)
                          .map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-primary shrink-0">•</span>
                              <span>{item.trim().replace(/\.$/, '')}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {(() => {
                    const impact = selectedInsight.metadata?.businessImpact as string | undefined;
                    const fallback: Record<string, string> = {
                      critical: 'Risco crítico com potencial de impacto imediato nas operações e segurança da organização.',
                      high: 'Risco elevado que pode comprometer a segurança e continuidade operacional.',
                      medium: 'Risco moderado que requer atenção para evitar degradação da postura de segurança.',
                      low: 'Risco baixo, mas que deve ser monitorado para manter a conformidade.',
                    };
                    const text = impact || fallback[selectedInsight.severity];
                    return text ? (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">💼 Impacto no negócio</p>
                        <p className="text-sm text-muted-foreground">{text}</p>
                      </div>
                    ) : null;
                  })()}

                  {selectedInsight.affectedUsers && selectedInsight.affectedUsers.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        👥 Usuários Afetados ({selectedInsight.affectedUsers.length})
                      </p>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {selectedInsight.affectedUsers.map((user, i) => (
                          <div key={i} className="bg-secondary/30 p-2 rounded text-xs font-medium">
                            {user}
                          </div>
                        ))}
                      </div>
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
