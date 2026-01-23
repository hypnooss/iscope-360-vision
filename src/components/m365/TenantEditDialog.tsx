import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { TenantConnection } from '@/hooks/useTenantConnection';

interface TenantEditDialogProps {
  tenant: TenantConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tenantId: string, updates: { display_name?: string; tenant_domain?: string }) => Promise<{ success: boolean; error?: string }>;
}

export function TenantEditDialog({ tenant, open, onOpenChange, onSave }: TenantEditDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant && open) {
      setDisplayName(tenant.display_name || '');
      setTenantDomain(tenant.tenant_domain || '');
    }
  }, [tenant, open]);

  const handleSave = async () => {
    if (!tenant) return;
    
    setSaving(true);
    const result = await onSave(tenant.id, {
      display_name: displayName.trim() || null,
      tenant_domain: tenantDomain.trim() || null,
    });
    setSaving(false);

    if (result.success) {
      onOpenChange(false);
    }
  };

  const isConnected = tenant?.connection_status === 'connected' || tenant?.connection_status === 'partial';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Tenant</DialogTitle>
          <DialogDescription>
            Atualize as informações do tenant Microsoft 365.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-id">Tenant ID</Label>
            <Input
              id="tenant-id"
              value={tenant?.tenant_id || ''}
              disabled
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              O Tenant ID não pode ser alterado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Nome de Exibição</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Contoso Corporation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-domain">Domínio do Tenant</Label>
            <Input
              id="tenant-domain"
              value={tenantDomain}
              onChange={(e) => setTenantDomain(e.target.value)}
              placeholder="contoso.onmicrosoft.com"
              disabled={isConnected}
            />
            {isConnected && (
              <p className="text-xs text-muted-foreground">
                O domínio não pode ser alterado enquanto o tenant está conectado.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Cliente Associado</Label>
            <Input
              value={tenant?.client.name || ''}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Para alterar o cliente, exclua e recrie a conexão.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
