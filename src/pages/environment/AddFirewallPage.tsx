import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Globe,
  Loader2,
  MapPin,
  Settings,
  Shield,
  Terminal,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { getDeviceUrlError } from '@/lib/urlValidation';
// geolocation lib removed — geolocation now done via Agent + ipapi.co in browser

import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client { id: string; name: string; }
interface Agent { id: string; name: string; client_id: string | null; }
interface DeviceType { id: string; name: string; vendor: string; code: string; }

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

const STEPS = [
  { id: 1, label: 'Fabricante' },
  { id: 2, label: 'Instruções' },
  { id: 3, label: 'Configuração' },
  { id: 4, label: 'Agendamento' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center w-full mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                step.id < current
                  ? 'bg-primary border-primary text-primary-foreground'
                  : step.id === current
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground bg-background'
              }`}
            >
              {step.id < current ? <Check className="w-4 h-4" /> : step.id}
            </div>
            <span
              className={`text-xs whitespace-nowrap ${
                step.id === current ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                step.id < current ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Instructions content ─────────────────────────────────────────────────────

function FortiGateInstructions() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <p className="text-sm text-blue-400 font-medium">ℹ️ Por que usar o perfil <span className="font-mono">super_admin_readonly</span>?</p>
        <ul className="text-xs text-blue-300/80 mt-1 space-y-1 list-disc list-inside">
          <li>Perfil nativo do FortiGate — não requer criação manual</li>
          <li>Acesso somente-leitura: não permite alterações de configuração</li>
          <li>Visibilidade completa para coleta de dados de compliance</li>
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
          Criar REST API Admin
        </h3>
        <ol className="ml-8 space-y-2 text-sm text-muted-foreground list-none">
          <li className="flex items-start gap-2">
            <span className="font-mono text-primary text-xs mt-0.5 w-3 shrink-0">a</span>
            <span>Vá em <span className="font-mono bg-muted px-1 rounded text-foreground">System &gt; Administrators</span></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-primary text-xs mt-0.5 w-3 shrink-0">b</span>
            <span>Clique em <strong>Create New &gt; REST API Admin</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-primary text-xs mt-0.5 w-3 shrink-0">c</span>
            <span>
              Preencha o formulário:
              <ul className="mt-1.5 space-y-1 list-none text-xs">
                <li className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">–</span>
                  <span><strong>Username:</strong> <span className="font-mono bg-muted px-1 rounded text-foreground">iscope360</span></span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">–</span>
                  <span><strong>Administrator Profile:</strong> <span className="font-mono bg-muted px-1 rounded text-foreground">super_admin_readonly</span></span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">–</span>
                  <span><strong>PKI Group:</strong> desmarque (deixe desabilitado)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">–</span>
                  <span><strong>Trusted Hosts:</strong> ative o toggle</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">–</span>
                  <span><strong>Host 1:</strong> insira o IP do servidor do agente iScope (ex: <span className="font-mono bg-muted px-1 rounded text-foreground">192.168.1.50/32</span>)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">–</span>
                  <span>Clique em <strong>OK</strong></span>
                </li>
              </ul>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-primary text-xs mt-0.5 w-3 shrink-0">d</span>
            <span>Anote o <strong>API Token</strong> gerado — ele será solicitado na próxima etapa</span>
          </li>
        </ol>
      </div>

      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2">
        <p className="text-sm font-semibold text-destructive flex items-center gap-2">
          🔒 Segurança: Restrição por IP (Trusted Hosts)
        </p>
        <p className="text-xs text-destructive/80">
          Habilitar <strong>Trusted Hosts</strong> é essencial. Sem essa restrição, o API Token pode ser usado de qualquer origem na internet caso seja comprometido.
        </p>
        <p className="text-xs text-destructive/80">
          Ao ativar Trusted Hosts e informar o IP do agente iScope, somente requisições originadas desse endereço serão aceitas pelo FortiGate — o token se torna inútil fora desse contexto.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</span>
          Habilitar acesso à API via CLI (se necessário)
        </h3>
        <div className="ml-8 space-y-2">
          <p className="text-sm text-muted-foreground">Execute os seguintes comandos no CLI do FortiGate:</p>
          <pre className="text-xs bg-muted font-mono p-3 rounded border border-border overflow-x-auto text-foreground">{`config system api-user
    edit "iscope360"
        set accprofile "super_admin_readonly"
        set vdom "root"
        set trusthost1 <IP-do-agente>/32
    next
end`}</pre>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</span>
          Habilitar acesso a logs via REST API
        </h3>
        <div className="ml-8 space-y-2">
          <p className="text-sm text-muted-foreground">
            Por padrão, o FortiGate não expõe logs para a REST API. Execute o comando abaixo para habilitar a leitura de logs e métricas de performance — necessário para o módulo <strong>Security Intelligence (Analyzer)</strong>:
          </p>
          <pre className="text-xs bg-muted font-mono p-3 rounded border border-border overflow-x-auto text-foreground">{`config log setting
    set rest-api-get enable
    set rest-api-performance enable
end`}</pre>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">rest-api-get</strong> — permite consulta de logs de tráfego, IPS e eventos via API.<br/>
            <strong className="text-foreground">rest-api-performance</strong> — expõe métricas de CPU, memória e sessões ativas.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-sm text-amber-400 font-medium">⚠️ Observação sobre portas e SSL</p>
        <p className="text-xs text-amber-300/80 mt-1">
          A porta padrão da API HTTPS do FortiGate é <span className="font-mono">8443</span>. Certifique-se de que o certificado SSL está configurado corretamente ou desabilite a verificação SSL no perfil. A URL deve incluir porta e protocolo HTTPS.
        </p>
      </div>
    </div>
  );
}

function SonicWallInstructions() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
          Habilitar a SonicOS API
        </h3>
        <p className="text-sm text-muted-foreground ml-8">
          Acesse <span className="font-mono bg-muted px-1 rounded text-foreground">Device &gt; Administration &gt; Management</span>, role até a seção <strong>SonicOS API</strong> e habilite o acesso à API REST.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</span>
          Criar usuário local com perfil de leitura
        </h3>
        <p className="text-sm text-muted-foreground ml-8">
          Vá em <span className="font-mono bg-muted px-1 rounded text-foreground">Device &gt; Users &gt; Local Users</span>, crie um novo usuário com o perfil <strong>Guest Services</strong> ou <strong>Read-Only Admin</strong> (conforme disponibilidade do firmware).
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</span>
          Confirmar porta de gerenciamento HTTPS
        </h3>
        <p className="text-sm text-muted-foreground ml-8">
          Verifique a porta HTTPS em <span className="font-mono bg-muted px-1 rounded text-foreground">Device &gt; Administration &gt; Management &gt; HTTPS Management Port</span>. A porta padrão é <span className="font-mono">443</span> ou <span className="font-mono">4444</span> dependendo do modelo.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-sm text-amber-400 font-medium">⚠️ Autenticação por sessão</p>
        <p className="text-xs text-amber-300/80 mt-1">
          O SonicWall utiliza autenticação por sessão (usuário + senha). O sistema realizará login automático e manterá a sessão durante a coleta de dados. Certifique-se de que o usuário tenha permissão de login via API.
        </p>
      </div>
    </div>
  );
}

function GenericInstructions({ vendorName }: { vendorName: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-6 text-center space-y-2">
      <Terminal className="w-10 h-10 text-muted-foreground mx-auto" />
      <p className="text-muted-foreground text-sm">
        Consulte a documentação do fabricante <strong>{vendorName}</strong> para configurar o acesso à API REST com permissões de leitura.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddFirewallPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { effectiveRole } = useEffectiveAuth();

  const isSuperUser = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Data
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Step 1
  const [selectedDeviceTypeId, setSelectedDeviceTypeId] = useState('');

  // Step 2
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
    agent_id: '',
    geo_latitude: '',
    geo_longitude: '',
  });

  // Step 4
  const [schedule, setSchedule] = useState<ScheduleFrequency>('manual');
  const [scheduledHour, setScheduledHour] = useState(2);
  const [scheduledDayOfWeek, setScheduledDayOfWeek] = useState(1);
  const [scheduledDayOfMonth, setScheduledDayOfMonth] = useState(1);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const selectedDeviceType = useMemo(
    () => deviceTypes.find(dt => dt.id === selectedDeviceTypeId),
    [deviceTypes, selectedDeviceTypeId]
  );

  const usesSessionAuth = useMemo(
    () => selectedDeviceType && SESSION_AUTH_DEVICE_CODES.some(code =>
      selectedDeviceType.code.toLowerCase().includes(code.toLowerCase())
    ),
    [selectedDeviceType]
  );

  const getUrlLabel = () =>
    selectedDeviceType?.vendor?.toLowerCase().includes('sonicwall') ? 'URL do SonicWall' : 'URL do FortiGate';

  const getUrlPlaceholder = () =>
    selectedDeviceType?.vendor?.toLowerCase().includes('sonicwall')
      ? 'https://192.168.1.1:4444'
      : 'https://192.168.1.1:8443';

  // ── Data fetching ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dtRes, clientsRes] = await Promise.all([
          supabase.from('device_types').select('id, name, vendor, code').eq('is_active', true).eq('category', 'firewall').order('vendor'),
          isSuperUser
            ? supabase.from('clients').select('id, name').order('name')
            : Promise.resolve({ data: [] as Client[] }),
        ]);
        if (dtRes.data) setDeviceTypes(dtRes.data);

        if (isSuperUser) {
          if (clientsRes.data) setClients(clientsRes.data);
        } else if (user?.id) {
          const { data: userClients } = await supabase
            .from('user_clients')
            .select('client_id, clients(id, name)')
            .eq('user_id', user.id);
          if (userClients) {
            const mapped = userClients
              .filter((uc: any) => uc.clients)
              .map((uc: any) => ({ id: uc.clients.id, name: uc.clients.name }));
            setClients(mapped);
            if (mapped.length === 1) {
              setFormData(prev => ({ ...prev, client_id: mapped[0].id }));
            }
          }
        }
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [isSuperUser, user?.id]);

  useEffect(() => {
    if (!formData.client_id) { setAgents([]); return; }
    supabase.from('agents').select('id, name, client_id').eq('client_id', formData.client_id).eq('revoked', false).order('name')
      .then(({ data }) => setAgents(data || []));
  }, [formData.client_id]);

  // ── Navigation ────────────────────────────────────────────────────────────────

  const canAdvanceStep1 = !!selectedDeviceTypeId;

  const canAdvanceStep2 = useMemo(() => {
    if (!formData.name.trim() || !formData.fortigate_url.trim() || !formData.client_id || !!urlError) return false;
    if (usesSessionAuth) return !!(formData.auth_username.trim() && formData.auth_password.trim());
    return !!formData.api_key.trim();
  }, [formData, urlError, usesSessionAuth]);

  const handleBack = () => {
    if (step === 1) navigate('/environment/new');
    else setStep(s => s - 1);
  };

  const handleNext = () => setStep(s => s + 1);

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSaving(true);
    try {
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
          device_type_id: selectedDeviceTypeId || null,
          agent_id: formData.agent_id || null,
          created_by: user?.id,
          geo_latitude: formData.geo_latitude ? parseFloat(formData.geo_latitude) : null,
          geo_longitude: formData.geo_longitude ? parseFloat(formData.geo_longitude) : null,
        } as any)
        .select()
        .single();

      if (fwError) throw fwError;

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
        toast.warning('Firewall criado, mas erro ao criptografar credenciais. Edite o firewall para salvar novamente.');
      }

      if (schedule !== 'manual') {
        const nextRunAt = calculateNextRunAt(schedule, scheduledHour, scheduledDayOfWeek, scheduledDayOfMonth);
        await supabase.from('analysis_schedules').insert({
          firewall_id: firewall.id,
          frequency: schedule,
          is_active: true,
          created_by: user?.id,
          scheduled_hour: scheduledHour,
          scheduled_day_of_week: scheduledDayOfWeek,
          scheduled_day_of_month: scheduledDayOfMonth,
          next_run_at: nextRunAt,
        } as any);
      }

      toast.success('Firewall adicionado com sucesso!');
      navigate('/environment');
    } catch (error: any) {
      toast.error('Erro ao adicionar firewall: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loadingData) {
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
        <PageBreadcrumb
          items={[
            { label: 'Ambiente', href: '/environment' },
            { label: 'Novo Item', href: '/environment/new' },
            { label: 'Firewall' },
          ]}
        />

        {/* Step Indicator */}
        <div className="pt-10">
          <StepIndicator current={step} />
        </div>

        {/* ── STEP 1: Fabricante ────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="w-5 h-5 text-orange-400" />
                  Selecione o Fabricante
                </CardTitle>
                <p className="text-sm text-muted-foreground">Escolha o modelo do firewall que deseja adicionar</p>
              </CardHeader>
              <CardContent>
                {deviceTypes.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Nenhum tipo de dispositivo disponível. Contate o administrador.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deviceTypes.map(dt => (
                      <button
                        key={dt.id}
                        onClick={() => setSelectedDeviceTypeId(dt.id)}
                        className={`relative text-left rounded-lg border-2 p-4 transition-all hover:border-primary/70 focus:outline-none ${
                          selectedDeviceTypeId === dt.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card hover:bg-muted/30'
                        }`}
                      >
                        {selectedDeviceTypeId === dt.id && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </span>
                        )}
                        <div className="w-10 h-10 rounded-lg bg-orange-400/10 flex items-center justify-center mb-3">
                          <Shield className="w-5 h-5 text-orange-400" />
                        </div>
                        <p className="font-semibold text-foreground text-sm">{dt.vendor}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{dt.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button onClick={handleNext} disabled={!canAdvanceStep1}>
                Próximo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Instruções ────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Terminal className="w-5 h-5 text-orange-400" />
                  Instruções de Configuração — {selectedDeviceType?.vendor}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Siga os passos abaixo para configurar o acesso à API no seu dispositivo.
                </p>
              </CardHeader>
              <CardContent>
                {selectedDeviceType?.vendor?.toLowerCase().includes('fortigate') || selectedDeviceType?.code?.toLowerCase().includes('fortigate') ? (
                  <FortiGateInstructions />
                ) : selectedDeviceType?.vendor?.toLowerCase().includes('sonicwall') || selectedDeviceType?.code?.toLowerCase().includes('sonicwall') ? (
                  <SonicWallInstructions />
                ) : (
                  <GenericInstructions vendorName={selectedDeviceType?.vendor || ''} />
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button onClick={handleNext}>
                Próximo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Configuração ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5 text-orange-400" />
                  Informações do Firewall
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Fabricante selecionado: <strong>{selectedDeviceType?.vendor} — {selectedDeviceType?.name}</strong>
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Workspace — super users only */}
                  {isSuperUser && (
                    <div className="space-y-2">
                      <Label>Workspace *</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v, agent_id: '' }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione um workspace" /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Nome */}
                  <div className="space-y-2">
                    <Label>Nome do Firewall *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: FW-HQ-01"
                    />
                  </div>
                </div>

                {/* URL */}
                <div className="space-y-2">
                  <Label>{getUrlLabel()} *</Label>
                  <Input
                    value={formData.fortigate_url}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, fortigate_url: e.target.value }));
                      setUrlError(getDeviceUrlError(e.target.value));
                    }}
                    placeholder={getUrlPlaceholder()}
                    className={urlError ? 'border-destructive' : ''}
                  />
                  {urlError && <p className="text-sm text-destructive">{urlError}</p>}
                </div>

                {/* Auth */}
                {usesSessionAuth ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Usuário *</Label>
                      <Input
                        value={formData.auth_username}
                        onChange={(e) => setFormData(prev => ({ ...prev, auth_username: e.target.value }))}
                        placeholder="admin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha *</Label>
                      <PasswordInput
                        value={formData.auth_password}
                        onChange={(e) => setFormData(prev => ({ ...prev, auth_password: e.target.value }))}
                        placeholder="Senha do dispositivo"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>API Key *</Label>
                    <PasswordInput
                      value={formData.api_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                      placeholder="Token da REST API"
                    />
                  </div>
                )}

                {/* Agent */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agent</Label>
                    <Select
                      value={formData.agent_id}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, agent_id: v }))}
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
                </div>

                {/* Geolocation */}
                <div className="space-y-2">
                  <Label>Localização (opcional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="any"
                      value={formData.geo_latitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, geo_latitude: e.target.value }))}
                      placeholder="Latitude"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="any"
                      value={formData.geo_longitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, geo_longitude: e.target.value }))}
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
                        if (!formData.agent_id) { toast.error('Selecione um Agent primeiro. A consulta ao FortiGate deve passar pelo Agent da rede do cliente.'); return; }
                        const credKey = usesSessionAuth ? formData.auth_username : formData.api_key;
                        if (!credKey) { toast.error(usesSessionAuth ? 'Preencha o usuário primeiro' : 'Preencha a API Key primeiro'); return; }

                        setGeoLoading(true);
                        try {
                          // Step 1: Create geo_query task via Edge Function (task will be picked up by the Agent)
                          const { data: taskData, error: taskError } = await supabase.functions.invoke('resolve-firewall-geo', {
                            body: {
                              agent_id: formData.agent_id,
                              url: formData.fortigate_url,
                              api_key: usesSessionAuth ? formData.auth_username : formData.api_key,
                            },
                          });

                          if (taskError || !taskData?.success) {
                            toast.error(`Erro ao criar task: ${taskData?.message || taskError?.message || 'Erro desconhecido'}`);
                            return;
                          }

                          const taskId = taskData.task_id;
                          toast.info('⏳ Aguardando resposta do Agent...');

                          // Step 2: Poll for task completion (every 2s, up to 60s)
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

                            if (!taskResult) {
                              setTimeout(pollTask, POLL_INTERVAL);
                              return;
                            }

                            if (taskResult.status === 'pending' || taskResult.status === 'running') {
                              setTimeout(pollTask, POLL_INTERVAL);
                              return;
                            }

                            // Task finished
                            setGeoLoading(false);

                            if (taskResult.status === 'failed' || taskResult.status === 'timeout') {
                              toast.error(`Agent reportou erro: ${taskResult.error_message || 'Falha na consulta ao FortiGate'}`);
                              return;
                            }

                            if (taskResult.status !== 'completed') {
                              toast.error(`Status inesperado da task: ${taskResult.status}`);
                              return;
                            }

                            // Step 3: Fetch step results from task_step_results table (not from agent_tasks.step_results)
                            const { data: stepRows } = await supabase
                              .from('task_step_results')
                              .select('step_id, status, data')
                              .eq('task_id', taskId);

                            const stepResultsMap = Object.fromEntries(
                              (stepRows || []).map((r: any) => [r.step_id, r.data])
                            );
                            const interfacesData = stepResultsMap['get_interfaces'];
                            const sdwanData = stepResultsMap['get_sdwan'];

                            // Detect HTML response (login page = invalid API key / restricted access)
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

                            // Filter WAN interfaces (same logic as old edge function)
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

                              // Skip tunnel/loopback interfaces — VPN overlays (IPSec, GRE, IPIP)
                              // never represent the real physical WAN egress point
                              if (iface.type === 'tunnel' || iface.type === 'loopback') continue;

                              const ipField: string = iface.ip || '';
                              const ip = ipField.split(' ')[0];
                              if (looksLikeIP(ip) && !isPrivateIP(ip) && ip !== '0.0.0.0') {
                                wanIPs.push({ ip, interfaceName: iface.name });
                              }
                            }

                            if (wanIPs.length === 0) {
                              toast.warning('Nenhum IP público encontrado nas interfaces WAN do FortiGate.');
                              return;
                            }

                            // Step 4: Geolocate IPs server-side via Edge Function (ip-api.com/batch — no CORS)
                            const { data: geoData, error: geoError } = await supabase.functions.invoke('resolve-firewall-geo', {
                              body: { ips: wanIPs.map(w => w.ip) },
                            });

                            const geoResultsRaw: any[] = (geoData?.results || []);
                            const ipToGeo = Object.fromEntries(
                              geoResultsRaw
                                .filter((r: any) => r.status === 'success')
                                .map((r: any) => [r.query, r])
                            );

                            const geoResults = wanIPs.map((w) => {
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
                            });

                            const candidates = geoResults.filter(Boolean) as WanCandidate[];

                            if (candidates.length === 0) {
                              toast.warning(`IPs WAN encontrados (${wanIPs.map(w => w.ip).join(', ')}) mas não foi possível geolocalizar nenhum.`);
                              return;
                            }

                            if (candidates.length === 1) {
                              const c = candidates[0];
                              setFormData(prev => ({ ...prev, geo_latitude: String(c.lat), geo_longitude: String(c.lng) }));
                              const loc = [c.city, c.region, c.country].filter(Boolean).join(', ');
                              toast.success(`📍 ${c.interface} — ${c.ip}${loc ? ` (${loc})` : ''}`);
                            } else {
                              setWanCandidates(candidates);
                              setShowWanDialog(true);
                            }
                          };

                          setTimeout(pollTask, POLL_INTERVAL);
                        } catch (err: any) {
                          toast.error('Erro ao buscar localização: ' + err.message);
                          setGeoLoading(false);
                        }
                      }}
                      disabled={geoLoading || !formData.fortigate_url || !formData.agent_id}
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

                {/* Description */}
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button onClick={handleNext} disabled={!canAdvanceStep2}>
                Próximo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Agendamento ───────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Agendamento de Análise
                </CardTitle>
                <p className="text-sm text-muted-foreground">Configure a frequência e horário da análise automática</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select value={schedule} onValueChange={(v) => setSchedule(v as ScheduleFrequency)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {schedule !== 'manual' && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Horário</Label>
                        <Select value={scheduledHour.toString()} onValueChange={(v) => setScheduledHour(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {HOURS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {schedule === 'weekly' && (
                        <div className="space-y-2">
                          <Label>Dia da Semana</Label>
                          <Select value={scheduledDayOfWeek.toString()} onValueChange={(v) => setScheduledDayOfWeek(parseInt(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {schedule === 'monthly' && (
                        <div className="space-y-2">
                          <Label>Dia do Mês</Label>
                          <Select value={scheduledDayOfMonth.toString()} onValueChange={(v) => setScheduledDayOfMonth(parseInt(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_MONTH.map(d => <SelectItem key={d.value} value={d.value}>Dia {d.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {schedule === 'daily' && `A análise será executada todos os dias às ${scheduledHour.toString().padStart(2, '0')}:00 (UTC).`}
                      {schedule === 'weekly' && `A análise será executada toda ${DAYS_OF_WEEK.find(d => d.value === scheduledDayOfWeek.toString())?.label} às ${scheduledHour.toString().padStart(2, '0')}:00 (UTC).`}
                      {schedule === 'monthly' && `A análise será executada todo dia ${scheduledDayOfMonth} do mês às ${scheduledHour.toString().padStart(2, '0')}:00 (UTC).`}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Adicionar Firewall
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
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
                {/* Card Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border/50">
                  {c.country_code ? (
                    <span
                      className={`fi fi-${c.country_code.toLowerCase()} text-2xl flex-shrink-0`}
                      title={c.country}
                    />
                  ) : (
                    <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="font-semibold text-foreground">{c.interface}</span>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/10">
                    WAN
                  </span>
                </div>

                {/* Card Body */}
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

                {/* Card Footer */}
                <div className="flex justify-end px-4 py-2.5 bg-muted/10 border-t border-border/50">
                  <Button
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        geo_latitude: String(c.lat),
                        geo_longitude: String(c.lng),
                      }));
                      setShowWanDialog(false);
                      toast.success(`📍 ${c.interface} — ${c.ip}${location ? ` (${location})` : ''} selecionado`);
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
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
