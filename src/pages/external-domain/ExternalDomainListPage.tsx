import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';

import {
  AddExternalDomainDialog,
  type AddExternalDomainPayload,
  type ScheduleFrequency,
} from '@/components/external-domain/AddExternalDomainDialog';
import { ExternalDomainStatsCards } from '@/components/external-domain/ExternalDomainStatsCards';
import { ExternalDomainTable, type ExternalDomainRow } from '@/components/external-domain/ExternalDomainTable';
import { EditExternalDomainDialog } from '@/components/external-domain/EditExternalDomainDialog';
import { DeleteExternalDomainDialog } from '@/components/external-domain/DeleteExternalDomainDialog';

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
}

export default function ExternalDomainListPage() {
  const { user, loading: authLoading, hasPermission, isSuperAdmin, role } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const navigate = useNavigate();
  const [domains, setDomains] = useState<ExternalDomainRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDomain, setEditingDomain] = useState<ExternalDomainRow | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<ExternalDomainRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      fetchData();
    }
  }, [user, hasModuleAccess, isPreviewMode, previewTarget]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get workspace IDs to filter by (for preview mode)
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      // Build queries with optional workspace filtering
      let clientsQuery = supabase.from('clients').select('id, name').order('name');
      let domainsQuery = supabase.from('external_domains').select('*').order('created_at', { ascending: false });
      let agentsQuery = supabase.from('agents').select('id, name').eq('revoked', false);
      
      // Filter by workspaces in preview mode
      if (workspaceIds && workspaceIds.length > 0) {
        clientsQuery = clientsQuery.in('id', workspaceIds);
        domainsQuery = domainsQuery.in('client_id', workspaceIds);
        agentsQuery = agentsQuery.in('client_id', workspaceIds);
      }

      // Busca principal em paralelo
      const [clientsRes, domainsRes, agentsRes] = await Promise.all([
        clientsQuery,
        domainsQuery,
        agentsQuery,
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (domainsRes.error) throw domainsRes.error;
      if (agentsRes.error) throw agentsRes.error;

      setClients(clientsRes.data || []);

      if (!domainsRes.data || domainsRes.data.length === 0) {
        setDomains([]);
        return;
      }

      const domainIds = domainsRes.data.map((d) => d.id);
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('external_domain_schedules')
        .select('domain_id, frequency, is_active')
        .in('domain_id', domainIds);

      if (schedulesError) throw schedulesError;

      const clientMap = new Map((clientsRes.data || []).map((c) => [c.id, c]));
      const agentMap = new Map((agentsRes.data || []).map((a: Agent) => [a.id, a]));
      const scheduleMap = new Map<string, { frequency: ScheduleFrequency; is_active: boolean }[]>();

      for (const schedule of schedulesData || []) {
        const existing = scheduleMap.get(schedule.domain_id) || [];
        existing.push({
          frequency: schedule.frequency as ScheduleFrequency,
          is_active: schedule.is_active,
        });
        scheduleMap.set(schedule.domain_id, existing);
      }

      const combined: ExternalDomainRow[] = (domainsRes.data || []).map((d) => {
        const schedules = scheduleMap.get(d.id) || [];
        const activeSchedule = schedules.find((s) => s.is_active) || schedules[0];

        return {
          id: d.id,
          name: d.name,
          domain: d.domain,
          description: d.description,
          status: d.status,
          last_scan_at: d.last_scan_at,
          last_score: d.last_score,
          client_id: d.client_id,
          agent_id: d.agent_id,
          client_name: clientMap.get(d.client_id)?.name,
          agent_name: d.agent_id ? agentMap.get(d.agent_id)?.name || null : null,
          schedule_frequency: activeSchedule?.frequency || 'manual',
          created_at: d.created_at,
        };
      });

      setDomains(combined);
    } catch (error: any) {
      console.error('Error fetching external domains:', error);
      toast.error('Erro ao carregar domínios', { description: error?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (payload: AddExternalDomainPayload) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      throw new Error('Usuário não autenticado');
    }

    if (!payload.client_id || !payload.agent_id || !payload.domain.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      throw new Error('Campos obrigatórios não preenchidos');
    }

    const name = payload.domain.trim();

    const { data: inserted, error: insertError } = await supabase
      .from('external_domains')
      .insert({
        client_id: payload.client_id,
        agent_id: payload.agent_id || null,
        domain: payload.domain.trim(),
        name,
        description: null,
        created_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      toast.error('Erro ao adicionar domínio: ' + insertError.message);
      throw insertError;
    }

    if (payload.schedule !== 'manual') {
      const { error: scheduleError } = await supabase
        .from('external_domain_schedules')
        .insert({
          domain_id: inserted.id,
          frequency: payload.schedule,
          is_active: true,
          created_by: user.id,
        });

      if (scheduleError) {
        toast.error('Domínio criado, mas falhou ao salvar frequência', { description: scheduleError.message });
        throw scheduleError;
      }
    }

    await fetchData();
    toast.success('Domínio adicionado com sucesso!');
  };

  const handleAnalyze = async (domain: ExternalDomainRow) => {
    if (!domain.agent_id) {
      toast.error('Agent não configurado', {
        description: 'Configure um agent para este domínio antes de executar a análise.',
        duration: 8000,
      });
      return;
    }

    setAnalyzing(domain.id);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-external-domain-analysis', {
        body: { domain_id: domain.id },
      });

      if (error) {
        console.error('Trigger external domain analysis error:', error);
        toast.error('Erro ao agendar análise', {
          description: 'Não foi possível criar a tarefa de análise. Tente novamente.',
          duration: 8000,
        });
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao agendar análise', {
          description: data?.message || 'Verifique a configuração do domínio.',
          duration: 10000,
        });
        return;
      }

      toast.success('Análise agendada!', {
        description: 'O agent irá processar em breve. Acompanhe o status na página.',
        duration: 5000,
      });
    } catch (e: any) {
      console.error('Trigger external domain analysis exception:', e);
      toast.error('Erro inesperado', {
        description: e?.message || 'Ocorreu um erro ao agendar a análise.',
        duration: 8000,
      });
    } finally {
      setAnalyzing(null);
    }
  };

  const openEditDialog = (domain: ExternalDomainRow) => {
    setEditingDomain(domain);
    setShowEditDialog(true);
  };

  const handleEditDomain = async (payload: { client_id?: string; agent_id: string; schedule: ScheduleFrequency }) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }
    if (!editingDomain) return;
    if (!payload.agent_id) {
      toast.error('Selecione um agent');
      return;
    }

    // Build update data - include client_id if it was changed
    const updateData: { agent_id: string; client_id?: string } = { 
      agent_id: payload.agent_id 
    };
    
    if (payload.client_id && payload.client_id !== editingDomain.client_id) {
      updateData.client_id = payload.client_id;
    }

    const { error: updateError } = await supabase
      .from('external_domains')
      .update(updateData)
      .eq('id', editingDomain.id);

    if (updateError) {
      toast.error('Erro ao atualizar domínio', { description: updateError.message });
      return;
    }

    const { error: deleteSchedulesError } = await supabase
      .from('external_domain_schedules')
      .delete()
      .eq('domain_id', editingDomain.id);

    if (deleteSchedulesError) {
      toast.error('Erro ao atualizar frequência', { description: deleteSchedulesError.message });
      return;
    }

    if (payload.schedule !== 'manual') {
      const { error: insertScheduleError } = await supabase
        .from('external_domain_schedules')
        .insert({
          domain_id: editingDomain.id,
          frequency: payload.schedule,
          is_active: true,
          created_by: user.id,
        });

      if (insertScheduleError) {
        toast.error('Erro ao salvar frequência', { description: insertScheduleError.message });
        return;
      }
    }

    await fetchData();
    setEditingDomain(null);
    toast.success('Domínio atualizado com sucesso!');
  };

  const handleDeleteDomain = async (domain: ExternalDomainRow) => {
    setDeleting(true);
    try {
      const { error: deleteTasksError } = await supabase
        .from('agent_tasks')
        .delete()
        .eq('target_type', 'external_domain')
        .eq('target_id', domain.id)
        .in('status', ['pending', 'running']);

      if (deleteTasksError) throw deleteTasksError;

      const { error: deleteDomainError } = await supabase
        .from('external_domains')
        .delete()
        .eq('id', domain.id);

      if (deleteDomainError) throw deleteDomainError;

      await fetchData();
      setDeletingDomain(null);
      toast.success('Domínio excluído com sucesso!');
    } catch (error: any) {
      console.error('Error deleting external domain:', error);
      toast.error('Erro ao excluir domínio', { description: error?.message });
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = hasPermission('external_domain', 'edit');

  const stats = useMemo(() => {
    const totalDomains = domains.length;
    const domainsWithScore = domains.filter((d) => d.last_score !== null);
    const averageScore =
      domainsWithScore.length > 0
        ? Math.round(domainsWithScore.reduce((sum, d) => sum + (d.last_score || 0), 0) / domainsWithScore.length)
        : 0;
    const criticalAlerts = domains.filter((d) => d.last_score !== null && d.last_score < 50).length;
    const criticalFailures = domains.filter((d) => d.last_score !== null && d.last_score < 30).length;
    return { totalDomains, averageScore, criticalAlerts, criticalFailures };
  }, [domains]);

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
              <AddExternalDomainDialog clients={clients} onDomainAdded={handleAddDomain} />
            </div>
          )}
        </div>

        <ExternalDomainStatsCards
          totalDomains={stats.totalDomains}
          averageScore={stats.averageScore}
          criticalAlerts={stats.criticalAlerts}
          criticalFailures={stats.criticalFailures}
        />

        <ExternalDomainTable
          domains={domains}
          loading={loading}
          canEdit={canEdit}
          analyzingId={analyzing}
          onAnalyze={handleAnalyze}
          onEdit={openEditDialog}
          onDelete={(d) => setDeletingDomain(d)}
        />

        <EditExternalDomainDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingDomain(null);
          }}
          domain={editingDomain}
          clients={clients}
          isSuperAdmin={isSuperAdmin() || role === 'super_suporte'}
          onSave={handleEditDomain}
        />

        <DeleteExternalDomainDialog
          open={!!deletingDomain}
          onOpenChange={(open) => {
            if (!open) setDeletingDomain(null);
          }}
          domain={deletingDomain}
          onConfirm={handleDeleteDomain}
          loading={deleting}
        />
      </div>
    </AppLayout>
  );
}
