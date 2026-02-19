import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useLatestAnalyzerSnapshot } from '@/hooks/useAnalyzerData';
import { useQuery } from '@tanstack/react-query';
import type { ConfigChangeDetail } from '@/types/analyzerInsights';
import { ArrowLeft, Building2, Search, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FirewallOption { id: string; name: string; client_id: string; }

const severityColors: Record<string, string> = {
  critical: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  medium: 'text-warning border-warning/30 bg-warning/10',
  low: 'text-primary border-primary/30 bg-primary/10',
};

export default function AnalyzerConfigChangesPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const [selectedFirewall, setSelectedFirewall] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

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
    if (!authLoading && !user) { navigate('/auth'); return; }
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) navigate('/modules');
  }, [user, authLoading, navigate, hasModuleAccess]);

  const { data: snapshot, isLoading, refetch } = useLatestAnalyzerSnapshot(selectedFirewall || undefined);
  const SYSTEM_ACTION_PATTERNS = ['phase1_sa', 'phase2_sa'];
  const allDetails: ConfigChangeDetail[] = (snapshot?.metrics?.configChangeDetails as any) || [];
  const details = allDetails.filter(d => {
    if (!d.user || d.user === 'unknown') return false;
    if (SYSTEM_ACTION_PATTERNS.some(p => d.action?.toLowerCase().includes(p))) return false;
    return true;
  });

  const categories = useMemo(() => {
    const cats = new Set(details.map(d => d.category));
    return ['all', ...Array.from(cats).sort()];
  }, [details]);

  const filtered = useMemo(() => {
    return details.filter(d => {
      if (searchUser && !d.user.toLowerCase().includes(searchUser.toLowerCase())) return false;
      if (filterCategory !== 'all' && d.category !== filterCategory) return false;
      return true;
    });
  }, [details, searchUser, filterCategory]);

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Firewall' },
          { label: 'Analyzer', href: '/scope-firewall/analyzer' },
          { label: 'Alterações de Configuração' },
        ]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/scope-firewall/analyzer')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Alterações de Configuração</h1>
              <p className="text-muted-foreground text-sm">Auditoria detalhada de modificações no firewall</p>
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
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecionar firewall" /></SelectTrigger>
              <SelectContent>
                {firewalls.map(fw => <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Atualizar dados">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por usuário..."
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c === 'all' ? 'Todas categorias' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {allDetails.length > 0 && details.length === 0 && !isLoading && !searchUser && filterCategory === 'all' && (
          <Alert className="mb-6 border-warning/30 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Detalhes indisponíveis</AlertTitle>
            <AlertDescription>
              Alterações detectadas, mas todas são ações automáticas do sistema.
              Execute uma nova análise para gerar dados detalhados de administradores.
            </AlertDescription>
          </Alert>
        )}

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">
              {filtered.length} alteração(ões) encontrada(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma alteração de configuração encontrada</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Objeto</TableHead>
                      <TableHead>Atributo</TableHead>
                      <TableHead>Severidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {d.date ? new Date(d.date).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="font-medium">{d.user}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{d.action || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{d.category || '—'}</TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate" title={d.cfgpath}>
                          {d.cfgpath || '—'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={d.cfgobj}>
                          {d.cfgobj || '—'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={d.cfgattr}>
                          {d.cfgattr || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={severityColors[d.severity] || ''}>
                            {d.severity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
