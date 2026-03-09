import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirewallSecurityInsights } from '@/hooks/useFirewallSecurityInsights';
import { FIREWALL_INSIGHT_SEVERITY_CONFIG } from '@/types/firewallSecurityInsights';
import type { AnalyzerSnapshot } from '@/types/analyzerInsights';
import * as LucideIcons from 'lucide-react';

interface SecurityInsightCardsProps {
  snapshot: AnalyzerSnapshot;
}

export function SecurityInsightCards({ snapshot }: SecurityInsightCardsProps) {
  const insights = useFirewallSecurityInsights(snapshot);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          💡 Insights de Segurança
        </h2>
        <Badge variant="outline" className="text-xs">
          {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.map(insight => {
          const severityConfig = FIREWALL_INSIGHT_SEVERITY_CONFIG[insight.severity];
          const IconComponent = (LucideIcons as any)[insight.icon] || LucideIcons.Shield;
          const isExpanded = expandedId === insight.id;

          return (
            <Collapsible
              key={insight.id}
              open={isExpanded}
              onOpenChange={() => setExpandedId(isExpanded ? null : insight.id)}
            >
              <Card
                className={cn(
                  "border-l-4 cursor-pointer transition-all hover:shadow-md",
                  severityConfig.borderColor
                )}
              >
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <IconComponent className="w-5 h-5 shrink-0" />
                        <CardTitle className="text-sm font-semibold">{insight.title}</CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 shrink-0",
                          severityConfig.badgeClass
                        )}
                      >
                        {severityConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CardContent className="space-y-3 pt-0">
                  {/* Métricas (sempre visível) */}
                  <div className="grid grid-cols-2 gap-2">
                    {insight.metrics.map((m, i) => (
                      <div key={i} className="bg-secondary/30 p-2 rounded text-xs">
                        <div className="text-muted-foreground">{m.label}</div>
                        <div className="font-bold text-sm">{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Detalhes expandidos */}
                  <CollapsibleContent>
                    <div className="space-y-3 pt-2 border-t animate-in fade-in slide-in-from-top-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">🎯 O que está acontecendo?</p>
                        <p className="text-sm">{insight.what}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">❓ Por que isso é um risco?</p>
                        <p className="text-sm">{insight.why}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">✅ Boas práticas recomendadas:</p>
                        <ul className="space-y-1">
                          {insight.bestPractice.map((bp, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-primary shrink-0">•</span>
                              <span>{bp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">💼 Impacto no negócio:</p>
                        <p className="text-sm text-muted-foreground">{insight.businessImpact}</p>
                      </div>
                    </div>
                  </CollapsibleContent>

                  {/* Indicador de expansão */}
                  <CollapsibleTrigger className="w-full">
                    <div className="flex justify-center pt-1">
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>
                  </CollapsibleTrigger>
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
