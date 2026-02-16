import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AttackSurfaceScanDialog } from '@/components/external-domain/AttackSurfaceScanDialog';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Globe,
  Server,
  ChevronDown,
  ChevronRight,
  Loader2,
  Radar,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Play,
  XCircle,
  Shield,
  Lock,
  ExternalLink,
  ShieldAlert,
  Search,
  ArrowUpDown } from
'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useLatestAttackSurfaceSnapshot,
  useRunningAttackSurfaceSnapshot,
  useAttackSurfaceScan,
  useAttackSurfaceCancelScan,
  useAttackSurfaceRescanIP,
  type AttackSurfaceSnapshot,
  type AttackSurfaceService,
  type AttackSurfaceWebService,
  type AttackSurfaceCVE } from
'@/hooks/useAttackSurfaceData';
import { Button } from '@/components/ui/button';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

/* ──────────────────────────── helpers ──────────────────────────── */

function getTechBadgeColor(tech: string): string {
  const t = tech.toLowerCase();
  if (['hsts', 'csp', 'x-frame-options', 'x-xss-protection'].some((k) => t.includes(k)))
  return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  if (['nginx', 'apache', 'iis', 'litespeed', 'caddy'].some((k) => t.includes(k)))
  return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  if (['php', 'python', 'node', 'java', 'ruby', 'asp.net', '.net'].some((k) => t.includes(k)))
  return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  if (['wordpress', 'nextcloud', 'drupal', 'joomla', 'react', 'angular', 'vue', 'django', 'laravel'].some((k) => t.includes(k)))
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return '';
}

function SeverityBadge({ severity }: {severity: string;}) {
  const colors: Record<string, string> = {
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-info/20 text-info border-info/30'
  };
  return (
    <Badge variant="outline" className={colors[severity?.toLowerCase()] || 'bg-muted text-muted-foreground'}>
      {severity || 'N/A'}
    </Badge>);

}

/* ──────────────────────────── hooks ──────────────────────────── */

function useClientId() {
  const { profile } = useAuth();
  const { effectiveProfile } = useEffectiveAuth();
  const userId = effectiveProfile?.id || profile?.id;

  return useQuery({
    queryKey: ['user-client-id', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase.
      from('user_clients').
      select('client_id').
      eq('user_id', userId).
      limit(1);
      return data?.[0]?.client_id ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10
  });
}

function useAttackSurfaceProgress(clientId?: string) {
  return useQuery({
    queryKey: ['attack-surface-progress', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await (supabase.
      from('attack_surface_snapshots' as any).
      select('id, status, created_at').
      eq('client_id', clientId).
      order('created_at', { ascending: false }).
      limit(1) as any);
      if (error) throw error;
      const snapshot = (data as any[])?.[0];
      if (!snapshot) return null;
      if (snapshot.status === 'completed') return { status: 'completed' as const, percent: 100, total: 0, done: 0 };
      const [totalRes, doneRes] = await Promise.all([
      supabase.from('attack_surface_tasks').select('id', { count: 'exact', head: true }).eq('snapshot_id', snapshot.id),
      supabase.from('attack_surface_tasks').select('id', { count: 'exact', head: true }).eq('snapshot_id', snapshot.id).eq('status', 'completed')]
      );
      const total = totalRes.count ?? 0;
      const done = doneRes.count ?? 0;
      const percent = total > 0 ? Math.round(done / total * 100) : 0;
      return { status: snapshot.status as string, percent, total, done };
    },
    enabled: !!clientId,
    refetchInterval: 10000,
    staleTime: 5000
  });
}

/* ──────────────── CVE-to-IP matching (CPE + vulns) ──────────────── */

interface CachedCVERecord {
  cve_id: string;
  title: string | null;
  severity: string | null;
  score: number | null;
  advisory_url: string | null;
  products: string[] | null;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function isVersionInRange(
version: string,
range: {gte?: string;lt?: string;lte?: string;})
: boolean {
  if (range.gte && compareVersions(version, range.gte) < 0) return false;
  if (range.lt && compareVersions(version, range.lt) >= 0) return false;
  if (range.lte && compareVersions(version, range.lte) > 0) return false;
  return true;
}

function matchCVEsToIP(
result: {services?: AttackSurfaceService[];web_services?: AttackSurfaceWebService[];vulns?: string[];} | undefined,
cveMatches: AttackSurfaceCVE[],
cachedCVEs?: CachedCVERecord[])
: AttackSurfaceCVE[] {
  if (!result) return [];

  const vulnSet = new Set(result.vulns || []);
  const productVersions = new Map<string, string | null>();
  const productNames = new Set<string>();

  for (const svc of result.services || []) {
    if (svc.cpe && Array.isArray(svc.cpe)) {
      for (const cpe of svc.cpe) {
        const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':');
        const product = (parts[2] || '').replace(/_/g, ' ').toLowerCase();
        const version = parts[3] && parts[3] !== '*' && parts[3] !== '' ? parts[3] : null;
        if (product) {
          productNames.add(product);
          const existing = productVersions.get(product);
          if (!existing && version) productVersions.set(product, version);else
          if (!existing) productVersions.set(product, null);
        }
      }
    }
    if (svc.product) {
      const p = svc.product.toLowerCase();
      productNames.add(p);
      if (!productVersions.has(p)) {
        productVersions.set(p, svc.version || null);
      }
    }
  }

  for (const ws of result.web_services || []) {
    for (const tech of ws.technologies || []) {
      const [name, ver] = tech.split(':');
      const techName = name.trim().toLowerCase();
      const techVer = ver?.trim() || null;
      if (techName) {
        productNames.add(techName);
        const existing = productVersions.get(techName);
        if (!existing && techVer) productVersions.set(techName, techVer);else
        if (!existing) productVersions.set(techName, null);
      }
    }
    if (ws.server) {
      const [name, ver] = ws.server.toLowerCase().split('/');
      const p = name.trim();
      if (p) {
        productNames.add(p);
        if (!productVersions.has(p)) {
          productVersions.set(p, ver?.trim() || null);
        }
      }
    }
  }

  const matched = new Map<string, AttackSurfaceCVE>();
  if (cveMatches.length > 0 && (vulnSet.size > 0 || productNames.size > 0)) {
    for (const c of cveMatches) {
      if (vulnSet.has(c.cve_id)) {matched.set(c.cve_id, c);continue;}
      const titleLower = (c.title || '').toLowerCase();
      const cveProducts = (c.products || []).map((p: string) => p.toLowerCase());
      for (const product of productNames) {
        if (titleLower.includes(product) || cveProducts.some((cp: string) => cp.includes(product))) {
          matched.set(c.cve_id, c);
          break;
        }
      }
    }
  }

  if (cachedCVEs && productVersions.size > 0) {
    for (const cached of cachedCVEs) {
      if (matched.has(cached.cve_id)) continue;
      const cachedProducts = cached.products || [];
      let didMatch = false;

      for (const productEntry of cachedProducts) {
        if (didMatch) break;
        const productStr = typeof productEntry === 'string' ? productEntry : '';
        const tokens = productStr.split(' ').filter(Boolean);
        if (tokens.length < 2) continue;

        const hasRange = tokens.some((t) => t === '>=' || t === '<' || t === '<=');

        if (hasRange) {
          const rangeInfo: {product: string;gte?: string;lt?: string;lte?: string;} = { product: '' };
          const nonRangeTokens: string[] = [];
          for (let i = 0; i < tokens.length; i++) {
            if (tokens[i] === '>=' && tokens[i + 1]) {rangeInfo.gte = tokens[++i];} else
            if (tokens[i] === '<' && tokens[i + 1]) {rangeInfo.lt = tokens[++i];} else
            if (tokens[i] === '<=' && tokens[i + 1]) {rangeInfo.lte = tokens[++i];} else
            {nonRangeTokens.push(tokens[i]);}
          }
          rangeInfo.product = nonRangeTokens.length >= 2 ?
          nonRangeTokens.slice(1).join(' ').toLowerCase() :
          (nonRangeTokens[0] || '').toLowerCase();

          for (const [product, detectedVersion] of productVersions) {
            if (!rangeInfo.product.includes(product) && !product.includes(rangeInfo.product)) continue;
            if (!detectedVersion) continue;
            if (isVersionInRange(detectedVersion, rangeInfo)) {didMatch = true;break;}
          }
        } else {
          const cachedVersion = tokens.length >= 3 ? tokens[tokens.length - 1] : '*';
          const cachedProduct = (tokens.length >= 3 ? tokens.slice(1, -1).join(' ') : tokens[1]).toLowerCase();

          for (const [product, detectedVersion] of productVersions) {
            if (!cachedProduct.includes(product) && !product.includes(cachedProduct)) continue;
            if (!detectedVersion) continue;
            if (cachedVersion === '*' || cachedVersion === detectedVersion) {didMatch = true;break;}
          }
        }
      }

      if (didMatch) {
        matched.set(cached.cve_id, {
          cve_id: cached.cve_id,
          title: cached.title || '',
          severity: cached.severity || 'medium',
          score: cached.score,
          advisory_url: cached.advisory_url || '',
          products: cached.products || []
        });
      }
    }
  }

  return Array.from(matched.values());
}

/* ──────────────── CVE-to-Service matching ──────────────── */

function matchCVEsToService(serviceName: string, cves: AttackSurfaceCVE[]): AttackSurfaceCVE[] {
  if (!serviceName) return [];
  const name = serviceName.toLowerCase();
  return cves.
  filter((cve) =>
  (cve.products || []).some((p) => p.toLowerCase().includes(name)) ||
  (cve.title || '').toLowerCase().includes(name)
  ).
  sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function getOrphanCVEs(
services: AttackSurfaceService[],
webServices: AttackSurfaceWebService[],
cves: AttackSurfaceCVE[])
: AttackSurfaceCVE[] {
  const serviceNames = new Set<string>();
  for (const svc of services) {
    if (svc.product) serviceNames.add(svc.product.toLowerCase());
  }
  for (const ws of webServices) {
    if (ws.server) {
      const [name] = ws.server.toLowerCase().split('/');
      serviceNames.add(name.trim());
    }
    for (const t of ws.technologies || []) {
      const [name] = t.split(':');
      serviceNames.add(name.trim().toLowerCase());
    }
  }
  return cves.filter((cve) => {
    for (const name of serviceNames) {
      if ((cve.products || []).some((p) => p.toLowerCase().includes(name)) ||
      (cve.title || '').toLowerCase().includes(name)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/* ──────────────────────────── ExposedAsset model ──────────────────────────── */

interface TLSCertInfo {
  subject_cn: string;
  issuer: string;
  not_after: string | null;
  daysRemaining: number | null;
}

interface ExposedAsset {
  hostname: string;
  ip: string;
  asn: {asn: string;provider: string;org: string;is_cdn: boolean;} | null;
  source: 'dns' | 'firewall';
  ports: number[];
  services: AttackSurfaceService[];
  webServices: AttackSurfaceWebService[];
  tlsCerts: TLSCertInfo[];
  cves: AttackSurfaceCVE[];
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expiredCerts: number;
  expiringSoonCerts: number;
  allTechs: string[];
}

function maxCVESeverityRank(asset: ExposedAsset): number {
  let max = 0;
  for (const cve of asset.cves) {
    const sev = (cve.severity || 'medium').toLowerCase();
    const rank = sev === 'critical' ? 4 : sev === 'high' ? 3 : sev === 'medium' ? 2 : 1;
    if (rank > max) max = rank;
  }
  return max;
}

function buildAssets(
snapshot: AttackSurfaceSnapshot,
cachedCVEs?: CachedCVERecord[])
: ExposedAsset[] {
  const assets: ExposedAsset[] = [];

  for (const ip of Object.keys(snapshot.results)) {
    const result = snapshot.results[ip];
    const sourceIP = snapshot.source_ips.find((s) => s.ip === ip);
    const hostname = sourceIP?.label || result.hostnames?.[0] || ip;

    // TLS certs deduplication
    const certMap = new Map<string, TLSCertInfo>();
    for (const ws of result.web_services || []) {
      if (!ws.tls?.subject_cn) continue;
      const key = `${ws.tls.subject_cn}__${ws.tls.not_after ?? ''}`;
      if (certMap.has(key)) continue;
      const issuer = ws.tls.issuer ?
      Array.isArray(ws.tls.issuer) ? ws.tls.issuer.join(', ') : ws.tls.issuer :
      '—';
      let daysRemaining: number | null = null;
      if (ws.tls.not_after) {
        try {daysRemaining = differenceInDays(parseISO(ws.tls.not_after), new Date());} catch {/* ignore */}
      }
      certMap.set(key, { subject_cn: ws.tls.subject_cn, issuer, not_after: ws.tls.not_after ?? null, daysRemaining });
    }

    const tlsCerts = Array.from(certMap.values());
    const expiredCerts = tlsCerts.filter((c) => c.daysRemaining !== null && c.daysRemaining < 0).length;
    const expiringSoonCerts = tlsCerts.filter((c) => c.daysRemaining !== null && c.daysRemaining >= 0 && c.daysRemaining <= 30).length;

    const cves = matchCVEsToIP(result, snapshot.cve_matches, cachedCVEs);

    // All technologies
    const techSet = new Set<string>();
    for (const svc of result.services || []) {
      if (svc.product) techSet.add(svc.version ? `${svc.product}/${svc.version}` : svc.product);
    }
    for (const ws of result.web_services || []) {
      if (ws.server) techSet.add(ws.server);
      for (const t of ws.technologies || []) techSet.add(t);
    }

    // Extract tech from NSE scripts
    for (const svc of result.services || []) {
      const scripts = svc.scripts || {};

      // ssl-cert: extract org/CN from subject
      if (scripts['ssl-cert']) {
        const orgMatch = scripts['ssl-cert'].match(/organizationName=([^\n\/,]+)/i);
        if (orgMatch) techSet.add(orgMatch[1].trim());else
        {
          const cnMatch = scripts['ssl-cert'].match(/commonName=([^\n\/,]+)/i);
          if (cnMatch && !cnMatch[1].includes('*')) techSet.add(cnMatch[1].trim());
        }
      }

      // smb-os-discovery
      if (scripts['smb-os-discovery']) {
        const osMatch = scripts['smb-os-discovery'].match(/OS:\s*(.+)/i);
        if (osMatch) techSet.add(osMatch[1].trim());
      }

      // rdp-ntlm-info
      if (scripts['rdp-ntlm-info']) {
        const prodMatch = scripts['rdp-ntlm-info'].match(/Product_Version:\s*(.+)/i);
        if (prodMatch) techSet.add(`Windows ${prodMatch[1].trim()}`);
      }

      // http-server-header (fallback if no httpx server)
      if (scripts['http-server-header']) {
        techSet.add(scripts['http-server-header'].trim().split('\n')[0]);
      }
    }

    // Risk score calculation
    let riskScore = 0;
    for (const cve of cves) {
      const sev = (cve.severity || 'medium').toLowerCase();
      if (sev === 'critical') riskScore += 10;else
      if (sev === 'high') riskScore += 7;else
      if (sev === 'medium') riskScore += 4;else
      riskScore += 1;
    }
    riskScore += expiredCerts * 5;
    riskScore += expiringSoonCerts * 2;

    const riskLevel: ExposedAsset['riskLevel'] =
    riskScore >= 30 ? 'CRITICAL' :
    riskScore >= 15 ? 'HIGH' :
    riskScore >= 5 ? 'MEDIUM' : 'LOW';

    assets.push({
      hostname,
      ip,
      asn: (result as any).asn || null,
      source: sourceIP?.source as 'dns' | 'firewall' || 'dns',
      ports: result.ports || [],
      services: result.services || [],
      webServices: result.web_services || [],
      tlsCerts,
      cves,
      riskScore,
      riskLevel,
      expiredCerts,
      expiringSoonCerts,
      allTechs: Array.from(techSet)
    });
  }

  return assets.sort((a, b) => {
    const sevDiff = maxCVESeverityRank(b) - maxCVESeverityRank(a);
    if (sevDiff !== 0) return sevDiff;
    const svcDiff = b.services.length + b.webServices.length - (a.services.length + a.webServices.length);
    if (svcDiff !== 0) return svcDiff;
    return b.ports.length - a.ports.length;
  });
}

/* ──────────────────────────── Stat Card ──────────────────────────── */

function StatCard({ icon: Icon, label, value, iconClass }: {icon: React.ElementType;label: string;value: number | string;iconClass?: string;}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("p-2 rounded-lg bg-muted/50", iconClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>);

}

/* ──────────────────────────── Asset Card ──────────────────────────── */

const riskColors: Record<string, {badge: string;icon: string;}> = {
  CRITICAL: { badge: 'bg-destructive/20 text-destructive border-destructive/30', icon: 'text-destructive' },
  HIGH: { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: 'text-orange-400' },
  MEDIUM: { badge: 'bg-warning/20 text-warning border-warning/30', icon: 'text-warning' },
  LOW: { badge: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: 'text-teal-400' }
};

const sevColors: Record<string, string> = {
  critical: 'bg-destructive/20 text-destructive border-destructive/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-warning/20 text-warning border-warning/30',
  low: 'bg-info/20 text-info border-info/30'
};

function CVESummaryBadges({ cves }: {cves: AttackSurfaceCVE[];}) {
  const counts: Record<string, number> = {};
  for (const cve of cves) {
    const sev = (cve.severity || 'medium').toLowerCase();
    counts[sev] = (counts[sev] || 0) + 1;
  }
  const order = ['critical', 'high', 'medium', 'low'];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {order.filter((s) => counts[s]).map((s, idx, arr) =>
      <React.Fragment key={s}>
          {idx > 0 && <span className="text-border">•</span>}
          <Badge variant="outline" className={cn("text-[10px] px-1.5", sevColors[s])}>
            {counts[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
          </Badge>
        </React.Fragment>
      )}
    </div>);

}

function CertStatusBadge({ asset }: {asset: ExposedAsset;}) {
  if (asset.tlsCerts.length === 0) return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
      <Lock className="w-3 h-3 mr-1" /> Sem Certificado
    </Badge>);

  if (asset.expiredCerts > 0) {
    const worst = asset.tlsCerts.reduce((a, b) =>
    (a.daysRemaining ?? 9999) < (b.daysRemaining ?? 9999) ? a : b
    );
    return (
      <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">
        <Lock className="w-3 h-3 mr-1" /> Certificado Expirado há {Math.abs(worst.daysRemaining ?? 0)}d
      </Badge>);

  }
  if (asset.expiringSoonCerts > 0) {
    const worst = asset.tlsCerts.reduce((a, b) =>
    (a.daysRemaining ?? 9999) < (b.daysRemaining ?? 9999) ? a : b
    );
    return (
      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-[10px]">
        <Lock className="w-3 h-3 mr-1" /> Certificado Expira em {worst.daysRemaining}d
      </Badge>);

  }
  return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
      <Lock className="w-3 h-3 mr-1" /> Certificado Válido
    </Badge>);

}

/* ──────────────── ServiceRow (expandable with inline CVEs) ──────────────── */

function CVEInlineBadge({ cve }: {cve: AttackSurfaceCVE;}) {
  const sev = (cve.severity || 'medium').toLowerCase();
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-mono", sevColors[sev] || '')}>
      {cve.cve_id} ({cve.score ?? '—'})
    </Badge>);

}

function CVEExpandedList({ cves }: {cves: AttackSurfaceCVE[];}) {
  if (cves.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-border/50 overflow-hidden">
      {cves.map((cve) =>
      <a
        key={cve.cve_id}
        href={cve.advisory_url || `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-3 py-2 border-b border-border/30 last:border-0 hover:bg-muted/50 transition-colors">

          <SeverityBadge severity={cve.severity} />
          <span className="font-mono text-sm">{cve.cve_id}</span>
          {cve.score != null &&
        <span className="text-xs font-mono text-muted-foreground">({cve.score})</span>
        }
          <span className="text-xs text-muted-foreground truncate flex-1">{cve.title}</span>
          <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
        </a>
      )}
    </div>);

}

function NseScriptsBlock({ scripts }: {scripts: Record<string, string>;}) {
  const entries = Object.entries(scripts).filter(([, v]) => v && v.trim());
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {entries.map(([scriptName, output]) =>
      <div key={scriptName} className="rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/30">
            <span className="text-xs font-mono font-semibold text-primary">{scriptName}</span>
          </div>
          <pre className="px-3 py-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words leading-relaxed">
            {output.trim()}
          </pre>
        </div>
      )}
    </div>);

}

function extractPortFromUrl(url: string): number | null {
  try {
    const u = new URL(url);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : null;
  } catch {return null;}
}

function UnifiedServiceRow({ ws, svc, cves }: {ws: AttackSurfaceWebService;svc: AttackSurfaceService | null;cves: AttackSurfaceCVE[];}) {
  const [expanded, setExpanded] = useState(false);
  const top2 = cves.slice(0, 2);
  const hasMore = cves.length > 2;
  const hasScripts = svc?.scripts && Object.keys(svc.scripts).length > 0;
  const isExpandable = cves.length > 0 || hasScripts;

  const statusColor = ws.status_code >= 200 && ws.status_code < 300 ?
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
  ws.status_code >= 300 && ws.status_code < 400 ?
  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
  'bg-destructive/20 text-destructive border-destructive/30';

  return (
    <div>
      <div
        className={cn(
          "rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2",
          isExpandable && "cursor-pointer hover:bg-muted/40 transition-colors"
        )}
        onClick={() => isExpandable && setExpanded(!expanded)}>

        <div className="flex items-center gap-2 flex-wrap">
          {isExpandable && (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />)
          }
          <a href={ws.url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono hover:underline text-blue-400 truncate max-w-[400px]" onClick={(e) => e.stopPropagation()}>
            {ws.url}
          </a>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColor)}>{ws.status_code}</Badge>
          {svc && (svc.product || svc.name) &&
          <span className="text-xs text-muted-foreground">• {svc.product || svc.name}{svc.version ? `/${svc.version}` : ''}</span>
          }
          {svc?.extra_info && <span className="text-muted-foreground/70 text-xs italic">{svc.extra_info}</span>}
          {ws.server && !svc?.product && <span className="text-xs text-muted-foreground">• {ws.server}</span>}
          {hasScripts && !expanded &&
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">NSE</Badge>
          }
          {!expanded && top2.length > 0 &&
          <div className="flex items-center gap-1.5 ml-auto">
              {top2.map((cve) => <CVEInlineBadge key={cve.cve_id} cve={cve} />)}
              {hasMore && <span className="text-[10px] text-muted-foreground">+{cves.length - 2}</span>}
            </div>
          }
        </div>
        {ws.technologies && ws.technologies.length > 0 &&
        <div className="flex flex-wrap gap-1">
            {ws.technologies.map((t, j) =>
          <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0", getTechBadgeColor(t))}>{t}</Badge>
          )}
          </div>
        }
      </div>
      {expanded &&
      <div className="pl-6">
          {hasScripts && <NseScriptsBlock scripts={svc!.scripts!} />}
          <CVEExpandedList cves={cves} />
        </div>
      }
    </div>);

}

function NmapServiceRow({ svc, cves }: {svc: AttackSurfaceService;cves: AttackSurfaceCVE[];}) {
  const [expanded, setExpanded] = useState(false);
  const top2 = cves.slice(0, 2);
  const hasMore = cves.length > 2;
  const hasScripts = svc.scripts && Object.keys(svc.scripts).length > 0;
  const isExpandable = cves.length > 0 || hasScripts;

  return (
    <div>
      <div
        className={cn(
          "rounded-lg border border-border/50 bg-muted/20 px-3 py-2 flex items-center gap-3 flex-wrap text-sm",
          isExpandable && "cursor-pointer hover:bg-muted/40 transition-colors"
        )}
        onClick={() => isExpandable && setExpanded(!expanded)}>

        {isExpandable && (
        expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />)
        }
        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">{svc.port}/{svc.transport}</Badge>
        <span className="font-medium">{svc.product || svc.name || '—'}</span>
        {svc.version && <span className="text-muted-foreground text-xs">{svc.version}</span>}
        {svc.extra_info && <span className="text-muted-foreground/70 text-xs italic">{svc.extra_info}</span>}
        {svc.banner && !svc.extra_info && <span className="text-muted-foreground text-xs truncate max-w-[300px]">{svc.banner}</span>}
        {hasScripts && !expanded &&
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">NSE</Badge>
        }
        {!expanded && top2.length > 0 &&
        <div className="flex items-center gap-1.5 ml-auto">
            {top2.map((cve) => <CVEInlineBadge key={cve.cve_id} cve={cve} />)}
            {hasMore && <span className="text-[10px] text-muted-foreground">+{cves.length - 2}</span>}
          </div>
        }
      </div>
      {expanded &&
      <div className="pl-6">
          {hasScripts && <NseScriptsBlock scripts={svc.scripts!} />}
          <CVEExpandedList cves={cves} />
        </div>
      }
    </div>);

}

function WebServiceRow({ ws, cves }: {ws: AttackSurfaceWebService;cves: AttackSurfaceCVE[];}) {
  const [expanded, setExpanded] = useState(false);
  const top2 = cves.slice(0, 2);
  const hasMore = cves.length > 2;

  const statusColor = ws.status_code >= 200 && ws.status_code < 300 ?
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
  ws.status_code >= 300 && ws.status_code < 400 ?
  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
  'bg-destructive/20 text-destructive border-destructive/30';

  // Collect all service names for CVE matching
  const serviceNames: string[] = [];
  if (ws.server) {const [name] = ws.server.toLowerCase().split('/');serviceNames.push(name.trim());}
  for (const t of ws.technologies || []) {const [name] = t.split(':');serviceNames.push(name.trim().toLowerCase());}

  return (
    <div>
      <div
        className={cn(
          "rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2",
          cves.length > 0 && "cursor-pointer hover:bg-muted/40 transition-colors"
        )}
        onClick={() => cves.length > 0 && setExpanded(!expanded)}>

        <div className="flex items-center gap-2 flex-wrap">
          {cves.length > 0 && (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />)
          }
          <a href={ws.url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono hover:underline text-blue-400 truncate max-w-[400px]" onClick={(e) => e.stopPropagation()}>
            {ws.url}
          </a>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusColor)}>{ws.status_code}</Badge>
          {ws.server && <span className="text-xs text-muted-foreground">• {ws.server}</span>}
          {!expanded && top2.length > 0 &&
          <div className="flex items-center gap-1.5 ml-auto">
              {top2.map((cve) => <CVEInlineBadge key={cve.cve_id} cve={cve} />)}
              {hasMore && <span className="text-[10px] text-muted-foreground">+{cves.length - 2}</span>}
            </div>
          }
        </div>
        {ws.technologies && ws.technologies.length > 0 &&
        <div className="flex flex-wrap gap-1">
            {ws.technologies.map((t, j) =>
          <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0", getTechBadgeColor(t))}>{t}</Badge>
          )}
          </div>
        }
      </div>
      {expanded && <div className="pl-6"><CVEExpandedList cves={cves} /></div>}
    </div>);

}

function OrphanCVEsBlock({ cves }: {cves: AttackSurfaceCVE[];}) {
  const [expanded, setExpanded] = useState(false);
  if (cves.length === 0) return null;
  const top2 = cves.slice(0, 2);

  return (
    <div>
      <div
        className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(!expanded)}>

        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <ShieldAlert className="w-4 h-4 text-warning" />
        <span className="font-medium">Outras Vulnerabilidades ({cves.length})</span>
        {!expanded &&
        <div className="flex items-center gap-1.5 ml-auto">
            {top2.map((cve) => <CVEInlineBadge key={cve.cve_id} cve={cve} />)}
            {cves.length > 2 && <span className="text-[10px] text-muted-foreground">+{cves.length - 2}</span>}
          </div>
        }
      </div>
      {expanded && <div className="pl-6"><CVEExpandedList cves={cves} /></div>}
    </div>);

}

function TimelineSection({
  icon: Icon,
  iconColor,
  iconBorderClass = "border-primary/40 bg-primary/10",
  title,
  isLast,
  children







}: {icon: React.ElementType;iconColor: string;iconBorderClass?: string;title: string;isLast?: boolean;children: React.ReactNode;}) {
  return (
    <div className="relative">
      {/* Vertical connector line between sections */}
      {!isLast &&
      <div className="absolute left-6 top-full w-1 h-4 bg-primary/50 z-0" />
      }
      {/* Bordered container with header + content inside */}
      <div className="rounded-xl border border-border/60 bg-card/30 mb-4">
        {/* Header row: icon + title */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
          <div className={cn(
            "w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0",
            iconBorderClass
          )}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>);

}

function AssetCard({ asset, isSuperRole, onRescan, isRescanning }: {asset: ExposedAsset;isSuperRole: boolean;onRescan: (asset: ExposedAsset) => void;isRescanning: boolean;}) {
  const [open, setOpen] = useState(false);
  const rc = riskColors[asset.riskLevel];
  const MAX_TECHS = 4;
  const visibleTechs = asset.allTechs.slice(0, MAX_TECHS);
  const overflowTechs = asset.allTechs.length - MAX_TECHS;

  return (
    <Card className="glass-card transition-all">
      {/* Summary row */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}>

        <div className="flex items-start gap-3">
          <Globe className={cn("w-5 h-5 mt-0.5 shrink-0", rc.icon)} />
          <div className="flex-1 min-w-0 space-y-2">
            {/* Row 1: hostname + IP + ASN + risk badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base font-semibold truncate">{asset.hostname}</span>
              {asset.hostname !== asset.ip &&
              <span className="text-sm text-muted-foreground font-mono">{asset.ip}</span>
              }
              {asset.asn?.asn &&
              <Badge variant="outline" className="text-[10px] px-1.5 bg-violet-500/10 text-violet-400 border-violet-500/30 font-mono">
                  {asset.asn.asn}
                  {asset.asn.provider !== 'unknown' && ` (${asset.asn.provider})`}
                </Badge>
              }
              <Badge variant="outline" className={cn("text-[10px] ml-auto shrink-0", rc.badge)}>
                {asset.riskLevel}
              </Badge>
            </div>

            {/* Row 2: ports + techs */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 bg-orange-500/10 text-orange-400 border-orange-500/30">{asset.ports.length} porta{asset.ports.length !== 1 ? 's' : ''}</Badge>
              <span className="text-border">•</span>
              <Badge variant="outline" className="text-[10px] px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/30">{asset.services.length + asset.webServices.length} serviço{asset.services.length + asset.webServices.length !== 1 ? 's' : ''}</Badge>
              <span className="text-border">•</span>
              <CertStatusBadge asset={asset} />
              {visibleTechs.length > 0 &&
              <>
                  <span className="text-border">•</span>
                  <div className="flex flex-wrap gap-1">
                    {visibleTechs.map((t, i) =>
                  <Badge key={i} variant="outline" className={cn("text-[10px] px-1.5", getTechBadgeColor(t))}>{t}</Badge>
                  )}
                    {overflowTechs > 0 &&
                  <Badge variant="outline" className="text-[10px] px-1.5 border-dashed text-muted-foreground">+{overflowTechs}</Badge>
                  }
                  </div>
                </>
              }
            </div>

            {/* Row 3: CVE summary + Testar button */}
            <div className="flex items-center gap-3 flex-wrap">
              {asset.cves.length > 0 ?
              <CVESummaryBadges cves={asset.cves} /> :

              <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground border-border">0 CVEs</Badge>
              }
              {isSuperRole &&
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                disabled={isRescanning}
                onClick={(e) => {
                  e.stopPropagation();
                  onRescan(asset);
                }}>

                  {isRescanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Testar
                </Button>
              }
            </div>
          </div>
          <div className="shrink-0 mt-1">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (() => {
        const hasPorts = asset.ports.length > 0;
        const hasServices = asset.services.length > 0 || asset.webServices.length > 0;
        const hasCerts = asset.tlsCerts.length > 0;
        const orphans = hasServices ? getOrphanCVEs(asset.services, asset.webServices, asset.cves) : [];

        return (
          <div className="border-t border-border/50 py-6 pr-4 pl-10 bg-muted/10">
           {/* Block 1: Ports */}
           {hasPorts &&
            <TimelineSection
              icon={Server}
              iconColor="text-orange-400"
              iconBorderClass="border-orange-400/40 bg-orange-400/10"
              title={`Portas Abertas (${asset.ports.length})`}
              isLast={!hasServices && !hasCerts}>

               <div className="flex flex-wrap gap-1.5">
                 {asset.ports.map((port) =>
                <Badge key={port} variant="outline" className="font-mono text-xs px-2 py-0.5">{port}</Badge>
                )}
               </div>
             </TimelineSection>
            }

           {/* Block 2: Services & Technologies (with inline CVEs) */}
           {hasServices &&
            <TimelineSection
              icon={Globe}
              iconColor="text-blue-400"
              iconBorderClass="border-blue-400/40 bg-blue-400/10"
              title="Serviços & Tecnologias"
              isLast={!hasCerts}>

               <div className="space-y-2">
                  {(() => {
                  // Build port -> nmapService map
                  const portToNmap = new Map<number, AttackSurfaceService>();
                  for (const svc of asset.services) {
                    if (svc.port && !portToNmap.has(svc.port)) {
                      portToNmap.set(svc.port, svc);
                    }
                  }
                  const consumedPorts = new Set<number>();

                  // Render unified rows for webServices with matching nmap services
                  const unifiedRows = asset.webServices.map((ws, i) => {
                    const port = extractPortFromUrl(ws.url);
                    const nmapSvc = port !== null ? portToNmap.get(port) ?? null : null;
                    if (nmapSvc && port !== null) consumedPorts.add(port);

                    // Collect CVEs from both sources
                    const cveMap = new Map<string, AttackSurfaceCVE>();
                    // From nmap service
                    if (nmapSvc) {
                      for (const cve of matchCVEsToService(nmapSvc.product || nmapSvc.name || '', asset.cves)) {
                        cveMap.set(cve.cve_id, cve);
                      }
                    }
                    // From web service
                    const names: string[] = [];
                    if (ws.server) {const [n] = ws.server.toLowerCase().split('/');names.push(n.trim());}
                    for (const t of ws.technologies || []) {const [n] = t.split(':');names.push(n.trim().toLowerCase());}
                    for (const name of names) {
                      for (const cve of matchCVEsToService(name, asset.cves)) {
                        cveMap.set(cve.cve_id, cve);
                      }
                    }
                    const combinedCves = Array.from(cveMap.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

                    return <UnifiedServiceRow key={`unified-${i}`} ws={ws} svc={nmapSvc} cves={combinedCves} />;
                  });

                  // Render remaining nmap services not consumed by any webService
                  const remainingNmap = asset.services.
                  filter((s) => !consumedPorts.has(s.port) && (s.product || s.name || s.scripts && Object.keys(s.scripts).length > 0)).
                  map((svc, i) =>
                  <NmapServiceRow key={`svc-remaining-${i}`} svc={svc} cves={matchCVEsToService(svc.product || svc.name || '', asset.cves)} />
                  );

                  return [...unifiedRows, ...remainingNmap];
                })()}
                  <OrphanCVEsBlock cves={orphans} />
               </div>
             </TimelineSection>
            }

           {/* Block 3: TLS Certificates */}
           {hasCerts &&
            <TimelineSection
              icon={Shield}
              iconColor="text-primary"
              title={`Certificados TLS (${asset.tlsCerts.length})`}
              isLast={true}>

               <div className="space-y-2">
                 {asset.tlsCerts.map((cert, i) => {
                  const isExpired = cert.daysRemaining !== null && cert.daysRemaining < 0;
                  const isExpiring = cert.daysRemaining !== null && cert.daysRemaining >= 0 && cert.daysRemaining <= 30;
                  return (
                    <div key={i} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 flex items-center gap-4 flex-wrap text-sm">
                       <div className="flex items-center gap-2">
                         <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                         <span className="font-mono font-medium">{cert.subject_cn}</span>
                       </div>
                       <span className="text-xs text-muted-foreground">Emissor: {cert.issuer}</span>
                       {cert.not_after &&
                      <span className="text-xs text-muted-foreground">
                           Expira: {new Date(cert.not_after).toLocaleDateString('pt-BR')}
                         </span>
                      }
                       {isExpired ?
                      <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">
                           Expirado há {Math.abs(cert.daysRemaining!)}d
                         </Badge> :
                      isExpiring ?
                      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-[10px]">
                           Expira em {cert.daysRemaining}d
                         </Badge> :
                      cert.daysRemaining !== null ?
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                           {cert.daysRemaining}d restantes
                         </Badge> :
                      null}
                     </div>);

                })}
               </div>
             </TimelineSection>
            }
         </div>);

      })()}
    </Card>);

}

/* ──────────────────────────── Page ──────────────────────────── */

type SortMode = 'risk' | 'cves' | 'ports' | 'alpha';

export default function AttackSurfaceAnalyzerPage() {
  const { effectiveRole } = useEffectiveAuth();
  const { data: userClientId } = useClientId();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const { data: workspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole,
    staleTime: 1000 * 60 * 5
  });

  useEffect(() => {
    if (isSuperRole && workspaces?.length && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [isSuperRole, workspaces, selectedWorkspaceId]);

  const selectedClientId = isSuperRole ? selectedWorkspaceId : userClientId;

  const scanMutation = useAttackSurfaceScan(selectedClientId ?? undefined);
  const cancelMutation = useAttackSurfaceCancelScan(selectedClientId ?? undefined);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const { data: snapshot, isLoading } = useLatestAttackSurfaceSnapshot(selectedClientId ?? undefined);
  const { data: progress } = useAttackSurfaceProgress(selectedClientId ?? undefined);

  const isRunning = progress?.status === 'pending' || progress?.status === 'running';
  const { data: runningSnapshot, refetch: refetchRunning, isFetching: isRefetchingRunning } = useRunningAttackSurfaceSnapshot(selectedClientId ?? undefined, isRunning);

  // Auto-refresh snapshot when rescan completes
  const queryClient = useQueryClient();
  const prevProgressStatus = useRef<string | null>(null);
  useEffect(() => {
    const currentStatus = progress?.status ?? null;
    if (currentStatus === 'completed' && prevProgressStatus.current && prevProgressStatus.current !== 'completed') {
      queryClient.invalidateQueries({ queryKey: ['attack-surface-latest', selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ['attack-surface-snapshots', selectedClientId] });
    }
    prevProgressStatus.current = currentStatus;
  }, [progress?.status, selectedClientId, queryClient]);

  const { data: cachedCVEs } = useQuery({
    queryKey: ['cve-cache', 'external_domain'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('cve_cache').
      select('cve_id, title, severity, score, advisory_url, products').
      eq('module_code', 'external_domain');
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        products: Array.isArray(row.products) ? row.products : []
      })) as CachedCVERecord[];
    },
    staleTime: 1000 * 60 * 5
  });
  const rescanMutation = useAttackSurfaceRescanIP(selectedClientId ?? undefined);

  // isRunning already declared above

  // Use running snapshot only when it already has partial results; otherwise keep showing last completed
  const hasPartialResults = runningSnapshot && Object.keys(runningSnapshot.results || {}).length > 0;
  const activeSnapshot = isRunning && hasPartialResults ? runningSnapshot : snapshot;

  // Build asset-centric data
  const assets = useMemo(() => {
    if (!activeSnapshot) return [];
    return buildAssets(activeSnapshot, cachedCVEs);
  }, [activeSnapshot, cachedCVEs]);

  // Search & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('risk');

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((a) =>
      a.hostname.toLowerCase().includes(q) ||
      a.ip.includes(q) ||
      a.allTechs.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    switch (sortMode) {
      case 'risk':return sorted.sort((a, b) => {
          const sevDiff = maxCVESeverityRank(b) - maxCVESeverityRank(a);
          if (sevDiff !== 0) return sevDiff;
          const svcDiff = b.services.length + b.webServices.length - (a.services.length + a.webServices.length);
          if (svcDiff !== 0) return svcDiff;
          return b.ports.length - a.ports.length;
        });
      case 'cves':return sorted.sort((a, b) => b.cves.length - a.cves.length);
      case 'ports':return sorted.sort((a, b) => b.ports.length - a.ports.length);
      case 'alpha':return sorted.sort((a, b) => a.hostname.localeCompare(b.hostname));
      default:return sorted;
    }
  }, [assets, searchTerm, sortMode]);

  // Executive stats
  const stats = useMemo(() => {
    let totalServices = 0;
    let criticalCVEs = 0;
    let expiredCerts = 0;
    for (const a of assets) {
      totalServices += a.services.length + a.webServices.length;
      criticalCVEs += a.cves.filter((c) => (c.severity || '').toLowerCase() === 'critical').length;
      expiredCerts += a.expiredCerts;
    }
    return { totalAssets: assets.length, totalServices, criticalCVEs, expiredCerts };
  }, [assets]);

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 lg:p-8 space-y-6">
          <PageBreadcrumb items={[
          { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
          { label: 'Analyzer' }]
          } />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Surface Analyzer</h1>
              <p className="text-muted-foreground">Visão consolidada de ativos expostos na internet</p>
            </div>
            <div className="flex items-center gap-3">
              {isSuperRole && workspaces &&
              <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger className="w-[220px]">
                    <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Selecione o workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) =>
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  )}
                  </SelectContent>
                </Select>
              }
              {isSuperRole && !isRunning &&
              <Button onClick={() => setScanDialogOpen(true)}>
                  <Play className="w-4 h-4" />
                  Executar Análise
                </Button>
              }
               {isSuperRole && isRunning &&
              <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Cancelar Análise
                </Button>
              }
            </div>
          </div>

          {/* Progress */}
          {isRunning && progress &&
          <Card className="glass-card border-teal-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span className="text-sm font-medium">Scan em andamento...</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground">
                      {progress.done} de {progress.total} IPs processados
                    </span>
                    <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-teal-400 hover:text-teal-300"
                    onClick={() => refetchRunning()}
                    disabled={isRefetchingRunning}>

                      <Loader2 className={cn("w-3 h-3", isRefetchingRunning && "animate-spin")} />
                      Atualizar
                    </Button>
                  </div>
                </div>
                <Progress value={progress.percent} className="h-2" />
              </CardContent>
            </Card>
          }

          {/* Executive Stats */}
          {activeSnapshot &&
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Globe} label="Ativos Expostos" value={stats.totalAssets} iconClass="text-teal-400" />
              <StatCard icon={Server} label="Serviços Detectados" value={stats.totalServices} iconClass="text-blue-400" />
              <StatCard icon={ShieldAlert} label="CVEs Críticas" value={stats.criticalCVEs} iconClass="text-destructive" />
              <StatCard icon={AlertTriangle} label="Certificados Expirados" value={stats.expiredCerts} iconClass="text-warning" />
            </div>
          }

          {/* Search + Sort */}
          {activeSnapshot && assets.length > 0 &&
          <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                placeholder="Buscar por hostname, IP ou tecnologia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9" />

              </div>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="w-[180px]">
                  <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="risk">Maior Risco</SelectItem>
                  <SelectItem value="cves">Mais CVEs</SelectItem>
                  <SelectItem value="ports">Mais Portas</SelectItem>
                  <SelectItem value="alpha">Alfabético</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }

          {/* Asset List */}
          {isLoading ?
          <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div> :
          !activeSnapshot || assets.length === 0 ?
          <Card className="glass-card">
              <CardContent className="py-16">
                <div className="text-center text-muted-foreground">
                  <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum dado disponível</p>
                  <p className="text-sm mt-1">O scan automático será executado diariamente às 00:00 UTC.</p>
                </div>
              </CardContent>
            </Card> :

          <div className="space-y-3">
              {filteredAssets.map((asset) =>
            <AssetCard
              key={asset.ip}
              asset={asset}
              isSuperRole={isSuperRole}
              onRescan={(a) => rescanMutation.mutate({ ip: a.ip, source: a.source, label: a.hostname, snapshotId: activeSnapshot!.id })}
              isRescanning={rescanMutation.isPending} />

            )}
              {filteredAssets.length === 0 && searchTerm &&
            <p className="text-center text-muted-foreground py-8">Nenhum ativo encontrado para "{searchTerm}"</p>
            }
            </div>
          }

          {/* Last scan timestamp */}
          {snapshot?.completed_at &&
          <div className="flex items-center gap-4 text-xs text-muted-foreground pb-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                Último scan concluído em {new Date(snapshot.completed_at).toLocaleString('pt-BR')}
              </div>
            </div>
          }
        </div>

        {selectedClientId &&
        <AttackSurfaceScanDialog
          open={scanDialogOpen}
          onOpenChange={setScanDialogOpen}
          clientId={selectedClientId}
          onStartScan={(ips) => {
            scanMutation.mutate(ips, {
              onSuccess: () => setScanDialogOpen(false)
            });
          }}
          isPending={scanMutation.isPending} />

        }
      </TooltipProvider>
    </AppLayout>);

}