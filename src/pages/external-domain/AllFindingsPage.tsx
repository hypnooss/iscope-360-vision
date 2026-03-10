import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ShieldAlert } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Radar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useLatestAttackSurfaceSnapshot, type AttackSurfaceSnapshot, type AttackSurfaceService, type AttackSurfaceWebService, type AttackSurfaceCVE } from '@/hooks/useAttackSurfaceData';
import { differenceInDays, parseISO } from 'date-fns';
import { generateFindings, SEVERITY_ORDER, SEVERITY_LABELS, type FindingsAsset, type SurfaceFinding } from '@/lib/surfaceFindings';
import { SurfaceFindingCard } from '@/components/surface/SurfaceFindingCard';

/* ── Reuse data helpers from V3 ── */

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

interface CachedCVERecord {
  cve_id: string; title: string | null; severity: string | null; score: number | null;
  advisory_url: string | null; products: string[] | null;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number); const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const va = pa[i] || 0; const vb = pb[i] || 0; if (va !== vb) return va - vb; }
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
    if (svc.cpe && Array.isArray(svc.cpe)) { for (const cpe of svc.cpe) { const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':'); const product = (parts[2] || '').replace(/_/g, ' ').toLowerCase(); const version = parts[3] && parts[3] !== '*' && parts[3] !== '' ? parts[3] : null; if (product) { productNames.add(product); if (!productVersions.has(product)) productVersions.set(product, version || null); } } }
    if (svc.product) { const p = svc.product.toLowerCase(); productNames.add(p); if (!productVersions.has(p)) productVersions.set(p, svc.version || null); }
  }
  for (const ws of result.web_services || []) {
    for (const tech of ws.technologies || []) { const [name, ver] = tech.split(':'); const n = name.trim().toLowerCase(); const v = ver?.trim() || null; if (n) { productNames.add(n); if (!productVersions.has(n)) productVersions.set(n, v); } }
    if (ws.server) { const [name, ver] = ws.server.toLowerCase().split('/'); const p = name.trim(); if (p) { productNames.add(p); if (!productVersions.has(p)) productVersions.set(p, ver?.trim() || null); } }
  }
  const matched = new Map<string, AttackSurfaceCVE>();
  if (cveMatches.length > 0 && (vulnSet.size > 0 || productNames.size > 0)) {
    for (const c of cveMatches) {
      if (vulnSet.has(c.cve_id)) { matched.set(c.cve_id, c); continue; }
      const titleLower = (c.title || '').toLowerCase(); const cveProducts = (c.products || []).map((p: string) => p.toLowerCase());
      for (const product of productNames) { if (titleLower.includes(product) || cveProducts.some((cp: string) => cp.includes(product))) { matched.set(c.cve_id, c); break; } }
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
          for (let i = 0; i < tokens.length; i++) { if (tokens[i] === '>=' && tokens[i + 1]) { rangeInfo.gte = tokens[++i]; } else if (tokens[i] === '<' && tokens[i + 1]) { rangeInfo.lt = tokens[++i]; } else if (tokens[i] === '<=' && tokens[i + 1]) { rangeInfo.lte = tokens[++i]; } else { nonRangeTokens.push(tokens[i]); } }
          rangeInfo.product = nonRangeTokens.length >= 2 ? nonRangeTokens.slice(1).join(' ').toLowerCase() : (nonRangeTokens[0] || '').toLowerCase();
          for (const [product, detectedVersion] of productVersions) { if (!rangeInfo.product.includes(product) && !product.includes(rangeInfo.product)) continue; if (!detectedVersion) continue; if (isVersionInRange(detectedVersion, rangeInfo)) { didMatch = true; break; } }
        } else {
          const cachedVersion = tokens.length >= 3 ? tokens[tokens.length - 1] : '*';
          const cachedProduct = (tokens.length >= 3 ? tokens.slice(1, -1).join(' ') : tokens[1]).toLowerCase();
          for (const [product, detectedVersion] of productVersions) { if (!cachedProduct.includes(product) && !product.includes(cachedProduct)) continue; if (!detectedVersion) continue; if (cachedVersion === '*' || cachedVersion === detectedVersion) { didMatch = true; break; } }
        }
      }
      if (didMatch) { matched.set(cached.cve_id, { cve_id: cached.cve_id, title: cached.title || '', severity: cached.severity || 'medium', score: cached.score, advisory_url: cached.advisory_url || '', products: cached.products || [] }); }
    }
  }
  return Array.from(matched.values());
}

function buildAssets(snapshot: AttackSurfaceSnapshot, cachedCVEs?: CachedCVERecord[]): FindingsAsset[] {
  const assets: FindingsAsset[] = [];
  for (const ip of Object.keys(snapshot.results)) {
    const result = snapshot.results[ip];
    const sourceIP = snapshot.source_ips.find(s => s.ip === ip);
    const hostname = sourceIP?.label || result.hostnames?.[0] || ip;
    const certMap = new Map<string, any>();
    for (const ws of result.web_services || []) {
      if (!ws.tls?.subject_cn) continue;
      const key = `${ws.tls.subject_cn}__${ws.tls.not_after ?? ''}`;
      if (certMap.has(key)) continue;
      const issuer = ws.tls.issuer ? (Array.isArray(ws.tls.issuer) ? ws.tls.issuer.join(', ') : ws.tls.issuer) : '—';
      let daysRemaining: number | null = null;
      if (ws.tls.not_after) { try { daysRemaining = differenceInDays(parseISO(ws.tls.not_after), new Date()); } catch { /* */ } }
      certMap.set(key, { subject_cn: ws.tls.subject_cn, issuer, not_after: ws.tls.not_after ?? null, daysRemaining });
    }
    const cves = matchCVEsToIP(result, snapshot.cve_matches, cachedCVEs);
    const techSet = new Set<string>();
    for (const svc of result.services || []) { if (svc.product) techSet.add(svc.version ? `${svc.product}/${svc.version}` : svc.product); }
    for (const ws of result.web_services || []) { if (ws.server) techSet.add(ws.server); for (const t of ws.technologies || []) techSet.add(t); }
    assets.push({
      hostname, ip,
      ports: result.ports || [],
      services: result.services || [],
      webServices: result.web_services || [],
      tlsCerts: Array.from(certMap.values()),
      cves,
      allTechs: Array.from(techSet),
    });
  }
  return assets;
}

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-500 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  low: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
};

export default function AllFindingsPage() {
  const navigate = useNavigate();
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

  const { data: snapshot, isLoading } = useLatestAttackSurfaceSnapshot(selectedClientId ?? undefined);

  const { data: cachedCVEs } = useQuery({
    queryKey: ['cve-cache', 'external_domain'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cve_cache').select('cve_id, title, severity, score, advisory_url, products').eq('module_code', 'external_domain');
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, products: Array.isArray(r.products) ? r.products : [] })) as CachedCVERecord[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const assets = useMemo(() => {
    if (!snapshot) return [];
    return buildAssets(snapshot, cachedCVEs);
  }, [snapshot, cachedCVEs]);

  const findings = useMemo(() => generateFindings(assets), [assets]);

  // Group by severity
  const grouped = useMemo(() => {
    const map: Record<string, SurfaceFinding[]> = { critical: [], high: [], medium: [], low: [] };
    for (const f of findings) { map[f.severity]?.push(f); }
    return map;
  }, [findings]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Domínio Externo' }, { label: 'Analyzer', href: '/scope-external-domain/analyzer' }, <PageBreadcrumb items={[{ label: 'Domínio Externo' }, { label: 'Analyzer', href: '/scope-external-domain/analyzer' }, { label: 'Vulnerabilidades Encontradas' }]} />]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/scope-external-domain/analyzer')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Serviços Expostos</h1>
              <p className="text-muted-foreground">Lista completa ordenada por severidade</p>
            </div>
          </div>
          {isSuperRole && workspaces && (
            <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger className="w-[220px]"><Building2 className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Selecione o workspace" /></SelectTrigger>
              <SelectContent>{workspaces.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : findings.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum achado encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {SEVERITY_ORDER.map(sev => {
              const items = grouped[sev];
              if (!items || items.length === 0) return null;
              return (
                <div key={sev} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider">{SEVERITY_LABELS[sev]}</h2>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SEV_BADGE[sev]}`}>
                      {items.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map(f => <SurfaceFindingCard key={f.id} finding={f} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
