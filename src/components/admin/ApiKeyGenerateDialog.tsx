import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiKeyScopesSelect } from './ApiKeyScopesSelect';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Copy, AlertTriangle, CheckCircle } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface ApiKeyGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}

export function ApiKeyGenerateDialog({ open, onOpenChange, onGenerated }: ApiKeyGenerateDialogProps) {
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      loadClients();
      setName('');
      setClientId('');
      setScopes([]);
      setExpiresAt('');
      setGeneratedToken('');
      setCopied(false);
    }
  }, [open]);

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  };

  const handleGenerate = async () => {
    if (!name.trim() || !clientId || !scopes.length) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ action: 'generate' });
      const { data: genData, error: genError } = await supabase.functions.invoke(
        `api-access-keys?${queryParams.toString()}`,
        {
          method: 'POST',
          body: { name, client_id: clientId, scopes, expires_at: expiresAt || null },
        }
      );

      if (genError) throw genError;
      if (genData?.error) throw new Error(genData.error);

      setGeneratedToken(genData.token);
      toast.success('Chave gerada com sucesso');
      onGenerated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar chave');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    toast.success('Chave copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (generatedToken) {
      // Confirm close if token is showing
      onOpenChange(false);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Nova Chave de API</DialogTitle>
          <DialogDescription>
            A chave será exibida apenas uma vez. Copie e armazene em local seguro.
          </DialogDescription>
        </DialogHeader>

        {generatedToken ? (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Atenção!</p>
                <p className="text-muted-foreground mt-1">
                  Esta chave não será exibida novamente. Copie agora e armazene em local seguro.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sua Chave de API</Label>
              <div className="flex gap-2">
                <Input value={generatedToken} readOnly className="font-mono text-xs" />
                <Button onClick={handleCopy} variant="outline" size="icon">
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} variant="default">Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Nome *</Label>
              <Input
                id="key-name"
                placeholder="Ex: Integração SOC, Dashboard externo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Workspace *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o workspace" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Permissões *</Label>
              <ApiKeyScopesSelect selected={scopes} onChange={setScopes} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-expires">Expiração (opcional)</Label>
              <Input
                id="key-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Gerar Chave
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
