import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Mail, Info } from 'lucide-react';
import { M365Insight, SEVERITY_LABELS } from '@/types/m365Insights';
import { cn } from '@/lib/utils';

interface M365AffectedEntitiesDialogProps {
  insight: M365Insight;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  info: 'bg-muted/50 text-muted-foreground border-muted',
};

export function M365AffectedEntitiesDialog({ insight, open, onOpenChange }: M365AffectedEntitiesDialogProps) {
  const remaining = insight.affectedCount - insight.affectedEntities.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-mono">{insight.code}</Badge>
            <Badge className={cn('text-xs border', SEVERITY_BADGE[insight.severity])}>
              {SEVERITY_LABELS[insight.severity]}
            </Badge>
          </div>
          <DialogTitle className="text-base">{insight.titulo}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Users className="w-4 h-4" />
          <span>{insight.affectedCount} {insight.affectedCount === 1 ? 'item afetado' : 'itens afetados'}</span>
        </div>

        <ScrollArea className="max-h-[360px] pr-2">
          <div className="space-y-2">
            {insight.affectedEntities.map((entity) => (
              <div
                key={entity.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground truncate">{entity.displayName}</p>
                  {entity.userPrincipalName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{entity.userPrincipalName}</span>
                    </div>
                  )}
                  {entity.details && Object.keys(entity.details).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(entity.details).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-[10px] font-normal">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {remaining > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <Info className="w-3.5 h-3.5" />
            <span>e mais {remaining} {remaining === 1 ? 'entidade' : 'entidades'} não listadas</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
