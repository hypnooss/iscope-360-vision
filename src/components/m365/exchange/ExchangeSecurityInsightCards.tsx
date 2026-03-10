import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/types/m365Insights';
import type { M365AnalyzerInsight } from '@/types/m365AnalyzerInsights';
import { AlertTriangle, AlertCircle, Info, Shield, Mail, Lightbulb, Users } from 'lucide-react';

interface ExchangeSecurityInsightCardsProps {
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

export function ExchangeSecurityInsightCards({ insights, loading }: ExchangeSecurityInsightCardsProps) {
  const [selectedInsight, setSelectedInsight] = useState<M365AnalyzerInsight | null>(null);

  // Sort by severity
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
                <p className="text-xs text-muted-foreground line-clamp-2">{insight.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  {insight.count != null && insight.count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {insight.count} ocorrência(s)
                    </span>
                  )}
                  {insight.affectedUsers && insight.affectedUsers.length > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {insight.affectedUsers.length} usuário(s)
                    </span>
                  )}
                </div>
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

                  {/* Metadata / Evidence */}
                  {selectedInsight.metadata && Object.keys(selectedInsight.metadata).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">🔎 Evidências</p>
                      <div className="space-y-2">
                        {Object.entries(selectedInsight.metadata).map(([key, value]) => {
                          if (Array.isArray(value) && value.length > 0) {
                            return (
                              <div key={key}>
                                <p className="text-xs text-muted-foreground mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
                                <div className="space-y-1">
                                  {value.slice(0, 10).map((item, i) => (
                                    <div key={i} className="bg-muted/50 rounded p-2 text-xs">
                                      {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                                    </div>
                                  ))}
                                  {value.length > 10 && (
                                    <p className="text-xs text-muted-foreground">+{value.length - 10} mais...</p>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          if (typeof value === 'object' && value !== null) return null;
                          return (
                            <div key={key} className="flex items-center justify-between bg-muted/50 rounded p-2">
                              <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="text-xs font-medium">{String(value)}</span>
                            </div>
                          );
                        })}
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
