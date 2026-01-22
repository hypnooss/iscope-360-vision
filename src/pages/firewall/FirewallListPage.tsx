import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Server, Play, Trash2, Eye, EyeOff, Loader2, Building, Edit, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FirewallStatsCards } from '@/components/firewall/FirewallStatsCards';
import { AddFirewallDialog } from '@/components/firewall/AddFirewallDialog';
import { EditFirewallDialog } from '@/components/firewall/EditFirewallDialog';

interface Client {
  id: string;
  name: string;
  description: string | null;
}

interface Firewall {
  id: string;
  name: string;
  description: string | null;
  fortigate_url: string;
  api_key: string;
  serial_number: string | null;
  last_analysis_at: string | null;
  last_score: number | null;
  client_id: string;
  clients?: { name: string } | null;
  analysis_schedules?: { frequency: string; is_active: boolean }[] | { frequency: string; is_active: boolean } | null;
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

export default function FirewallListPage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [firewalls, setFirewalls] = useState<Firewall[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFirewall, setEditingFirewall] = useState<Firewall | null>(null);
  const [deletingFirewall, setDeletingFirewall] = useState<Firewall | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const [newClient, setNewClient] = useState({
    name: '',
    description: '',
  });

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
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (clientsData) setClients(clientsData);

      const { data: firewallsData } = await supabase
        .from('firewalls')
        .select('*')
        .order('created_at', { ascending: false });

      if (!firewallsData || firewallsData.length === 0) {
        setFirewalls([]);
        setLoading(false);
        return;
      }

      const firewallIds = firewallsData.map(f => f.id);
      const { data: schedulesData } = await supabase
        .from('analysis_schedules')
        .select('firewall_id, frequency, is_active')
        .in('firewall_id', firewallIds);

      const clientMap = new Map((clientsData || []).map(c => [c.id, c]));
      const scheduleMap = new Map<string, { frequency: string; is_active: boolean }[]>();
      
      for (const schedule of (schedulesData || [])) {
        const existing = scheduleMap.get(schedule.firewall_id) || [];
        existing.push({ frequency: schedule.frequency, is_active: schedule.is_active });
        scheduleMap.set(schedule.firewall_id, existing);
      }

      const combined = firewallsData.map(fw => ({
        ...fw,
        clients: clientMap.get(fw.client_id) ? { name: clientMap.get(fw.client_id)!.name } : null,
        analysis_schedules: scheduleMap.get(fw.id) || null,
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
    client_id: string;
    schedule: ScheduleFrequency;
  }) => {
    if (!formData.name.trim() || !formData.fortigate_url.trim() || !formData.api_key.trim() || !formData.client_id) {
      toast.error('Preencha todos os campos obrigatórios');
      throw new Error('Campos obrigatórios não preenchidos');
    }

    const { data: firewall, error: fwError } = await supabase
      .from('firewalls')
      .insert({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        fortigate_url: formData.fortigate_url.trim(),
        api_key: formData.api_key.trim(),
        client_id: formData.client_id,
        created_by: user?.id,
      })
      .select()
      .single();

    if (fwError) {
      toast.error('Erro ao adicionar firewall: ' + fwError.message);
      throw fwError;
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
    setAnalyzing(firewall.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('fortigate-compliance', {
        body: { url: firewall.fortigate_url, apiKey: firewall.api_key },
      });

      if (error) {
        toast.error('Erro ao conectar com o servidor', {
          description: 'Não foi possível executar a análise. Verifique sua conexão e tente novamente.',
          duration: 8000,
        });
        return;
      }
      
      if (data.error) {
        toast.error(data.message || 'Erro na análise', {
          description: data.suggestion || data.details || 'Verifique a configuração do firewall.',
          duration: 10000,
        });
        console.error('Firewall analysis error:', {
          code: data.code,
          message: data.message,
          details: data.details,
          suggestion: data.suggestion,
        });
        return;
      }

      const score = data.overallScore ?? data.score ?? 0;
      
      await supabase.from('analysis_history').insert({
        firewall_id: firewall.id,
        score: score,
        report_data: data,
        analyzed_by: user?.id,
      });

      await supabase.from('firewalls').update({
        last_analysis_at: new Date().toISOString(),
        last_score: score,
        serial_number: data.serialNumber || firewall.serial_number,
      }).eq('id', firewall.id);

      await fetchData();
      toast.success(`Análise concluída! Score: ${score}%`);

      navigate(`/scope-firewall/firewalls/${firewall.id}/analysis`, { state: { report: data } });
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('failed')) {
        toast.error('Erro de conexão', {
          description: 'Não foi possível conectar ao servidor. Verifique sua conexão de internet.',
          duration: 8000,
        });
      } else if (errorMessage.includes('timeout')) {
        toast.error('Tempo limite excedido', {
          description: 'O servidor demorou muito para responder. Tente novamente.',
          duration: 8000,
        });
      } else {
        toast.error('Erro inesperado', {
          description: error.message || 'Ocorreu um erro durante a análise. Tente novamente.',
          duration: 8000,
        });
      }
      console.error('Firewall analysis exception:', error);
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

  const openEditDialog = (fw: Firewall) => {
    setEditingFirewall(fw);
    setShowEditDialog(true);
  };

  const handleEditFirewall = async (formData: {
    name: string;
    description: string;
    fortigate_url: string;
    api_key: string;
    client_id: string;
    schedule: ScheduleFrequency;
  }) => {
    if (!editingFirewall) return;

    if (!formData.name.trim() || !formData.fortigate_url.trim() || !formData.api_key.trim() || !formData.client_id) {
      toast.error('Preencha todos os campos obrigatórios');
      throw new Error('Campos obrigatórios não preenchidos');
    }

    const { error } = await supabase
      .from('firewalls')
      .update({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        fortigate_url: formData.fortigate_url.trim(),
        api_key: formData.api_key.trim(),
        client_id: formData.client_id,
      })
      .eq('id', editingFirewall.id);

    if (error) {
      toast.error('Erro ao atualizar firewall: ' + error.message);
      throw error;
    }

    await supabase
      .from('analysis_schedules')
      .delete()
      .eq('firewall_id', editingFirewall.id);

    if (formData.schedule !== 'manual') {
      await supabase
        .from('analysis_schedules')
        .insert({
          firewall_id: editingFirewall.id,
          frequency: formData.schedule,
          is_active: true,
          created_by: user?.id,
        });
    }

    await fetchData();
    setEditingFirewall(null);
    toast.success('Firewall atualizado com sucesso!');
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

  const canEdit = hasPermission('firewall', 'edit');

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Firewalls</h1>
            <p className="text-muted-foreground">Gerencie seus dispositivos FortiGate</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <AddFirewallDialog 
                clients={clients} 
                onFirewallAdded={handleAddFirewall} 
              />
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <FirewallStatsCards />

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
                    <TableHead>Cliente</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Último Score</TableHead>
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
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {fw.fortigate_url}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {fw.serial_number || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {schedule ? getScheduleLabel(schedule.frequency) : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {fw.last_score !== null ? (
                            <Badge className={getScoreColor(fw.last_score)}>
                              {fw.last_score}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowApiKey({ ...showApiKey, [fw.id]: !showApiKey[fw.id] })}
                              title={showApiKey[fw.id] ? 'Ocultar API Key' : 'Mostrar API Key'}
                            >
                              {showApiKey[fw.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            {canEdit && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(fw)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => setDeletingFirewall(fw)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          {showApiKey[fw.id] && (
                            <p className="text-xs font-mono mt-1 text-muted-foreground">
                              {fw.api_key.slice(0, 8)}...
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Firewall Dialog */}
        <EditFirewallDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          firewall={editingFirewall}
          clients={clients}
          onSave={handleEditFirewall}
        />

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
