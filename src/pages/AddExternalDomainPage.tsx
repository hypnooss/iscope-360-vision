import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Clock, Globe } from 'lucide-react';

import { getExternalDomainError } from '@/lib/urlValidation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  client_id: string | null;
}

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

function normalizeExternalDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).host;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

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

export default function AddExternalDomainPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, role } = useAuth();

  const isSuperUser = isSuperAdmin() || role === 'super_suporte';

  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [domainError, setDomainError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: '',
    agent_id: '',
    domain: '',
    schedule: 'manual' as ScheduleFrequency,
    scheduled_hour: 2,
    scheduled_day_of_week: 1,
    scheduled_day_of_month: 1,
  });

  // For non-super users, auto-select their client
  useEffect(() => {
    const fetchClients = async () => {
      if (isSuperUser) {
        const { data } = await supabase.from('clients').select('id, name').order('name');
        setClients(data || []);
      } else if (user?.id) {
        // Get user's client(s)
        const { data: userClients } = await supabase
          .from('user_clients')
          .select('client_id, clients(id, name)')
          .eq('user_id', user.id);
        
        if (userClients && userClients.length > 0) {
          const mapped = userClients
            .filter((uc: any) => uc.clients)
            .map((uc: any) => ({ id: uc.clients.id, name: uc.clients.name }));
          setClients(mapped);
          if (mapped.length === 1) {
            setFormData(prev => ({ ...prev, client_id: mapped[0].id }));
          }
        }
      }
    };
    fetchClients();
  }, [isSuperUser, user?.id]);

  // Fetch agents when client changes
  useEffect(() => {
    if (!formData.client_id) {
      setAgents([]);
      return;
    }
    const fetchAgents = async () => {
      const { data } = await supabase
        .from('agents')
        .select('id, name, client_id')
        .eq('client_id', formData.client_id)
        .eq('revoked', false)
        .order('name');
      setAgents(data || []);
    };
    fetchAgents();
  }, [formData.client_id]);

  const canSubmit = useMemo(() => {
    return !!formData.client_id && !!formData.agent_id && !!formData.domain.trim() && !domainError;
  }, [formData.client_id, formData.agent_id, formData.domain, domainError]);

  const handleSubmit = async () => {
    const normalizedDomain = normalizeExternalDomain(formData.domain);
    const validationError = getExternalDomainError(formData.domain);
    setDomainError(validationError);

    if (validationError) {
      toast.error('Domínio inválido', { description: validationError });
      return;
    }

    if (!user?.id || !formData.client_id || !formData.agent_id || !normalizedDomain) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('external_domains')
        .insert({
          client_id: formData.client_id,
          agent_id: formData.agent_id || null,
          domain: normalizedDomain,
          name: normalizedDomain,
          description: null,
          created_by: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        toast.error('Erro ao adicionar domínio: ' + insertError.message);
        return;
      }

      if (formData.schedule !== 'manual') {
        const nextRunAt = calculateNextRunAt(
          formData.schedule,
          formData.scheduled_hour,
          formData.scheduled_day_of_week,
          formData.scheduled_day_of_month
        );

        const { error: scheduleError } = await supabase
          .from('external_domain_schedules')
          .insert({
            domain_id: inserted.id,
            frequency: formData.schedule,
            is_active: true,
            created_by: user.id,
            scheduled_hour: formData.scheduled_hour,
            scheduled_day_of_week: formData.scheduled_day_of_week,
            scheduled_day_of_month: formData.scheduled_day_of_month,
            next_run_at: nextRunAt,
          } as any);

        if (scheduleError) {
          toast.error('Domínio criado, mas falhou ao salvar frequência', { description: scheduleError.message });
        }
      }

      toast.success('Domínio adicionado com sucesso!');
      navigate('/environment');
    } catch (error: any) {
      toast.error('Erro inesperado', { description: error?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Ambiente', href: '/environment' },
            { label: 'Novo Item', href: '/environment/new' },
            { label: 'Domínio Externo' },
          ]}
        />

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/environment/new')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Adicionar Domínio Externo</h1>
            <p className="text-sm text-muted-foreground">Preencha as informações do novo domínio</p>
          </div>
        </div>

        {/* Card: Informações do Domínio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-teal-400" />
              Informações do Domínio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Workspace */}
              {isSuperUser ? (
                <div className="space-y-2">
                  <Label>Workspace *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, client_id: v, agent_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Workspace</Label>
                  <Input value={clients.length === 1 ? clients[0].name : 'Carregando...'} disabled />
                </div>
              )}

              {/* Domínio */}
              <div className="space-y-2">
                <Label>Domínio Externo *</Label>
                <Input
                  value={formData.domain}
                  onChange={(e) => {
                    const next = e.target.value;
                    setFormData((prev) => ({ ...prev, domain: next }));
                    setDomainError(getExternalDomainError(next));
                  }}
                  placeholder="example.com ou https://example.com"
                  className={domainError ? 'border-destructive' : ''}
                />
                {domainError && <p className="text-sm text-destructive">{domainError}</p>}
              </div>
            </div>

            {/* Agent */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Agent *</Label>
              <Select
                value={formData.agent_id}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, agent_id: v }))}
                disabled={!formData.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.client_id ? 'Selecione o agent' : 'Selecione um workspace primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.client_id && agents.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum agent disponível para este workspace</p>
              )}
            </div>
            </div>

            {/* Aviso legal */}
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <AlertTitle className="text-amber-400">Aviso de Propriedade</AlertTitle>
              <AlertDescription className="text-amber-300/80 text-xs">
                Ao adicionar um domínio, você declara ser o proprietário ou ter autorização explícita para realizar
                varreduras e análises neste domínio. Varreduras em domínios sem autorização podem violar leis e
                regulamentos.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Card: Agendamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-teal-400" />
              Agendamento de Análise
            </CardTitle>
            <p className="text-sm text-muted-foreground">Configure a frequência de execução das análises</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={formData.schedule}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, schedule: v as ScheduleFrequency }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>

            {formData.schedule !== 'manual' && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Select
                      value={formData.scheduled_hour.toString()}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, scheduled_hour: parseInt(v) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.schedule === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Dia da Semana</Label>
                      <Select
                        value={formData.scheduled_day_of_week.toString()}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, scheduled_day_of_week: parseInt(v) }))}
                      >
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
                      <Select
                        value={formData.scheduled_day_of_month.toString()}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, scheduled_day_of_month: parseInt(v) }))}
                      >
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

        {/* Botões */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/environment/new')}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
