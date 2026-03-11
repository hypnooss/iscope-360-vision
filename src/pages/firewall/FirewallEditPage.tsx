import { useEffect, useState, useMemo } from 'react';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowLeft, Save, Loader2, Settings, Clock, MapPin, Globe, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { getDeviceUrlError } from '@/lib/urlValidation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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

const SESSION_AUTH_DEVICE_CODES = ['sonicwall_tz', 'sonicwall_nsa', 'sonicwall'];

interface WanCandidate {
  ip: string;
  interface: string;
  lat: number;
  lng: number;
  country: string;
  country_code: string;
  region: string;
  city: string;
}

export default function FirewallEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [wanCandidates, setWanCandidates] = useState<WanCandidate[]>([]);
  const [showWanDialog, setShowWanDialog] = useState(false);

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
    geo_latitude: '',
    geo_longitude: '',
    cloud_public_ip: '',
  });

  const [showCloudIP, setShowCloudIP] = useState(false);

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
    if (user && id) {
      fetchAllData();
    }
  }, [user, id]);

  // Fetch agents when client changes
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
      const [clientsRes, deviceTypesRes, firewallRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('device_types').select('id, name, vendor, code').eq('is_active', true).eq('category', 'firewall').order('vendor'),
        supabase.from('firewalls').select('*').eq('id', id!).single(),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (deviceTypesRes.data) setDeviceTypes(deviceTypesRes.data);

      if (firewallRes.error || !firewallRes.data) {
        toast.error('Firewall não encontrado');
        navigate('/environment');
        return;
      }

      const fw = firewallRes.data;

      // Load decrypted credentials via edge function
      let decryptedCreds = { api_key: '', auth_username: '', auth_password: '' };
      try {
        const { data: credData, error: credError } = await supabase.functions.invoke('manage-firewall-credentials', {
          body: { operation: 'read', firewall_id: id },
        });
        if (!credError && credData?.credentials) {
          decryptedCreds = credData.credentials;
        }
      } catch (credErr) {
        console.error('Failed to decrypt credentials, using raw values:', credErr);
        decryptedCreds = {
          api_key: fw.api_key || '',
          auth_username: fw.auth_username || '',
          auth_password: fw.auth_password || '',
        };
      }

      setFormData({
        name: fw.name,
        description: fw.description || '',
        fortigate_url: fw.fortigate_url,
        api_key: decryptedCreds.api_key,
        auth_username: decryptedCreds.auth_username,
        auth_password: decryptedCreds.auth_password,
        client_id: fw.client_id,
        device_type_id: fw.device_type_id || '',
        agent_id: fw.agent_id || '',
        geo_latitude: (fw as any).geo_latitude ? String((fw as any).geo_latitude) : '',
        geo_longitude: (fw as any).geo_longitude ? String((fw as any).geo_longitude) : '',
        cloud_public_ip: (fw as any).cloud_public_ip || '',
      });
      if ((fw as any).cloud_public_ip) setShowCloudIP(true);
      setUrlError(getDeviceUrlError(fw.fortigate_url));

      // Fetch agents for this client
      if (fw.client_id) {
        await fetchAgents(fw.client_id);
      }
    } catch (error) {
      console.error('Error fetching firewall data:', error);
      toast.error('Erro ao carregar dados do firewall');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
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

    setSaving(true);
    try {
      // Update firewall (non-sensitive fields only, credentials set to placeholder)
      const { error } = await supabase
        .from('firewalls')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          fortigate_url: formData.fortigate_url.trim(),
          client_id: formData.client_id,
          device_type_id: formData.device_type_id || null,
          agent_id: formData.agent_id || null,
          geo_latitude: formData.geo_latitude ? parseFloat(formData.geo_latitude) : null,
          geo_longitude: formData.geo_longitude ? parseFloat(formData.geo_longitude) : null,
          cloud_public_ip: formData.cloud_public_ip?.trim() || null,
        } as any)
        .eq('id', id!);

      if (error) throw error;

      // Save encrypted credentials via edge function
      const { error: credError } = await supabase.functions.invoke('manage-firewall-credentials', {
        body: {
          operation: 'save',
          firewall_id: id,
          api_key: usesSessionAuth ? '' : (formData.api_key?.trim() || ''),
          auth_username: usesSessionAuth ? formData.auth_username?.trim() || null : null,
          auth_password: usesSessionAuth ? formData.auth_password?.trim() || null : null,
        },
      });

      if (credError) {
        console.error('Failed to encrypt credentials:', credError);
        toast.error('Erro ao criptografar credenciais');
        return;
      }

      toast.success('Firewall atualizado com sucesso!');
      navigate('/environment');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
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
    <>
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Ambiente', href: '/environment' },
          { label: 'Editar Firewall' },
        ]} />

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/environment')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Editar Firewall</h1>
            <p className="text-muted-foreground">Atualize as informações e agendamento do dispositivo</p>
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
            {/* Workspace */}
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
              {/* Cloud Public IP toggle */}
              {!showCloudIP && (
                <button
                  type="button"
                  onClick={() => setShowCloudIP(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                >
                  <Cloud className="w-3 h-3" />
                  Firewall em Cloud?
                </button>
              )}
              {showCloudIP && (
                <div className="space-y-1.5 mt-2 p-3 rounded-lg border border-border bg-muted/20">
                  <Label className="text-xs">IP Público da Cloud</Label>
                  <Input
                    value={formData.cloud_public_ip}
                    onChange={(e) => setFormData({ ...formData, cloud_public_ip: e.target.value })}
                    placeholder="Ex: 203.0.113.50"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o IP público atribuído pela cloud (AWS, Azure, GCP). Será usado para geolocalização e Surface Analyzer.
                  </p>
                </div>
              )}
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
                <div className="relative inline-flex shrink-0">
                  {!geoLoading && formData.fortigate_url && formData.agent_id && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 z-10">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!formData.fortigate_url) { toast.error('Preencha a URL primeiro'); return; }
                      if (!formData.agent_id) { toast.error('Selecione um Agent primeiro'); return; }

                      setGeoLoading(true);

                      try {
                        // Cloud Public IP shortcut: geolocate directly
                        if (formData.cloud_public_ip?.trim()) {
                          const { data: geoData } = await supabase.functions.invoke('resolve-firewall-geo', {
                            body: { ips: [formData.cloud_public_ip.trim()] },
                          });
                          const geoResults: any[] = geoData?.results || [];
                          const success = geoResults.find((r: any) => r.status === 'success');
                          if (success) {
                            setFormData(prev => ({ ...prev, geo_latitude: String(success.lat), geo_longitude: String(success.lon) }));
                            const loc = [success.city, success.regionName, success.country].filter(Boolean).join(', ');
                            toast.success(`☁️ Cloud IP — ${formData.cloud_public_ip}${loc ? ` (${loc})` : ''}`);
                          } else {
                            toast.error('Não foi possível geolocalizar o IP público da cloud.');
                          }
                          setGeoLoading(false);
                          return;
                        }
                      } catch (cloudErr: any) {
                        toast.error('Erro ao geolocalizar Cloud IP: ' + cloudErr.message);
                        setGeoLoading(false);
                        return;
                      }

                      // Helper: extract WAN public IPs from compliance step data
                      const extractWanPublicIPs = (interfacesData: any, sdwanData: any): { ip: string; interfaceName: string }[] => {
                        const isPrivateIP = (ip: string) =>
                          /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(ip);
                        const looksLikeIP = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
                        const wanNamePatterns = /^(wan|wan\d+|internet|isp|isp\d+|mpls|lte|4g|5g|broadband)/i;
                        const interfaces: any[] = interfacesData?.results || interfacesData?.data?.results || [];
                        const sdwan = sdwanData?.results || sdwanData?.data?.results || {};
                        const sdwanMembers = new Set<string>(
                          (sdwan.members || []).map((m: any) => m.interface).filter(Boolean)
                        );
                        const wanIPs: { ip: string; interfaceName: string }[] = [];
                        for (const iface of interfaces) {
                          let isWan = false;
                          if (iface.name === 'virtual-wan-link') isWan = true;
                          else if (sdwanMembers.has(iface.name)) isWan = true;
                          else if (iface.role?.toLowerCase() === 'wan') isWan = true;
                          else if (wanNamePatterns.test(iface.name)) isWan = true;
                          if (!isWan) continue;
                          if (iface.type === 'tunnel' || iface.type === 'loopback') continue;
                          const ipField: string = iface.ip || '';
                          const ip = ipField.split(' ')[0];
                          if (looksLikeIP(ip) && !isPrivateIP(ip) && ip !== '0.0.0.0') {
                            wanIPs.push({ ip, interfaceName: iface.name });
                          }
                        }
                        return wanIPs;
                      };

                      // Helper: geolocate IPs and show result / WanSelectorDialog
                      const applyGeoResults = async (wanIPs: { ip: string; interfaceName: string }[], source: 'cache' | 'agent') => {
                        const { data: geoData } = await supabase.functions.invoke('resolve-firewall-geo', {
                          body: { ips: wanIPs.map(w => w.ip) },
                        });

                        const geoResultsRaw: any[] = (geoData?.results || []);
                        const ipToGeo = Object.fromEntries(
                          geoResultsRaw
                            .filter((r: any) => r.status === 'success')
                            .map((r: any) => [r.query, r])
                        );

                        const candidates = wanIPs.map((w) => {
                          const r = ipToGeo[w.ip];
                          if (!r) return null;
                          return {
                            ip: w.ip,
                            interface: w.interfaceName,
                            lat: r.lat as number,
                            lng: r.lon as number,
                            country: r.country || '',
                            country_code: (r.countryCode || '').toLowerCase(),
                            region: r.regionName || '',
                            city: r.city || '',
                          };
                        }).filter(Boolean) as WanCandidate[];

                        if (candidates.length === 0) {
                          toast.warning(`IPs WAN encontrados (${wanIPs.map(w => w.ip).join(', ')}) mas não foi possível geolocalizar nenhum.`);
                          return;
                        }

                        const sourceIcon = source === 'cache' ? '📦' : '🔌';
                        if (candidates.length === 1) {
                          const c = candidates[0];
                          setFormData(prev => ({ ...prev, geo_latitude: String(c.lat), geo_longitude: String(c.lng) }));
                          const loc = [c.city, c.region, c.country].filter(Boolean).join(', ');
                          toast.success(`${sourceIcon} ${c.interface} — ${c.ip}${loc ? ` (${loc})` : ''}`);
                        } else {
                          setWanCandidates(candidates);
                          setShowWanDialog(true);
                        }
                      };

                      try {
                        // ── CAMINHO 1: Verificar coletas de compliance recentes (últimos 7 dias) ──
                        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                        const { data: recentTask } = await supabase
                          .from('agent_tasks')
                          .select('id, completed_at')
                          .eq('target_id', id!)
                          .eq('target_type', 'firewall')
                          .eq('task_type', 'fortigate_compliance')
                          .eq('status', 'completed')
                          .gte('completed_at', sevenDaysAgo)
                          .order('completed_at', { ascending: false })
                          .limit(1)
                          .maybeSingle();

                        if (recentTask?.id) {
                          const { data: stepRows } = await supabase
                            .from('task_step_results')
                            .select('step_id, data, status')
                            .eq('task_id', recentTask.id)
                            .in('step_id', ['system_interface', 'system_sdwan'])
                            .eq('status', 'success');

                          const stepMap = Object.fromEntries(
                            (stepRows || []).map((r: any) => [r.step_id, r.data])
                          );

                          const interfacesData = stepMap['system_interface'];
                          const sdwanData = stepMap['system_sdwan'];

                          if (interfacesData) {
                            const wanIPs = extractWanPublicIPs(interfacesData, sdwanData);
                            if (wanIPs.length > 0) {
                              const collectedAt = formatDateTimeBR(recentTask.completed_at!);
                              toast.info(`📦 Usando dados da coleta de ${collectedAt}`);
                              await applyGeoResults(wanIPs, 'cache');
                              setGeoLoading(false);
                              return;
                            }
                          }
                        }

                        // ── CAMINHO 2: Fallback — criar task via Agent ──────────────────────────
                        const credKey = usesSessionAuth ? formData.auth_username : formData.api_key;
                        if (!credKey) {
                          toast.error(usesSessionAuth ? 'Preencha o usuário primeiro' : 'Preencha a API Key primeiro');
                          setGeoLoading(false);
                          return;
                        }

                        const { data: taskData, error: taskError } = await supabase.functions.invoke('resolve-firewall-geo', {
                          body: {
                            agent_id: formData.agent_id,
                            url: formData.fortigate_url,
                            api_key: usesSessionAuth ? formData.auth_username : formData.api_key,
                          },
                        });

                        if (taskError || !taskData?.success) {
                          toast.error(`Erro ao criar task: ${taskData?.message || taskError?.message || 'Erro desconhecido'}`);
                          setGeoLoading(false);
                          return;
                        }

                        const taskId = taskData.task_id;
                        toast.info('⏳ Nenhuma coleta recente. Aguardando resposta do Agent...');

                        const POLL_INTERVAL = 2000;
                        const MAX_POLLS = 30;
                        let polls = 0;

                        const pollTask = async (): Promise<void> => {
                          polls++;
                          if (polls > MAX_POLLS) {
                            toast.error('Timeout: O Agent não respondeu em 60 segundos. Verifique se o Agent está online.');
                            setGeoLoading(false);
                            return;
                          }

                          const { data: taskResult } = await supabase
                            .from('agent_tasks')
                            .select('status, result, step_results, error_message')
                            .eq('id', taskId)
                            .single();

                          if (!taskResult || taskResult.status === 'pending' || taskResult.status === 'running') {
                            setTimeout(pollTask, POLL_INTERVAL);
                            return;
                          }

                          setGeoLoading(false);

                          if (taskResult.status === 'failed' || taskResult.status === 'timeout') {
                            toast.error(`Agent reportou erro: ${taskResult.error_message || 'Falha na consulta ao FortiGate'}`);
                            return;
                          }

                          if (taskResult.status !== 'completed') {
                            toast.error(`Status inesperado da task: ${taskResult.status}`);
                            return;
                          }

                          const { data: stepRows } = await supabase
                            .from('task_step_results')
                            .select('step_id, status, data')
                            .eq('task_id', taskId);

                          const stepResultsMap = Object.fromEntries(
                            (stepRows || []).map((r: any) => [r.step_id, r.data])
                          );
                          const interfacesData = stepResultsMap['get_interfaces'];
                          const sdwanData = stepResultsMap['get_sdwan'];

                          const isHtmlResponse = (data: any) =>
                            data?.raw_text && typeof data.raw_text === 'string' && data.raw_text.trim().startsWith('<!DOCTYPE');

                          if (isHtmlResponse(interfacesData)) {
                            toast.error('O FortiGate retornou página de login. Verifique a API Key e se o token tem permissão de acesso via REST API.');
                            return;
                          }

                          if (!interfacesData) {
                            toast.error('Agent não retornou dados de interfaces. Verifique as credenciais e a URL.');
                            return;
                          }

                          const wanIPs = extractWanPublicIPs(interfacesData, sdwanData);

                          if (wanIPs.length === 0) {
                            toast.warning('Nenhum IP público encontrado nas interfaces WAN do FortiGate.');
                            return;
                          }

                          await applyGeoResults(wanIPs, 'agent');
                        };

                        setTimeout(pollTask, POLL_INTERVAL);
                      } catch (err: any) {
                        toast.error('Erro ao buscar localização: ' + err.message);
                        setGeoLoading(false);
                      }
                    }}
                    disabled={geoLoading || !formData.fortigate_url || !formData.agent_id}
                    className="gap-1"
                  >
                    {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    Buscar
                  </Button>
                </div>
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/environment')}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !!urlError || !formData.fortigate_url || !canEdit}>
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

    {/* WAN IP Selector Dialog */}
    <Dialog open={showWanDialog} onOpenChange={setShowWanDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Múltiplos IPs WAN encontrados
          </DialogTitle>
          <DialogDescription>
            Selecione o IP que representa a localização física deste firewall.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {wanCandidates.map((c) => {
            const location = [c.city, c.region, c.country].filter(Boolean).join(', ');
            return (
              <div
                key={c.ip}
                className="group border border-border rounded-lg overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border/50">
                  {c.country_code ? (
                    <span className={`fi fi-${c.country_code.toLowerCase()} text-2xl flex-shrink-0`} title={c.country} />
                  ) : (
                    <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="font-semibold text-foreground">{c.interface}</span>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/10">
                    WAN
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1.5 group-hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono font-bold text-base text-foreground">{c.ip}</span>
                  </div>
                  {location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{location}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end px-4 py-2.5 bg-muted/10 border-t border-border/50">
                  <Button
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, geo_latitude: String(c.lat), geo_longitude: String(c.lng) }));
                      setShowWanDialog(false);
                      toast.success(`📍 ${c.interface} — ${c.ip}${location ? ` (${location})` : ''} selecionado`);
                    }}
                  >
                    Selecionar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
