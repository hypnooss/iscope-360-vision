import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  Monitor, Search, Building2, Globe, Shield, Cloud, ExternalLink,
  Server, TrendingUp, AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

type AssetType = 'firewall' | 'external_domain' | 'm365_tenant';

interface UnifiedAsset {
  id: string;
  name: string;
  type: AssetType;
  workspaceId: string;
  workspaceName: string;
  score: number | null;
  status: string;
}

const TYPE_CONFIG: Record<AssetType, { label: string; color: string; icon: typeof Shield }> = {
  firewall: { label: 'Firewall', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: Shield },
  external_domain: { label: 'Domínio Externo', color: 'bg-teal-500/15 text-teal-400 border-teal-500/30', icon: Globe },
  m365_tenant: { label: 'Tenant M365', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Cloud },
};

const getScoreColor = (score: number | null) => {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 75) return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
  if (score >= 50) return 'bg-warning/20 text-warning border-warning/30';
  return 'bg-destructive/20 text-destructive border-destructive/30';
};

const getNavigationUrl = (asset: UnifiedAsset) => {
  switch (asset.type) {
    case 'firewall': return `/scope-firewall/firewalls/${asset.id}/edit`;
    case 'external_domain': return `/scope-external-domain/domains/${asset.id}/edit`;
    case 'm365_tenant': return `/scope-m365/tenant-connection`;
  }
};

export default function EnvironmentPage() {
  const { user, loading: authLoading } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Fetch workspaces
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

  useEffect(() => {
    if (isSuperRole && allWorkspaces?.length && !selectedWorkspaceId) {
      setSelectedWorkspaceId(allWorkspaces[0].id);
    }
  }, [isSuperRole, allWorkspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Determine workspace filter
  const workspaceFilter = useMemo(() => {
    if (isPreviewMode && previewTarget?.workspaces) {
      return previewTarget.workspaces.map((w) => w.id);
    }
    if (isSuperRole && selectedWorkspaceId) {
      return [selectedWorkspaceId];
    }
    return null;
  }, [isPreviewMode, previewTarget, isSuperRole, selectedWorkspaceId]);

  // Fetch all assets
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['environment-assets', workspaceFilter],
    queryFn: async () => {
      // Build queries
      let fwQuery = supabase.from('firewalls').select('id, name, client_id, last_score');
      let edQuery = supabase.from('external_domains').select('id, name, domain, client_id, last_score, status');
      let m365Query = supabase.from('m365_tenants').select('id, display_name, tenant_domain, client_id, connection_status');
      let clientsQuery = supabase.from('clients').select('id, name');

      if (workspaceFilter && workspaceFilter.length > 0) {
        fwQuery = fwQuery.in('client_id', workspaceFilter);
        edQuery = edQuery.in('client_id', workspaceFilter);
        m365Query = m365Query.in('client_id', workspaceFilter);
        clientsQuery = clientsQuery.in('id', workspaceFilter);
      }

      const [fwRes, edRes, m365Res, clientsRes] = await Promise.all([fwQuery, edQuery, m365Query, clientsQuery]);

      if (fwRes.error) throw fwRes.error;
      if (edRes.error) throw edRes.error;
      if (m365Res.error) throw m365Res.error;
      if (clientsRes.error) throw clientsRes.error;

      const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]));

      const unified: UnifiedAsset[] = [
        ...(fwRes.data || []).map(fw => ({
          id: fw.id,
          name: fw.name,
          type: 'firewall' as AssetType,
          workspaceId: fw.client_id,
          workspaceName: clientMap.get(fw.client_id) || '—',
          score: fw.last_score,
          status: fw.last_score !== null ? 'analyzed' : 'pending',
        })),
        ...(edRes.data || []).map(ed => ({
          id: ed.id,
          name: ed.name || ed.domain,
          type: 'external_domain' as AssetType,
          workspaceId: ed.client_id,
          workspaceName: clientMap.get(ed.client_id) || '—',
          score: ed.last_score,
          status: ed.status,
        })),
        ...(m365Res.data || []).map(t => ({
          id: t.id,
          name: t.display_name || t.tenant_domain || t.id,
          type: 'm365_tenant' as AssetType,
          workspaceId: t.client_id,
          workspaceName: clientMap.get(t.client_id) || '—',
          score: null,
          status: t.connection_status,
        })),
      ];

      return unified;
    },
    enabled: !!user && (isSuperRole ? !!selectedWorkspaceId || isPreviewMode : true),
    staleTime: 1000 * 30,
  });

  // Stats
  const stats = useMemo(() => {
    const firewalls = assets.filter(a => a.type === 'firewall').length;
    const domains = assets.filter(a => a.type === 'external_domain').length;
    const tenants = assets.filter(a => a.type === 'm365_tenant').length;
    return { total: assets.length, firewalls, domains, tenants };
  }, [assets]);

  // Filtered
  const filtered = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      TYPE_CONFIG[a.type].label.toLowerCase().includes(q) ||
      a.workspaceName.toLowerCase().includes(q)
    );
  }, [assets, search]);

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Ambiente' }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerenciamento do Ambiente</h1>
            <p className="text-muted-foreground">Gerencie todos os sistemas monitorados</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperRole && !isPreviewMode && allWorkspaces && allWorkspaces.length > 0 && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[220px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Monitor className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.firewalls}</p>
                  <p className="text-xs text-muted-foreground">Firewalls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Globe className="w-8 h-8 text-teal-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.domains}</p>
                  <p className="text-xs text-muted-foreground">Domínios Externos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Cloud className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.tenants}</p>
                  <p className="text-xs text-muted-foreground">Tenants M365</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ativo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum ativo encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(asset => {
                    const config = TYPE_CONFIG[asset.type];
                    return (
                      <TableRow key={`${asset.type}-${asset.id}`}>
                        <TableCell className="font-medium text-foreground">{asset.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.color}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{asset.workspaceName}</TableCell>
                        <TableCell>
                          {asset.score !== null ? (
                            <Badge variant="outline" className={getScoreColor(asset.score)}>
                              {asset.score}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(getNavigationUrl(asset))}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Abrir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
