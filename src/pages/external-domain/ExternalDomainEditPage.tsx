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
      const [clientsRes, domainRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('external_domains').select('*').eq('id', id!).single(),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);

      if (domainRes.error || !domainRes.data) {
        toast.error('Domínio não encontrado');
        navigate('/environment');
        return;
      }

      const d = domainRes.data;

      setFormData({
        domain: d.domain,
        client_id: d.client_id,
        agent_id: d.agent_id || '',
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
