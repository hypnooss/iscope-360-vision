import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLatestAnalyzerSnapshot } from '@/hooks/useAnalyzerData';
import { cn } from '@/lib/utils';
import { AlertOctagon, AlertTriangle } from 'lucide-react';

interface FirewallOption { id: string; name: string; }

export default function AnalyzerCriticalPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [firewalls, setFirewalls] = useState<FirewallOption[]>([]);
  const [selectedFirewall, setSelectedFirewall] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) navigate('/modules');
  }, [user, authLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('firewalls').select('id, name').order('name');
      if (data?.length) { setFirewalls(data); setSelectedFirewall(data[0].id); }
    })();
  }, []);

  const { data: snapshot, isLoading } = useLatestAnalyzerSnapshot(selectedFirewall || undefined);

  const criticalInsights = (snapshot?.insights ?? []).filter(
    i => i.severity === 'critical' || i.severity === 'high'
  ).sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Firewall' },
          { label: 'Analyzer', href: '/scope-firewall/analyzer' },
          { label: 'Monitoramento Crítico' },
        ]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertOctagon className="w-6 h-6 text-rose-400" />
              Monitoramento Crítico
            </h1>
            <p className="text-muted-foreground">Apenas eventos Critical e High</p>
          </div>
          <Select value={selectedFirewall} onValueChange={setSelectedFirewall}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Firewall" /></SelectTrigger>
            <SelectContent>{firewalls.map(fw => <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : criticalInsights.length === 0 ? (
          <Card className="glass-card border-primary/20">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <AlertOctagon className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-medium text-foreground">Nenhum evento crítico detectado</p>
              <p className="text-sm text-muted-foreground mt-1">O ambiente está sem alertas de alto risco no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {criticalInsights.map((insight, i) => (
              <Card key={i} className={cn(
                'glass-card border-l-4',
                insight.severity === 'critical' ? 'border-l-rose-500' : 'border-l-orange-500',
              )}>
                <CardContent className="flex items-start gap-4 p-5">
                  {insight.severity === 'critical'
                    ? <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-6 h-6 text-orange-400 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        insight.severity === 'critical' ? 'text-rose-400 border-rose-500/30' : 'text-orange-400 border-orange-500/30',
                      )}>{insight.severity}</Badge>
                      <Badge variant="secondary" className="text-xs">{insight.category.replace('_', ' ')}</Badge>
                    </div>
                    <p className="font-medium text-foreground">{insight.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    {insight.details && (
                      <p className="text-xs text-muted-foreground mt-2 bg-secondary/30 rounded p-2 font-mono">{insight.details}</p>
                    )}
                  </div>
                  {insight.count != null && (
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-foreground">{insight.count}</div>
                      <div className="text-xs text-muted-foreground">eventos</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
