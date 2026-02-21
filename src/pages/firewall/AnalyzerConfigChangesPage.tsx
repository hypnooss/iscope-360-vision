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
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Search, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FirewallOption { id: string; name: string; client_id: string; }

interface ConfigChangeRow {
  id: string;
  user_name: string;
  action: string;
  cfgpath: string;
  cfgobj: string;
  cfgattr: string;
  msg: string;
  category: string;
  severity: string;
  changed_at: string;
}

const severityColors: Record<string, string> = {
  critical: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  medium: 'text-warning border-warning/30 bg-warning/10',
  low: 'text-primary border-primary/30 bg-primary/10',
};

const PAGE_SIZE = 50;

export default function AnalyzerConfigChangesPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const [selectedFirewall, setSelectedFirewall] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

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

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [selectedFirewall, searchUser, filterCategory, dateRange]);

  const dateFilterStart = useMemo(() => {
    if (dateRange === 'all') return null;
    const d = new Date();
    if (dateRange === '7d') d.setDate(d.getDate() - 7);
    if (dateRange === '30d') d.setDate(d.getDate() - 30);
    if (dateRange === '90d') d.setDate(d.getDate() - 90);
    return d.toISOString();
  }, [dateRange]);

  // Query persistent table
  const { data: queryResult, isLoading, refetch } = useQuery({
    queryKey: ['analyzer-config-changes', selectedFirewall, searchUser, filterCategory, dateRange, page],
    queryFn: async () => {
      if (!selectedFirewall) return { rows: [] as ConfigChangeRow[], total: 0 };

      let query = supabase
        .from('analyzer_config_changes' as any)
        .select('id, user_name, action, cfgpath, cfgobj, cfgattr, msg, category, severity, changed_at', { count: 'exact' })
        .eq('firewall_id', selectedFirewall)
        .order('changed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dateFilterStart) {
        query = query.gte('changed_at', dateFilterStart);
      }
      if (searchUser) {
        query = query.ilike('user_name', `%${searchUser}%`);
      }
      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      const { data, count, error } = await query as any;
      if (error) throw error;
      return { rows: (data ?? []) as ConfigChangeRow[], total: (count ?? 0) as number };
    },
    enabled: !!selectedFirewall,
    staleTime: 1000 * 30,
  });

  const rows = queryResult?.rows ?? [];
  const totalCount = queryResult?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Get unique categories for filter
  const { data: categories = ['all'] } = useQuery({
    queryKey: ['analyzer-config-categories', selectedFirewall],
    queryFn: async () => {
      if (!selectedFirewall) return ['all'];
      const { data } = await supabase
        .from('analyzer_config_changes' as any)
        .select('category')
        .eq('firewall_id', selectedFirewall) as any;
      const cats = new Set<string>((data ?? []).map((d: any) => d.category).filter(Boolean));
      return ['all', ...Array.from(cats).sort()];
    },
    enabled: !!selectedFirewall,
    staleTime: 1000 * 60 * 5,
  });

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
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">
              {totalCount} alteração(ões) encontrada(s)
              {totalPages > 1 && <span className="text-muted-foreground font-normal ml-2">— Página {page + 1} de {totalPages}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
            ) : rows.length === 0 ? (
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
                    {rows.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {d.changed_at ? new Date(d.changed_at).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="font-medium">{d.user_name}</TableCell>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Próxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
