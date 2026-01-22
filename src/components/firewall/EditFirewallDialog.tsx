import { useEffect, useState } from 'react';
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

interface Client {
  id: string;
  name: string;
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

interface Firewall {
  id: string;
  name: string;
  description: string | null;
  fortigate_url: string;
  api_key: string;
  client_id: string;
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
    client_id: string;
    schedule: ScheduleFrequency;
  }) => Promise<void>;
}

export function EditFirewallDialog({ 
  open, 
  onOpenChange, 
  firewall, 
  clients, 
  onSave 
}: EditFirewallDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fortigate_url: '',
    api_key: '',
    client_id: '',
    schedule: 'manual' as ScheduleFrequency,
  });

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
        client_id: firewall.client_id,
        schedule: currentSchedule,
      });
    }
  }, [firewall, open]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
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
            Atualize as informações do FortiGate
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 py-2 px-6">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-client">Cliente *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(v) => setFormData({ ...formData, client_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
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
              <Label htmlFor="edit-fw-url">URL do FortiGate *</Label>
              <Input
                id="edit-fw-url"
                value={formData.fortigate_url}
                onChange={(e) => setFormData({ ...formData, fortigate_url: e.target.value })}
                placeholder="https://192.168.1.1:8443"
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="edit-fw-api">API Key *</Label>
              <PasswordInput
                id="edit-fw-api"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="Token da REST API"
              />
            </div>

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
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
