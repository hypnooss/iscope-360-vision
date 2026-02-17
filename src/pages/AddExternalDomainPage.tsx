import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Globe } from 'lucide-react';

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

export default function AddExternalDomainPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [domainError, setDomainError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: '',
    agent_id: '',
    domain: '',
    schedule: 'manual' as ScheduleFrequency,
  });

  // Fetch clients
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('clients').select('id, name').order('name');
      setClients(data || []);
    };
    fetch();
  }, []);

  // Fetch agents when client changes
  useEffect(() => {
    if (!formData.client_id) {
      setAgents([]);
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from('agents')
        .select('id, name, client_id')
        .eq('client_id', formData.client_id)
        .eq('revoked', false)
        .order('name');
      setAgents(data || []);
    };
    fetch();
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
        const { error: scheduleError } = await supabase
          .from('external_domain_schedules')
          .insert({
            domain_id: inserted.id,
            frequency: formData.schedule,
            is_active: true,
            created_by: user.id,
          });

        if (scheduleError) {
          toast.error('Domínio criado, mas falhou ao salvar frequência', { description: scheduleError.message });
        }
      }

      toast.success('Domínio adicionado com sucesso!');
      navigate('/scope-external-domain/domains');
    } catch (error: any) {
      toast.error('Erro inesperado', { description: error?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 flex flex-col flex-1 min-h-0">
        <PageBreadcrumb
          items={[
            { label: 'Ambiente', href: '/environment' },
            { label: 'Novo Item', href: '/environment/new' },
            { label: 'Domínio Externo' },
          ]}
        />

        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-400" />
                Adicionar Domínio Externo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {/* Workspace */}
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
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Agent */}
              <div className="space-y-2">
                <Label>Agent *</Label>
                <Select
                  value={formData.agent_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, agent_id: v }))}
                  disabled={!formData.client_id}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={formData.client_id ? 'Selecione o agent' : 'Selecione um workspace primeiro'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.client_id && agents.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum agent disponível para este workspace</p>
                )}
              </div>

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

              {/* Frequência */}
              <div className="space-y-2">
                <Label>Frequência de Análise</Label>
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

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => navigate('/environment/new')}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
                  {saving ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
