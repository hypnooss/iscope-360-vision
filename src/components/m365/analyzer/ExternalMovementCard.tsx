import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  AlertOctagon, AlertTriangle, Shield, Eye, Users, Activity,
  Lightbulb, Sparkles, TrendingUp,
} from 'lucide-react';
import type { ExternalMovementAlert } from '@/types/externalMovement';
import { riskScoreLabel } from '@/types/externalMovement';

const SEV_CFG = {
  critical: { label: 'Critical', icon: AlertOctagon, border: 'border-rose-500/40', bg: 'bg-rose-500/10', text: 'text-rose-400', glow: 'shadow-[0_0_12px_hsl(350_70%_50%/0.15)]' },
  high: { label: 'High', icon: AlertTriangle, border: 'border-orange-500/40', bg: 'bg-orange-500/10', text: 'text-orange-400', glow: '' },
  medium: { label: 'Medium', icon: Shield, border: 'border-warning/40', bg: 'bg-warning/10', text: 'text-warning', glow: '' },
} as const;

interface Props {
  alert: ExternalMovementAlert;
  compact?: boolean;
}

export function ExternalMovementCard({ alert, compact }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const sev = SEV_CFG[alert.severity] ?? SEV_CFG.medium;
  const isCritical = alert.severity === 'critical';
  const risk = riskScoreLabel(alert.risk_score);

  return (
    <>
      <Card className={cn(
        'glass-card border transition-all',
        sev.border,
        isCritical && sev.glow,
        isCritical && 'bg-rose-500/5',
      )}>
        <CardContent className={cn('space-y-1.5', compact ? 'p-2' : 'p-3')}>
          {/* Row 1: Title + severity */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <sev.icon className={cn('w-4 h-4 shrink-0', sev.text, isCritical && 'animate-pulse')} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h4 className="text-sm font-semibold text-foreground truncate cursor-default">{alert.title}</h4>
                  </TooltipTrigger>
                  {alert.description && (
                    <TooltipContent side="top" className="max-w-xs text-xs">{alert.description}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge variant="outline" className={cn(
              'shrink-0 border',
              sev.bg, sev.text, sev.border,
              isCritical ? 'text-sm font-bold' : 'text-[10px]',
            )}>
              {sev.label}
            </Badge>
          </div>

          {/* Row 2: Metrics */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {alert.user_id}
            </span>
            {alert.z_score !== null && alert.z_score !== undefined && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Z: {alert.z_score.toFixed(1)}
              </span>
            )}
            {alert.is_new && (
              <Badge variant="secondary" className="text-[10px] h-4">Novo</Badge>
            )}
            {alert.is_anomalous && (
              <Badge variant="outline" className="text-[10px] h-4 border-rose-500/40 text-rose-400">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />Anômalo
              </Badge>
            )}
            {/* Risk Score */}
            <span className={cn('font-mono font-bold text-[10px]', risk.color)}>
              Risk: {alert.risk_score}
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-primary/70 cursor-help">
                    <Lightbulb className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {alert.description || 'Sem informações adicionais'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Row 3: Details button */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2" onClick={() => setDetailOpen(true)}>
              <Eye className="w-3 h-3" /> Detalhes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', sev.bg)}>
                <sev.icon className={cn('w-5 h-5', sev.text)} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={cn('text-xs', sev.bg, sev.text, sev.border)}>{sev.label}</Badge>
                  <Badge variant="secondary" className="text-xs">Risk: {alert.risk_score}/100</Badge>
                </div>
                <DialogTitle className="text-lg">{alert.title}</DialogTitle>
              </div>
            </div>
            <DialogDescription className="mt-2">
              {alert.description || 'Sem descrição disponível.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 py-4 -mx-6 px-6">
            {/* User */}
            <div className="p-3 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground">Usuário</span>
              <p className="font-medium text-sm">{alert.user_id}</p>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {alert.z_score !== null && (
                <div className="p-2 rounded-lg bg-muted/30 text-sm">
                  <span className="text-muted-foreground text-xs">Z-Score</span>
                  <p className="font-bold">{alert.z_score?.toFixed(2)}</p>
                </div>
              )}
              {alert.pct_increase !== null && (
                <div className="p-2 rounded-lg bg-muted/30 text-sm">
                  <span className="text-muted-foreground text-xs">Aumento %</span>
                  <p className="font-bold">{alert.pct_increase?.toFixed(0)}%</p>
                </div>
              )}
              <div className="p-2 rounded-lg bg-muted/30 text-sm">
                <span className="text-muted-foreground text-xs">Risk Score</span>
                <p className={cn('font-bold', risk.color)}>{alert.risk_score}/100</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-sm">
                <span className="text-muted-foreground text-xs">Tipo</span>
                <p className="font-medium">{alert.alert_type}</p>
              </div>
            </div>

            {/* Affected domains */}
            {alert.affected_domains && alert.affected_domains.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Domínios Afetados</h4>
                <div className="flex flex-wrap gap-1">
                  {alert.affected_domains.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence */}
            {alert.evidence && Object.keys(alert.evidence).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Evidências</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(alert.evidence).map(([key, value]) => (
                    <div key={key} className="p-2 rounded-lg bg-muted/30 text-sm">
                      <span className="text-muted-foreground text-xs">{key}</span>
                      <p className="font-medium truncate">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
