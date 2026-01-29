import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Placeholder interface - será ajustada quando a tabela for criada no banco
interface ExternalDomain {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  status: 'active' | 'inactive' | 'pending';
  last_scan_at: string | null;
  last_score: number | null;
  client_id: string;
  client_name?: string;
  created_at: string;
}

export default function ExternalDomainListPage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [domains, setDomains] = useState<ExternalDomain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    if (!authLoading && user && !hasModuleAccess('scope_external_domain')) {
      navigate('/modules');
    }
  }, [user, authLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    if (user && hasModuleAccess('scope_external_domain')) {
      // TODO: Buscar dados reais quando a tabela for criada
      setLoading(false);
    }
  }, [user, hasModuleAccess]);

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted text-muted-foreground';
    if (score >= 90) return 'bg-success/10 text-success';
    if (score >= 75) return 'bg-success/10 text-success';
    if (score >= 60) return 'bg-warning/10 text-warning';
    return 'bg-destructive/10 text-destructive';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success">Ativo</Badge>;
      case 'inactive':
        return <Badge className="bg-muted text-muted-foreground">Inativo</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canEdit = hasPermission('external_domain', 'edit');

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
          { label: 'Domínios' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Domínios Externos</h1>
            <p className="text-muted-foreground">Gerencie e monitore seus domínios externos</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Domínio
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards - Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Total de Domínios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <Globe className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Domínios Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Globe className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <Globe className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-sm text-muted-foreground">Com Problemas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Domains Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Lista de Domínios
            </CardTitle>
            <CardDescription>{domains.length} domínio(s) cadastrado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : domains.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum domínio cadastrado</p>
                <p className="text-sm mt-2">Adicione um domínio para começar o monitoramento</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Última Verificação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{domain.name}</p>
                          <p className="text-xs text-muted-foreground">{domain.domain}</p>
                        </div>
                      </TableCell>
                      <TableCell>{domain.client_name || 'N/A'}</TableCell>
                      <TableCell>{getStatusBadge(domain.status)}</TableCell>
                      <TableCell>
                        {domain.last_score !== null ? (
                          <Badge className={getScoreColor(domain.last_score)}>
                            {domain.last_score}%
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">-</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {domain.last_scan_at
                          ? new Date(domain.last_scan_at).toLocaleDateString('pt-BR')
                          : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <>
                              <Button variant="ghost" size="icon" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Excluir">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
