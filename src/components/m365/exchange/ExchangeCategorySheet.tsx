import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Mail, ShieldBan, ShieldAlert, Bug, Forward, Reply, UserX, HardDrive, User,
  ArrowUpRight, ArrowDownLeft, Globe, AtSign,
} from 'lucide-react';
import type { ExchangeDashboardData } from '@/hooks/useExchangeDashboard';
import type { ExchangeOperationalCategory } from './ExchangeAnalyzerCategoryGrid';

interface ExchangeCategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ExchangeOperationalCategory | null;
  dashboardData: ExchangeDashboardData | null;
  analyzerMetrics?: any;
}

const CATEGORY_META: Record<ExchangeOperationalCategory, {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  colorHex: string;
  description: string;
}> = {
  email_traffic: {
    label: 'Tráfego de Email',
    icon: Mail,
    colorHex: '#14b8a6',
    description: 'Análise detalhada do volume de emails enviados e recebidos, incluindo rankings de remetentes e domínios.',
  },
  anti_spam: {
    label: 'Proteção Anti-Spam',
    icon: ShieldBan,
    colorHex: '#8b5cf6',
    description: 'Detecções de spam com rankings de domínios atacantes e usuários alvos.',
  },
  phishing: {
    label: 'Detecção de Phishing',
    icon: ShieldAlert,
    colorHex: '#ef4444',
    description: 'Tentativas de phishing detectadas com rankings de atacantes e alvos.',
  },
  malware: {
    label: 'Detecção de Malware',
    icon: Bug,
    colorHex: '#f59e0b',
    description: 'Anexos e links maliciosos identificados pelo filtro de malware.',
  },
  forwarding: {
    label: 'Forwarding Ativo',
    icon: Forward,
    colorHex: '#f97316',
    description: 'Caixas de correio com encaminhamento automático configurado.',
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

/* ─── Generic ranking list (equivalent to Firewall IPList) ─── */
function RankingList({
  items,
  colorClass,
  renderLabel,
  renderSub,
}: {
  items: { name: string; count?: number; [k: string]: any }[];
  colorClass?: string;
  renderLabel?: (item: any, idx: number) => React.ReactNode;
  renderSub?: (item: any) => React.ReactNode;
}) {
  if (!items?.length) return <p className="text-xs text-muted-foreground py-2">Sem dados disponíveis</p>;
  return (
    <>
      {items.slice(0, 15).map((item, idx) => (
        <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
          <div className="flex items-center gap-2 min-w-0">
            {renderLabel ? renderLabel(item, idx) : (
              <span className="text-sm truncate">{item.name}</span>
            )}
            {renderSub && <span className="text-xs text-muted-foreground truncate">{renderSub(item)}</span>}
          </div>
          {item.count !== undefined && (
            <span className={cn('text-sm font-semibold shrink-0 ml-2', colorClass ?? 'text-foreground')}>
              {item.count.toLocaleString()}
            </span>
          )}
        </div>
      ))}
    </>
  );
}

/* ─── Mailbox detail list (for forwarding/inactive/over-quota) ─── */
function MailboxDetailList({
  items,
  colorClass,
  subKey,
  subLabel,
}: {
  items: any[];
  colorClass?: string;
  subKey: string;
  subLabel: string;
}) {
  if (!items?.length) return <p className="text-xs text-muted-foreground py-2">Rankings disponíveis após execução do Analyzer</p>;
  return (
    <>
      {items.slice(0, 15).map((item, idx) => (
        <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{item.name}</span>
          </div>
          <span className={cn('text-xs shrink-0 ml-2 font-medium', colorClass ?? 'text-muted-foreground')}>
            {item[subKey]}
            {subKey === 'usagePct' ? '%' : ''}
          </span>
        </div>
      ))}
    </>
  );
}

export function ExchangeCategorySheet({
  open,
  onOpenChange,
  category,
  dashboardData,
  analyzerMetrics,
}: ExchangeCategorySheetProps) {
  if (!category) return null;

  const meta = CATEGORY_META[category];
  const IconComp = meta.icon;
  const traffic = analyzerMetrics?.emailTrafficRankings;
  const mbRankings = analyzerMetrics?.mailboxRankings;
  const threatData = analyzerMetrics?.threatProtection;
  const phishingData = analyzerMetrics?.phishing;

  const isFullHeight = ['email_traffic', 'anti_spam', 'phishing'].includes(category);

  const renderTrafficContent = () => {
    const sent = dashboardData?.traffic.sent || 0;
    const received = dashboardData?.traffic.received || 0;
    return (
      <Tabs defaultValue="enviados" className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-border shrink-0" />
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-6 h-auto py-0 shrink-0">
          <TabsTrigger
            value="enviados"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs gap-1.5"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Enviados ({sent.toLocaleString()})
          </TabsTrigger>
          <TabsTrigger
            value="recebidos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs gap-1.5"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Recebidos ({received.toLocaleString()})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enviados" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                {sent.toLocaleString()} emails enviados
              </Badge>
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Remetentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <RankingList
                    items={traffic?.topSenders || []}
                    colorClass="text-emerald-600 dark:text-emerald-400"
                    renderLabel={(item) => (
                      <>
                        <AtSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{item.name}</span>
                      </>
                    )}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Domínios de Destino</CardTitle>
                </CardHeader>
                <CardContent>
                  <RankingList
                    items={traffic?.topDestinationDomains || []}
                    colorClass="text-emerald-600 dark:text-emerald-400"
                    renderLabel={(item) => (
                      <>
                        <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{item.name}</span>
                      </>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recebidos" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                {received.toLocaleString()} emails recebidos
              </Badge>
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Destinatários</CardTitle>
                </CardHeader>
                <CardContent>
                  <RankingList
                    items={traffic?.topRecipients || []}
                    colorClass="text-blue-600 dark:text-blue-400"
                    renderLabel={(item) => (
                      <>
                        <AtSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{item.name}</span>
                      </>
                    )}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Domínios de Origem</CardTitle>
                </CardHeader>
                <CardContent>
                  <RankingList
                    items={traffic?.topSourceDomains || []}
                    colorClass="text-blue-600 dark:text-blue-400"
                    renderLabel={(item) => (
                      <>
                        <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{item.name}</span>
                      </>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    );
  };

  const renderSecurityContent = (cat: 'anti_spam' | 'phishing' | 'malware') => {
    const valueMap: Record<string, number> = {
      anti_spam: dashboardData?.security.spam || 0,
      phishing: dashboardData?.security.phishing || 0,
      malware: dashboardData?.security.malware || 0,
    };
    const value = valueMap[cat];
    const labelMap: Record<string, string> = {
      anti_spam: 'detecções de spam',
      phishing: 'tentativas de phishing',
      malware: 'detecções de malware',
    };

    // Get ranking data based on category
    // For phishing: aggregate sender domains from threatProtection.topPhishingTargets[].senders
    const phishDomains: { name: string; count: number }[] = (() => {
      const senderMap: Record<string, number> = {};
      (threatData?.topPhishingTargets || []).forEach((t: any) => {
        (t.senders || []).forEach((s: string) => {
          senderMap[s] = (senderMap[s] || 0) + 1;
        });
      });
      return Object.entries(senderMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
    })();

    const topDomains: { name: string; count: number }[] =
      cat === 'anti_spam' ? (threatData?.topSpamSenderDomains || []).map((d: any) => typeof d === 'string' ? { name: d, count: 0 } : { name: d.domain || d.name || d, count: d.count || 0 }) :
      cat === 'phishing' ? phishDomains :
      (threatData?.topMalwareSenders || []).map((d: any) => ({ name: d.domain || d.name || d, count: d.count || 0 }));

    // Aggregate malware recipients from topMalwareSenders[].recipients
    const malwareTargets = (() => {
      const targetMap: Record<string, number> = {};
      (threatData?.topMalwareSenders || []).forEach((d: any) => {
        (d.recipients || []).forEach((r: string) => {
          targetMap[r] = (targetMap[r] || 0) + 1;
        });
      });
      return Object.entries(targetMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
    })();

    const topUsers: { name: string; count: number }[] =
      cat === 'anti_spam' ? (threatData?.topSpamRecipients || []).map((u: any) => typeof u === 'string' ? { name: u, count: 0 } : { name: u.user || u.name || u, count: u.count || 0 }) :
      cat === 'phishing' ? (threatData?.topPhishingTargets || []).map((u: any) => typeof u === 'string' ? { name: u, count: 0 } : { name: u.user || u.name || u, count: u.count || 0 }) :
      malwareTargets;

    const sevColor = cat === 'phishing' ? 'text-red-500' : cat === 'malware' ? 'text-amber-500' : 'text-violet-500';

    if (cat === 'malware') {
      // Malware: no tabs, simple list
      return (
        <ScrollArea className="h-[calc(100vh-12rem)] mt-4">
          <div className="p-6 space-y-4">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              {value.toLocaleString()} {labelMap[cat]}
            </Badge>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Domínios de Origem</CardTitle>
              </CardHeader>
              <CardContent>
                <RankingList items={topDomains} colorClass="text-amber-600 dark:text-amber-400"
                  renderLabel={(item) => (<><Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{item.name}</span></>)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium">Top Usuários Alvos</CardTitle>
              </CardHeader>
              <CardContent>
                <RankingList items={topUsers} colorClass="text-amber-600 dark:text-amber-400"
                  renderLabel={(item) => (<><User className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{item.name}</span></>)} />
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      );
    }

    // Spam & Phishing: tabs
    const badgeBg = cat === 'phishing' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30';
    const listColor = cat === 'phishing' ? 'text-red-600 dark:text-red-400' : 'text-violet-600 dark:text-violet-400';

    return (
      <Tabs defaultValue="origens" className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-border shrink-0" />
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-6 h-auto py-0 shrink-0">
          <TabsTrigger value="origens" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Origens
          </TabsTrigger>
          <TabsTrigger value="alvos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-xs gap-1.5">
            <User className="w-3.5 h-3.5" />
            Alvos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="origens" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              <Badge variant="outline" className={badgeBg}>
                {value.toLocaleString()} {labelMap[cat]}
              </Badge>
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Domínios Remetentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <RankingList items={topDomains} colorClass={listColor}
                    renderLabel={(item) => (<><Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{item.name}</span></>)} />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="alvos" className="flex-1 mt-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              <Badge variant="outline" className={badgeBg}>
                {value.toLocaleString()} {labelMap[cat]}
              </Badge>
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium">Top Usuários Visados</CardTitle>
                </CardHeader>
                <CardContent>
                  <RankingList items={topUsers} colorClass={listColor}
                    renderLabel={(item) => (<><User className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-sm truncate">{item.name}</span></>)} />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    );
  };

  const renderMailboxContent = (cat: 'forwarding' | 'auto_reply' | 'inactive_mailboxes' | 'over_quota') => {
    const totalMb = dashboardData?.mailboxes.total || 1;
    const valueMap: Record<string, number> = {
      forwarding: dashboardData?.mailboxes.forwardingEnabled || 0,
      auto_reply: dashboardData?.mailboxes.autoReplyExternal || 0,
      inactive_mailboxes: dashboardData?.mailboxes.notLoggedIn30d || 0,
      over_quota: dashboardData?.mailboxes.overQuota || 0,
    };
    const value = valueMap[cat];

    const badgeColor: Record<string, string> = {
      forwarding: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
      auto_reply: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
      inactive_mailboxes: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      over_quota: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    };
    const listColor: Record<string, string> = {
      forwarding: 'text-orange-600 dark:text-orange-400',
      auto_reply: 'text-pink-600 dark:text-pink-400',
      inactive_mailboxes: 'text-indigo-600 dark:text-indigo-400',
      over_quota: 'text-red-600 dark:text-red-400',
    };

    const items = cat === 'forwarding' ? (mbRankings?.topForwarding || []) :
      cat === 'inactive_mailboxes' ? (mbRankings?.topInactive || []) :
      cat === 'over_quota' ? (mbRankings?.topOverQuota || []) : [];

    const subKey = cat === 'forwarding' ? 'forwardTo' : cat === 'inactive_mailboxes' ? 'lastLogin' : 'usagePct';
    const cardTitle = cat === 'forwarding' ? 'Mailboxes com Forwarding' :
      cat === 'inactive_mailboxes' ? 'Mailboxes sem Login (30d)' :
      cat === 'over_quota' ? 'Mailboxes Acima da Cota' : 'Mailboxes com Auto-Reply';

    return (
      <ScrollArea className="h-[calc(100vh-12rem)] mt-4">
        <div className="p-6 space-y-4">
          <Badge variant="outline" className={badgeColor[cat]}>
            {value.toLocaleString()} de {totalMb.toLocaleString()} mailboxes ({totalMb > 0 ? ((value / totalMb) * 100).toFixed(1) : 0}%)
          </Badge>
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium">{cardTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <MailboxDetailList items={items} colorClass={listColor[cat]} subKey={subKey} subLabel="" />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    );
  };

  const renderCategoryContent = () => {
    switch (category) {
      case 'email_traffic':
        return renderTrafficContent();
      case 'anti_spam':
      case 'phishing':
      case 'malware':
        return renderSecurityContent(category);
      case 'forwarding':
      case 'auto_reply':
      case 'inactive_mailboxes':
      case 'over_quota':
        return renderMailboxContent(category);
      default:
        return <p className="text-sm text-muted-foreground p-6">Sem dados disponíveis.</p>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          'w-full sm:max-w-[50vw]',
          isFullHeight ? 'p-0 flex flex-col' : ''
        )}
      >
        <SheetHeader className={cn(isFullHeight ? 'px-6 pt-6 pb-0 shrink-0' : 'mb-2')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${meta.colorHex}15` }}>
              <IconComp className="w-5 h-5" style={{ color: meta.colorHex }} />
            </div>
            <SheetTitle>{meta.label}</SheetTitle>
          </div>
          <SheetDescription>{meta.description}</SheetDescription>
        </SheetHeader>

        {isFullHeight ? (
          renderCategoryContent()
        ) : (
          renderCategoryContent()
        )}
      </SheetContent>
    </Sheet>
  );
}
