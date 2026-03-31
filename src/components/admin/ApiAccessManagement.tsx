import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ApiKeyGenerateDialog } from './ApiKeyGenerateDialog';
import { ApiAccessLogsTable } from './ApiAccessLogsTable';
import { Loader2, Plus, RefreshCw, Ban, Trash2, Copy, ChevronDown, Terminal, Globe, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ApiKey {
  id: string;
  client_id: string;
  client_name: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface ApiJob {
  id: string;
  job_type: string;
  status: string;
  steps: any[];
  current_step: string | null;
  domain_id: string | null;
  metadata: any;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const SCOPE_LABELS: Record<string, string> = {
  'external_domain:read': 'Leitura',
  'external_domain:write': 'Cadastro',
  'external_domain:report': 'Relatório',
  'external_domain:analyze': 'Análise',
  'external_domain:pipeline': 'Pipeline',
  'external_domain:subdomains': 'Subdomínios',
  'external_domain:certificates': 'Certificados',
};

const STEP_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
};

const JOB_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  queued: 'outline',
  running: 'default',
  completed: 'default',
  failed: 'destructive',
  partial: 'secondary',
};

export function ApiAccessManagement() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-access-keys', { method: 'GET' });
      if (error) throw error;
      setKeys(data?.keys || []);
    } catch (err) {
      console.error('Error loading keys:', err);
      toast.error('Erro ao carregar chaves');
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    setJobsLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_jobs')
        .select('id, job_type, status, steps, current_step, domain_id, metadata, error_message, created_at, started_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setJobs((data as any[]) || []);
    } catch (err) {
      console.error('Error loading jobs:', err);
      toast.error('Erro ao carregar jobs');
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    if (jobsOpen) loadJobs();
  }, [jobsOpen]);

  const handleRevoke = async (id: string) => {
    setActionLoading(id);
    try {
      const { data, error } = await supabase.functions.invoke('api-access-keys?action=revoke', {
        method: 'POST',
        body: { id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Chave revogada');
      await loadKeys();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao revogar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
      const { data, error } = await supabase.functions.invoke('api-access-keys?action=delete', {
        method: 'DELETE',
        body: { id: deleteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Chave excluída');
      setDeleteId(null);
      await loadKeys();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    } finally {
      setActionLoading(null);
    }
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const gatewayBase = `${supabaseUrl}/functions/v1/api-gateway`;

  return (
    <div className="space-y-6">
      {/* Keys Management */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Chaves de Acesso à API
              </CardTitle>
              <CardDescription className="mt-2">
                Gerencie chaves de acesso para que projetos externos consumam dados do iSCOPE via API.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button size="sm" onClick={() => setGenerateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Chave
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">Nenhuma chave de API criada</p>
              <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar primeira chave
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Prefixo</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Escopos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Uso</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-xs">{key.key_prefix}...</TableCell>
                      <TableCell className="text-sm">{key.client_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">
                              {SCOPE_LABELS[s] || s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {key.is_active ? (
                          key.expires_at && new Date(key.expires_at) < new Date() ? (
                            <Badge variant="destructive" className="text-xs">Expirada</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600 text-xs">Ativa</Badge>
                          )
                        ) : (
                          <Badge variant="secondary" className="text-xs">Revogada</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {key.last_used_at ? format(new Date(key.last_used_at), 'dd/MM/yy HH:mm') : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(key.created_at), 'dd/MM/yy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {key.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRevoke(key.id)}
                              disabled={actionLoading === key.id}
                              title="Revogar"
                            >
                              {actionLoading === key.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Ban className="w-4 h-4 text-warning" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(key.id)}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs / Pipeline */}
      <Collapsible open={jobsOpen} onOpenChange={setJobsOpen}>
        <Card className="border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GitBranch className="w-5 h-5" />
                    Jobs / Pipeline
                  </CardTitle>
                  <CardDescription>Pipelines de análise criados via API</CardDescription>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${jobsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {jobsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Nenhum job registrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={loadJobs} disabled={jobsLoading}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${jobsLoading ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domínio</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Steps</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead>Duração</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-mono text-xs">
                              {job.metadata?.domain || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {job.job_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={JOB_STATUS_VARIANT[job.status] || 'outline'} className="text-xs">
                                {job.status === 'queued' && 'Na fila'}
                                {job.status === 'running' && 'Executando'}
                                {job.status === 'completed' && 'Concluído'}
                                {job.status === 'failed' && 'Falhou'}
                                {job.status === 'partial' && 'Parcial'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(job.steps || []).map((step: any, i: number) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className={`text-xs ${STEP_STATUS_COLORS[step.status] || ''}`}
                                  >
                                    {step.name}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(job.created_at), 'dd/MM/yy HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {job.completed_at && job.started_at
                                ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
                                : job.started_at
                                  ? 'Em andamento...'
                                  : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* API Documentation */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="w-5 h-5" />
            Documentação Rápida
          </CardTitle>
          <CardDescription>Exemplos de uso da API iSCOPE</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Base URL</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 block overflow-x-auto">
                {gatewayBase}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { navigator.clipboard.writeText(gatewayBase); toast.success('URL copiada'); }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                title: 'Listar domínios',
                scope: 'external_domain:read',
                curl: `curl -H "X-API-Key: isk_SUA_CHAVE" \\\n  ${gatewayBase}/v1/domains`,
              },
              {
                title: 'Cadastrar domínio',
                scope: 'external_domain:write',
                curl: `curl -X POST -H "X-API-Key: isk_SUA_CHAVE" \\\n  -H "Content-Type: application/json" \\\n  -d '{"domain": "example.com"}' \\\n  ${gatewayBase}/v1/domains`,
              },
              {
                title: 'Obter relatório',
                scope: 'external_domain:report',
                curl: `curl -H "X-API-Key: isk_SUA_CHAVE" \\\n  ${gatewayBase}/v1/domains/{domain_id}/report`,
              },
              {
                title: 'Disparar análise',
                scope: 'external_domain:analyze',
                curl: `curl -X POST -H "X-API-Key: isk_SUA_CHAVE" \\\n  ${gatewayBase}/v1/domains/{domain_id}/analyze`,
              },
              {
                title: 'Criar pipeline completo',
                scope: 'external_domain:pipeline',
                curl: `curl -X POST -H "X-API-Key: isk_SUA_CHAVE" \\\n  -H "Content-Type: application/json" \\\n  -d '{"domain":"example.com","steps":["register","compliance","analyzer","email_report"],"email_to":"x@y.com"}' \\\n  ${gatewayBase}/v1/pipeline`,
              },
              {
                title: 'Consultar status do job',
                scope: 'external_domain:pipeline',
                curl: `curl -H "X-API-Key: isk_SUA_CHAVE" \\\n  ${gatewayBase}/v1/jobs/{job_id}`,
              },
            ].map((example) => (
              <div key={example.title} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{example.title}</p>
                  <Badge variant="outline" className="text-xs">{example.scope}</Badge>
                </div>
                <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {example.curl}
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Access Logs */}
      <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
        <Card className="border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Logs de Acesso</CardTitle>
                  <CardDescription>Últimas 100 chamadas à API</CardDescription>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${logsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ApiAccessLogsTable keys={keys.map((k) => ({ id: k.id, name: k.name, key_prefix: k.key_prefix }))} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Dialogs */}
      <ApiKeyGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={loadKeys}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chave permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as integrações usando esta chave deixarão de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
