import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Building, Plus, Loader2, MoreVertical, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  scopes_count?: number;
  agents_count?: number;
}

export default function ClientsPage() {
  const { user, loading: authLoading, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Create client dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientDescription, setNewClientDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editClientDescription, setEditClientDescription] = useState("");
  const [editing, setEditing] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canAccessPage = isSuperAdmin() || isAdmin();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && !canAccessPage) {
      navigate("/dashboard");
      toast.error("Acesso não autorizado");
    }
  }, [user, authLoading, navigate, canAccessPage]);

  useEffect(() => {
    if (user && canAccessPage) {
      fetchData();
    }
  }, [user, canAccessPage]);

  const fetchData = async () => {
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase.from("clients").select("*").order("name");

      if (clientsError) throw clientsError;

      // Fetch counts for each client (scopes = firewalls + m365_tenants, agents)
      const clientsWithCounts = await Promise.all(
        (clientsData || []).map(async (client) => {
          const [firewallsResult, tenantsResult, agentsResult] = await Promise.all([
            supabase.from("firewalls").select("id", { count: "exact", head: true }).eq("client_id", client.id),
            supabase.from("m365_tenants").select("id", { count: "exact", head: true }).eq("client_id", client.id),
            supabase.from("agents").select("id", { count: "exact", head: true }).eq("client_id", client.id),
          ]);

          return {
            ...client,
            scopes_count: (firewallsResult.count || 0) + (tenantsResult.count || 0),
            agents_count: agentsResult.count || 0,
          };
        }),
      );

      setClients(clientsWithCounts);
    } catch (error: unknown) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar workspaces");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from("clients").insert({
        name: newClientName.trim(),
        description: newClientDescription.trim() || null,
      });

      if (error) throw error;

      toast.success("Workspace criado com sucesso");
      setCreateDialogOpen(false);
      setNewClientName("");
      setNewClientDescription("");
      fetchData();
    } catch (error: unknown) {
      console.error("Erro ao criar workspace:", error);
      toast.error("Erro ao criar workspace");
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setEditClientName(client.name);
    setEditClientDescription(client.description || "");
    setEditDialogOpen(true);
  };

  const handleEditClient = async () => {
    if (!editingClient || !editClientName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setEditing(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          name: editClientName.trim(),
          description: editClientDescription.trim() || null,
        })
        .eq("id", editingClient.id);

      if (error) throw error;

      toast.success("Workspace atualizado com sucesso");
      setEditDialogOpen(false);
      setEditingClient(null);
      fetchData();
    } catch (error: unknown) {
      console.error("Erro ao atualizar workspace:", error);
      toast.error("Erro ao atualizar workspace");
    } finally {
      setEditing(false);
    }
  };

  const openDeleteDialog = (client: Client) => {
    setClientToDelete(client);
    setDeleteConfirmName("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    if (deleteConfirmName !== clientToDelete.name) {
      toast.error("Nome do workspace não confere");
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", clientToDelete.id);

      if (error) throw error;

      toast.success("Workspace deletado com sucesso");
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      setDeleteConfirmName("");
      fetchData();
    } catch (error: unknown) {
      console.error("Erro ao deletar workspace:", error);
      toast.error("Erro ao deletar workspace. Verifique se não há escopos ou agents associados.");
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
            <p className="text-muted-foreground">Gerencie todos os workspaces do sistema</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Workspace</DialogTitle>
                <DialogDescription>Adicione um novo workspace à plataforma</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Nome *</Label>
                  <Input
                    id="client-name"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ex: Empresa ABC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-description">Descrição</Label>
                  <Textarea
                    id="client-description"
                    value={newClientDescription}
                    onChange={(e) => setNewClientDescription(e.target.value)}
                    placeholder="Descrição opcional do workspace"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateClient} disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Workspaces Table */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Lista de Workspaces
            </CardTitle>
            <CardDescription>{clients.length} workspace(s) registrado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum workspace cadastrado</p>
                <p className="text-sm">Clique em "Novo Workspace" para adicionar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead className="text-center">Escopos</TableHead>
                    <TableHead className="text-center">Agents</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{client.id}</TableCell>
                      <TableCell className="text-center">{client.scopes_count}</TableCell>
                      <TableCell className="text-center">{client.agents_count}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(client.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(client)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(client)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Deletar
                            </DropdownMenuItem>
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
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Workspace</DialogTitle>
              <DialogDescription>Atualize as informações do workspace</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-client-name">Nome *</Label>
                <Input
                  id="edit-client-name"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-client-description">Descrição</Label>
                <Textarea
                  id="edit-client-description"
                  value={editClientDescription}
                  onChange={(e) => setEditClientDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditClient} disabled={editing}>
                {editing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deletar Workspace</DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. Para confirmar, digite o nome do workspace:{" "}
                <strong>{clientToDelete?.name}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="delete-confirm-name">Nome do workspace</Label>
                <Input
                  id="delete-confirm-name"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="Digite o nome do workspace para confirmar"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteClient}
                disabled={deleting || deleteConfirmName !== clientToDelete?.name}
              >
                {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Deletar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
