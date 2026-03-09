import { Mail, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExchangeInsight } from '@/hooks/useExchangeOnlineInsights';
import { M365RiskCategory, CATEGORY_LABELS } from '@/types/m365Insights';

interface ExchangeAnalyzerCategoryGridProps {
  insights: ExchangeInsight[];
  onCategoryClick: (category: M365RiskCategory) => void;
}

const EXCHANGE_CATEGORIES: { category: M365RiskCategory; icon: React.ElementType; color: string }[] = [
  { category: 'email_exchange', icon: Mail, color: 'text-indigo-500' },
  { category: 'threats_activity', icon: AlertTriangle, color: 'text-red-500' },
  { category: 'pim_governance', icon: ShieldCheck, color: 'text-orange-500' },
];

export function ExchangeAnalyzerCategoryGrid({ insights, onCategoryClick }: ExchangeAnalyzerCategoryGridProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Panorama por Categoria
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {EXCHANGE_CATEGORIES.map(({ category, icon: Icon, color }) => {
          const catInsights = insights.filter(i => i.category === category);
          const critical = catInsights.filter(i => i.severity === 'critical').length;
          const high = catInsights.filter(i => i.severity === 'high').length;
          const medium = catInsights.filter(i => i.severity === 'medium').length;
          const fail = catInsights.filter(i => i.status === 'fail').length;
          const total = catInsights.length;

          const severity = critical > 0 ? 'critical' : high > 0 ? 'high' : medium > 0 ? 'medium' : fail > 0 ? 'low' : 'none';
          const borderColor = {
            critical: 'border-red-500/50',
            high: 'border-orange-500/50',
            medium: 'border-amber-500/50',
            low: 'border-blue-500/50',
            none: 'border-border/50',
          }[severity];

          return (
            <Card
              key={category}
              className={cn('glass-card cursor-pointer hover:shadow-md transition-all', borderColor)}
              onClick={() => onCategoryClick(category)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Icon className={cn('w-5 h-5', color)} />
                  <span className="font-semibold text-sm text-foreground">{CATEGORY_LABELS[category]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{total}</span>
                  <div className="flex gap-1.5">
                    {critical > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-500 border-red-500/30">
                        {critical} Crítico
                      </Badge>
                    )}
                    {high > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-500 border-orange-500/30">
                        {high} Alto
                      </Badge>
                    )}
                    {medium > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-500 border-amber-500/30">
                        {medium} Médio
                      </Badge>
                    )}
                  </div>
                </div>
                {fail > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{fail} em falha</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
