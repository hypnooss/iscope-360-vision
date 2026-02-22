import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SurfaceFinding, SurfaceFindingSeverity } from '@/lib/surfaceFindings';

interface AssetHealth {
  hostname: string;
  ip: string;
  asn: string | null;
  worstSeverity: SurfaceFindingSeverity | 'ok';
  counts: { critical: number; high: number; medium: number; low: number };
  totalFindings: number;
  services: number;
}

const BORDER_COLORS: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-400',
  ok: 'border-l-emerald-500',
};

interface AssetHealthGridProps {
  assets: Array<{
    hostname: string;
    ip: string;
    asn?: { asn: string; provider: string; org: string } | null;
    services: Array<unknown>;
    webServices: Array<unknown>;
  }>;
  findings: SurfaceFinding[];
  onAssetClick: (ip: string) => void;
}

function formatAsn(asn?: { asn: string; provider: string; org: string } | null): string | null {
  if (!asn?.asn) return null;
  const label = asn.org || asn.provider;
  if (label) {
    const full = `${asn.asn} - ${label}`;
    return full.length > 24 ? `${asn.asn} - ${label.slice(0, 14)}…` : full;
  }
  return asn.asn;
}

export function AssetHealthGrid({ assets, findings, onAssetClick }: AssetHealthGridProps) {
  const healthData: AssetHealth[] = assets
    .filter(a => a.services.length > 0 || (a as any).webServices?.length > 0 || (a as any).ports?.length > 0)
    .map(asset => {
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      let totalFindings = 0;
      for (const f of findings) {
        if (f.affectedAssets.some(a => a.ip === asset.ip)) {
          counts[f.severity]++;
          totalFindings++;
        }
      }

      const worstSeverity: SurfaceFindingSeverity | 'ok' =
        counts.critical > 0 ? 'critical' :
        counts.high > 0 ? 'high' :
        counts.medium > 0 ? 'medium' :
        counts.low > 0 ? 'low' : 'ok';

      return {
        hostname: asset.hostname,
        ip: asset.ip,
        asn: formatAsn(asset.asn),
        worstSeverity,
        counts,
        totalFindings,
        services: asset.services.length + ((asset as any).webServices?.length || 0),
      };
    })
    .sort((a, b) => {
      const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, ok: 0 };
      return (rank[b.worstSeverity] || 0) - (rank[a.worstSeverity] || 0);
    });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Server className="w-4 h-4 text-muted-foreground" />
          Saúde dos Ativos
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
            {healthData.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {healthData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum ativo com serviços expostos</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {healthData.map(asset =>
              asset.worstSeverity === 'ok' ? (
                /* ── Card compacto (sem vulnerabilidades) ── */
                <div
                  key={asset.ip}
                  className={cn(
                    'rounded-lg border border-border/40 bg-card/50 px-3 py-2 border-l-4 cursor-pointer',
                    'hover:bg-muted/30 transition-colors',
                    BORDER_COLORS.ok
                  )}
                  onClick={() => onAssetClick(asset.ip)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{asset.hostname}</span>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">{asset.ip}</span>
                    {asset.asn && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-border/60 shrink-0 hidden sm:inline-flex">
                        {asset.asn}
                      </Badge>
                    )}
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-auto" />
                    <span className="text-[10px] text-muted-foreground shrink-0">{asset.services} svc</span>
                  </div>
                </div>
              ) : (
                /* ── Card expandido (com vulnerabilidades) ── */
                <div
                  key={asset.ip}
                  className={cn(
                    'rounded-lg border border-border/40 bg-card/50 p-3 border-l-4 cursor-pointer',
                    'hover:bg-muted/30 transition-colors',
                    BORDER_COLORS[asset.worstSeverity]
                  )}
                  onClick={() => onAssetClick(asset.ip)}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-foreground truncate">{asset.hostname}</span>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">{asset.ip}</span>
                    {asset.asn && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-border/60 shrink-0 ml-auto">
                        {asset.asn}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {asset.counts.critical > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-500/20 text-red-500 border-red-500/30">{asset.counts.critical}C</Badge>}
                    {asset.counts.high > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-500/20 text-orange-500 border-orange-500/30">{asset.counts.high}H</Badge>}
                    {asset.counts.medium > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-yellow-500/20 text-yellow-500 border-yellow-500/30">{asset.counts.medium}M</Badge>}
                    {asset.counts.low > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-400/20 text-blue-400 border-blue-400/30">{asset.counts.low}L</Badge>}
                    <span className="text-[10px] text-muted-foreground ml-auto">{asset.services} svc</span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
