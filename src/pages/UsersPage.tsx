import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Users, Edit, Shield, Loader2, Building, Layers, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { InviteUserDialog } from '@/components/InviteUserDialog';

type AppRole = 'super_admin' | 'admin' | 'user';
type ModulePermission = 'view' | 'edit' | 'full';
type ScopeModule = 'scope_firewall' | 'scope_network' | 'scope_cloud';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role?: AppRole;
  permissions?: Record<string, ModulePermission>;
  client_ids?: string[];
  module_ids?: string[];
}

interface Client {
  id: string;
  name: string;
}

interface Module {
  id: string;
  code: ScopeModule;
  name: string;
}

const MODULES = ['dashboard', 'firewall', 'reports'] as const;

const SCOPE_MODULE_LABELS: Record<ScopeModule, string> = {
  scope_firewall: 'Scope Firewall',
  scope_network: 'Scope Network',
  scope_cloud: 'Scope Cloud',
};

export default function UsersPage() {
  const { user, loading: authLoading, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [myClientIds, setMyClientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('user');
  const [editPermissions, setEditPermissions] = useState<Record<string, ModulePermission>>({});
  const [editClientIds, setEditClientIds] = useState<string[]>([]);
  const [editModuleIds, setEditModuleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canAccessPage = isSuperAdmin() || isAdmin();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !canAccessPage) {
      navigate('/dashboard');
      toast.error('Acesso não autorizado');
    }
  }, [user, authLoading, navigate, canAccessPage]);

  useEffect(() => {
    if (user && canAccessPage) {
      fetchData();
    }
  }, [user, canAccessPage]);

  const fetchData = async () => {
    try {
      // First, get my client associations if I'm an admin (not super admin)
      let adminClientIds: string[] = [];
      if (!isSuperAdmin()) {
        const { data: myClients } = await supabase
          .from('user_clients')
          .select('client_id')
          .eq('user_id', user!.id);
        
        adminClientIds = (myClients || []).map(c => c.client_id);
        setMyClientIds(adminClientIds);
      }

      // Fetch profiles - RLS will filter based on permissions
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch roles - RLS will filter
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Fetch permissions - RLS will filter
      const { data: permissions } = await supabase
        .from('user_module_permissions')
        .select('user_id, module_name, permission');

      // Fetch user-client associations - RLS will filter
      const { data: userClients } = await supabase
        .from('user_clients')
        .select('user_id, client_id');

      // Fetch user-module associations
      const { data: userModules } = await supabase
        .from('user_modules')
        .select('user_id, module_id');

      // Fetch clients I have access to
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      // Fetch available modules
      const { data: modulesData } = await supabase
        .from('modules')
        .select('id, code, name')
        .eq('is_active', true);

      // Merge data
      const mergedUsers: UserProfile[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        const userPerms = permissions?.filter((p) => p.user_id === profile.id) || [];
        const userClientAssocs = userClients?.filter((uc) => uc.user_id === profile.id) || [];
        const userModuleAssocs = userModules?.filter((um) => um.user_id === profile.id) || [];

        const permsObj: Record<string, ModulePermission> = {};
        userPerms.forEach((p) => {
          permsObj[p.module_name] = p.permission as ModulePermission;
        });

        return {
          ...profile,
          role: (userRole?.role as AppRole) || 'user',
          permissions: permsObj,
          client_ids: userClientAssocs.map((uc) => uc.client_id),
          module_ids: userModuleAssocs.map((um) => um.module_id),
        };
      });

      setUsers(mergedUsers);
      setClients(clientsData || []);
      setModules((modulesData || []) as Module[]);
    } catch (error: any) {
      toast.error('Erro ao carregar usuários: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (userProfile: UserProfile) => {
    setEditingUser(userProfile);
    setEditRole(userProfile.role || 'user');
    setEditPermissions(userProfile.permissions || {});
    setEditClientIds(userProfile.client_ids || []);
    setEditModuleIds(userProfile.module_ids || []);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      // Update role
      await supabase
        .from('user_roles')
        .upsert({ user_id: editingUser.id, role: editRole }, { onConflict: 'user_id,role' });

      // If role changed, delete old role first
      if (editingUser.role !== editRole) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editingUser.id)
          .neq('role', editRole);
      }

      // Update permissions
      for (const module of MODULES) {
        const perm = editPermissions[module] || 'view';
        await supabase
          .from('user_module_permissions')
          .upsert(
            { user_id: editingUser.id, module_name: module, permission: perm },
            { onConflict: 'user_id,module_name' }
          );
      }

      // Update client associations
      await supabase.from('user_clients').delete().eq('user_id', editingUser.id);
      if (editClientIds.length > 0) {
        await supabase.from('user_clients').insert(
          editClientIds.map((clientId) => ({ user_id: editingUser.id, client_id: clientId }))
        );
      }

      // Update module associations
      await supabase.from('user_modules').delete().eq('user_id', editingUser.id);
      if (editRole !== 'super_admin' && editModuleIds.length > 0) {
        await supabase.from('user_modules').insert(
          editModuleIds.map((moduleId) => ({ user_id: editingUser.id, module_id: moduleId }))
        );
      }

      toast.success('Usuário atualizado com sucesso!');
      setEditingUser(null);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    try {
      // Delete user-related data in order
      await supabase.from('user_module_permissions').delete().eq('user_id', deletingUser.id);
      await supabase.from('user_modules').delete().eq('user_id', deletingUser.id);
      await supabase.from('user_clients').delete().eq('user_id', deletingUser.id);
      await supabase.from('user_roles').delete().eq('user_id', deletingUser.id);
      await supabase.from('profiles').delete().eq('id', deletingUser.id);

      toast.success('Usuário excluído com sucesso!');
      setDeletingUser(null);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir usuário: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-primary/10 text-primary">Super Admin</Badge>;
      case 'admin':
        return <Badge className="bg-warning/10 text-warning">Admin</Badge>;
      default:
        return <Badge variant="outline">Usuário</Badge>;
    }
  };

  const getPermissionLabel = (perm: ModulePermission) => {
    switch (perm) {
      case 'full':
        return 'Completo';
      case 'edit':
        return 'Editar';
      default:
        return 'Visualizar';
    }
  };

  const toggleClient = (clientId: string) => {
    if (editClientIds.includes(clientId)) {
      setEditClientIds(editClientIds.filter((id) => id !== clientId));
    } else {
      setEditClientIds([...editClientIds, clientId]);
    }
  };

  const toggleModule = (moduleId: string) => {
    if (editModuleIds.includes(moduleId)) {
      setEditModuleIds(editModuleIds.filter((id) => id !== moduleId));
    } else {
      setEditModuleIds([...editModuleIds, moduleId]);
    }
  };

  // Get client names for a user
  const getClientNames = (clientIds: string[] | undefined) => {
    if (!clientIds || clientIds.length === 0) return [];
    return clients
      .filter(c => clientIds.includes(c.id))
      .map(c => c.name);
  };

  // Get module names for a user
  const getModuleNames = (moduleIds: string[] | undefined) => {
    if (!moduleIds || moduleIds.length === 0) return [];
    return modules
      .filter(m => moduleIds.includes(m.id))
      .map(m => SCOPE_MODULE_LABELS[m.code] || m.name);
  };

  // Check if current user can edit this user
  const canEditUser = (targetUser: UserProfile): boolean => {
    // Can't edit yourself
    if (targetUser.id === user?.id) return false;
    
    // Super admin can edit anyone except other super admins
    if (isSuperAdmin()) {
      return targetUser.role !== 'super_admin';
    }
    
    // Admin can edit users but not super admins or other admins
    if (isAdmin()) {
      return targetUser.role === 'user';
    }
    
    return false;
  };

  // Get available roles for dropdown based on current user's role
  const getAvailableRoles = (): { value: AppRole; label: string }[] => {
    if (isSuperAdmin()) {
      return [
        { value: 'user', label: 'Usuário' },
        { value: 'admin', label: 'Admin' },
        { value: 'super_admin', label: 'Super Admin' },
      ];
    }
    // Admin can only assign user role
    return [
      { value: 'user', label: 'Usuário' },
    ];
  };

  // Get clients that current user can assign to others
  const getAssignableClients = (): Client[] => {
    if (isSuperAdmin()) {
      return clients;
    }
    // Admin can only assign their own clients
    return clients.filter(c => myClientIds.includes(c.id));
  };

  if (authLoading || !canAccessPage) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
            <p className="text-muted-foreground">
              {isSuperAdmin() 
                ? 'Gerencie todos os usuários e permissões do sistema' 
                : 'Gerencie usuários dos seus clientes'
              }
            </p>
          </div>
          <InviteUserDialog 
            clients={clients} 
            myClientIds={myClientIds}
            onUserCreated={fetchData}
          />
        </div>

        {/* Users Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Usuários
            </CardTitle>
            <CardDescription>
              {users.length} usuário(s) {!isSuperAdmin() && 'nos seus clientes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum usuário encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Módulos</TableHead>
                    <TableHead>Clientes</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.full_name || 'Sem nome'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(u.role || 'user')}</TableCell>
                      <TableCell>
                        {u.role === 'super_admin' ? (
                          <span className="text-xs text-muted-foreground">Todos</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {getModuleNames(u.module_ids).slice(0, 2).map((name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                <Layers className="w-3 h-3 mr-1" />
                                {name}
                              </Badge>
                            ))}
                            {(u.module_ids?.length || 0) > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(u.module_ids?.length || 0) - 2}
                              </Badge>
                            )}
                            {(u.module_ids?.length || 0) === 0 && (
                              <span className="text-xs text-muted-foreground">Nenhum</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.role === 'super_admin' ? (
                          <span className="text-xs text-muted-foreground">Todos</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {getClientNames(u.client_ids).slice(0, 2).map((name, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                <Building className="w-3 h-3 mr-1" />
                                {name}
                              </Badge>
                            ))}
                            {(u.client_ids?.length || 0) > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(u.client_ids?.length || 0) - 2}
                              </Badge>
                            )}
                            {(u.client_ids?.length || 0) === 0 && (
                              <span className="text-xs text-muted-foreground">Nenhum</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border shadow-md">
                            {canEditUser(u) ? (
                              <>
                                <DropdownMenuItem onClick={() => openEditDialog(u)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeletingUser(u)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem disabled className="text-muted-foreground">
                                {u.id === user?.id 
                                  ? 'Não é possível editar seu próprio usuário' 
                                  : 'Sem permissão para editar'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Editar Permissões
              </DialogTitle>
              <DialogDescription>
                {editingUser?.full_name || editingUser?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Role */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isSuperAdmin() && (
                  <p className="text-xs text-muted-foreground">
                    Como Admin, você só pode atribuir o role de Usuário
                  </p>
                )}
              </div>

              {/* Scope Modules Access */}
              {editRole !== 'super_admin' && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Módulos com Acesso
                  </Label>
                  <div className="space-y-2 border rounded-lg p-3">
                    {modules.map((mod) => (
                      <div key={mod.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-mod-${mod.id}`}
                          checked={editModuleIds.includes(mod.id)}
                          onCheckedChange={() => toggleModule(mod.id)}
                        />
                        <label htmlFor={`edit-mod-${mod.id}`} className="text-sm cursor-pointer">
                          {SCOPE_MODULE_LABELS[mod.code] || mod.name}
                        </label>
                      </div>
                    ))}
                    {modules.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum módulo disponível</p>
                    )}
                  </div>
                </div>
              )}

              {/* Module Permissions */}
              <div className="space-y-3">
                <Label>Permissões por Área</Label>
                {MODULES.map((mod) => (
                  <div key={mod} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{mod === 'firewall' ? 'Scope Firewall' : mod}</span>
                    <Select
                      value={editPermissions[mod] || 'view'}
                      onValueChange={(v) =>
                        setEditPermissions({ ...editPermissions, [mod]: v as ModulePermission })
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
              {editRole !== 'super_admin' && (
                <div className="space-y-3">
                  <Label>Acesso a Clientes</Label>
                  <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3">
                    {getAssignableClients().map((client) => (
                      <div key={client.id} className="flex items-center gap-2">
                        <Checkbox
                          id={client.id}
                          checked={editClientIds.includes(client.id)}
                          onCheckedChange={() => toggleClient(client.id)}
                        />
                        <label htmlFor={client.id} className="text-sm cursor-pointer">
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

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o usuário{' '}
                <strong>{deletingUser?.full_name || deletingUser?.email}</strong>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteUser} 
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
