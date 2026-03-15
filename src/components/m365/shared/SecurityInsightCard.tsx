import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/types/m365Insights';
import { M365_ANALYZER_CATEGORY_LABELS } from '@/types/m365AnalyzerInsights';
import type { M365AnalyzerInsight } from '@/types/m365AnalyzerInsights';
import {
  AlertTriangle, AlertCircle, Info, Shield, CheckCircle2,
  TrendingUp, TrendingDown, Users, Hash, Tag, MinusCircle,
} from 'lucide-react';
import { DataSourceDot } from './DataSourceDot';
import { IncidentDetailSheet } from '@/components/m365/analyzer/IncidentDetailSheet';

// ─── Config ──────────────────────────────────────────────────────────────────

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
  info: 'border-l-slate-400',
};

const severityBadgeStyles: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  info: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const trendIcons: Record<string, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
};

const trendStyles: Record<string, string> = {
  up: 'bg-red-500/15 text-red-400 border-red-500/30',
  down: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface SecurityInsightCardsProps {
  insights: M365AnalyzerInsight[];
  loading?: boolean;
  title?: string;
}

// ─── N/A Detection ───────────────────────────────────────────────────────────

function isNAInsight(insight: M365AnalyzerInsight): boolean {
  if (insight.status === 'pass' || insight.status === 'not_applicable') return false;
  if (insight.status === 'not_applicable') return true;
  const name = insight.name.toLowerCase();
  const configKeywords = ['desabilitado', 'disabled', 'configuração', 'configuracao', 'policy', 'habilitado', 'enabled'];
  if (configKeywords.some(kw => name.includes(kw))) return true;
  if ((insight.count === undefined || insight.count === 0) && (!insight.affectedUsers || insight.affectedUsers.length === 0)) return true;
  return false;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SecurityInsightCards({ insights, loading, title = 'Insights de Segurança' }: SecurityInsightCardsProps) {
  const [selectedInsight, setSelectedInsight] = useState<M365AnalyzerInsight | null>(null);

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

  // Classify insights into fail, pass, NA
  const failInsights = insights
    .filter(i => i.status !== 'pass' && !isNAInsight(i))
    .sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));
  const passInsights = insights.filter(i => i.status === 'pass');
  const naInsights = insights.filter(i => i.status !== 'pass' && isNAInsight(i));
  const sorted = [...failInsights, ...passInsights, ...naInsights];

  const failCount = failInsights.length;
  const passCount = passInsights.length;
  const naCount = naInsights.length;

  if (loading || sorted.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {failCount > 0 && (
            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
              {failCount} {failCount === 1 ? 'alerta' : 'alertas'}
            </Badge>
          )}
          {passCount > 0 && (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              {passCount} OK
            </Badge>
          )}
          {naCount > 0 && (
            <Badge variant="outline" className="text-xs bg-slate-500/10 text-slate-400 border-slate-500/30">
              {naCount} N/A
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {sorted.map(insight => {
          const isPass = insight.status === 'pass';
          const sevConfig = SEVERITY_CONFIG[insight.severity];
          const Icon = isPass ? CheckCircle2 : (severityIcons[insight.severity] || Shield);
          const borderColor = isPass ? 'border-l-emerald-500' : severityBorderColors[insight.severity];
          const categoryLabel = M365_ANALYZER_CATEGORY_LABELS[insight.category];
          const trend = insight.metadata?.trend as string | undefined;
          const TrendIcon = trend ? trendIcons[trend] : undefined;

          return (
            <Card
              key={insight.id}
              className={cn(
                'border-l-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]',
                borderColor,
                isPass && 'opacity-80 hover:opacity-100'
              )}
              onClick={() => setSelectedInsight(insight)}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon className={cn(
                      'w-4 h-4 shrink-0 mt-0.5',
                      isPass ? 'text-emerald-400' : sevConfig?.color
                    )} />
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
                        {insight.name}
                      </CardTitle>
                      {categoryLabel && (
                        <span className="text-[11px] text-muted-foreground mt-0.5 block">
                          {categoryLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <DataSourceDot source="analyzed" />
                </div>
              </CardHeader>

              <CardContent className="pt-0 pb-3 px-4">
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {/* Severity / OK badge */}
                  {isPass ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" />
                      OK
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', severityBadgeStyles[insight.severity])}>
                      {sevConfig?.label ?? insight.severity}
                    </Badge>
                  )}

                  {/* Occurrences */}
                  {!isPass && insight.count != null && insight.count > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/50 text-muted-foreground">
                      <Hash className="w-3 h-3 mr-0.5" />
                      {insight.count} ocorrências
                    </Badge>
                  )}

                  {/* Affected Users */}
                  {!isPass && insight.affectedUsers && insight.affectedUsers.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/50 text-muted-foreground">
                      <Users className="w-3 h-3 mr-0.5" />
                      {insight.affectedUsers.length} usuários
                    </Badge>
                  )}

                  {/* Category */}
                  {categoryLabel && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/50 text-muted-foreground">
                      <Tag className="w-3 h-3 mr-0.5" />
                      {categoryLabel}
                    </Badge>
                  )}

                  {/* Trend */}
                  {!isPass && trend && TrendIcon && (
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', trendStyles[trend])}>
                      <TrendIcon className="w-3 h-3 mr-0.5" />
                      {trend === 'up' ? 'Crescente' : 'Decrescente'}
                    </Badge>
                  )}

                  {/* Metadata numeric values as badges */}
                  {!isPass && insight.metadata && Object.entries(insight.metadata).map(([key, value]) => {
                    if (key === 'trend') return null;
                    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
                      return (
                        <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/50 text-muted-foreground">
                          {key.replace(/_/g, ' ')}: {String(value)}
                        </Badge>
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

      <IncidentDetailSheet
        insight={selectedInsight}
        open={!!selectedInsight}
        onOpenChange={(open) => !open && setSelectedInsight(null)}
      />
    </div>
  );
}
