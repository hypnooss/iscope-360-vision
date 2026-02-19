import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLatestAnalyzerSnapshot } from '@/hooks/useAnalyzerData';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ArrowLeft, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AnalyzerCategory, AnalyzerSeverity, AnalyzerInsight } from '@/types/analyzerInsights';

const categoryLabels: Record<AnalyzerCategory, string> = {
  denied_traffic: 'Tráfego Negado',
  authentication: 'Autenticação',
  ips_ids: 'IPS / IDS',
  dns_security: 'DNS Security',
  config_changes: 'Alterações de Configuração',
  traffic_behavior: 'Comportamento de Tráfego',
  lateral_movement: 'Movimento Lateral',
  persistent_sessions: 'Sessões Persistentes',
  geolocation: 'Geolocalização',
  ioc_correlation: 'IoC Correlation',
  anomaly: 'Anomalias de Rede',
};

const severityOrder: AnalyzerSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

interface FirewallOption { id: string; name: string; client_id: string; }

export default function AnalyzerInsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const [selectedFirewall, setSelectedFirewall] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);

  const { data: firewalls = [] } = useQuery({
    queryKey: ['analyzer-firewalls', selectedWorkspaceId, isSuperRole],
    queryFn: async () => {
      let query = supabase.from('firewalls').select('id, name, client_id').order('name');
      if (isSuperRole && selectedWorkspaceId) {
        query = query.eq('client_id', selectedWorkspaceId);
      }
      const { data } = await query;
      return (data ?? []) as FirewallOption[];
    },
    enabled: isSuperRole ? !!selectedWorkspaceId : true,
  });

  useEffect(() => {
    if (firewalls.length > 0 && !firewalls.find(f => f.id === selectedFirewall)) {
      setSelectedFirewall(firewalls[0].id);
    } else if (firewalls.length === 0) {
      setSelectedFirewall('');
    }
  }, [firewalls]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) navigate('/modules');
  }, [user, authLoading, navigate, hasModuleAccess]);

  const { data: snapshot, isLoading } = useLatestAnalyzerSnapshot(selectedFirewall || undefined);

  const filteredInsights = (snapshot?.insights ?? []).filter(i => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    return true;
  });

  // Group by category
  const grouped = filteredInsights.reduce<Record<string, AnalyzerInsight[]>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  // Sort categories by highest severity
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const getMinSev = (cat: string) => Math.min(...grouped[cat].map(i => severityOrder.indexOf(i.severity)));
    return getMinSev(a) - getMinSev(b);
  });

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Firewall' },
          { label: 'Analyzer', href: '/scope-firewall/analyzer' },
          { label: 'Insights' },
        ]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/scope-firewall/analyzer')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Insights</h1>
              <p className="text-muted-foreground">Drill-down técnico por categoria</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isSuperRole && !isPreviewMode && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={(v) => { setSelectedWorkspaceId(v); setSelectedFirewall(''); }}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces?.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedFirewall} onValueChange={setSelectedFirewall}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Firewall" /></SelectTrigger>
              <SelectContent>{firewalls.map(fw => <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : sortedCategories.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum insight encontrado. Execute uma análise primeiro.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map(cat => (
              <Card key={cat} className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">
                    {categoryLabels[cat as AnalyzerCategory] ?? cat}
                    <Badge variant="secondary" className="ml-2">{grouped[cat].length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {grouped[cat].sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)).map((insight, idx) => {
                    const key = `${cat}-${idx}`;
                    return (
                      <Collapsible key={key} open={expandedInsights[key]} onOpenChange={o => setExpandedInsights(p => ({ ...p, [key]: o }))}>
                        <CollapsibleTrigger className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors text-left">
                          {expandedInsights[key] ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                          <Badge variant="outline" className={cn(
                            'text-xs shrink-0',
                            insight.severity === 'critical' && 'text-rose-400 border-rose-500/30',
                            insight.severity === 'high' && 'text-orange-400 border-orange-500/30',
                            insight.severity === 'medium' && 'text-warning border-warning/30',
                            insight.severity === 'low' && 'text-primary border-primary/30',
                            insight.severity === 'info' && 'text-muted-foreground border-border',
                          )}>{insight.severity}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{insight.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{insight.description}</p>
                          </div>
                          {insight.count != null && <Badge variant="secondary" className="font-mono">{insight.count}</Badge>}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-11 pr-3 pb-3">
                          <div className="text-sm text-muted-foreground space-y-2 bg-secondary/20 rounded-lg p-4">
                            {insight.details && <p>{insight.details}</p>}
                            {insight.sourceIPs?.length ? (
                              <div>
                                <span className="font-medium text-foreground">IPs de Origem:</span>{' '}
                                <span className="font-mono text-xs">{insight.sourceIPs.join(', ')}</span>
                              </div>
                            ) : null}
                            {insight.targetPorts?.length ? (
                              <div>
                                <span className="font-medium text-foreground">Portas Alvo:</span>{' '}
                                <span className="font-mono text-xs">{insight.targetPorts.join(', ')}</span>
                              </div>
                            ) : null}
                            {insight.affectedUsers?.length ? (
                              <div>
                                <span className="font-medium text-foreground">Usuários:</span>{' '}
                                <span className="font-mono text-xs">{insight.affectedUsers.join(', ')}</span>
                              </div>
                            ) : null}
                            {insight.recommendation && (
                              <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20">
                                <span className="font-medium text-primary text-xs">Recomendação:</span>
                                <p className="text-xs mt-1">{insight.recommendation}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
