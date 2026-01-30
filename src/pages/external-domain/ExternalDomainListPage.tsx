import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
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

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
}

export default function ExternalDomainListPage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [domains, setDomains] = useState<ExternalDomainRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

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
  }, [user, hasModuleAccess]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Busca principal em paralelo
      const [clientsRes, domainsRes, agentsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('external_domains').select('*').order('created_at', { ascending: false }),
        supabase.from('agents').select('id, name').eq('revoked', false),
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

  const canEdit = hasPermission('external_domain', 'edit');

  const stats = useMemo(() => {
    const total = domains.length;
    const active = domains.filter((d) => d.status === 'active').length;
    const pending = domains.filter((d) => d.status === 'pending').length;
    const issues = domains.filter((d) => d.last_score !== null && d.last_score < 60).length;
    return { total, active, pending, issues };
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
          total={stats.total}
          active={stats.active}
          pending={stats.pending}
          issues={stats.issues}
        />

        <ExternalDomainTable
          domains={domains}
          loading={loading}
          canEdit={canEdit}
          analyzingId={analyzing}
          onAnalyze={handleAnalyze}
        />
      </div>
    </AppLayout>
  );
}
