import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Server, Play, Trash2, Loader2, Building, Pencil, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FirewallStatsCards } from '@/components/firewall/FirewallStatsCards';
import { AddFirewallDialog } from '@/components/firewall/AddFirewallDialog';


interface Client {
  id: string;
  name: string;
  description: string | null;
}

interface DeviceType {
  id: string;
  name: string;
  vendor: string;
}

interface Agent {
  id: string;
  name: string;
  client_id: string | null;
}

  interface ScheduleInfo {
    frequency: string;
    is_active: boolean;
    scheduled_hour?: number | null;
    scheduled_day_of_week?: number | null;
    scheduled_day_of_month?: number | null;
  }

  interface Firewall {
  id: string;
  name: string;
  description: string | null;
  fortigate_url: string;
  api_key: string;
  auth_username: string | null;
  auth_password: string | null;
  serial_number: string | null;
  last_analysis_at: string | null;
  last_score: number | null;
  client_id: string;
  agent_id: string | null;
  device_type_id: string | null;
  clients?: { name: string } | null;
  analysis_schedules?: ScheduleInfo[] | ScheduleInfo | null;
  pending_task?: boolean;
  device_type?: DeviceType | null;
  agent?: Agent | null;
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

export default function FirewallListPage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const [firewalls, setFirewalls] = useState<Firewall[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [deletingFirewall, setDeletingFirewall] = useState<Firewall | null>(null);
  
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const [newClient, setNewClient] = useState({
    name: '',
    description: '',
  });

  // Workspace selector for super roles
  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  // Fetch workspaces for super roles (Analyzer pattern)
  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  // Auto-select first workspace
  useEffect(() => {
    if (isSuperRole && allWorkspaces?.length && !selectedWorkspaceId) {
      setSelectedWorkspaceId(allWorkspaces[0].id);
    }
  }, [isSuperRole, allWorkspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) {
      navigate('/modules');
    }
  }, [user, authLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    if (user && hasModuleAccess('scope_firewall')) {
      fetchData();
    }
  }, [user, isPreviewMode, previewTarget, selectedWorkspaceId]);

  const fetchData = async () => {
    try {
      // Get workspace IDs to filter by (use preview workspaces if in preview mode)
      let workspaceIds: string[] | null = null;
      if (isPreviewMode && previewTarget?.workspaces) {
        workspaceIds = previewTarget.workspaces.map(w => w.id);
      } else if (isSuperRole && selectedWorkspaceId) {
        workspaceIds = [selectedWorkspaceId];
      }

      // Build queries with optional workspace filtering
      let clientsQuery = supabase.from('clients').select('*').order('name');
      let firewallsQuery = supabase.from('firewalls').select('*').order('created_at', { ascending: false });
      let agentsQuery = supabase.from('agents').select('id, name, client_id').eq('revoked', false);

      // Apply workspace filter
      if (workspaceIds && workspaceIds.length > 0) {
        clientsQuery = clientsQuery.in('id', workspaceIds);
        firewallsQuery = firewallsQuery.in('client_id', workspaceIds);
        agentsQuery = agentsQuery.in('client_id', workspaceIds);
      }

      // Fetch all data in parallel
      const [clientsRes, firewallsRes, deviceTypesRes, agentsRes] = await Promise.all([
        clientsQuery,
        firewallsQuery,
        supabase.from('device_types').select('id, name, vendor').eq('is_active', true),
        agentsQuery,
      ]);
      
      if (clientsRes.data) setClients(clientsRes.data);
      if (deviceTypesRes.data) setDeviceTypes(deviceTypesRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);

      if (!firewallsRes.data || firewallsRes.data.length === 0) {
        setFirewalls([]);
        setLoading(false);
        return;
      }

      const firewallIds = firewallsRes.data.map(f => f.id);
      const { data: schedulesData } = await supabase
        .from('analysis_schedules')
        .select('firewall_id, frequency, is_active, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month')
        .in('firewall_id', firewallIds);

      const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c]));
      const deviceTypeMap = new Map((deviceTypesRes.data || []).map(d => [d.id, d]));
      const agentMap = new Map((agentsRes.data || []).map(a => [a.id, a]));
      const scheduleMap = new Map<string, ScheduleInfo[]>();
      
      for (const schedule of (schedulesData || [])) {
        const existing = scheduleMap.get(schedule.firewall_id) || [];
        existing.push({
          frequency: schedule.frequency,
          is_active: schedule.is_active,
          scheduled_hour: (schedule as any).scheduled_hour,
          scheduled_day_of_week: (schedule as any).scheduled_day_of_week,
          scheduled_day_of_month: (schedule as any).scheduled_day_of_month,
        });
        scheduleMap.set(schedule.firewall_id, existing);
      }

      const combined = firewallsRes.data.map(fw => ({
        ...fw,
        clients: clientMap.get(fw.client_id) ? { name: clientMap.get(fw.client_id)!.name } : null,
        analysis_schedules: scheduleMap.get(fw.id) || null,
        device_type: fw.device_type_id ? deviceTypeMap.get(fw.device_type_id) || null : null,
        agent: fw.agent_id ? agentMap.get(fw.agent_id) || null : null,
      }));

      setFirewalls(combined as unknown as Firewall[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: newClient.name.trim(),
          description: newClient.description.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setClients([...clients, data]);
      setNewClient({ name: '', description: '' });
      setShowClientDialog(false);
      toast.success('Cliente adicionado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao adicionar cliente: ' + error.message);
    }
  };

  const handleAddFirewall = async (formData: {
    name: string;
    description: string;
    fortigate_url: string;
    api_key: string;
    auth_username?: string;
    auth_password?: string;
    client_id: string;
    schedule: ScheduleFrequency;
    device_type_id: string;
    agent_id: string;
  }) => {
    // Validate required fields - either api_key or (auth_username + auth_password)
    const hasApiKey = formData.api_key?.trim();
    const hasSessionAuth = formData.auth_username?.trim() && formData.auth_password?.trim();
    
    if (!formData.name.trim() || !formData.fortigate_url.trim() || !formData.client_id) {
      toast.error('Preencha todos os campos obrigatórios');
      throw new Error('Campos obrigatórios não preenchidos');
    }

    if (!hasApiKey && !hasSessionAuth) {
      toast.error('Preencha as credenciais de autenticação');
      throw new Error('Credenciais não preenchidas');
    }

    const { data: firewall, error: fwError } = await supabase
      .from('firewalls')
      .insert({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        fortigate_url: formData.fortigate_url.trim(),
        api_key: '', // placeholder, will be encrypted below
        auth_username: null,
        auth_password: null,
        client_id: formData.client_id,
        device_type_id: formData.device_type_id || null,
        agent_id: formData.agent_id || null,
        created_by: user?.id,
      })
      .select()
      .single();

    if (fwError) {
      toast.error('Erro ao adicionar firewall: ' + fwError.message);
      throw fwError;
    }

    // Encrypt credentials via edge function
    const { error: credError } = await supabase.functions.invoke('manage-firewall-credentials', {
      body: {
        operation: 'save',
        firewall_id: firewall.id,
        api_key: formData.api_key?.trim() || '',
        auth_username: formData.auth_username?.trim() || null,
        auth_password: formData.auth_password?.trim() || null,
      },
    });

    if (credError) {
      console.error('Failed to encrypt credentials:', credError);
      // Firewall was created but credentials failed - warn user
      toast.warning('Firewall criado, mas erro ao criptografar credenciais. Edite o firewall para salvar novamente.');
    }

    if (formData.schedule !== 'manual') {
      await supabase
        .from('analysis_schedules')
        .insert({
          firewall_id: firewall.id,
          frequency: formData.schedule,
          is_active: true,
          created_by: user?.id,
        });
    }

    await fetchData();
    toast.success('Firewall adicionado com sucesso!');
  };

  const handleAnalyze = async (firewall: Firewall) => {
    // Check if firewall has agent configured
    if (!firewall.agent_id) {
      toast.error('Agent não configurado', {
        description: 'Configure um agent para este firewall antes de executar a análise.',
        duration: 8000,
      });
      return;
    }

    if (!firewall.device_type_id) {
      toast.error('Tipo de dispositivo não configurado', {
        description: 'Configure o tipo de dispositivo para este firewall.',
        duration: 8000,
      });
      return;
    }

    setAnalyzing(firewall.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('trigger-firewall-analysis', {
        body: { firewall_id: firewall.id },
      });

      if (error) {
        toast.error('Erro ao agendar análise', {
          description: 'Não foi possível criar a tarefa de análise. Tente novamente.',
          duration: 8000,
        });
        console.error('Trigger analysis error:', error);
        return;
      }
      
      if (!data.success) {
        toast.error(data.error || 'Erro ao agendar análise', {
          description: data.message || 'Verifique a configuração do firewall.',
          duration: 10000,
        });
        return;
      }

      // Update local state to show pending
      setFirewalls(prev => prev.map(fw => 
        fw.id === firewall.id ? { ...fw, pending_task: true } : fw
      ));

      toast.success('Análise agendada!', {
        description: 'O agent irá processar a análise em breve. Acompanhe o status na página.',
        duration: 5000,
      });

    } catch (error: any) {
      toast.error('Erro inesperado', {
        description: error.message || 'Ocorreu um erro ao agendar a análise.',
        duration: 8000,
      });
      console.error('Trigger analysis exception:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = async (fw: Firewall) => {
    try {
      const { error } = await supabase.from('firewalls').delete().eq('id', fw.id);
      if (error) throw error;

      setFirewalls(firewalls.filter(f => f.id !== fw.id));
      setDeletingFirewall(null);
      toast.success('Firewall excluído com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const openEditPage = (fw: Firewall) => {
    navigate(`/scope-firewall/firewalls/${fw.id}/edit`);
  };


  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted text-muted-foreground';
    if (score >= 90) return 'bg-success/10 text-success';
    if (score >= 75) return 'bg-success/10 text-success';
    if (score >= 60) return 'bg-warning/10 text-warning';
    return 'bg-destructive/10 text-destructive';
  };

  const getScheduleLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Diário';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensal';
      default: return 'Manual';
    }
  };

  const getDayOfWeekLabel = (day: number) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[day] || '—';
  };

  const getScheduleDetailBadges = (schedule: ScheduleInfo | null | undefined) => {
    if (!schedule || schedule.frequency === 'manual') return null;
    const hour = schedule.scheduled_hour ?? null;
    const badges: React.ReactNode[] = [];

    if (schedule.frequency === 'weekly' && schedule.scheduled_day_of_week != null) {
      badges.push(
        <Badge key="dow" variant="outline">
          {getDayOfWeekLabel(schedule.scheduled_day_of_week)}
        </Badge>
      );
    }

    if (schedule.frequency === 'monthly' && schedule.scheduled_day_of_month != null) {
      badges.push(
        <Badge key="dom" variant="outline">
          Dia {schedule.scheduled_day_of_month}
        </Badge>
      );
    }

    if (hour != null) {
      badges.push(
        <Badge key="hour" variant="outline">
          {hour.toString().padStart(2, '0')}:00
        </Badge>
      );
    }

    return badges.length > 0 ? badges : null;
  };

  const canEdit = hasPermission('firewall', 'edit');

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Firewall', href: '/scope-firewall/dashboard' },
          { label: 'Firewalls' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Firewalls</h1>
            <p className="text-muted-foreground">Gerencie e monitore seus firewalls</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperRole && !isPreviewMode && allWorkspaces && allWorkspaces.length > 0 && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[220px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canEdit && (
              <AddFirewallDialog 
                clients={clients} 
                onFirewallAdded={handleAddFirewall} 
              />
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <FirewallStatsCards 
          workspaceIds={
            isPreviewMode && previewTarget?.workspaces 
              ? previewTarget.workspaces.map(w => w.id)
              : isSuperRole && selectedWorkspaceId
                ? [selectedWorkspaceId]
                : undefined
          } 
        />

        {/* Firewalls Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Lista de Firewalls
            </CardTitle>
            <CardDescription>{firewalls.length} firewall(s) cadastrado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : firewalls.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum firewall cadastrado</p>
                {canEdit && clients.length === 0 && (
                  <p className="text-sm mt-2">Adicione um cliente primeiro</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firewall</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firewalls.map((fw) => {
                    const schedule = Array.isArray(fw.analysis_schedules)
                      ? fw.analysis_schedules[0]
                      : fw.analysis_schedules;
                    
                    return (
                      <TableRow key={fw.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{fw.name}</p>
                            {fw.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {fw.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{fw.clients?.name || 'N/A'}</TableCell>
                        <TableCell>
                          {fw.device_type ? (
                            <Badge variant="secondary">
                              {fw.device_type.vendor}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {fw.agent ? (
                            <Badge variant="outline">
                              {fw.agent.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline">
                              {schedule ? getScheduleLabel(schedule.frequency) : 'Manual'}
                            </Badge>
                            {getScheduleDetailBadges(schedule as ScheduleInfo)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAnalyze(fw)}
                              disabled={analyzing === fw.id}
                              title="Analisar"
                            >
                              {analyzing === fw.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditPage(fw)}
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingFirewall(fw)}
                                  title="Excluir"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>


        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingFirewall} onOpenChange={() => setDeletingFirewall(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o firewall{' '}
                <strong>{deletingFirewall?.name}</strong>?
                Esta ação não pode ser desfeita e todo o histórico de análises será perdido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deletingFirewall && handleDelete(deletingFirewall)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
