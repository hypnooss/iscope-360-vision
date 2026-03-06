import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertOctagon, AlertTriangle, Shield, Info,
  Search, Layers, FileText, Wrench, Users, UserX,
  Activity, TrendingUp, TrendingDown, Minus, Lightbulb,
} from 'lucide-react';
import type { M365AnalyzerInsight } from '@/types/m365AnalyzerInsights';

// ─── Severity config ─────────────────────────────────────────────────────────
const SEV_CFG = {
  critical: { label: 'Critical', icon: AlertOctagon, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  high: { label: 'High', icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  medium: { label: 'Medium', icon: Shield, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  low: { label: 'Low', icon: Info, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
} as const;

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, variant = 'default', children }: {
  title: string; icon: typeof FileText; variant?: 'default' | 'warning'; children: React.ReactNode;
}) {
  const styles = variant === 'warning'
    ? { bg: 'bg-warning/10 border-warning/30', icon: 'text-warning' }
    : { bg: 'bg-muted/30 border-border/30', icon: 'text-muted-foreground' };
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Icon className={cn('w-3 h-3', styles.icon)} />
        {title}
      </h5>
      <div className={cn('rounded-md p-3 border', styles.bg)}>
        <p className="text-sm text-foreground whitespace-pre-line">{children}</p>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
interface IncidentDetailSheetProps {
  insight: M365AnalyzerInsight | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncidentDetailSheet({ insight, open, onOpenChange }: IncidentDetailSheetProps) {
  if (!insight) return null;

  const sev = SEV_CFG[insight.severity as keyof typeof SEV_CFG] ?? SEV_CFG.medium;
  const Icon = sev.icon;
  const prevCount = (insight.metadata as any)?.previousCount;
  const hasEvidence = (insight.affectedUsers && insight.affectedUsers.length > 0) ||
    ((insight.metadata as any)?.userDetails?.length > 0) ||
    (insight.metadata && Object.keys(insight.metadata).filter(k => k !== 'previousCount' && k !== 'userDetails').length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-start gap-3">
            <div className={cn('p-2.5 rounded-lg border flex-shrink-0', sev.bg, sev.border)}>
              <Icon className={cn('w-5 h-5', sev.color)} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <SheetTitle className="text-base font-semibold text-foreground leading-tight">
                {insight.name}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn('text-xs', sev.bg, sev.color, sev.border)}>
                  {sev.label}
                </Badge>
                {insight.count !== undefined && insight.count > 0 && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {insight.count} ocorrências
                  </Badge>
                )}
                {insight.affectedUsers && insight.affectedUsers.length > 0 && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    <Users className="w-3 h-3 mr-1" />
                    {insight.affectedUsers.length} usuário{insight.affectedUsers.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {prevCount !== undefined && insight.count !== undefined && (
                  <Badge variant="outline" className={cn('text-xs font-mono',
                    insight.count > prevCount ? 'text-rose-400 border-rose-500/30' :
                    insight.count < prevCount ? 'text-emerald-400 border-emerald-500/30' :
                    'text-muted-foreground border-border'
                  )}>
                    {insight.count > prevCount ? <TrendingUp className="w-3 h-3 mr-0.5" /> :
                     insight.count < prevCount ? <TrendingDown className="w-3 h-3 mr-0.5" /> :
                     <Minus className="w-3 h-3 mr-0.5" />}
                    {insight.count > prevCount ? `+${insight.count - prevCount}` :
                     insight.count < prevCount ? `${insight.count - prevCount}` : '='} vs anterior
                  </Badge>
                )}
                {prevCount === undefined && insight.count !== undefined && insight.count > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Novo</Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="analise" className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-6 h-auto py-0">
            <TabsTrigger value="analise" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs">
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Análise
            </TabsTrigger>
            {hasEvidence && (
              <TabsTrigger value="evidencias" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-xs">
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                Evidências
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab: Análise */}
          <TabsContent value="analise" className="p-6 space-y-4 mt-0">
            <Section title="DESCRIÇÃO" icon={FileText}>
              {insight.description || 'Sem descrição disponível.'}
            </Section>

            {insight.details && (
              <Section title="IMPACTO" icon={FileText} variant="warning">
                {insight.details}
              </Section>
            )}

            {!insight.details && insight.count !== undefined && insight.count > 0 && (
              <Section title="IMPACTO" icon={FileText} variant="warning">
                {`Foram detectadas ${insight.count} ocorrência(s) deste incidente`}
                {insight.affectedUsers && insight.affectedUsers.length > 0
                  ? `, afetando ${insight.affectedUsers.length} usuário(s) da organização.`
                  : '.'}
                {' '}Monitoramento contínuo é recomendado para detectar recorrências.
              </Section>
            )}

            {insight.recommendation && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-primary" />
                  RECOMENDAÇÃO
                </h5>
                <div className="rounded-md p-3 border bg-primary/5 border-primary/20">
                  <p className="text-sm text-foreground">{insight.recommendation}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab: Evidências */}
          {hasEvidence && (
          <TabsContent value="evidencias" className="p-6 space-y-4 mt-0">
              {/* Per-user detail cards (from consolidated insights) */}
              {(insight.metadata as any)?.userDetails && (insight.metadata as any).userDetails.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    DETALHAMENTO POR USUÁRIO
                  </h5>
                  <div className="rounded-md border border-border/50 divide-y divide-border/30">
                    {((insight.metadata as any).userDetails as { user: string; description: string; count: number }[]).map((ud, i) => (
                      <div key={i} className="px-3 py-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground flex items-center gap-2">
                            <UserX className="w-3 h-3 text-muted-foreground shrink-0" />
                            {ud.user}
                          </span>
                          {ud.count > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-mono">{ud.count} ocorrências</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">{ud.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Simple affected users list (fallback when no userDetails) */}
              {insight.affectedUsers && insight.affectedUsers.length > 0 && !(insight.metadata as any)?.userDetails && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    USUÁRIOS AFETADOS
                  </h5>
                  <div className="rounded-md border border-border/50 divide-y divide-border/30">
                    {insight.affectedUsers.map((u, i) => (
                      <div key={i} className="px-3 py-2 text-sm text-foreground flex items-center gap-2">
                        <UserX className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{u}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insight.metadata && Object.keys(insight.metadata).filter(k => k !== 'previousCount' && k !== 'userDetails').length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-muted-foreground" />
                    DETALHES ADICIONAIS
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(insight.metadata)
                      .filter(([k]) => k !== 'previousCount' && k !== 'userDetails')
                      .map(([key, value]) => (
                        <div key={key} className="p-2.5 rounded-md border border-border/50 bg-muted/30 text-sm">
                          <span className="text-muted-foreground text-xs block mb-0.5">{key}</span>
                          <p className="font-medium truncate text-foreground">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
