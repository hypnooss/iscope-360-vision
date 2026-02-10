import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePreview } from '@/contexts/PreviewContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModuleHealth {
  score: number | null;
  assetCount: number;
  lastAnalysisDate: string | null;
  severities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const emptyHealth: ModuleHealth = {
  score: null,
  assetCount: 0,
  lastAnalysisDate: null,
  severities: { critical: 0, high: 0, medium: 0, low: 0 },
};

export interface RecentActivity {
  id: string;
  module: 'firewall' | 'm365' | 'external_domain';
  resourceName: string;
  clientName: string;
  score: number | null;
  date: string;
}

export interface DashboardStats {
  firewall: ModuleHealth;
  m365: ModuleHealth;
  externalDomain: ModuleHealth;
  agentsOnline: number;
  agentsTotal: number;
  totalSeverities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  totalAssets: number;
  lastOverallAnalysis: string | null;
  recentActivity: RecentActivity[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  const { user } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const workspaceIds = isPreviewMode && previewTarget?.workspaces
    ? previewTarget.workspaces.map(w => w.id)
    : null;

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, isPreviewMode, previewTarget]);

  const fetchStats = async () => {
    try {
      // ── 1. Asset counts (parallel) ──────────────────────────────────
      let fwQuery = supabase.from('firewalls').select('id, client_id', { count: 'exact' });
      let m365Query = supabase.from('m365_tenants').select('id, client_id', { count: 'exact' })
        .in('connection_status', ['connected', 'partial']);
      let extQuery = supabase.from('external_domains').select('id, client_id', { count: 'exact' });
      let agentsQuery = supabase.from('agents').select('id, client_id, last_seen, revoked')
        .eq('revoked', false);

      if (workspaceIds && workspaceIds.length > 0) {
        fwQuery = fwQuery.in('client_id', workspaceIds);
        m365Query = m365Query.in('client_id', workspaceIds);
        extQuery = extQuery.in('client_id', workspaceIds);
        agentsQuery = agentsQuery.in('client_id', workspaceIds);
      }

      const [fwRes, m365Res, extRes, agentsRes] = await Promise.all([
        fwQuery, m365Query, extQuery, agentsQuery,
      ]);

      // Agents
      const agents = agentsRes.data || [];
      const agentsTotal = agents.length;
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const agentsOnline = agents.filter(a => a.last_seen && a.last_seen > fiveMinAgo).length;

      // ── 2. Scores per module ────────────────────────────────────────
      const firewallIds = (fwRes.data || []).map(f => f.id);
      const tenantIds = (m365Res.data || []).map(t => t.id);
      const extDomainIds = (extRes.data || []).map(d => d.id);

      // --- Firewall ---
const fwHealth: ModuleHealth = {
        score: null,
        assetCount: fwRes.count || 0,
        lastAnalysisDate: null,
        severities: { critical: 0, high: 0, medium: 0, low: 0 },
      };
      if (firewallIds.length > 0) {
        const { data: fwHistory } = await supabase
          .from('analysis_history')
          .select('firewall_id, score, report_data, created_at')
          .in('firewall_id', firewallIds)
          .order('created_at', { ascending: false });

        const scores: number[] = [];
        let latestDate: string | null = null;
        const seen = new Set<string>();
        for (const h of (fwHistory || [])) {
          if (seen.has(h.firewall_id)) continue;
          seen.add(h.firewall_id);
          scores.push(h.score);
          if (!latestDate || h.created_at > latestDate) latestDate = h.created_at;
          const report = h.report_data as any;
          if (report?.summary) {
            fwHealth.severities.critical += report.summary.critical || 0;
            fwHealth.severities.high += report.summary.high || 0;
            fwHealth.severities.medium += report.summary.medium || 0;
            fwHealth.severities.low += report.summary.low || 0;
          }
        }
        fwHealth.score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        fwHealth.lastAnalysisDate = latestDate;
      }

      // --- M365 ---
const m365Health: ModuleHealth = {
        score: null,
        assetCount: m365Res.count || 0,
        lastAnalysisDate: null,
        severities: { critical: 0, high: 0, medium: 0, low: 0 },
      };
      if (tenantIds.length > 0) {
        const { data: m365History } = await supabase
          .from('m365_posture_history')
          .select('tenant_record_id, score, summary, created_at')
          .in('tenant_record_id', tenantIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        const scores: number[] = [];
        let latestDate: string | null = null;
        const seen = new Set<string>();
        for (const h of (m365History || [])) {
          if (seen.has(h.tenant_record_id)) continue;
          seen.add(h.tenant_record_id);
          if (h.score != null) scores.push(h.score);
          if (!latestDate || (h.created_at && h.created_at > latestDate)) latestDate = h.created_at;
          const summary = h.summary as any;
          if (summary) {
            m365Health.severities.critical += summary.critical || 0;
            m365Health.severities.high += summary.high || 0;
            m365Health.severities.medium += summary.medium || 0;
            m365Health.severities.low += summary.low || 0;
          }
        }
        m365Health.score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        m365Health.lastAnalysisDate = latestDate;
      }

      // --- External Domain ---
      const extHealth: ModuleHealth = { ...emptyHealth, assetCount: extRes.count || 0 };
      if (extDomainIds.length > 0) {
        const { data: extHistory } = await supabase
          .from('external_domain_analysis_history')
          .select('domain_id, score, created_at')
          .in('domain_id', extDomainIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        const scores: number[] = [];
        let latestDate: string | null = null;
        const seen = new Set<string>();
        for (const h of (extHistory || [])) {
          if (seen.has(h.domain_id)) continue;
          seen.add(h.domain_id);
          if (h.score != null) scores.push(h.score);
          if (!latestDate || h.created_at > latestDate) latestDate = h.created_at;
        }
        extHealth.score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        extHealth.lastAnalysisDate = latestDate;
      }

      // Cross-module totals
      const totalSeverities = {
        critical: fwHealth.severities.critical + m365Health.severities.critical + extHealth.severities.critical,
        high: fwHealth.severities.high + m365Health.severities.high + extHealth.severities.high,
        medium: fwHealth.severities.medium + m365Health.severities.medium + extHealth.severities.medium,
        low: fwHealth.severities.low + m365Health.severities.low + extHealth.severities.low,
      };

      const totalAssets = fwHealth.assetCount + m365Health.assetCount + extHealth.assetCount;

      const dates = [fwHealth.lastAnalysisDate, m365Health.lastAnalysisDate, extHealth.lastAnalysisDate].filter(Boolean) as string[];
      const lastOverallAnalysis = dates.length > 0 ? dates.sort().reverse()[0] : null;

      // ── 3. Recent activity ──────────────────────────────────────────
      const recentActivity: RecentActivity[] = [];

      // Firewall recent
      if (firewallIds.length > 0) {
        const { data: fwRecent } = await supabase
          .from('analysis_history')
          .select('id, firewall_id, score, created_at')
          .in('firewall_id', firewallIds)
          .order('created_at', { ascending: false })
          .limit(10);

        if (fwRecent?.length) {
          const fwIds = [...new Set(fwRecent.map(r => r.firewall_id))];
          const { data: fwData } = await supabase.from('firewalls').select('id, name, client_id').in('id', fwIds);
          const clientIds = [...new Set((fwData || []).map(f => f.client_id))];
          const { data: clientData } = clientIds.length > 0
            ? await supabase.from('clients').select('id, name').in('id', clientIds)
            : { data: [] };

          const fwMap = new Map((fwData || []).map(f => [f.id, f]));
          const cMap = new Map((clientData || []).map(c => [c.id, c]));

          for (const r of fwRecent) {
            const fw = fwMap.get(r.firewall_id);
            recentActivity.push({
              id: r.id,
              module: 'firewall',
              resourceName: fw?.name || 'N/A',
              clientName: fw ? cMap.get(fw.client_id)?.name || 'N/A' : 'N/A',
              score: r.score,
              date: r.created_at,
            });
          }
        }
      }

      // M365 recent
      if (tenantIds.length > 0) {
        const { data: m365Recent } = await supabase
          .from('m365_posture_history')
          .select('id, tenant_record_id, score, created_at, client_id')
          .in('tenant_record_id', tenantIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10);

        if (m365Recent?.length) {
          const tIds = [...new Set(m365Recent.map(r => r.tenant_record_id))];
          const { data: tData } = await supabase.from('m365_tenants').select('id, display_name, tenant_domain').in('id', tIds);
          const cIds = [...new Set(m365Recent.map(r => r.client_id))];
          const { data: cData } = cIds.length > 0
            ? await supabase.from('clients').select('id, name').in('id', cIds)
            : { data: [] };

          const tMap = new Map((tData || []).map(t => [t.id, t]));
          const cMap = new Map((cData || []).map(c => [c.id, c]));

          for (const r of m365Recent) {
            const tenant = tMap.get(r.tenant_record_id);
            recentActivity.push({
              id: r.id,
              module: 'm365',
              resourceName: tenant?.display_name || tenant?.tenant_domain || 'N/A',
              clientName: cMap.get(r.client_id)?.name || 'N/A',
              score: r.score,
              date: r.created_at || '',
            });
          }
        }
      }

      // External domain recent
      if (extDomainIds.length > 0) {
        const { data: extRecent } = await supabase
          .from('external_domain_analysis_history')
          .select('id, domain_id, score, created_at')
          .in('domain_id', extDomainIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10);

        if (extRecent?.length) {
          const dIds = [...new Set(extRecent.map(r => r.domain_id))];
          const { data: dData } = await supabase.from('external_domains').select('id, name, client_id').in('id', dIds);
          const cIds = [...new Set((dData || []).map(d => d.client_id))];
          const { data: cData } = cIds.length > 0
            ? await supabase.from('clients').select('id, name').in('id', cIds)
            : { data: [] };

          const dMap = new Map((dData || []).map(d => [d.id, d]));
          const cMap = new Map((cData || []).map(c => [c.id, c]));

          for (const r of extRecent) {
            const domain = dMap.get(r.domain_id);
            recentActivity.push({
              id: r.id,
              module: 'external_domain',
              resourceName: domain?.name || 'N/A',
              clientName: domain ? cMap.get(domain.client_id)?.name || 'N/A' : 'N/A',
              score: r.score,
              date: r.created_at,
            });
          }
        }
      }

      recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const topActivity = recentActivity.slice(0, 10);

      setStats({
        firewall: fwHealth,
        m365: m365Health,
        externalDomain: extHealth,
        agentsOnline,
        agentsTotal,
        totalSeverities,
        totalAssets,
        lastOverallAnalysis,
        recentActivity: topActivity,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading };
}
