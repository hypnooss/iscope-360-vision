import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Loader2, UserPlus, Building, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

type AppRole = 'super_admin' | 'super_suporte' | 'workspace_admin' | 'user';
type ModulePermission = 'view' | 'edit' | 'full';
type ScopeModule = 'scope_firewall' | 'scope_network' | 'scope_cloud';

interface Client {
  id: string;
  name: string;
}

interface Module {
  id: string;
  code: ScopeModule;
  name: string;
}

interface InviteUserDialogProps {
  clients: Client[];
  myClientIds?: string[];
  onUserCreated: () => void;
}

const MODULES = ['dashboard', 'firewall', 'reports'] as const;

const SCOPE_MODULE_LABELS: Record<ScopeModule, string> = {
  scope_firewall: 'Scope Firewall',
  scope_network: 'Scope Network',
  scope_cloud: 'Scope Cloud',
};

const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export function InviteUserDialog({ clients, myClientIds = [], onUserCreated }: InviteUserDialogProps) {
  const { isSuperAdmin, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableModules, setAvailableModules] = useState<Module[]>([]);

  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AppRole>('user');
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({
    dashboard: 'view',
    firewall: 'view',
    reports: 'view',
  });
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);

  // Fetch available modules
  useEffect(() => {
    const fetchModules = async () => {
      const { data } = await supabase
        .from('modules')
        .select('id, code, name')
        .eq('is_active', true);
      setAvailableModules((data || []) as Module[]);
    };
    fetchModules();
  }, []);

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setPassword('');
    setRole('user');
    setPermissions({
      dashboard: 'view',
      firewall: 'view',
      reports: 'view',
    });
    setSelectedClientIds([]);
    setSelectedModuleIds([]);
  };

  const toggleModule = (moduleId: string) => {
    if (selectedModuleIds.includes(moduleId)) {
      setSelectedModuleIds(selectedModuleIds.filter((id) => id !== moduleId));
    } else {
      setSelectedModuleIds([...selectedModuleIds, moduleId]);
    }
  };

  const handleSubmit = async () => {
    const validation = inviteSchema.safeParse({ email, fullName, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (role !== 'super_admin' && selectedClientIds.length === 0) {
      toast.error('Selecione pelo menos um cliente para o usuário');
      return;
    }

    if (role !== 'super_admin' && selectedModuleIds.length === 0) {
      toast.error('Selecione pelo menos um módulo para o usuário');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          fullName,
          role,
          permissions,
          clientIds: role === 'super_admin' ? [] : selectedClientIds,
          moduleIds: role === 'super_admin' ? [] : selectedModuleIds,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Usuário criado com sucesso!');
      setOpen(false);
      resetForm();
      onUserCreated();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Erro ao criar usuário: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const toggleClient = (clientId: string) => {
    if (selectedClientIds.includes(clientId)) {
      setSelectedClientIds(selectedClientIds.filter((id) => id !== clientId));
    } else {
      setSelectedClientIds([...selectedClientIds, clientId]);
    }
  };

const getAvailableRoles = (): { value: AppRole; label: string }[] => {
    if (isSuperAdmin()) {
      return [
        { value: 'user', label: 'Usuário' },
        { value: 'workspace_admin', label: 'Workspace Admin' },
      ];
    }
    return [{ value: 'user', label: 'Usuário' }];
  };

  const getAssignableClients = (): Client[] => {
    if (isSuperAdmin()) {
      return clients;
    }
    return clients.filter((c) => myClientIds.includes(c.id));
  };

  if (!isSuperAdmin() && !isAdmin()) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Criar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo usuário na plataforma
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 py-4 pr-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome do usuário"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Senha Inicial</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableRoles().map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isSuperAdmin() && (
              <p className="text-xs text-muted-foreground">
                Como Workspace Admin, você só pode criar usuários com role Usuário
              </p>
            )}
          </div>

          {/* Scope Modules Access */}
          {role !== 'super_admin' && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Módulos com Acesso
              </Label>
              <div className="space-y-2 border rounded-lg p-3">
                {availableModules.map((mod) => (
                  <div key={mod.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`mod-${mod.id}`}
                      checked={selectedModuleIds.includes(mod.id)}
                      onCheckedChange={() => toggleModule(mod.id)}
                    />
                    <label htmlFor={`mod-${mod.id}`} className="text-sm cursor-pointer">
                      {SCOPE_MODULE_LABELS[mod.code] || mod.name}
                    </label>
                  </div>
                ))}
                {availableModules.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum módulo disponível</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione os módulos que o usuário terá acesso
              </p>
            </div>
          )}

          {/* Module Permissions */}
          <div className="space-y-3">
            <Label>Permissões por Área</Label>
            {MODULES.map((mod) => (
              <div key={mod} className="flex items-center justify-between">
                <span className="text-sm capitalize">{mod === 'firewall' ? 'Scope Firewall' : mod}</span>
                <Select
                  value={permissions[mod] || 'view'}
                  onValueChange={(v) =>
                    setPermissions({ ...permissions, [mod]: v as ModulePermission })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Visualizar</SelectItem>
                    <SelectItem value="edit">Editar</SelectItem>
                    <SelectItem value="full">Completo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Client Access */}
          {role !== 'super_admin' && (
            <div className="space-y-3">
              <Label>Acesso a Clientes</Label>
              <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3">
                {getAssignableClients().map((client) => (
                  <div key={client.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`new-${client.id}`}
                      checked={selectedClientIds.includes(client.id)}
                      onCheckedChange={() => toggleClient(client.id)}
                    />
                    <label htmlFor={`new-${client.id}`} className="text-sm cursor-pointer flex items-center gap-1">
                      <Building className="w-3 h-3 text-muted-foreground" />
                      {client.name}
                    </label>
                  </div>
                ))}
                {getAssignableClients().length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isSuperAdmin() ? 'Nenhum cliente cadastrado' : 'Você não possui clientes atribuídos'}
                  </p>
                )}
              </div>
              {!isSuperAdmin() && (
                <p className="text-xs text-muted-foreground">
                  Você só pode atribuir clientes aos quais você tem acesso
                </p>
              )}
            </div>
          )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Criar Usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
