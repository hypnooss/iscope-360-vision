import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import LeakedCredentialsSection from '@/components/external-domain/LeakedCredentialsSection';
import { AppLayout } from '@/components/layout/AppLayout';
import { AttackSurfaceScanDialog } from '@/components/external-domain/AttackSurfaceScanDialog';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Loader2, Radar, Building2, CheckCircle2, Play, XCircle, Settings, Calendar,
  Globe, Server, ShieldAlert, AlertTriangle, Clock, Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useLatestAttackSurfaceSnapshot, useRunningAttackSurfaceSnapshot,
  useAttackSurfaceScan, useAttackSurfaceCancelScan, useAttackSurfaceRescanIP,
  type AttackSurfaceSnapshot, type AttackSurfaceService, type AttackSurfaceWebService, type AttackSurfaceCVE,
} from '@/hooks/useAttackSurfaceData';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  generateFindings, calculateFindingsStats,
  CATEGORY_INFO,
  type SurfaceFinding, type SurfaceFindingCategory, type FindingsAsset,
} from '@/lib/surfaceFindings';

import { CategoryOverviewGrid } from '@/components/surface/CategoryOverviewGrid';
import { TopFindingsList } from '@/components/surface/TopFindingsList';
import { AssetHealthGrid } from '@/components/surface/AssetHealthGrid';
import { CategoryDetailSheet } from '@/components/surface/CategoryDetailSheet';
import { AssetDetailSheet } from '@/components/surface/AssetDetailSheet';
import { SeverityTechDonut } from '@/components/surface/SeverityTechDonut';

/* ══════════════════════ DATA LOGIC (from V2) ══════════════════════ */

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
      const { data, error } = await (supabase.from('attack_surface_snapshots' as any).select('id, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1) as any);
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
    refetchInterval: 30000,
    staleTime: 15000,
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

interface TLSCertInfo { subject_cn: string; issuer: string; not_after: string | null; daysRemaining: number | null; }

interface ExposedAsset {
  hostname: string; ip: string;
  asn: { asn: string; provider: string; org: string; is_cdn: boolean; country?: string; abuse_email?: string; tech_email?: string; ip_range?: string; owner?: string; ownerid?: string; responsible?: string; abuse_handle?: string; } | null;
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
    }
    for (const svc of result.services || []) {
      const scripts = svc.scripts || {};
      if (scripts['ssl-cert']) { const m = scripts['ssl-cert'].match(/organizationName=([^\n\/,]+)/i); if (m) techSet.add(m[1].trim()); }
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
    const maxSev = (asset: ExposedAsset) => { let max = 0; for (const cve of asset.cves) { const s = (cve.severity || 'medium').toLowerCase(); const r = s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1; if (r > max) max = r; } return max; };
    const sevDiff = maxSev(b) - maxSev(a);
    if (sevDiff !== 0) return sevDiff;
    return (b.services.length + b.webServices.length) - (a.services.length + a.webServices.length);
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

/* ══════════════════════ MAIN PAGE ══════════════════════ */

export default function SurfaceAnalyzerV3Page() {
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
  const rescanMutation = useAttackSurfaceRescanIP(selectedClientId ?? undefined);
  const [rescanningIp, setRescanningIp] = useState<string | null>(null);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

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

  const findings = useMemo(() => generateFindings(assets as FindingsAsset[]), [assets]);
  const findingsStats = useMemo(() => calculateFindingsStats(findings), [findings]);

  const assetStats = useMemo(() => {
    let totalServices = 0, expiredCerts = 0, criticalCVEs = 0;
    for (const a of assets) {
      totalServices += a.services.length + a.webServices.length;
      expiredCerts += a.expiredCerts;
      for (const cve of a.cves) {
        if ((cve.severity || '').toLowerCase() === 'critical') criticalCVEs++;
      }
    }
    return { totalAssets: assets.length, totalServices, expiredCerts, criticalCVEs };
  }, [assets]);

  // Sheet state
  const [sheetCategory, setSheetCategory] = useState<SurfaceFindingCategory | null>(null);
  const [sheetAssetIp, setSheetAssetIp] = useState<string | null>(null);
  const [sheetFindingId, setSheetFindingId] = useState<string | null>(null);

  const sheetOpen = sheetCategory !== null || sheetAssetIp !== null || sheetFindingId !== null;

  const sheetFindings = useMemo(() => {
    if (sheetFindingId) return findings.filter(f => f.id === sheetFindingId);
    if (sheetCategory) return findings.filter(f => f.category === sheetCategory);
    if (sheetAssetIp) return findings.filter(f => f.affectedAssets.some(a => a.ip === sheetAssetIp));
    return [];
  }, [findings, sheetCategory, sheetAssetIp, sheetFindingId]);

  const sheetTitle = useMemo(() => {
    if (sheetFindingId) {
      const f = findings.find(f => f.id === sheetFindingId);
      return f?.name || '';
    }
    if (sheetCategory) return CATEGORY_INFO[sheetCategory]?.label || '';
    if (sheetAssetIp) {
      const asset = assets.find(a => a.ip === sheetAssetIp);
      return asset ? `${asset.hostname} (${asset.ip})` : sheetAssetIp;
    }
    return '';
  }, [sheetCategory, sheetAssetIp, sheetFindingId, assets, findings]);

  const handleCloseSheet = (open: boolean) => {
    if (!open) {
      setSheetCategory(null);
      setSheetAssetIp(null);
      setSheetFindingId(null);
    }
  };

  const handleCategoryClick = (cat: SurfaceFindingCategory) => {
    if (cat === 'leaked_credentials') {
      // Open leaked credentials in sheet
      setSheetCategory(cat);
    } else {
      setSheetCategory(cat);
    }
  };

  // Leaked credentials count (from dehashed_cache)
  const { data: leakedCount } = useQuery({
    queryKey: ['leaked-count', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return 0;
      const { data } = await supabase.from('dehashed_cache').select('total_entries').eq('client_id', selectedClientId);
      return (data || []).reduce((sum, d) => sum + (d.total_entries || 0), 0);
    },
    enabled: !!selectedClientId,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 lg:p-8 space-y-6">
          <PageBreadcrumb items={[{ label: 'Domínio Externo' }, { label: 'Analyzer' }]} />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Surface Analyzer</h1>
              <p className="text-muted-foreground">Dashboard de exposição dos ativos na internet</p>
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
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Cancelar
                </Button>
              )}
              <Button variant="outline" size="icon" title="Configurar agendamento" onClick={() => setScheduleDialogOpen(true)}><Settings className="w-4 h-4" /></Button>
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

          {/* Last collection info */}
          {snapshot?.completed_at && (
            <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Última coleta:</span>
              <Badge variant="outline" className="text-xs">
                {new Date(snapshot.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Badge>
            </div>
          )}

          {/* Main content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !activeSnapshot || assets.length === 0 ? (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="py-10 text-center max-w-md mx-auto">
                <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-1">Nenhuma análise encontrada</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Execute uma análise para visualizar os ativos expostos na internet.
                </p>
                <Button onClick={() => setScanDialogOpen(true)} disabled={!isSuperRole}>
                  <Play className="w-4 h-4 mr-2" /> Executar Análise
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-10">
              {/* 1. Summary Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Globe className="w-8 h-8 text-teal-400" />
                    <div>
                      <p className="text-2xl font-bold">{assetStats.totalAssets}</p>
                      <p className="text-xs text-muted-foreground">Ativos Expostos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Server className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-2xl font-bold">{assetStats.totalServices}</p>
                      <p className="text-xs text-muted-foreground">Serviços Detectados</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold">{assetStats.criticalCVEs}</p>
                      <p className="text-xs text-muted-foreground">CVEs Críticas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-warning" />
                    <div>
                      <p className="text-2xl font-bold">{assetStats.expiredCerts}</p>
                      <p className="text-xs text-muted-foreground">Certificados Expirados</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 2. Category Overview Grid */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Panorama por Categoria</h2>
                <CategoryOverviewGrid
                  findings={findings}
                  leakedCount={leakedCount || 0}
                  onCategoryClick={handleCategoryClick}
                />
              </div>

              {/* 3. Top Findings + Donut side by side */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Exposição dos Serviços</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopFindingsList
                  findings={findings}
                  onViewAll={() => {}}
                  onFindingClick={(f) => setSheetFindingId(f.id)}
                />
                <SeverityTechDonut findings={findings} assets={assets} />
                </div>
              </div>

              {/* 4. Asset Health (full-width) */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detalhamento da Exposição</h2>
                <AssetHealthGrid
                assets={assets}
                findings={findings}
                onAssetClick={(ip) => setSheetAssetIp(ip)}
                isSuperRole={isSuperRole}
                rescanningIp={rescanningIp}
                onRescan={(ip, hostname, source) => {
                  if (!activeSnapshot) return;
                  setRescanningIp(ip);
                  rescanMutation.mutate(
                    { ip, source, label: hostname, snapshotId: activeSnapshot.id },
                    { onSettled: () => setRescanningIp(null) }
                  );
                }}
              />
              </div>
            </div>
          )}

        </div>

        {/* Detail Sheet — Asset Detail (tabbed) */}
        {sheetAssetIp && (() => {
          const asset = assets.find(a => a.ip === sheetAssetIp);
          if (!asset) return null;
          return (
            <AssetDetailSheet
              open={!!sheetAssetIp}
              onOpenChange={handleCloseSheet}
              hostname={asset.hostname}
              ip={asset.ip}
              ports={asset.ports}
              services={asset.services}
              webServices={asset.webServices}
              tlsCerts={asset.tlsCerts}
              cves={asset.cves}
              allTechs={asset.allTechs}
              findings={sheetFindings}
            />
          );
        })()}

        {/* Detail Sheet — Category / Finding */}
        <CategoryDetailSheet
          open={sheetOpen && !sheetAssetIp}
          onOpenChange={handleCloseSheet}
          category={sheetCategory}
          findings={sheetCategory === 'leaked_credentials' ? [] : sheetFindings}
          title={sheetTitle}
        >
          {sheetCategory === 'leaked_credentials' && selectedClientId && clientDomains && clientDomains.length > 0 && (
            <LeakedCredentialsSection clientId={selectedClientId} domains={clientDomains} isSuperRole={isSuperRole} />
          )}
        </CategoryDetailSheet>

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
            <Alert className="border-blue-500/30 bg-blue-500/5">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-sm text-muted-foreground">
                O Surface Analyzer monitora eventos e métricas em tempo real. Recomendamos agendar a execução 1 vez por hora.
              </AlertDescription>
            </Alert>
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
