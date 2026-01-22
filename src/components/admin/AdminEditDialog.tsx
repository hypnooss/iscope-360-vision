import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  User,
  History,
  ShieldCheck,
  HeadsetIcon,
  UserPlus,
  UserMinus,
  Settings,
  Building,
  Shield,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type AdminRole = "super_admin" | "super_suporte";

interface Administrator {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AdminRole;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  action_type: string;
  target_type: string | null;
  target_name: string | null;
  details: unknown;
  created_at: string;
}

interface AdminEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: Administrator | null;
  onSaved: () => void;
  currentUserId?: string;
}

const ADMIN_ROLES: { value: AdminRole; label: string; description: string }[] = [
  { 
    value: "super_admin", 
    label: "Super Admin",
    description: "Acesso total ao sistema, incluindo gerenciamento de outros administradores"
  },
  { 
    value: "super_suporte", 
    label: "Super Suporte",
    description: "Acesso de visualização e suporte, sem permissões de gerenciamento"
  },
];

const ACTION_TYPE_CONFIG: Record<string, { icon: typeof User; color: string; label: string }> = {
  user_management: { icon: UserPlus, color: "text-blue-500", label: "Usuários" },
  admin_management: { icon: Shield, color: "text-amber-500", label: "Administração" },
  client_management: { icon: Building, color: "text-green-500", label: "Clientes" },
  system: { icon: Settings, color: "text-purple-500", label: "Sistema" },
  general: { icon: AlertCircle, color: "text-muted-foreground", label: "Geral" },
};

export function AdminEditDialog({
  open,
  onOpenChange,
  admin,
  onSaved,
  currentUserId,
}: AdminEditDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Form states
  const [formFullName, setFormFullName] = useState("");
  const [formRole, setFormRole] = useState<AdminRole>("super_suporte");
  
  // Activity logs
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const isEditingSelf = admin?.id === currentUserId;

  useEffect(() => {
    if (admin && open) {
      setFormFullName(admin.full_name || "");
      setFormRole(admin.role);
      setActiveTab("profile");
      fetchActivityLogs();
    }
  }, [admin, open]);

  const fetchActivityLogs = async () => {
    if (!admin) return;
    
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("admin_activity_logs")
        .select("*")
        .eq("admin_id", admin.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSave = async () => {
    if (!admin) return;

    try {
      setSaving(true);

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: formFullName })
        .eq("id", admin.id);

      if (profileError) throw profileError;

      // Update role if changed and not editing self
      if (formRole !== admin.role && !isEditingSelf) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: formRole })
          .eq("user_id", admin.id);

        if (roleError) throw roleError;

        // Log the role change
        await supabase.from("admin_activity_logs").insert({
          admin_id: currentUserId,
          action: `Alterou a role de ${admin.full_name || admin.email} para ${formRole === "super_admin" ? "Super Admin" : "Super Suporte"}`,
          action_type: "admin_management",
          target_type: "admin",
          target_id: admin.id,
          target_name: admin.full_name || admin.email,
          details: { old_role: admin.role, new_role: formRole },
        });
      }

      toast({
        title: "Sucesso",
        description: "Administrador atualizado com sucesso.",
      });

      onSaved();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Error updating administrator:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o administrador.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: AdminRole) => {
    if (role === "super_admin") {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
          <ShieldCheck className="w-3 h-3 mr-1" />
          Super Admin
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-500 hover:bg-purple-600 text-white">
        <HeadsetIcon className="w-3 h-3 mr-1" />
        Super Suporte
      </Badge>
    );
  };

  const getActionIcon = (actionType: string) => {
    const config = ACTION_TYPE_CONFIG[actionType] || ACTION_TYPE_CONFIG.general;
    const Icon = config.icon;
    return <Icon className={`w-4 h-4 ${config.color}`} />;
  };

  if (!admin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="block">Editar Administrador</span>
              <span className="text-sm font-normal text-muted-foreground">
                {admin.email}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edite as informações do administrador
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger
              value="profile"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <User className="w-4 h-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <History className="w-4 h-4 mr-2" />
              Atividades
              {activityLogs.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {activityLogs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <TabsContent value="profile" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-6 px-1 pr-4">

                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Informações Pessoais
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <Input
                          id="fullName"
                          value={formFullName}
                          onChange={(e) => setFormFullName(e.target.value)}
                          placeholder="Nome do administrador"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={admin.email}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          O email não pode ser alterado
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Role Management */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Role e Permissões
                    </h3>

                    {isEditingSelf ? (
                      <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-600">
                              Você não pode alterar sua própria role
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Por segurança, outro Super Admin deve fazer essa alteração.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select 
                            value={formRole} 
                            onValueChange={(v) => setFormRole(v as AdminRole)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ADMIN_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  <div className="flex flex-col">
                                    <span>{role.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Role Description */}
                        <div className="p-3 rounded-lg bg-muted/50 border">
                          <p className="text-sm text-muted-foreground">
                            {ADMIN_ROLES.find(r => r.value === formRole)?.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="activity" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="px-1 pr-4">
                  {loadingLogs ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <History className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma atividade registrada
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        As ações realizadas por este administrador aparecerão aqui
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                      
                      <div className="space-y-4">
                        {activityLogs.map((log, index) => (
                          <div key={log.id} className="relative pl-10">
                            {/* Timeline dot */}
                            <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-background bg-primary" />
                            
                            <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  {getActionIcon(log.action_type)}
                                  <div>
                                    <p className="text-sm">{log.action}</p>
                                    {log.target_name && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Alvo: {log.target_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(log.created_at), {
                                      addSuffix: true,
                                      locale: ptBR,
                                    })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(log.created_at), "HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
