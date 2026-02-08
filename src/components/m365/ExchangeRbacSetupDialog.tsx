import { useState } from 'react';
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
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExchangeRbacSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantRecordId: string;
  tenantDomain: string;
  onSuccess?: () => void;
}

export function ExchangeRbacSetupDialog({
  open,
  onOpenChange,
  tenantRecordId,
  tenantDomain,
  onSuccess,
}: ExchangeRbacSetupDialogProps) {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('setup-exchange-rbac', {
        body: {
          tenant_record_id: tenantRecordId,
          admin_email: adminEmail,
          admin_password: adminPassword,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao iniciar configuração');
      }

      setSuccess(true);
      toast.success('Configuração iniciada', {
        description: 'O agent está processando a configuração do Exchange RBAC.',
      });

      // Clear form
      setAdminEmail('');
      setAdminPassword('');

      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        onSuccess?.();
      }, 2000);

    } catch (err: any) {
      console.error('Error setting up Exchange RBAC:', err);
      setError(err.message || 'Erro ao configurar Exchange RBAC');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setAdminEmail('');
      setAdminPassword('');
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Configurar Exchange Online
          </DialogTitle>
          <DialogDescription>
            Forneça credenciais de um administrador do Exchange para autorizar o acesso via certificado.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <p className="text-lg font-medium">Configuração iniciada!</p>
            <p className="text-sm text-muted-foreground mt-2">
              O agent executará os comandos PowerShell em breve.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert className="bg-warning/10 border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <AlertDescription className="text-warning text-sm">
                Essas credenciais são usadas apenas uma vez para executar os comandos de autorização e <strong>não são armazenadas</strong>.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Email do Administrador</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder={`admin@${tenantDomain}`}
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Deve ter a role "Exchange Administrator" no Entra ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha</Label>
              <PasswordInput
                id="admin-password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !adminEmail || !adminPassword}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  'Autorizar'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
