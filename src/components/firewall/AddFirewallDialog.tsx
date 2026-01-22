import { useState } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Server } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

interface AddFirewallDialogProps {
  clients: Client[];
  onFirewallAdded: (firewall: {
    name: string;
    description: string;
    fortigate_url: string;
    api_key: string;
    client_id: string;
    schedule: ScheduleFrequency;
  }) => Promise<void>;
}

export function AddFirewallDialog({ clients, onFirewallAdded }: AddFirewallDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fortigate_url: '',
    api_key: '',
    client_id: '',
    schedule: 'manual' as ScheduleFrequency,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      fortigate_url: '',
      api_key: '',
      client_id: '',
      schedule: 'manual',
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onFirewallAdded(formData);
      setOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Firewall
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Adicionar Firewall
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo FortiGate para monitoramento
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 py-2 px-6">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="fw-client">Cliente *</Label>
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
              <Label htmlFor="fw-name">Nome do Firewall *</Label>
              <Input
                id="fw-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: FW-HQ-01"
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="fw-url">URL do FortiGate *</Label>
              <Input
                id="fw-url"
                value={formData.fortigate_url}
                onChange={(e) => setFormData({ ...formData, fortigate_url: e.target.value })}
                placeholder="https://192.168.1.1:8443"
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="fw-api">API Key *</Label>
              <PasswordInput
                id="fw-api"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="Token da REST API"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="fw-desc">Descrição</Label>
              <Textarea
                id="fw-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do firewall"
              />
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label htmlFor="fw-schedule">Frequência de Análise</Label>
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
