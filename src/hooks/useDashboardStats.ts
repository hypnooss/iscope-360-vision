import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePreview } from '@/contexts/PreviewContext';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardStats {
  totalFirewalls: number;
  totalM365Tenants: number;
  totalExternalDomains: number;
  agentsOnline: number;
  agentsTotal: number;
  consolidatedScore: number | null;
  severities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentActivity: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  module: 'firewall' | 'm365' | 'external_domain';
  resourceName: string;
  clientName: string;
  score: number | null;
  date: string;
}

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

  const applyWorkspaceFilter = <T extends { in: (col: string, values: string[]) => T }>(
    query: T,
    column: string
  ): T => {
    if (workspaceIds && workspaceIds.length > 0) {
      return query.in(column, workspaceIds);
    }
    return query;
  };

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

      const totalFirewalls = fwRes.count || 0;
      const totalM365Tenants = m365Res.count || 0;
      const totalExternalDomains = extRes.count || 0;

      const agents = agentsRes.data || [];
      const agentsTotal = agents.length;
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const agentsOnline = agents.filter(a => a.last_seen && a.last_seen > fiveMinAgo).length;

      // ── 2. Latest scores per resource ───────────────────────────────
      const firewallIds = (fwRes.data || []).map(f => f.id);
      const tenantIds = (m365Res.data || []).map(t => t.id);

      // Firewall: latest analysis per firewall
      let fwScores: number[] = [];
      let fwSeverities = { critical: 0, high: 0, medium: 0, low: 0 };

      if (firewallIds.length > 0) {
        const { data: fwHistory } = await supabase
          .from('analysis_history')
          .select('firewall_id, score, report_data, created_at')
          .in('firewall_id', firewallIds)
          .order('created_at', { ascending: false });

        // Deduplicate: keep only latest per firewall
        const seenFw = new Set<string>();
        for (const h of (fwHistory || [])) {
          if (seenFw.has(h.firewall_id)) continue;
          seenFw.add(h.firewall_id);
          fwScores.push(h.score);

          // Extract severities from report_data summary if available
          const report = h.report_data as any;
          if (report?.summary) {
            fwSeverities.critical += report.summary.critical || 0;
            fwSeverities.high += report.summary.high || 0;
            fwSeverities.medium += report.summary.medium || 0;
            fwSeverities.low += report.summary.low || 0;
          }
        }
      }

      // M365: latest posture per tenant
      let m365Scores: number[] = [];
      let m365Severities = { critical: 0, high: 0, medium: 0, low: 0 };

      if (tenantIds.length > 0) {
        const { data: m365History } = await supabase
          .from('m365_posture_history')
          .select('tenant_record_id, score, summary, created_at')
          .in('tenant_record_id', tenantIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        const seenTenant = new Set<string>();
        for (const h of (m365History || [])) {
          if (seenTenant.has(h.tenant_record_id)) continue;
          seenTenant.add(h.tenant_record_id);
          if (h.score != null) m365Scores.push(h.score);

          const summary = h.summary as any;
          if (summary) {
            m365Severities.critical += summary.critical || 0;
            m365Severities.high += summary.high || 0;
            m365Severities.medium += summary.medium || 0;
            m365Severities.low += summary.low || 0;
          }
        }
      }

      // Consolidated score
      const allScores = [...fwScores, ...m365Scores];
      const consolidatedScore = allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : null;

      const severities = {
        critical: fwSeverities.critical + m365Severities.critical,
        high: fwSeverities.high + m365Severities.high,
        medium: fwSeverities.medium + m365Severities.medium,
        low: fwSeverities.low + m365Severities.low,
      };

      // ── 3. Recent activity (unified timeline) ──────────────────────
      const recentActivity: RecentActivity[] = [];

      // Firewall recent
      if (firewallIds.length > 0) {
        const { data: fwRecent } = await supabase
          .from('analysis_history')
          .select('id, firewall_id, score, created_at')
          .in('firewall_id', firewallIds)
          .order('created_at', { ascending: false })
          .limit(8);

        if (fwRecent && fwRecent.length > 0) {
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
          .limit(8);

        if (m365Recent && m365Recent.length > 0) {
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
      const extDomainIds = (extRes.data || []).map(d => d.id);
      if (extDomainIds.length > 0) {
        const { data: extRecent } = await supabase
          .from('external_domain_analysis_history')
          .select('id, domain_id, score, created_at')
          .in('domain_id', extDomainIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(8);

        if (extRecent && extRecent.length > 0) {
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

      // Sort by date desc and take top 8
      recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const topActivity = recentActivity.slice(0, 8);

      setStats({
        totalFirewalls,
        totalM365Tenants,
        totalExternalDomains,
        agentsOnline,
        agentsTotal,
        consolidatedScore,
        severities,
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
