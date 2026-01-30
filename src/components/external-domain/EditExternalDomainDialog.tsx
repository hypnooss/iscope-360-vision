import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Pencil } from 'lucide-react';
import type { ScheduleFrequency } from '@/components/external-domain/AddExternalDomainDialog';
import type { ExternalDomainRow } from '@/components/external-domain/ExternalDomainTable';

interface Agent {
  id: string;
  name: string;
  client_id: string | null;
}

interface EditExternalDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: ExternalDomainRow | null;
  onSave: (payload: { agent_id: string; schedule: ScheduleFrequency }) => Promise<void>;
}

export function EditExternalDomainDialog({ open, onOpenChange, domain, onSave }: EditExternalDomainDialogProps) {
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [formData, setFormData] = useState({
    agent_id: '',
    schedule: 'manual' as ScheduleFrequency,
  });

  useEffect(() => {
    if (!open || !domain) return;

    setFormData({
      agent_id: domain.agent_id || '',
      schedule: (domain.schedule_frequency || 'manual') as ScheduleFrequency,
    });
  }, [open, domain]);

  useEffect(() => {
    const fetchAgents = async () => {
      if (!open || !domain?.client_id) {
        setAgents([]);
        return;
      }

      const { data, error } = await supabase
        .from('agents')
        .select('id, name, client_id')
        .eq('client_id', domain.client_id)
        .eq('revoked', false)
        .order('name');

      if (error) {
        console.error('Error fetching agents:', error);
        setAgents([]);
        return;
      }

      setAgents((data || []) as Agent[]);
    };

    fetchAgents();
  }, [open, domain?.client_id]);

  const canSubmit = useMemo(() => {
    return !!formData.agent_id;
  }, [formData.agent_id]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave({ agent_id: formData.agent_id, schedule: formData.schedule });
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
            <Pencil className="w-5 h-5" />
            Editar Domínio Externo
          </DialogTitle>
          <DialogDescription>Atualize o agent e a frequência de análise.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 py-2 px-6">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={domain?.client_name || 'N/A'} disabled />
            </div>

            <div className="space-y-2">
              <Label>Domínio</Label>
              <Input value={domain?.domain || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-ext-agent">Agent *</Label>
              <Select
                value={formData.agent_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, agent_id: v }))}
                disabled={!domain?.client_id}
              >
                <SelectTrigger id="edit-ext-agent">
                  <SelectValue placeholder={domain?.client_id ? 'Selecione o agent' : 'Selecione um cliente primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-ext-schedule">Frequência de Análise</Label>
              <Select
                value={formData.schedule}
                onValueChange={(v) => setFormData((p) => ({ ...p, schedule: v as ScheduleFrequency }))}
              >
                <SelectTrigger id="edit-ext-schedule">
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
          <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
