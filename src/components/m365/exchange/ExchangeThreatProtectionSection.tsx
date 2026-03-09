import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ShieldCheck, ShieldX, AlertTriangle, CheckCircle2,
  Globe, Users, Bug,
} from 'lucide-react';
import type { M365AnalyzerMetrics } from '@/types/m365AnalyzerInsights';

type ThreatProtection = M365AnalyzerMetrics['threatProtection'];

// ─── Policy Status Card ──────────────────────────────────────────────────────
function PolicyCard({ name, status }: { name: string; status: 'enabled' | 'weak' | 'disabled' }) {
  const cfg = {
    enabled: { icon: CheckCircle2, label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    weak: { icon: AlertTriangle, label: 'Fraco', color: 'text-warning', bg: 'bg-warning/10 border-warning/30' },
    disabled: { icon: ShieldX, label: 'Desativado', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  }[status];

  return (
    <Card className={cn('glass-card border', cfg.bg)}>
      <CardContent className="p-3 flex items-center gap-2.5">
        <cfg.icon className={cn('w-4 h-4 shrink-0', cfg.color)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p className={cn('text-[10px] font-medium', cfg.color)}>{cfg.label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Ranking List ────────────────────────────────────────────────────────────
function RankingList({ title, icon: Icon, items, labelKey }: {
  title: string; icon: React.ElementType;
  items: { [key: string]: any; count: number }[];
  labelKey: string;
}) {
  if (!items?.length) return null;
  const maxCount = Math.max(...items.map(i => i.count), 1);

  return (
    <Card className="glass-card border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1">
        {items.slice(0, 8).map((item, i) => (
          <div key={i} className="py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{item[labelKey]}</span>
              <Badge variant="secondary" className="font-mono text-xs shrink-0">{item.count}</Badge>
            </div>
            <div className="mt-1.5 ml-8 h-1 bg-secondary/60 rounded-full overflow-hidden">
              <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${(item.count / maxCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Section ────────────────────────────────────────────────────────────
interface ExchangeThreatProtectionSectionProps {
  data: ThreatProtection | null;
  loading?: boolean;
}

export function ExchangeThreatProtectionSection({ data, loading }: ExchangeThreatProtectionSectionProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasRankings = data.topSpamSenderDomains?.length > 0 ||
    data.topPhishingTargets?.length > 0 ||
    data.topMalwareSenders?.length > 0;

  return (
    <div className="space-y-4">
      {/* Policy Status */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          Status das Políticas de Proteção
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          <PolicyCard name="Anti-Spam" status={data.policyStatus.antiSpam} />
          <PolicyCard name="Anti-Phishing" status={data.policyStatus.antiPhish} />
          <PolicyCard name="Safe Links" status={data.policyStatus.safeLinks} />
          <PolicyCard name="Safe Attachments" status={data.policyStatus.safeAttach} />
          <PolicyCard name="Malware Filter" status={data.policyStatus.malwareFilter} />
        </div>
      </div>

      {/* Rankings */}
      {hasRankings && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RankingList title="Top Origem de SPAM" icon={Globe} items={data.topSpamSenderDomains} labelKey="domain" />
          <RankingList title="Top Alvos de Phishing" icon={Users} items={data.topPhishingTargets} labelKey="user" />
          <RankingList title="Top Fontes de Malware" icon={Bug} items={data.topMalwareSenders} labelKey="domain" />
        </div>
      )}
    </div>
  );
}
