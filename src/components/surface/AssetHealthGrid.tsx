import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Server, CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'flag-icons/css/flag-icons.min.css';
import type { SurfaceFinding, SurfaceFindingSeverity } from '@/lib/surfaceFindings';

interface AsnData {
  asn: string; provider: string; org: string;
  country?: string; abuse_email?: string; tech_email?: string;
  ip_range?: string; owner?: string; ownerid?: string;
  responsible?: string; abuse_handle?: string;
  [key: string]: unknown;
}

interface TLSCertInfo { subject_cn: string; issuer: string; not_after: string | null; daysRemaining: number | null; }

interface AssetHealth {
  hostname: string;
  ip: string;
  asn: string | null;
  asnRaw: AsnData | null;
  worstSeverity: SurfaceFindingSeverity | 'ok';
  counts: { critical: number; high: number; medium: number; low: number };
  totalFindings: number;
  services: number;
  ports: number;
  tlsCerts: TLSCertInfo[];
  expiredCerts: number;
  expiringSoonCerts: number;
  allTechs: string[];
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
    asn?: AsnData | null;
    services: Array<unknown>;
    webServices: Array<unknown>;
    ports?: number[] | unknown[];
    tlsCerts?: TLSCertInfo[];
    expiredCerts?: number;
    expiringSoonCerts?: number;
    allTechs?: string[];
  }>;
  findings: SurfaceFinding[];
  onAssetClick: (ip: string) => void;
}

const PROVIDER_DOMAINS: Record<string, string> = {
  'cloudflare': 'cloudflare.com', 'akamai': 'akamai.com', 'fastly': 'fastly.com',
  'aws_cloudfront': 'aws.com', 'aws': 'aws.com', 'azure': 'microsoft.com',
  'google_cloud': 'google.com', 'incapsula': 'imperva.com', 'sucuri': 'sucuri.net',
  'stackpath': 'stackpath.com', 'oracle': 'oracle.com',
  'digitalocean': 'digitalocean.com', 'hetzner': 'hetzner.com',
  'vultr': 'vultr.com', 'ovh': 'ovh.com',
};

function formatAsn(asn?: AsnData | null): string | null {
  if (!asn) return null;
  const asnNum = asn.asn || '';
  const raw = asn.provider && asn.provider !== 'unknown' ? asn.provider : '';
  const friendly = raw ? (PROVIDER_DOMAINS[raw] || raw) : '';
  const providerLabel = friendly || (asn.org
    ? (asn.org.length > 20 ? asn.org.slice(0, 20) + '...' : asn.org)
    : '');
  if (!asnNum && !providerLabel) return null;
  if (asnNum && providerLabel) return `${asnNum} - ${providerLabel}`;
  return asnNum || providerLabel;
}

function getTechBadgeColor(tech: string): string {
  const t = tech.toLowerCase();
  if (['hsts', 'csp', 'x-frame-options', 'x-xss-protection'].some(k => t.includes(k)))
    return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  if (['nginx', 'apache', 'iis', 'litespeed', 'caddy'].some(k => t.includes(k)))
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  if (['php', 'python', 'node', 'java', 'ruby', 'asp.net', '.net'].some(k => t.includes(k)))
    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  if (['wordpress', 'nextcloud', 'drupal', 'joomla', 'react', 'angular', 'vue', 'django', 'laravel'].some(k => t.includes(k)))
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return '';
}

function CertStatusBadge({ tlsCerts, expiredCerts, expiringSoonCerts }: { tlsCerts: TLSCertInfo[]; expiredCerts: number; expiringSoonCerts: number }) {
  if (tlsCerts.length === 0) return (
    <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0 text-muted-foreground border-border/60">
      <Lock className="w-3 h-3 mr-1" /> Sem Certificado
    </Badge>
  );
  if (expiredCerts > 0) {
    const worst = tlsCerts.reduce((a, b) => (a.daysRemaining ?? 9999) < (b.daysRemaining ?? 9999) ? a : b);
    return (
      <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-[11px] font-mono px-1.5 py-0">
        <Lock className="w-3 h-3 mr-1" /> Certificado Expirado há {Math.abs(worst.daysRemaining ?? 0)}d
      </Badge>
    );
  }
  if (expiringSoonCerts > 0) {
    const worst = tlsCerts.reduce((a, b) => (a.daysRemaining ?? 9999) < (b.daysRemaining ?? 9999) ? a : b);
    return (
      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-[11px] font-mono px-1.5 py-0">
        <Lock className="w-3 h-3 mr-1" /> Certificado Expira em {worst.daysRemaining}d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[11px] font-mono px-1.5 py-0">
      <Lock className="w-3 h-3 mr-1" /> Certificado Válido
    </Badge>
  );
}

function IpTooltipBody({ asn }: { asn: AsnData }) {
  const unavailable = <span className="italic text-muted-foreground/60">indisponível</span>;
  return (
    <div className="space-y-1.5">
      {asn.asn && (
        <div className="flex items-center gap-2 font-mono text-xs font-semibold">
          <span>{asn.asn}</span>
          {asn.org && <span className="text-muted-foreground font-normal truncate">({asn.org})</span>}
        </div>
      )}
      {asn.country && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`fi fi-${asn.country.toLowerCase()} rounded-sm`} style={{ fontSize: '14px' }} />
          <span>País: {asn.country}</span>
        </div>
      )}
      {asn.ip_range && (
        <div className="text-xs text-muted-foreground font-mono">Range: {asn.ip_range}</div>
      )}
      <div className="border-t border-border my-1.5" />
      <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">
        <span className="text-muted-foreground font-mono">abuse-c:</span>
        <span className="truncate">{asn.abuse_handle || unavailable}</span>
        <span className="text-muted-foreground font-mono">owner:</span>
        <span className="truncate">{asn.owner || unavailable}</span>
        <span className="text-muted-foreground font-mono">ownerid:</span>
        <span className="truncate font-mono">{asn.ownerid || unavailable}</span>
        <span className="text-muted-foreground font-mono">responsible:</span>
        <span className="truncate">{asn.responsible || unavailable}</span>
      </div>
      {(asn.abuse_email || (asn.tech_email && asn.tech_email !== asn.abuse_email)) && (
        <>
          <div className="border-t border-border my-1.5" />
          {asn.abuse_email && <div className="text-xs text-muted-foreground">Abuse: {asn.abuse_email}</div>}
          {asn.tech_email && asn.tech_email !== asn.abuse_email && <div className="text-xs text-muted-foreground">Técnico: {asn.tech_email}</div>}
        </>
      )}
    </div>
  );
}

function IpBadge({ ip, asnRaw }: { ip: string; asnRaw: AsnData | null }) {
  const badge = (
    <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0 text-muted-foreground border-border/60 shrink-0">{ip}</Badge>
  );
  if (!asnRaw) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs"><IpTooltipBody asn={asnRaw} /></TooltipContent>
    </Tooltip>
  );
}

function AsnBadge({ label, asnRaw }: { label: string; asnRaw: AsnData | null }) {
  const badge = (
    <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0 text-muted-foreground border-border/60 shrink-0">{label}</Badge>
  );
  if (!asnRaw) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs"><IpTooltipBody asn={asnRaw} /></TooltipContent>
    </Tooltip>
  );
}

function ContextLine({ asset }: { asset: AssetHealth }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0 bg-orange-500/10 text-orange-400 border-orange-500/30">
        {asset.ports} porta{asset.ports !== 1 ? 's' : ''}
      </Badge>
      <span className="text-muted-foreground/50 text-[10px]">·</span>
      <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
        {asset.services} serviço{asset.services !== 1 ? 's' : ''}
      </Badge>
      <span className="text-muted-foreground/50 text-[10px]">·</span>
      <CertStatusBadge tlsCerts={asset.tlsCerts} expiredCerts={asset.expiredCerts} expiringSoonCerts={asset.expiringSoonCerts} />
    </div>
  );
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
        asnRaw: asset.asn || null,
        worstSeverity,
        counts,
        totalFindings,
        services: asset.services.length + ((asset as any).webServices?.length || 0),
        ports: Array.isArray(asset.ports) ? asset.ports.length : 0,
        tlsCerts: asset.tlsCerts || [],
        expiredCerts: asset.expiredCerts || 0,
        expiringSoonCerts: asset.expiringSoonCerts || 0,
        allTechs: asset.allTechs || [],
      };
    })
    .sort((a, b) => {
      const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, ok: 0 };
      return (rank[b.worstSeverity] || 0) - (rank[a.worstSeverity] || 0);
    });

  return (
    <TooltipProvider delayDuration={200}>
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
                  <div
                    key={asset.ip}
                    className={cn(
                      'rounded-lg border border-border/40 bg-card/50 px-3 py-2 border-l-4 cursor-pointer',
                      'hover:bg-muted/30 transition-colors',
                      BORDER_COLORS.ok
                    )}
                    onClick={() => onAssetClick(asset.ip)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{asset.hostname}</span>
                      <span className="text-muted-foreground/50 text-[10px]">·</span>
                      <IpBadge ip={asset.ip} asnRaw={asset.asnRaw} />
                      {asset.asn && (
                        <>
                          <span className="text-muted-foreground/50 text-[10px]">·</span>
                          <AsnBadge label={asset.asn} asnRaw={asset.asnRaw} />
                        </>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] text-muted-foreground">{asset.services} svc</span>
                      </div>
                    </div>
                    <ContextLine asset={asset} />
                  </div>
                ) : (
                  <div
                    key={asset.ip}
                    className={cn(
                      'rounded-lg border border-border/40 bg-card/50 p-3 border-l-4 cursor-pointer',
                      'hover:bg-muted/30 transition-colors',
                      BORDER_COLORS[asset.worstSeverity]
                    )}
                    onClick={() => onAssetClick(asset.ip)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{asset.hostname}</span>
                      <span className="text-muted-foreground/50 text-[10px]">·</span>
                      <IpBadge ip={asset.ip} asnRaw={asset.asnRaw} />
                      {asset.asn && (
                        <>
                          <span className="text-muted-foreground/50 text-[10px]">·</span>
                          <AsnBadge label={asset.asn} asnRaw={asset.asnRaw} />
                        </>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{asset.services} svc</span>
                    </div>
                    <ContextLine asset={asset} />
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {asset.counts.critical > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-500/20 text-red-500 border-red-500/30">{asset.counts.critical}C</Badge>}
                      {asset.counts.high > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-500/20 text-orange-500 border-orange-500/30">{asset.counts.high}H</Badge>}
                      {asset.counts.medium > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-yellow-500/20 text-yellow-500 border-yellow-500/30">{asset.counts.medium}M</Badge>}
                      {asset.counts.low > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-400/20 text-blue-400 border-blue-400/30">{asset.counts.low}L</Badge>}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
