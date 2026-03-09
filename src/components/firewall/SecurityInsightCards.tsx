import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirewallSecurityInsights } from '@/hooks/useFirewallSecurityInsights';
import { useComplianceCorrelatedInsights } from '@/hooks/useComplianceCorrelatedInsights';
import { FIREWALL_INSIGHT_SEVERITY_CONFIG } from '@/types/firewallSecurityInsights';
import type { AnalyzerSnapshot } from '@/types/analyzerInsights';
import type { FirewallSecurityInsight } from '@/types/firewallSecurityInsights';
import * as LucideIcons from 'lucide-react';

interface SecurityInsightCardsProps {
  snapshot: AnalyzerSnapshot;
}

export function SecurityInsightCards({ snapshot }: SecurityInsightCardsProps) {
  const trafficInsights = useFirewallSecurityInsights(snapshot);
  const { insights: complianceInsights } = useComplianceCorrelatedInsights(snapshot, snapshot.firewall_id);
  const [selectedInsight, setSelectedInsight] = useState<FirewallSecurityInsight | null>(null);

  // Combine and sort by severity priority
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const allInsights: FirewallSecurityInsight[] = [
    ...complianceInsights,
    ...trafficInsights.map(i => ({ ...i, source: 'traffic' as const })),
  ].sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  if (allInsights.length === 0) return null;

  const complianceCount = complianceInsights.length;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Insights de Segurança
        </h2>
        <div className="flex items-center gap-2">
          {complianceCount > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">
              <Link2 className="w-3 h-3 mr-1" />
              {complianceCount} correlação{complianceCount > 1 ? 'ões' : ''}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {allInsights.length} {allInsights.length === 1 ? 'insight' : 'insights'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {allInsights.map(insight => {
          const severityConfig = FIREWALL_INSIGHT_SEVERITY_CONFIG[insight.severity];
          const IconComponent = (LucideIcons as any)[insight.icon] || LucideIcons.Shield;
          const isCorrelation = insight.source === 'compliance_correlation';

          return (
            <Card
              key={insight.id}
              className={cn(
                "border-l-4 cursor-pointer transition-all hover:shadow-md",
                severityConfig.borderColor
              )}
              onClick={() => setSelectedInsight(insight)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <IconComponent className="w-5 h-5 shrink-0" />
                    <CardTitle className="text-sm font-semibold">{insight.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCorrelation && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-500 border-amber-500/30"
                      >
                        <Link2 className="w-2.5 h-2.5 mr-0.5" />
                        {insight.complianceCode?.toUpperCase()}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        severityConfig.badgeClass
                      )}
                    >
                      {severityConfig.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2">
                  {insight.metrics.map((m, i) => (
                    <div key={i} className="bg-secondary/30 p-2 rounded text-xs">
                      <div className="text-muted-foreground">{m.label}</div>
                      <div className="font-bold text-sm">{m.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sheet lateral de detalhes */}
      <InsightDetailSheet
        insight={selectedInsight}
        onClose={() => setSelectedInsight(null)}
      />
    </div>
  );
}

function InsightDetailSheet({
  insight,
  onClose,
}: {
  insight: FirewallSecurityInsight | null;
  onClose: () => void;
}) {
  if (!insight) return <Sheet open={false} onOpenChange={() => {}} />;

  const severityConfig = FIREWALL_INSIGHT_SEVERITY_CONFIG[insight.severity];
  const IconComponent = (LucideIcons as any)[insight.icon] || LucideIcons.Shield;
  const isCorrelation = insight.source === 'compliance_correlation';

  return (
    <Sheet open={!!insight} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg shrink-0 bg-secondary">
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg">{insight.title}</SheetTitle>
              <div className="flex items-center gap-1.5 mt-1">
                {isCorrelation && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/30"
                  >
                    <Link2 className="w-3 h-3 mr-0.5" />
                    {insight.complianceCode?.toUpperCase()}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", severityConfig.badgeClass)}
                >
                  {severityConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-6 space-y-5">
            {/* Métricas */}
            <div className="grid grid-cols-2 gap-3">
              {insight.metrics.map((m, i) => (
                <div key={i} className="bg-secondary/30 p-3 rounded-lg">
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className="font-bold text-lg">{m.value}</div>
                </div>
              ))}
            </div>

            {isCorrelation && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3">
                <p className="text-xs text-amber-500 font-medium">
                  🔗 Correlação: Configuração em falha ({insight.complianceCode?.toUpperCase()}) + evidência de tráfego do Analyzer
                </p>
              </div>
            )}

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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
