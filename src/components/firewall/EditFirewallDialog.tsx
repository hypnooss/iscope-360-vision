import { useEffect, useState, useMemo } from 'react';
import { getDeviceUrlError } from '@/lib/urlValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

interface Firewall {
  id: string;
  name: string;
  description: string | null;
  fortigate_url: string;
  api_key: string;
  auth_username?: string | null;
  auth_password?: string | null;
  client_id: string;
  device_type_id?: string | null;
  agent_id?: string | null;
  analysis_schedules?: { frequency: string; is_active: boolean }[] | { frequency: string; is_active: boolean } | null;
}

interface EditFirewallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firewall: Firewall | null;
  clients: Client[];
  onSave: (data: {
    name: string;
    description: string;
    fortigate_url: string;
    api_key: string;
    auth_username?: string;
    auth_password?: string;
    client_id: string;
    schedule: ScheduleFrequency;
    device_type_id: string;
    agent_id: string;
  }) => Promise<void>;
}

// Device types that use session-based auth (username/password) instead of API key
const SESSION_AUTH_DEVICE_CODES = ['sonicwall_tz', 'sonicwall_nsa', 'sonicwall'];

export function EditFirewallDialog({ 
  open, 
  onOpenChange, 
  firewall, 
  clients, 
  onSave 
}: EditFirewallDialogProps) {
  const [saving, setSaving] = useState(false);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fortigate_url: '',
    api_key: '',
    auth_username: '',
    auth_password: '',
    client_id: '',
    schedule: 'manual' as ScheduleFrequency,
    device_type_id: '',
    agent_id: '',
  });

  // Determine if selected device uses session auth
  const selectedDeviceType = useMemo(() => {
    return deviceTypes.find(dt => dt.id === formData.device_type_id);
  }, [deviceTypes, formData.device_type_id]);

  const usesSessionAuth = useMemo(() => {
    return selectedDeviceType && SESSION_AUTH_DEVICE_CODES.some(code => 
      selectedDeviceType.code.toLowerCase().includes(code.toLowerCase())
    );
  }, [selectedDeviceType]);

  // Fetch device types on mount
  useEffect(() => {
    const fetchDeviceTypes = async () => {
      const { data } = await supabase
        .from('device_types')
        .select('id, name, vendor, code')
        .eq('is_active', true)
        .eq('category', 'firewall')
        .order('vendor');
      if (data) setDeviceTypes(data);
    };
    fetchDeviceTypes();
  }, []);

  // Fetch agents when client changes
  useEffect(() => {
    const fetchAgents = async () => {
      if (!formData.client_id) {
        setAgents([]);
        return;
      }
      const { data } = await supabase
        .from('agents')
        .select('id, name, client_id')
        .eq('client_id', formData.client_id)
        .eq('revoked', false)
        .order('name');
      if (data) setAgents(data);
    };
    fetchAgents();
  }, [formData.client_id]);

  useEffect(() => {
    if (firewall && open) {
      // Get current schedule frequency
      let currentSchedule: ScheduleFrequency = 'manual';
      if (firewall.analysis_schedules) {
        const schedules = Array.isArray(firewall.analysis_schedules) 
          ? firewall.analysis_schedules 
          : [firewall.analysis_schedules];
        const activeSchedule = schedules.find(s => s.is_active);
        if (activeSchedule) {
          currentSchedule = activeSchedule.frequency as ScheduleFrequency;
        }
      }

      setFormData({
        name: firewall.name,
        description: firewall.description || '',
        fortigate_url: firewall.fortigate_url,
        api_key: firewall.api_key,
        auth_username: firewall.auth_username || '',
        auth_password: firewall.auth_password || '',
        client_id: firewall.client_id,
        schedule: currentSchedule,
        device_type_id: firewall.device_type_id || '',
        agent_id: firewall.agent_id || '',
      });
      // Validate existing URL on load
      setUrlError(getDeviceUrlError(firewall.fortigate_url));
    }
  }, [firewall, open]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        ...formData,
        // Only include auth fields relevant to the device type
        api_key: usesSessionAuth ? '' : formData.api_key,
        auth_username: usesSessionAuth ? formData.auth_username : undefined,
        auth_password: usesSessionAuth ? formData.auth_password : undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const getUrlLabel = () => {
    if (selectedDeviceType?.vendor?.toLowerCase().includes('sonicwall')) {
      return 'URL do SonicWall';
    }
    return 'URL do FortiGate';
  };

  const getUrlPlaceholder = () => {
    if (selectedDeviceType?.vendor?.toLowerCase().includes('sonicwall')) {
      return 'https://192.168.1.1:4444';
    }
    return 'https://192.168.1.1:8443';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Editar Firewall
          </DialogTitle>
          <DialogDescription>
            Atualize as informações do dispositivo
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 py-2 px-6">
            {/* Workspace */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-client">Workspace *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(v) => setFormData({ ...formData, client_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um workspace" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Device Type */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-device-type">Tipo de Dispositivo *</Label>
              <Select
                value={formData.device_type_id}
                onValueChange={(v) => setFormData({ ...formData, device_type_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      {dt.vendor} - {dt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agent */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-agent">Agent *</Label>
              <Select
                value={formData.agent_id}
                onValueChange={(v) => setFormData({ ...formData, agent_id: v })}
                disabled={!formData.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.client_id ? "Selecione o agent" : "Selecione um cliente primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.client_id && agents.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum agent disponível para este cliente</p>
              )}
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-name">Nome do Firewall *</Label>
              <Input
                id="edit-fw-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: FW-HQ-01"
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-url">{getUrlLabel()} *</Label>
              <Input
                id="edit-fw-url"
                value={formData.fortigate_url}
                onChange={(e) => {
                  const newUrl = e.target.value;
                  setFormData({ ...formData, fortigate_url: newUrl });
                  setUrlError(getDeviceUrlError(newUrl));
                }}
                placeholder={getUrlPlaceholder()}
                className={urlError ? 'border-destructive' : ''}
              />
              {urlError && (
                <p className="text-sm text-destructive">{urlError}</p>
              )}
            </div>

            {/* Conditional Auth Fields */}
            {usesSessionAuth ? (
              <>
                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="edit-fw-username">Usuário *</Label>
                  <Input
                    id="edit-fw-username"
                    value={formData.auth_username}
                    onChange={(e) => setFormData({ ...formData, auth_username: e.target.value })}
                    placeholder="admin"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="edit-fw-password">Senha *</Label>
                  <PasswordInput
                    id="edit-fw-password"
                    value={formData.auth_password}
                    onChange={(e) => setFormData({ ...formData, auth_password: e.target.value })}
                    placeholder="Senha do dispositivo"
                  />
                </div>
              </>
            ) : (
              /* API Key */
              <div className="space-y-2">
                <Label htmlFor="edit-fw-api">API Key *</Label>
                <PasswordInput
                  id="edit-fw-api"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="Token da REST API"
                />
              </div>
            )}

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-desc">Descrição</Label>
              <Textarea
                id="edit-fw-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do firewall"
              />
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-schedule">Frequência de Análise</Label>
              <Select
                value={formData.schedule}
                onValueChange={(v) => setFormData({ ...formData, schedule: v as ScheduleFrequency })}
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
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !!urlError || !formData.fortigate_url}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
