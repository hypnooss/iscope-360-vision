import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Mail, ShieldBan, ShieldAlert, Bug, Forward, Reply, UserX, HardDrive,
  ArrowUpRight, ArrowDownLeft, AlertTriangle, CheckCircle2, TrendingUp,
} from 'lucide-react';
import type { ExchangeDashboardData } from '@/hooks/useExchangeDashboard';
import type { ExchangeOperationalCategory } from './ExchangeAnalyzerCategoryGrid';

interface CategoryIconProps {
  className?: string;
  style?: React.CSSProperties;
}

interface ExchangeCategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ExchangeOperationalCategory | null;
  dashboardData: ExchangeDashboardData | null;
  analyzerMetrics?: any;
}

const CATEGORY_META: Record<ExchangeOperationalCategory, {
  label: string;
  icon: React.ComponentType<CategoryIconProps>;
  icon: React.ComponentType<{ className?: string }>;
  colorHex: string;
  description: string;
}> = {
  email_traffic: {
    label: 'Tráfego de Email',
    icon: Mail,
    colorHex: '#14b8a6',
    description: 'Volume de emails enviados e recebidos no período monitorado.',
  },
  anti_spam: {
    label: 'Proteção Anti-Spam',
    icon: ShieldBan,
    colorHex: '#8b5cf6',
    description: 'Emails identificados e bloqueados como spam pelas políticas de proteção.',
  },
  phishing: {
    label: 'Detecção de Phishing',
    icon: ShieldAlert,
    colorHex: '#ef4444',
    description: 'Tentativas de phishing detectadas nas mensagens de entrada.',
  },
  malware: {
    label: 'Detecção de Malware',
    icon: Bug,
    colorHex: '#f59e0b',
    description: 'Anexos ou links maliciosos identificados pelo filtro de malware.',
  },
  forwarding: {
    label: 'Forwarding Ativo',
    icon: Forward,
    colorHex: '#f97316',
    description: 'Caixas de correio com encaminhamento automático configurado para endereços externos.',
  },
  auto_reply: {
    label: 'Auto-Reply Externo',
    icon: Reply,
    colorHex: '#ec4899',
    description: 'Caixas com respostas automáticas habilitadas para remetentes externos.',
  },
  inactive_mailboxes: {
    label: 'Mailboxes Inativas',
    icon: UserX,
    colorHex: '#6366f1',
    description: 'Caixas de correio sem login nos últimos 30 dias.',
  },
  over_quota: {
    label: 'Caixas Over Quota',
    icon: HardDrive,
    colorHex: '#dc2626',
    description: 'Caixas de correio que excederam a cota de armazenamento.',
  },
};

const RISK_RECOMMENDATIONS: Partial<Record<ExchangeOperationalCategory, string>> = {
  forwarding: 'Revise as regras de encaminhamento. Forwarding para domínios externos pode indicar exfiltração de dados ou configuração insegura.',
  auto_reply: 'Respostas automáticas externas podem expor informações internas. Considere restringir via política de transporte.',
  inactive_mailboxes: 'Contas inativas são vetores de ataque. Desabilite ou remova as licenças para reduzir a superfície de ataque.',
  over_quota: 'Caixas acima da cota podem deixar de receber emails críticos, incluindo alertas de segurança.',
};

function getSeverity(cat: ExchangeOperationalCategory, value: number, total: number) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  switch (cat) {
    case 'anti_spam':
      return value > 500 ? 'critical' : value > 100 ? 'high' : value > 20 ? 'medium' : 'low';
    case 'phishing':
      return value > 100 ? 'critical' : value > 30 ? 'high' : value > 5 ? 'medium' : 'low';
    case 'malware':
      return value > 50 ? 'critical' : value > 10 ? 'high' : value > 2 ? 'medium' : 'low';
    case 'forwarding':
      return pct > 20 ? 'critical' : pct > 10 ? 'high' : pct > 3 ? 'medium' : 'low';
    case 'auto_reply':
      return pct > 15 ? 'high' : pct > 5 ? 'medium' : 'low';
    case 'inactive_mailboxes':
      return pct > 30 ? 'high' : pct > 15 ? 'medium' : 'low';
    case 'over_quota':
      return pct > 10 ? 'critical' : pct > 5 ? 'high' : value > 0 ? 'medium' : 'low';
    default:
      return 'low';
  }
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30', label: 'Crítico' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30', label: 'Alto' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30', label: 'Médio' },
  low: { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-400/30', label: 'Baixo' },
};

function TrafficContent({ data }: { data: ExchangeDashboardData }) {
  const { sent, received } = data.traffic;
  const total = sent + received;
  const sentPct = total > 0 ? (sent / total) * 100 : 50;
  const receivedPct = total > 0 ? (received / total) * 100 : 50;

  return (
    <Tabs defaultValue="overview" className="mt-4">
      <TabsList className="w-full bg-muted/30 rounded-none border-b border-border p-0 h-auto">
        <TabsTrigger value="overview" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 text-xs">
          Visão Geral
        </TabsTrigger>
        <TabsTrigger value="sent" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 text-xs">
          Enviados ({sent.toLocaleString()})
        </TabsTrigger>
        <TabsTrigger value="received" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 text-xs">
          Recebidos ({received.toLocaleString()})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-4 py-4">
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Total de Emails</span>
                  <span className="text-2xl font-bold text-foreground">{total.toLocaleString()}</span>
                </div>

                <div className="w-full h-3 rounded-full bg-muted/50 overflow-hidden flex">
                  <div className="h-full transition-all" style={{ width: `${sentPct}%`, backgroundColor: '#10b981' }} />
                  <div className="h-full transition-all" style={{ width: `${receivedPct}%`, backgroundColor: '#3b82f6' }} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                    <div>
                      <p className="text-xs text-muted-foreground">Enviados</p>
                      <p className="text-sm font-semibold text-foreground">{sent.toLocaleString()} ({sentPct.toFixed(1)}%)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                    <div>
                      <p className="text-xs text-muted-foreground">Recebidos</p>
                      <p className="text-sm font-semibold text-foreground">{received.toLocaleString()} ({receivedPct.toFixed(1)}%)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Proporção Enviado / Recebido</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Enviados</span>
                      <span className="text-xs font-medium text-foreground">{sentPct.toFixed(1)}%</span>
                    </div>
                    <Progress value={sentPct} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" /> Recebidos</span>
                      <span className="text-xs font-medium text-foreground">{receivedPct.toFixed(1)}%</span>
                    </div>
                    <Progress value={receivedPct} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="sent">
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-4 py-4">
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5" style={{ color: '#10b981' }} />
                  <span className="text-lg font-bold text-foreground">{sent.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">emails enviados</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Representam {sentPct.toFixed(1)}% do tráfego total do período monitorado.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-muted/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  💡 Rankings de top remetentes e domínios de destino estarão disponíveis quando o Analyzer completar a coleta detalhada.
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="received">
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-4 py-4">
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5" style={{ color: '#3b82f6' }} />
                  <span className="text-lg font-bold text-foreground">{received.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">emails recebidos</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Representam {receivedPct.toFixed(1)}% do tráfego total do período monitorado.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-muted/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  💡 Rankings de top destinatários e domínios de origem estarão disponíveis quando o Analyzer completar a coleta detalhada.
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function SecurityContent({ category, data, analyzerMetrics }: { category: 'anti_spam' | 'phishing' | 'malware'; data: ExchangeDashboardData; analyzerMetrics?: any }) {
  const valueMap = { anti_spam: data.security.spam, phishing: data.security.phishing, malware: data.security.malware };
  const value = valueMap[category];
  const severity = getSeverity(category, value, 1);
  const sevStyle = SEVERITY_STYLES[severity];
  const labelMap = { anti_spam: 'spam bloqueados', phishing: 'tentativas de phishing', malware: 'detecções de malware' };

  const threatData = analyzerMetrics?.threatProtection;
  const topDomains: string[] = threatData?.topAttackerDomains ?? [];
  const topUsers: string[] = threatData?.topTargetedUsers ?? [];

  return (
    <ScrollArea className="h-[calc(100vh-220px)] mt-4">
      <div className="space-y-4 py-2">
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de detecções</span>
              <span className="text-2xl font-bold text-foreground">{value.toLocaleString()}</span>
            </div>
            <Badge variant="outline" className={cn('text-xs', sevStyle.text, sevStyle.border, sevStyle.bg)}>
              Severidade: {sevStyle.label}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {value.toLocaleString()} {labelMap[category]} identificados no período.
            </p>
          </CardContent>
        </Card>

        {topDomains.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Top Domínios de Origem
              </h4>
              <div className="space-y-2">
                {topDomains.slice(0, 10).map((domain, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-5">{idx + 1}.</span>
                    <span className="text-foreground font-medium">{domain}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {topUsers.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-500" />
                Usuários Mais Visados
              </h4>
              <div className="space-y-2">
                {topUsers.slice(0, 10).map((user, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-5">{idx + 1}.</span>
                    <span className="text-foreground font-medium">{user}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {topDomains.length === 0 && topUsers.length === 0 && (
          <Card className="border-border/50 bg-muted/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                💡 Rankings detalhados de domínios e usuários estarão disponíveis quando o Analyzer completar a análise de Threat Protection.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

function MailboxRiskContent({ category, data }: { category: 'forwarding' | 'auto_reply' | 'inactive_mailboxes' | 'over_quota'; data: ExchangeDashboardData }) {
  const { mailboxes } = data;
  const totalMb = mailboxes.total || 1;

  const valueMap: Record<string, number> = {
    forwarding: mailboxes.forwardingEnabled,
    auto_reply: mailboxes.autoReplyExternal,
    inactive_mailboxes: mailboxes.notLoggedIn30d,
    over_quota: mailboxes.overQuota,
  };

  const value = valueMap[category] ?? 0;
  const pct = (value / totalMb) * 100;
  const severity = getSeverity(category, value, totalMb);
  const sevStyle = SEVERITY_STYLES[severity];
  const recommendation = RISK_RECOMMENDATIONS[category];

  return (
    <ScrollArea className="h-[calc(100vh-220px)] mt-4">
      <div className="space-y-4 py-2">
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Caixas afetadas</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-foreground">{value.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground ml-1">/ {totalMb.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">Percentual de exposição</span>
                <span className="text-xs font-medium text-foreground">{pct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', SEVERITY_BAR_COLORS[severity])}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>

            <Badge variant="outline" className={cn('text-xs', sevStyle.text, sevStyle.border, sevStyle.bg)}>
              Risco: {sevStyle.label}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Contexto
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total de mailboxes</p>
                <p className="text-sm font-semibold text-foreground">{totalMb.toLocaleString()}</p>
              </div>
              <div className="bg-muted/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Afetadas</p>
                <p className="text-sm font-semibold text-foreground">{value.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {value === 0 && (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-sm text-foreground">Nenhuma caixa afetada nesta categoria. Situação saudável.</p>
            </CardContent>
          </Card>
        )}

        {recommendation && value > 0 && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4">
              <p className="text-sm text-foreground">💡 {recommendation}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

const SEVERITY_BAR_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
};

export function ExchangeCategorySheet({ open, onOpenChange, category, dashboardData, analyzerMetrics }: ExchangeCategorySheetProps) {
  if (!category || !dashboardData) return null;

  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  const isTraffic = category === 'email_traffic';
  const isSecurity = category === 'anti_spam' || category === 'phishing' || category === 'malware';
  const isMailboxRisk = category === 'forwarding' || category === 'auto_reply' || category === 'inactive_mailboxes' || category === 'over_quota';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${meta.colorHex}15` }}>
              <Icon className="w-5 h-5" style={{ color: meta.colorHex }} />
            </div>
            <div>
              <SheetTitle className="text-lg">{meta.label}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="px-6">
          {isTraffic && <TrafficContent data={dashboardData} />}
          {isSecurity && <SecurityContent category={category} data={dashboardData} analyzerMetrics={analyzerMetrics} />}
          {isMailboxRisk && <MailboxRiskContent category={category} data={dashboardData} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
