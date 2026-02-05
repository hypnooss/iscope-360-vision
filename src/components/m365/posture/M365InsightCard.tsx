import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wrench,
  ExternalLink,
  Users
} from 'lucide-react';
import { M365Insight, SEVERITY_LABELS, PRODUCT_LABELS } from '@/types/m365Insights';
import { M365RemediationDialog } from './M365RemediationDialog';

interface M365InsightCardProps {
  insight: M365Insight;
}

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; border: string }> = {
  critical: {
    icon: AlertTriangle,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  medium: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  low: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  info: {
    icon: Info,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    border: 'border-muted',
  },
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  pass: { icon: CheckCircle2, color: 'text-primary' },
  fail: { icon: AlertTriangle, color: 'text-rose-400' },
  warning: { icon: AlertCircle, color: 'text-warning' },
};

export function M365InsightCard({ insight }: M365InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRemediation, setShowRemediation] = useState(false);

  const severityConfig = SEVERITY_CONFIG[insight.severity];
  const statusConfig = STATUS_CONFIG[insight.status];
  const SeverityIcon = severityConfig.icon;
  const StatusIcon = statusConfig.icon;

  const isFailed = insight.status === 'fail';

  return (
    <>
      <Card className={cn(
        'glass-card border transition-all duration-200',
        isFailed ? severityConfig.border : 'border-primary/30'
      )}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded', isFailed ? severityConfig.bg : 'bg-primary/10')}>
                {isFailed ? (
                  <SeverityIcon className={cn('w-4 h-4', severityConfig.color)} />
                ) : (
                  <StatusIcon className={cn('w-4 h-4', statusConfig.color)} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn('text-xs font-mono', isFailed ? severityConfig.color : 'text-primary')}
                  >
                    {insight.code}
                  </Badge>
                  {isFailed && (
                    <Badge className={cn('text-xs', severityConfig.bg, severityConfig.color, 'border-0')}>
                      {SEVERITY_LABELS[insight.severity]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {PRODUCT_LABELS[insight.product]}
            </Badge>
          </div>

          {/* Title and Description */}
          <h4 className="font-semibold text-foreground mb-2">{insight.titulo}</h4>
          <p className="text-sm text-muted-foreground mb-3">{insight.descricaoExecutiva}</p>

          {/* Affected count */}
          {insight.affectedCount > 0 && isFailed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="w-4 h-4" />
              <span>{insight.affectedCount} {insight.affectedCount === 1 ? 'item afetado' : 'itens afetados'}</span>
            </div>
          )}

          {/* Expandable section */}
          {isFailed && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground hover:text-foreground"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <span>Detalhes técnicos</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  {insight.riscoTecnico && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Risco Técnico</p>
                      <p className="text-sm text-foreground">{insight.riscoTecnico}</p>
                    </div>
                  )}
                  {insight.impactoNegocio && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Impacto no Negócio</p>
                      <p className="text-sm text-foreground">{insight.impactoNegocio}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Actions */}
          {isFailed && insight.remediacao && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => setShowRemediation(true)}
              >
                <Wrench className="w-4 h-4 mr-2" />
                Como Corrigir
              </Button>
              {insight.remediacao.portalUrl && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  asChild
                >
                  <a href={insight.remediacao.portalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <M365RemediationDialog
        insight={insight}
        open={showRemediation}
        onOpenChange={setShowRemediation}
      />
    </>
  );
}
