import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import LeakedCredentialsSection from '@/components/external-domain/LeakedCredentialsSection';
import { AppLayout } from '@/components/layout/AppLayout';
import { AttackSurfaceScanDialog } from '@/components/external-domain/AttackSurfaceScanDialog';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Globe, Network, Server, ChevronDown, ChevronRight, Loader2, Radar,
  AlertTriangle, Building2, CheckCircle2, Play, XCircle, Shield, Lock,
  ExternalLink, ShieldAlert, Search, Settings, Calendar, Monitor, KeyRound
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useLatestAttackSurfaceSnapshot, useRunningAttackSurfaceSnapshot,
  useAttackSurfaceScan, useAttackSurfaceCancelScan, useAttackSurfaceRescanIP,
  type AttackSurfaceSnapshot, type AttackSurfaceService, type AttackSurfaceWebService, type AttackSurfaceCVE
} from '@/hooks/useAttackSurfaceData';
import { Button } from '@/components/ui/button';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

/* ══════════════════════ DATA LOGIC (ported from original) ══════════════════════ */

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

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-info/20 text-info border-info/30',
  };
  return (
    <Badge variant="outline" className={colors[severity?.toLowerCase()] || 'bg-muted text-muted-foreground'}>
      {severity || 'N/A'}
    </Badge>
  );
}

function useClientId() {
  const { profile } = useAuth();
  const { effectiveProfile } = useEffectiveAuth();
  const userId = effectiveProfile?.id || profile?.id;
  return useQuery({
    queryKey: ['user-client-id', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase.from('user_clients').select('client_id').eq('user_id', userId).limit(1);
      return data?.[0]?.client_id ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

function useAttackSurfaceProgress(clientId?: string) {
  return useQuery({
    queryKey: ['attack-surface-progress', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await (supabase
        .from('attack_surface_snapshots' as any)
        .select('id, status, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1) as any);
      if (error) throw error;
      const snapshot = (data as any[])?.[0];
      if (!snapshot) return null;
      if (snapshot.status === 'completed') return { status: 'completed' as const, percent: 100, total: 0, done: 0 };
      const [totalRes, doneRes] = await Promise.all([
        supabase.from('attack_surface_tasks').select('id', { count: 'exact', head: true }).eq('snapshot_id', snapshot.id),
        supabase.from('attack_surface_tasks').select('id', { count: 'exact', head: true }).eq('snapshot_id', snapshot.id).eq('status', 'completed'),
      ]);
      const total = totalRes.count ?? 0;
      const done = doneRes.count ?? 0;
      return { status: snapshot.status as string, percent: total > 0 ? Math.round(done / total * 100) : 0, total, done };
    },
    enabled: !!clientId,
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

interface CachedCVERecord {
  cve_id: string; title: string | null; severity: string | null; score: number | null;
  advisory_url: string | null; products: string[] | null;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number); const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0; const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function isVersionInRange(version: string, range: { gte?: string; lt?: string; lte?: string }): boolean {
  if (range.gte && compareVersions(version, range.gte) < 0) return false;
  if (range.lt && compareVersions(version, range.lt) >= 0) return false;
  if (range.lte && compareVersions(version, range.lte) > 0) return false;
  return true;
}

function matchCVEsToIP(
  result: { services?: AttackSurfaceService[]; web_services?: AttackSurfaceWebService[]; vulns?: string[] } | undefined,
  cveMatches: AttackSurfaceCVE[], cachedCVEs?: CachedCVERecord[]
): AttackSurfaceCVE[] {
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
        if (product) { productNames.add(product); if (!productVersions.has(product)) productVersions.set(product, version || null); }
      }
    }
    if (svc.product) { const p = svc.product.toLowerCase(); productNames.add(p); if (!productVersions.has(p)) productVersions.set(p, svc.version || null); }
  }
  for (const ws of result.web_services || []) {
    for (const tech of ws.technologies || []) {
      const [name, ver] = tech.split(':'); const n = name.trim().toLowerCase(); const v = ver?.trim() || null;
      if (n) { productNames.add(n); if (!productVersions.has(n)) productVersions.set(n, v); }
    }
    if (ws.server) { const [name, ver] = ws.server.toLowerCase().split('/'); const p = name.trim(); if (p) { productNames.add(p); if (!productVersions.has(p)) productVersions.set(p, ver?.trim() || null); } }
  }

  const matched = new Map<string, AttackSurfaceCVE>();
  if (cveMatches.length > 0 && (vulnSet.size > 0 || productNames.size > 0)) {
    for (const c of cveMatches) {
      if (vulnSet.has(c.cve_id)) { matched.set(c.cve_id, c); continue; }
      const titleLower = (c.title || '').toLowerCase();
      const cveProducts = (c.products || []).map((p: string) => p.toLowerCase());
      for (const product of productNames) {
        if (titleLower.includes(product) || cveProducts.some((cp: string) => cp.includes(product))) { matched.set(c.cve_id, c); break; }
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
        const hasRange = tokens.some(t => t === '>=' || t === '<' || t === '<=');
        if (hasRange) {
          const rangeInfo: { product: string; gte?: string; lt?: string; lte?: string } = { product: '' };
          const nonRangeTokens: string[] = [];
          for (let i = 0; i < tokens.length; i++) {
            if (tokens[i] === '>=' && tokens[i + 1]) { rangeInfo.gte = tokens[++i]; }
            else if (tokens[i] === '<' && tokens[i + 1]) { rangeInfo.lt = tokens[++i]; }
            else if (tokens[i] === '<=' && tokens[i + 1]) { rangeInfo.lte = tokens[++i]; }
            else { nonRangeTokens.push(tokens[i]); }
          }
          rangeInfo.product = nonRangeTokens.length >= 2 ? nonRangeTokens.slice(1).join(' ').toLowerCase() : (nonRangeTokens[0] || '').toLowerCase();
          for (const [product, detectedVersion] of productVersions) {
            if (!rangeInfo.product.includes(product) && !product.includes(rangeInfo.product)) continue;
            if (!detectedVersion) continue;
            if (isVersionInRange(detectedVersion, rangeInfo)) { didMatch = true; break; }
          }
        } else {
          const cachedVersion = tokens.length >= 3 ? tokens[tokens.length - 1] : '*';
          const cachedProduct = (tokens.length >= 3 ? tokens.slice(1, -1).join(' ') : tokens[1]).toLowerCase();
          for (const [product, detectedVersion] of productVersions) {
            if (!cachedProduct.includes(product) && !product.includes(cachedProduct)) continue;
            if (!detectedVersion) continue;
            if (cachedVersion === '*' || cachedVersion === detectedVersion) { didMatch = true; break; }
          }
        }
      }
      if (didMatch) {
        matched.set(cached.cve_id, {
          cve_id: cached.cve_id, title: cached.title || '', severity: cached.severity || 'medium',
          score: cached.score, advisory_url: cached.advisory_url || '', products: cached.products || [],
        });
      }
    }
  }
  return Array.from(matched.values());
}

interface TLSCertInfo { subject_cn: string; issuer: string; not_after: string | null; daysRemaining: number | null; }

interface ExposedAsset {
  hostname: string; ip: string;
  asn: { asn: string; provider: string; org: string; is_cdn: boolean; country?: string; abuse_email?: string; tech_email?: string; ip_range?: string; owner?: string; ownerid?: string; responsible?: string; abuse_handle?: string } | null;
  source: 'dns' | 'firewall'; ports: number[]; services: AttackSurfaceService[];
  webServices: AttackSurfaceWebService[]; tlsCerts: TLSCertInfo[]; cves: AttackSurfaceCVE[];
  expiredCerts: number; expiringSoonCerts: number; allTechs: string[];
}

function buildAssets(snapshot: AttackSurfaceSnapshot, cachedCVEs?: CachedCVERecord[]): ExposedAsset[] {
  const assets: ExposedAsset[] = [];
  for (const ip of Object.keys(snapshot.results)) {
    const result = snapshot.results[ip];
    const sourceIP = snapshot.source_ips.find(s => s.ip === ip);
    const hostname = sourceIP?.label || result.hostnames?.[0] || ip;

    const certMap = new Map<string, TLSCertInfo>();
    for (const ws of result.web_services || []) {
      if (!ws.tls?.subject_cn) continue;
      const key = `${ws.tls.subject_cn}__${ws.tls.not_after ?? ''}`;
      if (certMap.has(key)) continue;
      const issuer = ws.tls.issuer ? (Array.isArray(ws.tls.issuer) ? ws.tls.issuer.join(', ') : ws.tls.issuer) : '—';
      let daysRemaining: number | null = null;
      if (ws.tls.not_after) { try { daysRemaining = differenceInDays(parseISO(ws.tls.not_after), new Date()); } catch { /* */ } }
      certMap.set(key, { subject_cn: ws.tls.subject_cn, issuer, not_after: ws.tls.not_after ?? null, daysRemaining });
    }
    const tlsCerts = Array.from(certMap.values());
    const expiredCerts = tlsCerts.filter(c => c.daysRemaining !== null && c.daysRemaining < 0).length;
    const expiringSoonCerts = tlsCerts.filter(c => c.daysRemaining !== null && c.daysRemaining >= 0 && c.daysRemaining <= 30).length;
    const cves = matchCVEsToIP(result, snapshot.cve_matches, cachedCVEs);

    const techSet = new Set<string>();
    for (const svc of result.services || []) { if (svc.product) techSet.add(svc.version ? `${svc.product}/${svc.version}` : svc.product); }
    for (const ws of result.web_services || []) {
      if (ws.server) techSet.add(ws.server);
      for (const t of ws.technologies || []) techSet.add(t);
      if (ws.title && !ws.url?.includes(ws.title.toLowerCase())) techSet.add(ws.title);
      if (ws.tls?.subject_cn) {
        const cn = typeof ws.tls.subject_cn === 'string' ? ws.tls.subject_cn : '';
        const urlHost = ws.url ? new URL(ws.url).hostname : '';
        if (cn && cn !== urlHost && !cn.includes('.') && !cn.includes('*')) techSet.add(cn);
      }
    }
    for (const svc of result.services || []) {
      const scripts = svc.scripts || {};
      if (scripts['ssl-cert']) { const m = scripts['ssl-cert'].match(/organizationName=([^\n\/,]+)/i); if (m) techSet.add(m[1].trim()); else { const cn = scripts['ssl-cert'].match(/commonName=([^\n\/,]+)/i); if (cn && !cn[1].includes('*')) techSet.add(cn[1].trim()); } }
      if (scripts['smb-os-discovery']) { const m = scripts['smb-os-discovery'].match(/OS:\s*(.+)/i); if (m) techSet.add(m[1].trim()); }
      if (scripts['rdp-ntlm-info']) { const m = scripts['rdp-ntlm-info'].match(/Product_Version:\s*(.+)/i); if (m) techSet.add(`Windows ${m[1].trim()}`); }
      if (scripts['http-server-header']) techSet.add(scripts['http-server-header'].trim().split('\n')[0]);
    }

    assets.push({
      hostname, ip, asn: (result as any).asn || null,
      source: sourceIP?.source as 'dns' | 'firewall' || 'dns',
      ports: result.ports || [], services: result.services || [],
      webServices: result.web_services || [], tlsCerts, cves,
      expiredCerts, expiringSoonCerts, allTechs: Array.from(techSet),
    });
  }

  return assets.sort((a, b) => {
    const maxSev = (asset: ExposedAsset) => {
      let max = 0;
      for (const cve of asset.cves) { const s = (cve.severity || 'medium').toLowerCase(); const r = s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1; if (r > max) max = r; }
      return max;
    };
    const sevDiff = maxSev(b) - maxSev(a);
    if (sevDiff !== 0) return sevDiff;
    const svcDiff = (b.services.length + b.webServices.length) - (a.services.length + a.webServices.length);
    if (svcDiff !== 0) return svcDiff;
    return b.ports.length - a.ports.length;
  });
}

function calculateNextRun(frequency: string, hour: number, dayOfWeek: number, dayOfMonth: number): Date {
  const now = new Date(); const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (frequency === 'daily') { if (next <= now) next.setDate(next.getDate() + 1); }
  else if (frequency === 'weekly') { const cd = next.getDay(); let d = (dayOfWeek - cd + 7) % 7; if (d === 0 && next <= now) d = 7; next.setDate(next.getDate() + d); }
  else if (frequency === 'monthly') { next.setDate(dayOfMonth); if (next <= now) { next.setMonth(next.getMonth() + 1); next.setDate(dayOfMonth); } }
  return next;
}

/* ══════════════════════ SUMMARY CARDS ══════════════════════ */

function SummaryCard({ icon: Icon, title, value, children, iconClass }: {
  icon: React.ElementType; title: string; value: string | number; children?: React.ReactNode; iconClass?: string;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-1">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconClass || "bg-primary/10")}>
            <Icon className="w-4.5 h-4.5 text-inherit" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
        {children && <div className="mt-2 ml-12">{children}</div>}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════ TAB: INVENTÁRIO ══════════════════════ */

function InventoryTab({ assets, emptyAssets, isSuperRole, onRescan, isRescanning, activeSnapshot }: {
  assets: ExposedAsset[]; emptyAssets: ExposedAsset[]; isSuperRole: boolean;
  onRescan: (a: ExposedAsset) => void; isRescanning: boolean; activeSnapshot: AttackSurfaceSnapshot | null;
}) {
  const [expandedIp, setExpandedIp] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-8"></TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>ASN / Provedor</TableHead>
              <TableHead className="text-center">Portas</TableHead>
              <TableHead className="text-center">Serviços</TableHead>
              <TableHead>CVEs</TableHead>
              <TableHead className="text-center">Certificado</TableHead>
              {isSuperRole && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map(asset => {
              const isExpanded = expandedIp === asset.ip;
              const certStatus = asset.expiredCerts > 0 ? 'expired' : asset.expiringSoonCerts > 0 ? 'expiring' : asset.tlsCerts.length > 0 ? 'valid' : 'none';
              const certIcon = { expired: 'text-destructive', expiring: 'text-warning', valid: 'text-primary', none: 'text-muted-foreground' };

              return (
                <React.Fragment key={asset.ip}>
                  <TableRow
                    className={cn("cursor-pointer hover:bg-muted/30 transition-colors", isExpanded && "bg-muted/20")}
                    onClick={() => setExpandedIp(isExpanded ? null : asset.ip)}
                  >
                    <TableCell className="px-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {asset.source === 'dns' ? <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <Shield className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        <span className="font-medium text-sm truncate max-w-[200px]">{asset.hostname}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{asset.ip}</span>
                        {asset.asn?.country && <span className={`fi fi-${asset.asn.country.toLowerCase()} text-xs`} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                        {asset.asn?.asn ? `${asset.asn.asn}` : '—'}
                        {asset.asn?.org ? ` (${asset.asn.org.length > 18 ? asset.asn.org.slice(0, 18) + '…' : asset.asn.org})` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5">{asset.ports.length}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5">{asset.services.length + asset.webServices.length}</Badge>
                    </TableCell>
                    <TableCell>
                      {asset.cves.length > 0 ? <InlineCVEBadges cves={asset.cves} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Lock className={cn("w-4 h-4 mx-auto", certIcon[certStatus])} />
                    </TableCell>
                    {isSuperRole && (
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={isRescanning}
                          onClick={(e) => { e.stopPropagation(); onRescan(asset); }}>
                          {isRescanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={isSuperRole ? 9 : 8} className="p-0">
                        <AssetDetailPanel asset={asset} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {emptyAssets.length > 0 && <EmptyAssetsSummary assets={emptyAssets} />}
    </div>
  );
}

function InlineCVEBadges({ cves }: { cves: AttackSurfaceCVE[] }) {
  const counts: Record<string, number> = {};
  for (const c of cves) { const s = (c.severity || 'medium').toLowerCase(); counts[s] = (counts[s] || 0) + 1; }
  const sevColors: Record<string, string> = {
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-info/20 text-info border-info/30',
  };
  const order = ['critical', 'high', 'medium', 'low'];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {order.filter(s => counts[s]).map(s => (
        <Badge key={s} variant="outline" className={cn("text-[10px] px-1.5 py-0", sevColors[s])}>
          {counts[s]} {s === 'critical' ? 'Crit' : s === 'high' ? 'High' : s === 'medium' ? 'Med' : 'Low'}
        </Badge>
      ))}
    </div>
  );
}

function AssetDetailPanel({ asset }: { asset: ExposedAsset }) {
  return (
    <div className="bg-muted/10 border-t border-border/50 p-4 space-y-4">
      {/* Open Ports */}
      {asset.ports.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Portas Abertas</h4>
          <div className="flex flex-wrap gap-1.5">
            {asset.ports.map(p => <Badge key={p} variant="outline" className="font-mono text-xs px-2 py-0.5">{p}</Badge>)}
          </div>
        </div>
      )}
      {/* Services */}
      {(asset.services.length > 0 || asset.webServices.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Serviços</h4>
          <div className="space-y-1.5">
            {asset.webServices.map((ws, i) => (
              <div key={i} className="rounded border border-border/40 bg-card/50 px-3 py-2 flex items-center gap-3 flex-wrap text-sm">
                <a href={ws.url} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-400 hover:underline text-xs truncate max-w-[350px]" onClick={e => e.stopPropagation()}>
                  {ws.url}
                </a>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0",
                  ws.status_code >= 200 && ws.status_code < 300 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  ws.status_code >= 300 && ws.status_code < 400 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  'bg-destructive/20 text-destructive border-destructive/30'
                )}>{ws.status_code}</Badge>
                {ws.server && <span className="text-xs text-muted-foreground">{ws.server}</span>}
                {ws.technologies && ws.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ws.technologies.map((t, j) => <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0", getTechBadgeColor(t))}>{t}</Badge>)}
                  </div>
                )}
              </div>
            ))}
            {asset.services.filter(s => s.product || s.name).map((svc, i) => (
              <div key={i} className="rounded border border-border/40 bg-card/50 px-3 py-2 flex items-center gap-3 text-sm">
                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">{svc.port}/{svc.transport}</Badge>
                <span className="text-sm">{svc.product || svc.name || '—'}</span>
                {svc.version && <span className="text-muted-foreground text-xs">{svc.version}</span>}
                {svc.extra_info && <span className="text-muted-foreground/70 text-xs italic">{svc.extra_info}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* CVEs */}
      {asset.cves.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vulnerabilidades ({asset.cves.length})</h4>
          <div className="space-y-1">
            {asset.cves.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(cve => (
              <a key={cve.cve_id} href={cve.advisory_url || `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-1.5 rounded border border-border/30 hover:bg-muted/50 transition-colors" onClick={e => e.stopPropagation()}>
                <SeverityBadge severity={cve.severity} />
                <span className="font-mono text-xs">{cve.cve_id}</span>
                {cve.score != null && <span className="text-xs font-mono text-muted-foreground">({cve.score})</span>}
                <span className="text-xs text-muted-foreground truncate flex-1">{cve.title}</span>
                <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}
      {/* Certs */}
      {asset.tlsCerts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Certificados TLS</h4>
          <div className="space-y-1">
            {asset.tlsCerts.map((cert, i) => (
              <div key={i} className="rounded border border-border/40 bg-card/50 px-3 py-2 flex items-center gap-4 flex-wrap text-sm">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">{cert.subject_cn}</span>
                <span className="text-xs text-muted-foreground">Emissor: {cert.issuer}</span>
                {cert.daysRemaining !== null && (
                  cert.daysRemaining < 0 ? <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Expirado há {Math.abs(cert.daysRemaining)}d</Badge> :
                  cert.daysRemaining <= 30 ? <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-[10px]">Expira em {cert.daysRemaining}d</Badge> :
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">{cert.daysRemaining}d restantes</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyAssetsSummary({ assets }: { assets: ExposedAsset[] }) {
  const [open, setOpen] = useState(false);
  if (assets.length === 0) return null;
  return (
    <Card className="glass-card border-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          <span className="text-sm font-medium">{assets.length} {assets.length === 1 ? 'ativo' : 'ativos'} sem exposição detectada</span>
        </div>
        <p className="text-xs text-muted-foreground ml-7 mb-2">Nenhuma porta aberta ou serviço identificado.</p>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="ml-7 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {open ? 'Ocultar lista' : 'Ver lista'}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-7 mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0.5">
              {assets.map(a => <span key={a.ip} className="text-xs text-muted-foreground truncate">{a.hostname !== a.ip ? `${a.hostname} (${a.ip})` : a.ip}</span>)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════ TAB: SERVIÇOS WEB ══════════════════════ */

interface WebServiceEntry {
  url: string; statusCode: number; server: string | null;
  technologies: string[]; tlsSubject: string | null; tlsExpiry: string | null;
  asset: ExposedAsset;
}

function WebServicesTab({ assets }: { assets: ExposedAsset[] }) {
  const entries = useMemo(() => {
    const list: WebServiceEntry[] = [];
    for (const asset of assets) {
      for (const ws of asset.webServices) {
        list.push({
          url: ws.url, statusCode: ws.status_code, server: ws.server || null,
          technologies: ws.technologies || [], tlsSubject: ws.tls?.subject_cn || null,
          tlsExpiry: ws.tls?.not_after || null, asset,
        });
      }
    }
    return list;
  }, [assets]);

  if (entries.length === 0) return <EmptyTabState text="Nenhum serviço web detectado nesta análise." />;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>URL</TableHead>
            <TableHead className="text-center w-20">Status</TableHead>
            <TableHead>Servidor</TableHead>
            <TableHead>Tecnologias</TableHead>
            <TableHead>TLS</TableHead>
            <TableHead>Ativo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e, i) => (
            <TableRow key={i}>
              <TableCell>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-blue-400 hover:underline truncate block max-w-[300px]">
                  {e.url}
                </a>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0",
                  e.statusCode >= 200 && e.statusCode < 300 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  e.statusCode >= 300 && e.statusCode < 400 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  'bg-destructive/20 text-destructive border-destructive/30'
                )}>{e.statusCode}</Badge>
              </TableCell>
              <TableCell><span className="text-xs text-muted-foreground">{e.server || '—'}</span></TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {e.technologies.slice(0, 3).map((t, j) => <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0", getTechBadgeColor(t))}>{t}</Badge>)}
                  {e.technologies.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashed">+{e.technologies.length - 3}</Badge>}
                </div>
              </TableCell>
              <TableCell>
                {e.tlsSubject ? (
                  <div className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{e.tlsSubject}</span>
                  </div>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell><span className="text-xs text-muted-foreground">{e.asset.hostname !== e.asset.ip ? e.asset.hostname : e.asset.ip}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ══════════════════════ TAB: VULNERABILIDADES ══════════════════════ */

interface CVEWithAssets { cve: AttackSurfaceCVE; assets: ExposedAsset[] }

function VulnerabilitiesTab({ assets }: { assets: ExposedAsset[] }) {
  const [filter, setFilter] = useState<string>('all');

  const cveMap = useMemo(() => {
    const map = new Map<string, CVEWithAssets>();
    for (const asset of assets) {
      for (const cve of asset.cves) {
        const existing = map.get(cve.cve_id);
        if (existing) { existing.assets.push(asset); }
        else { map.set(cve.cve_id, { cve, assets: [asset] }); }
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.cve.score ?? 0) - (a.cve.score ?? 0));
  }, [assets]);

  const filtered = filter === 'all' ? cveMap : cveMap.filter(c => (c.cve.severity || 'medium').toLowerCase() === filter);
  const sevCounts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const e of cveMap) { const s = (e.cve.severity || 'medium').toLowerCase(); c[s] = (c[s] || 0) + 1; }
    return c;
  }, [cveMap]);

  if (cveMap.length === 0) return <EmptyTabState text="Nenhuma vulnerabilidade detectada nesta análise." />;

  const sevColors: Record<string, string> = {
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-info/20 text-info border-info/30',
  };

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={filter === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setFilter('all')}>Todas ({cveMap.length})</Badge>
        {['critical', 'high', 'medium', 'low'].filter(s => sevCounts[s] > 0).map(s => (
          <Badge key={s} variant="outline" className={cn("cursor-pointer", filter === s && sevColors[s])} onClick={() => setFilter(filter === s ? 'all' : s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({sevCounts[s]})
          </Badge>
        ))}
      </div>

      {/* CVE list */}
      <div className="space-y-2">
        {filtered.map(({ cve, assets: affectedAssets }) => (
          <Card key={cve.cve_id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <SeverityBadge severity={cve.severity} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={cve.advisory_url || `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-sm font-semibold hover:underline text-blue-400 flex items-center gap-1">
                      {cve.cve_id} <ExternalLink className="w-3 h-3" />
                    </a>
                    {cve.score != null && <span className="text-xs font-mono text-muted-foreground">Score: {cve.score}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{cve.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <span className="text-xs text-muted-foreground">Afeta:</span>
                    {affectedAssets.map(a => (
                      <Badge key={a.ip} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{a.hostname !== a.ip ? a.hostname : a.ip}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════ TAB: CERTIFICADOS ══════════════════════ */

interface CertEntry { cert: TLSCertInfo; asset: ExposedAsset }

function CertificatesTab({ assets }: { assets: ExposedAsset[] }) {
  const entries = useMemo(() => {
    const list: CertEntry[] = [];
    const seen = new Set<string>();
    for (const asset of assets) {
      for (const cert of asset.tlsCerts) {
        const key = `${cert.subject_cn}__${cert.not_after}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ cert, asset });
      }
    }
    // Sort: expired first, then expiring soon, then by days remaining
    return list.sort((a, b) => (a.cert.daysRemaining ?? 9999) - (b.cert.daysRemaining ?? 9999));
  }, [assets]);

  if (entries.length === 0) return <EmptyTabState text="Nenhum certificado TLS detectado nesta análise." />;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Subject (CN)</TableHead>
            <TableHead>Emissor</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Ativo Associado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(({ cert, asset }, i) => {
            const isExpired = cert.daysRemaining !== null && cert.daysRemaining < 0;
            const isExpiring = cert.daysRemaining !== null && cert.daysRemaining >= 0 && cert.daysRemaining <= 30;
            return (
              <TableRow key={i}>
                <TableCell><span className="font-mono text-sm">{cert.subject_cn}</span></TableCell>
                <TableCell><span className="text-xs text-muted-foreground">{cert.issuer}</span></TableCell>
                <TableCell><span className="text-xs text-muted-foreground">{cert.not_after ? new Date(cert.not_after).toLocaleDateString('pt-BR') : '—'}</span></TableCell>
                <TableCell className="text-center">
                  {isExpired ? <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Expirado há {Math.abs(cert.daysRemaining!)}d</Badge> :
                   isExpiring ? <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-[10px]">Expira em {cert.daysRemaining}d</Badge> :
                   cert.daysRemaining !== null ? <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">{cert.daysRemaining}d</Badge> :
                   <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><span className="text-xs text-muted-foreground">{asset.hostname !== asset.ip ? asset.hostname : asset.ip}</span></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ══════════════════════ TAB: CREDENCIAIS VAZADAS ══════════════════════ */

function LeakedCredentialsTab({ clientId, domains, isSuperRole }: { clientId: string; domains: string[]; isSuperRole: boolean }) {
  if (domains.length === 0) return <EmptyTabState text="Nenhum domínio configurado para consulta de credenciais vazadas." />;
  return <LeakedCredentialsSection clientId={clientId} domains={domains} isSuperRole={isSuperRole} />;
}

/* ══════════════════════ SHARED ══════════════════════ */

function EmptyTabState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Radar className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ══════════════════════ MAIN PAGE ══════════════════════ */

export default function SurfaceAnalyzerV2Page() {
  const { effectiveRole } = useEffectiveAuth();
  const { data: userClientId } = useClientId();
  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const { data: workspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => { const { data, error } = await supabase.from('clients').select('id, name').order('name'); if (error) throw error; return data ?? []; },
    enabled: isSuperRole, staleTime: 1000 * 60 * 5,
  });

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(workspaces, isSuperRole);
  const selectedClientId = isSuperRole ? selectedWorkspaceId : userClientId;

  const scanMutation = useAttackSurfaceScan(selectedClientId ?? undefined);
  const cancelMutation = useAttackSurfaceCancelScan(selectedClientId ?? undefined);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  // Schedule states
  const [scheduleFreq, setScheduleFreq] = useState<string>('daily');
  const [scheduleHour, setScheduleHour] = useState<number>(15);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number>(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [scheduleActive, setScheduleActive] = useState<boolean>(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const { data: currentSchedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['attack-surface-schedule', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data } = await supabase.from('attack_surface_schedules').select('*').eq('client_id', selectedClientId).maybeSingle();
      return data ?? null;
    },
    enabled: !!selectedClientId && isSuperRole,
  });

  useEffect(() => {
    if (currentSchedule && scheduleDialogOpen) {
      setScheduleFreq(currentSchedule.frequency ?? 'daily');
      setScheduleHour(currentSchedule.scheduled_hour ?? 15);
      setScheduleDayOfWeek(currentSchedule.scheduled_day_of_week ?? 1);
      setScheduleDayOfMonth(currentSchedule.scheduled_day_of_month ?? 1);
      setScheduleActive(currentSchedule.is_active ?? true);
    }
  }, [currentSchedule, scheduleDialogOpen]);

  const workspaceName = workspaces?.find(w => w.id === selectedClientId)?.name;

  const handleSaveSchedule = async () => {
    if (!selectedClientId) return;
    setScheduleSaving(true);
    try {
      const nextRunAt = calculateNextRun(scheduleFreq, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth);
      const payload = {
        client_id: selectedClientId, frequency: scheduleFreq as any,
        scheduled_hour: scheduleHour, scheduled_day_of_week: scheduleDayOfWeek,
        scheduled_day_of_month: scheduleDayOfMonth, is_active: scheduleActive,
        next_run_at: nextRunAt.toISOString(), updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('attack_surface_schedules').upsert(payload, { onConflict: 'client_id' });
      if (error) throw error;
      toast.success('Agendamento salvo com sucesso!');
      refetchSchedule();
      setScheduleDialogOpen(false);
    } catch (err: any) { toast.error('Erro ao salvar: ' + err.message); }
    finally { setScheduleSaving(false); }
  };

  const { data: snapshot, isLoading } = useLatestAttackSurfaceSnapshot(selectedClientId ?? undefined);
  const { data: progress } = useAttackSurfaceProgress(selectedClientId ?? undefined);
  const isRunning = progress?.status === 'pending' || progress?.status === 'running';
  const { data: runningSnapshot, refetch: refetchRunning, isFetching: isRefetchingRunning } = useRunningAttackSurfaceSnapshot(selectedClientId ?? undefined, isRunning);

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
      const { data, error } = await supabase.from('cve_cache').select('cve_id, title, severity, score, advisory_url, products').eq('module_code', 'external_domain');
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, products: Array.isArray(r.products) ? r.products : [] })) as CachedCVERecord[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const rescanMutation = useAttackSurfaceRescanIP(selectedClientId ?? undefined);

  const { data: clientDomains } = useQuery({
    queryKey: ['client-domains', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data } = await supabase.from('external_domains').select('domain').eq('client_id', selectedClientId);
      return (data || []).map(d => d.domain);
    },
    enabled: !!selectedClientId, staleTime: 1000 * 60 * 10,
  });

  const hasPartialResults = runningSnapshot && Object.keys(runningSnapshot.results || {}).length > 0;
  const activeSnapshot = isRunning && hasPartialResults ? runningSnapshot : snapshot;

  const assets = useMemo(() => {
    if (!activeSnapshot) return [];
    return buildAssets(activeSnapshot, cachedCVEs);
  }, [activeSnapshot, cachedCVEs]);

  const [searchTerm, setSearchTerm] = useState('');

  const { activeAssets, emptyAssets } = useMemo(() => {
    let list = assets;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(a => a.hostname.toLowerCase().includes(q) || a.ip.includes(q) || a.allTechs.some(t => t.toLowerCase().includes(q)));
    }
    const active: ExposedAsset[] = []; const empty: ExposedAsset[] = [];
    for (const a of list) {
      if (a.ports.length === 0 && a.services.length === 0 && a.webServices.length === 0) empty.push(a);
      else active.push(a);
    }
    return { activeAssets: active, emptyAssets: empty };
  }, [assets, searchTerm]);

  // Executive stats
  const stats = useMemo(() => {
    let totalServices = 0, webServices = 0, infraServices = 0;
    let criticalCVEs = 0, highCVEs = 0, mediumCVEs = 0, lowCVEs = 0;
    let validCerts = 0, expiringCerts = 0, expiredCerts = 0;
    for (const a of assets) {
      webServices += a.webServices.length;
      infraServices += a.services.length;
      totalServices += a.services.length + a.webServices.length;
      for (const c of a.cves) {
        const s = (c.severity || 'medium').toLowerCase();
        if (s === 'critical') criticalCVEs++; else if (s === 'high') highCVEs++; else if (s === 'medium') mediumCVEs++; else lowCVEs++;
      }
      expiredCerts += a.expiredCerts;
      expiringCerts += a.expiringSoonCerts;
      validCerts += a.tlsCerts.length - a.expiredCerts - a.expiringSoonCerts;
    }
    const totalCVEs = criticalCVEs + highCVEs + mediumCVEs + lowCVEs;
    return { totalAssets: assets.length, totalServices, webServices, infraServices, totalCVEs, criticalCVEs, highCVEs, mediumCVEs, lowCVEs, validCerts, expiringCerts, expiredCerts, totalCerts: validCerts + expiringCerts + expiredCerts };
  }, [assets]);

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 lg:p-8 space-y-6">
          <PageBreadcrumb items={[{ label: 'Domínio Externo' }, { label: 'Analyzer (v2)' }]} />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Surface Analyzer</h1>
              <p className="text-muted-foreground">Visibilidade da exposição dos ativos na internet</p>
            </div>
            <div className="flex items-center gap-3">
              {isSuperRole && workspaces && (
                <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger className="w-[220px]"><Building2 className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Selecione o workspace" /></SelectTrigger>
                  <SelectContent>{workspaces.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {isSuperRole && !isRunning && <Button onClick={() => setScanDialogOpen(true)}><Play className="w-4 h-4" /> Executar Análise</Button>}
              {isSuperRole && isRunning && (
                <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Cancelar Análise
                </Button>
              )}
              {isSuperRole && <Button variant="outline" size="icon" title="Configurar agendamento" onClick={() => setScheduleDialogOpen(true)}><Settings className="w-4 h-4" /></Button>}
            </div>
          </div>

          {/* Progress */}
          {isRunning && progress && (
            <Card className="glass-card border-teal-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span className="text-sm font-medium">Scan em andamento...</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground">{progress.done} de {progress.total} IPs processados</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-teal-400 hover:text-teal-300" onClick={() => refetchRunning()} disabled={isRefetchingRunning}>
                      <Loader2 className={cn("w-3 h-3", isRefetchingRunning && "animate-spin")} /> Atualizar
                    </Button>
                  </div>
                </div>
                <Progress value={progress.percent} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          {activeSnapshot && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard icon={Globe} title="Ativos Monitorados" value={stats.totalAssets} iconClass="bg-teal-500/15 text-teal-400" />
              <SummaryCard icon={Server} title="Serviços Expostos" value={stats.totalServices} iconClass="bg-blue-500/15 text-blue-400">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{stats.webServices} web</span>
                  <span className="text-border">•</span>
                  <span>{stats.infraServices} infra</span>
                </div>
              </SummaryCard>
              <SummaryCard icon={ShieldAlert} title="Vulnerabilidades" value={stats.totalCVEs} iconClass="bg-destructive/15 text-destructive">
                {stats.totalCVEs > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {stats.criticalCVEs > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-destructive/20 text-destructive border-destructive/30">{stats.criticalCVEs} Crit</Badge>}
                    {stats.highCVEs > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-400 border-orange-500/30">{stats.highCVEs} High</Badge>}
                    {stats.mediumCVEs > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning/20 text-warning border-warning/30">{stats.mediumCVEs} Med</Badge>}
                    {stats.lowCVEs > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-info/20 text-info border-info/30">{stats.lowCVEs} Low</Badge>}
                  </div>
                )}
              </SummaryCard>
              <SummaryCard icon={Lock} title="Certificados" value={stats.totalCerts} iconClass="bg-primary/15 text-primary">
                {stats.totalCerts > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {stats.validCerts > 0 && <span className="text-primary">{stats.validCerts} válido{stats.validCerts !== 1 ? 's' : ''}</span>}
                    {stats.expiringCerts > 0 && <span className="text-warning">{stats.expiringCerts} expirando</span>}
                    {stats.expiredCerts > 0 && <span className="text-destructive">{stats.expiredCerts} expirado{stats.expiredCerts !== 1 ? 's' : ''}</span>}
                  </div>
                )}
              </SummaryCard>
            </div>
          )}

          {/* Main content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !activeSnapshot || assets.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16">
                <div className="text-center text-muted-foreground">
                  <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum dado disponível</p>
                  <p className="text-sm mt-1">Execute uma análise para visualizar os ativos expostos.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por hostname, IP ou tecnologia..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>

              {/* Tabs */}
              <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="w-full justify-start bg-muted/50 h-auto p-1 flex-wrap">
                  <TabsTrigger value="inventory" className="gap-1.5 data-[state=active]:bg-background">
                    <Network className="w-3.5 h-3.5" /> Inventário
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">{activeAssets.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="web-services" className="gap-1.5 data-[state=active]:bg-background">
                    <Monitor className="w-3.5 h-3.5" /> Serviços Web
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">{stats.webServices}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="vulnerabilities" className="gap-1.5 data-[state=active]:bg-background">
                    <ShieldAlert className="w-3.5 h-3.5" /> Vulnerabilidades
                    {stats.totalCVEs > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1 bg-destructive/20 text-destructive border-destructive/30">{stats.totalCVEs}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="certificates" className="gap-1.5 data-[state=active]:bg-background">
                    <Lock className="w-3.5 h-3.5" /> Certificados
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">{stats.totalCerts}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="leaked-credentials" className="gap-1.5 data-[state=active]:bg-background">
                    <KeyRound className="w-3.5 h-3.5" /> Credenciais Vazadas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="inventory">
                  <InventoryTab assets={activeAssets} emptyAssets={emptyAssets} isSuperRole={isSuperRole}
                    onRescan={a => rescanMutation.mutate({ ip: a.ip, source: a.source, label: a.hostname, snapshotId: activeSnapshot!.id })}
                    isRescanning={rescanMutation.isPending} activeSnapshot={activeSnapshot} />
                </TabsContent>
                <TabsContent value="web-services"><WebServicesTab assets={activeAssets} /></TabsContent>
                <TabsContent value="vulnerabilities"><VulnerabilitiesTab assets={activeAssets} /></TabsContent>
                <TabsContent value="certificates"><CertificatesTab assets={activeAssets} /></TabsContent>
                <TabsContent value="leaked-credentials">
                  {selectedClientId && <LeakedCredentialsTab clientId={selectedClientId} domains={clientDomains || []} isSuperRole={isSuperRole} />}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Last scan timestamp */}
          {snapshot?.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              Último scan concluído em {new Date(snapshot.completed_at).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* Scan Dialog */}
        {selectedClientId && (
          <AttackSurfaceScanDialog open={scanDialogOpen} onOpenChange={setScanDialogOpen} clientId={selectedClientId}
            onStartScan={ips => { scanMutation.mutate(ips, { onSuccess: () => setScanDialogOpen(false) }); }} isPending={scanMutation.isPending} />
        )}

        {/* Schedule Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> Agendamento do Analyzer</DialogTitle>
              <DialogDescription>Configure a frequência de execução automática{workspaceName ? ` para ${workspaceName}` : ''}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between"><Label htmlFor="schedule-active">Agendamento ativo</Label><Switch id="schedule-active" checked={scheduleActive} onCheckedChange={setScheduleActive} /></div>
              <div className="space-y-1.5"><Label>Frequência</Label><Select value={scheduleFreq} onValueChange={setScheduleFreq}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Diário</SelectItem><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="monthly">Mensal</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Hora de execução (UTC-3)</Label><Select value={String(scheduleHour)} onValueChange={v => setScheduleHour(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 24 }, (_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>)}</SelectContent></Select></div>
              {scheduleFreq === 'weekly' && <div className="space-y-1.5"><Label>Dia da semana</Label><Select value={String(scheduleDayOfWeek)} onValueChange={v => setScheduleDayOfWeek(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select></div>}
              {scheduleFreq === 'monthly' && <div className="space-y-1.5"><Label>Dia do mês</Label><Select value={String(scheduleDayOfMonth)} onValueChange={v => setScheduleDayOfMonth(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 28 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>)}</SelectContent></Select></div>}
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Próxima execução estimada: <span className="text-foreground font-medium">{calculateNextRun(scheduleFreq, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth).toLocaleString('pt-BR')}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSchedule} disabled={scheduleSaving}>{scheduleSaving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </AppLayout>
  );
}
