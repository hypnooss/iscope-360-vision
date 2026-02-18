import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, Loader2, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  client_id: string;
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: `${i.toString().padStart(2, '0')}:00`,
}));

const DAYS_OF_WEEK = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
];

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => ({
  value: (i + 1).toString(),
  label: (i + 1).toString(),
}));

function calculateNextRunAt(
  frequency: ScheduleFrequency,
  hour: number,
  dayOfWeek: number,
  dayOfMonth: number
): string | null {
  if (frequency === 'manual') return null;

  const now = new Date();
  let next: Date;

  if (frequency === 'daily') {
    next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    const currentDay = now.getDay();
    let daysAhead = dayOfWeek - currentDay;
    if (daysAhead < 0) daysAhead += 7;
    next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead, hour, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 7);
  } else {
    next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hour, 0, 0);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString();
}

export default function ExternalDomainEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, hasPermission, isSuperAdmin, role } = useAuth();
  const { hasModuleAccess } = useModules();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [formData, setFormData] = useState({
    domain: '',
    client_id: '',
    agent_id: '',
    schedule: 'manual' as ScheduleFrequency,
    scheduled_hour: 2,
    scheduled_day_of_week: 1,
    scheduled_day_of_month: 1,
  });

  const isSuperAdminUser = isSuperAdmin() || role === 'super_suporte';

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
    if (user && id) {
      fetchAllData();
    }
  }, [user, id]);

  useEffect(() => {
    if (formData.client_id) {
      fetchAgents(formData.client_id);
    }
  }, [formData.client_id]);

  const fetchAgents = async (clientId: string) => {
    const { data } = await supabase
      .from('agents')
      .select('id, name, client_id')
      .eq('client_id', clientId)
      .eq('revoked', false)
      .order('name');
    if (data) setAgents(data);
  };

  const fetchAllData = async () => {
    try {
      const [clientsRes, domainRes, scheduleRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('external_domains').select('*').eq('id', id!).single(),
        supabase.from('external_domain_schedules').select('*').eq('domain_id', id!).maybeSingle(),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);

      if (domainRes.error || !domainRes.data) {
        toast.error('Domínio não encontrado');
        navigate('/environment');
        return;
      }

      const d = domainRes.data;
      const schedule = scheduleRes.data;

      setFormData({
        domain: d.domain,
        client_id: d.client_id,
        agent_id: d.agent_id || '',
        schedule: (schedule?.frequency as ScheduleFrequency) || 'manual',
        scheduled_hour: (schedule as any)?.scheduled_hour ?? 2,
        scheduled_day_of_week: (schedule as any)?.scheduled_day_of_week ?? 1,
        scheduled_day_of_month: (schedule as any)?.scheduled_day_of_month ?? 1,
      });

      if (d.client_id) {
        await fetchAgents(d.client_id);
      }
    } catch (error) {
      console.error('Error fetching domain data:', error);
      toast.error('Erro ao carregar dados do domínio');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.client_id) {
      toast.error('Selecione um workspace');
      return;
    }

    setSaving(true);
    try {
      const updateData: { agent_id: string | null; client_id?: string } = {
        agent_id: formData.agent_id || null,
      };

      if (isSuperAdminUser) {
        updateData.client_id = formData.client_id;
      }

      const { error } = await supabase
        .from('external_domains')
        .update(updateData)
        .eq('id', id!);

      if (error) throw error;

      // Delete existing schedules
      await supabase.from('external_domain_schedules').delete().eq('domain_id', id!);

      // Create new schedule if not manual
      if (formData.schedule !== 'manual') {
        const nextRunAt = calculateNextRunAt(
          formData.schedule,
          formData.scheduled_hour,
          formData.scheduled_day_of_week,
          formData.scheduled_day_of_month
        );

        await supabase.from('external_domain_schedules').insert({
          domain_id: id!,
          frequency: formData.schedule,
          is_active: true,
          created_by: user?.id,
          scheduled_hour: formData.scheduled_hour,
          scheduled_day_of_week: formData.scheduled_day_of_week,
          scheduled_day_of_month: formData.scheduled_day_of_month,
          next_run_at: nextRunAt,
        } as any);
      }

      toast.success('Domínio atualizado com sucesso!');
      navigate('/environment');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const currentWorkspaceName = useMemo(() => {
    return clients.find(c => c.id === formData.client_id)?.name || 'N/A';
  }, [clients, formData.client_id]);

  const canEdit = hasPermission('external_domain', 'edit');

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Ambiente', href: '/environment' },
          { label: 'Domínios Externos' },
          { label: 'Editar' },
        ]} />

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/environment')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Editar Domínio Externo</h1>
            <p className="text-muted-foreground">Atualize as informações e agendamento do domínio</p>
          </div>
        </div>

        {/* Domain Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5" />
              Informações do Domínio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Workspace</Label>
                {isSuperAdminUser ? (
                  <Select
                    value={formData.client_id}
                    onValueChange={(v) => setFormData({ ...formData, client_id: v, agent_id: '' })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione um workspace" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={currentWorkspaceName} disabled />
                )}
              </div>

              <div className="space-y-2">
                <Label>Domínio</Label>
                <Input value={formData.domain} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Agent</Label>
              <Select
                value={formData.agent_id}
                onValueChange={(v) => setFormData({ ...formData, agent_id: v })}
                disabled={!formData.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.client_id ? 'Selecione o agent' : 'Selecione um workspace primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {formData.client_id && agents.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum agent disponível para este workspace</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              Agendamento de Análise
            </CardTitle>
            <CardDescription>Configure a frequência e horário da análise automática</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select value={formData.schedule} onValueChange={(v) => setFormData({ ...formData, schedule: v as ScheduleFrequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.schedule !== 'manual' && (
              <>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Select value={formData.scheduled_hour.toString()} onValueChange={(v) => setFormData({ ...formData, scheduled_hour: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.schedule === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Dia da Semana</Label>
                      <Select value={formData.scheduled_day_of_week.toString()} onValueChange={(v) => setFormData({ ...formData, scheduled_day_of_week: parseInt(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.schedule === 'monthly' && (
                    <div className="space-y-2">
                      <Label>Dia do Mês</Label>
                      <Select value={formData.scheduled_day_of_month.toString()} onValueChange={(v) => setFormData({ ...formData, scheduled_day_of_month: parseInt(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_MONTH.map(d => <SelectItem key={d.value} value={d.value}>Dia {d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {formData.schedule === 'daily' && `A análise será executada todos os dias às ${formData.scheduled_hour.toString().padStart(2, '0')}:00 (UTC).`}
                  {formData.schedule === 'weekly' && `A análise será executada toda ${DAYS_OF_WEEK.find(d => d.value === formData.scheduled_day_of_week.toString())?.label} às ${formData.scheduled_hour.toString().padStart(2, '0')}:00 (UTC).`}
                  {formData.schedule === 'monthly' && `A análise será executada todo dia ${formData.scheduled_day_of_month} do mês às ${formData.scheduled_hour.toString().padStart(2, '0')}:00 (UTC).`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/environment')}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !canEdit}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
