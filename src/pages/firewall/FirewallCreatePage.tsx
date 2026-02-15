import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Loader2, Settings, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { getDeviceUrlError } from '@/lib/urlValidation';
import { resolveGeoFromUrl } from '@/lib/geolocation';

interface Client {
  id: string;
  name: string;
}

interface DeviceType {
  id: string;
  name: string;
  vendor: string;
  code: string;
}

interface Agent {
  id: string;
  name: string;
  client_id: string;
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

const SESSION_AUTH_DEVICE_CODES = ['sonicwall_tz', 'sonicwall_nsa', 'sonicwall'];

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

export default function FirewallCreatePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();

  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fortigate_url: '',
    api_key: '',
    auth_username: '',
    auth_password: '',
    client_id: '',
    device_type_id: '',
    agent_id: '',
    schedule: 'manual' as ScheduleFrequency,
    scheduled_hour: 2,
    scheduled_day_of_week: 1,
    scheduled_day_of_month: 1,
    geo_latitude: '',
    geo_longitude: '',
  });

  const selectedDeviceType = useMemo(() => {
    return deviceTypes.find(dt => dt.id === formData.device_type_id);
  }, [deviceTypes, formData.device_type_id]);

  const usesSessionAuth = useMemo(() => {
    return selectedDeviceType && SESSION_AUTH_DEVICE_CODES.some(code =>
      selectedDeviceType.code.toLowerCase().includes(code.toLowerCase())
    );
  }, [selectedDeviceType]);

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
    if (user) fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (formData.client_id) {
      fetchAgents(formData.client_id);
    } else {
      setAgents([]);
    }
  }, [formData.client_id]);

  const fetchInitialData = async () => {
    try {
      const [clientsRes, deviceTypesRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('device_types').select('id, name, vendor, code').eq('is_active', true).eq('category', 'firewall').order('vendor'),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (deviceTypesRes.data) setDeviceTypes(deviceTypesRes.data);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async (clientId: string) => {
    const { data } = await supabase
      .from('agents')
      .select('id, name, client_id')
      .eq('client_id', clientId)
      .eq('revoked', false)
      .order('name');
    if (data) setAgents(data);
  };

  const handleSubmit = async () => {
    const hasApiKey = formData.api_key?.trim();
    const hasSessionAuth = formData.auth_username?.trim() && formData.auth_password?.trim();

    if (!formData.name.trim() || !formData.fortigate_url.trim() || !formData.client_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!hasApiKey && !hasSessionAuth) {
      toast.error('Preencha as credenciais de autenticação');
      return;
    }

    if (urlError) {
      toast.error('Corrija o erro na URL antes de salvar');
      return;
    }

    setSaving(true);
    try {
      // 1. Insert firewall
      const { data: firewall, error: fwError } = await supabase
        .from('firewalls')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          fortigate_url: formData.fortigate_url.trim(),
          api_key: '',
          auth_username: null,
          auth_password: null,
          client_id: formData.client_id,
          device_type_id: formData.device_type_id || null,
          agent_id: formData.agent_id || null,
          created_by: user?.id,
          geo_latitude: formData.geo_latitude ? parseFloat(formData.geo_latitude) : null,
          geo_longitude: formData.geo_longitude ? parseFloat(formData.geo_longitude) : null,
        } as any)
        .select()
        .single();

      if (fwError) throw fwError;

      // 2. Encrypt credentials
      const { error: credError } = await supabase.functions.invoke('manage-firewall-credentials', {
        body: {
          operation: 'save',
          firewall_id: firewall.id,
          api_key: usesSessionAuth ? '' : (formData.api_key?.trim() || ''),
          auth_username: usesSessionAuth ? formData.auth_username?.trim() || null : null,
          auth_password: usesSessionAuth ? formData.auth_password?.trim() || null : null,
        },
      });

      if (credError) {
        console.error('Failed to encrypt credentials:', credError);
        toast.warning('Firewall criado, mas erro ao criptografar credenciais. Edite o firewall para salvar novamente.');
      }

      // 3. Create schedule if not manual
      if (formData.schedule !== 'manual') {
        const nextRunAt = calculateNextRunAt(
          formData.schedule,
          formData.scheduled_hour,
          formData.scheduled_day_of_week,
          formData.scheduled_day_of_month
        );

        await supabase.from('analysis_schedules').insert({
          firewall_id: firewall.id,
          frequency: formData.schedule,
          is_active: true,
          created_by: user?.id,
          scheduled_hour: formData.scheduled_hour,
          scheduled_day_of_week: formData.scheduled_day_of_week,
          scheduled_day_of_month: formData.scheduled_day_of_month,
          next_run_at: nextRunAt,
        } as any);
      }

      toast.success('Firewall adicionado com sucesso!');
      navigate('/scope-firewall/firewalls');
    } catch (error: any) {
      toast.error('Erro ao adicionar firewall: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getUrlLabel = () => {
    if (selectedDeviceType?.vendor?.toLowerCase().includes('sonicwall')) return 'URL do SonicWall';
    return 'URL do FortiGate';
  };

  const getUrlPlaceholder = () => {
    if (selectedDeviceType?.vendor?.toLowerCase().includes('sonicwall')) return 'https://192.168.1.1:4444';
    return 'https://192.168.1.1:8443';
  };

  const canEdit = hasPermission('firewall', 'edit');

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
          { label: 'Firewall', href: '/scope-firewall/dashboard' },
          { label: 'Firewalls', href: '/scope-firewall/firewalls' },
          { label: 'Novo' },
        ]} />

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/scope-firewall/firewalls')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Firewall</h1>
            <p className="text-muted-foreground">Adicione um novo dispositivo e configure o agendamento</p>
          </div>
        </div>

        {/* Device Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5" />
              Informações do Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Workspace *</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v, agent_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Dispositivo *</Label>
                <Select value={formData.device_type_id} onValueChange={(v) => setFormData({ ...formData, device_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {deviceTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.vendor} - {dt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agent *</Label>
                <Select value={formData.agent_id} onValueChange={(v) => setFormData({ ...formData, agent_id: v })} disabled={!formData.client_id}>
                  <SelectTrigger><SelectValue placeholder={formData.client_id ? "Selecione o agent" : "Selecione um workspace primeiro"} /></SelectTrigger>
                  <SelectContent>
                    {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nome do Firewall *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: FW-HQ-01" />
              </div>
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label>{getUrlLabel()} *</Label>
              <Input
                value={formData.fortigate_url}
                onChange={(e) => {
                  setFormData({ ...formData, fortigate_url: e.target.value });
                  setUrlError(getDeviceUrlError(e.target.value));
                }}
                placeholder={getUrlPlaceholder()}
                className={urlError ? 'border-destructive' : ''}
              />
              {urlError && <p className="text-sm text-destructive">{urlError}</p>}
            </div>

            {/* Geolocation */}
            <div className="space-y-2">
              <Label>Localização (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="any"
                  value={formData.geo_latitude}
                  onChange={(e) => setFormData({ ...formData, geo_latitude: e.target.value })}
                  placeholder="Latitude"
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="any"
                  value={formData.geo_longitude}
                  onChange={(e) => setFormData({ ...formData, geo_longitude: e.target.value })}
                  placeholder="Longitude"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!formData.fortigate_url) { toast.error('Preencha a URL primeiro'); return; }
                    setGeoLoading(true);
                    try {
                      const geo = await resolveGeoFromUrl(formData.fortigate_url);
                      if (geo) {
                        setFormData(prev => ({ ...prev, geo_latitude: String(geo.lat), geo_longitude: String(geo.lng) }));
                        toast.success('Localização encontrada');
                      } else {
                        toast.error('Não foi possível determinar a localização');
                      }
                    } catch { toast.error('Erro ao buscar localização'); }
                    finally { setGeoLoading(false); }
                  }}
                  disabled={geoLoading || !formData.fortigate_url}
                  className="gap-1"
                >
                  {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Buscar
                </Button>
              </div>
              {formData.geo_latitude && formData.geo_longitude && (
                <p className="text-xs text-muted-foreground">📍 {formData.geo_latitude}, {formData.geo_longitude}</p>
              )}
            </div>

            {/* Auth */}
            {usesSessionAuth ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuário *</Label>
                  <Input value={formData.auth_username} onChange={(e) => setFormData({ ...formData, auth_username: e.target.value })} placeholder="admin" />
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <PasswordInput value={formData.auth_password} onChange={(e) => setFormData({ ...formData, auth_password: e.target.value })} placeholder="Senha do dispositivo" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>API Key *</Label>
                <PasswordInput value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} placeholder="Token da REST API" />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição opcional" />
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
          <Button variant="outline" onClick={() => navigate('/scope-firewall/firewalls')}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !!urlError || !formData.fortigate_url || !canEdit}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
