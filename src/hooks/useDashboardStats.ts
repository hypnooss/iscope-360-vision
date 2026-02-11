import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MODULE_DASHBOARD_CONFIG } from '@/config/moduleDashboardConfig';
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


// ─── Helpers ──────────────────────────────────────────────────────────────────

type SeverityCounts = { critical: number; high: number; medium: number; low: number };

/** Extract severity counts from report_data by walking categories[].checks[] */
function extractSeveritiesFromReport(reportData: any): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  if (!reportData) return counts;
  // If a pre-computed summary exists, use it
  if (reportData.summary) {
    counts.critical = reportData.summary.critical || 0;
    counts.high = reportData.summary.high || 0;
    counts.medium = reportData.summary.medium || 0;
    counts.low = reportData.summary.low || 0;
    return counts;
  }
  // Otherwise walk categories → checks/rules
  const categories = reportData.categories as any[] | undefined;
  if (!Array.isArray(categories)) return counts;
  for (const cat of categories) {
    const rules = (cat.checks || cat.rules || []) as any[];
    for (const rule of rules) {
      if (rule.status === 'pass') continue;
      const sev = rule.severity as string;
      if (sev in counts) {
        counts[sev as keyof SeverityCounts]++;
      }
    }
  }
  return counts;
}


export interface DashboardStats {
  modules: Record<string, ModuleHealth>;
  agentsOnline: number;
  agentsTotal: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardStats(selectedWorkspaceId?: string | null) {
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
  }, [user, isPreviewMode, previewTarget, selectedWorkspaceId]);

  const fetchStats = async () => {
    try {
      // ── 1. Asset counts (parallel) ──────────────────────────────────
      let fwQuery = supabase.from('firewalls').select('id, client_id', { count: 'exact' });
      let m365Query = supabase.from('m365_tenants').select('id, client_id', { count: 'exact' })
        .in('connection_status', ['connected', 'partial']);
      let extQuery = supabase.from('external_domains').select('id, client_id', { count: 'exact' });
      let agentsQuery = supabase.from('agents').select('id, client_id, last_seen, revoked')
        .eq('revoked', false);

      if (selectedWorkspaceId) {
        fwQuery = fwQuery.eq('client_id', selectedWorkspaceId);
        m365Query = m365Query.eq('client_id', selectedWorkspaceId);
        extQuery = extQuery.eq('client_id', selectedWorkspaceId);
        agentsQuery = agentsQuery.eq('client_id', selectedWorkspaceId);
      } else if (workspaceIds && workspaceIds.length > 0) {
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
          const sevs = extractSeveritiesFromReport(h.report_data);
          fwHealth.severities.critical += sevs.critical;
          fwHealth.severities.high += sevs.high;
          fwHealth.severities.medium += sevs.medium;
          fwHealth.severities.low += sevs.low;
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
const extHealth: ModuleHealth = {
        score: null,
        assetCount: extRes.count || 0,
        lastAnalysisDate: null,
        severities: { critical: 0, high: 0, medium: 0, low: 0 },
      };
      if (extDomainIds.length > 0) {
        const { data: extHistory } = await supabase
          .from('external_domain_analysis_history')
          .select('domain_id, score, report_data, created_at')
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
          const sevs = extractSeveritiesFromReport(h.report_data);
          extHealth.severities.critical += sevs.critical;
          extHealth.severities.high += sevs.high;
          extHealth.severities.medium += sevs.medium;
          extHealth.severities.low += sevs.low;
        }
        extHealth.score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        extHealth.lastAnalysisDate = latestDate;
      }

      const modulesRecord: Record<string, ModuleHealth> = {
        firewall: fwHealth,
        m365: m365Health,
        externalDomain: extHealth,
      };

      // Auto-fill remaining modules from config with emptyHealth
      for (const config of Object.values(MODULE_DASHBOARD_CONFIG)) {
        if (!modulesRecord[config.statsKey]) {
          modulesRecord[config.statsKey] = { ...emptyHealth };
        }
      }

      setStats({
        modules: modulesRecord,
        agentsOnline,
        agentsTotal,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading };
}
