import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot,
  Plus,
  Loader2,
  Eye,
  Ban,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Building,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agent {
  id: string;
  name: string;
  client_id: string | null;
  created_at: string;
  last_seen: string | null;
  revoked: boolean;
  activation_code: string | null;
  activation_code_expires_at: string | null;
  client_name?: string;
}

interface Client {
  id: string;
  name: string;
}

export default function AgentsPage() {
  const { user, loading: authLoading, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Create agent dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentClientId, setNewAgentClientId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [activationExpiresAt, setActivationExpiresAt] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Details dialog
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [newActivationCode, setNewActivationCode] = useState<{
    id: string;
    code: string;
    expires_at: string;
    used_at: string | null;
  } | null>(null);

  // Revoke dialog
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [agentToRevoke, setAgentToRevoke] = useState<Agent | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
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
      // Fetch agents - using type assertion since tables may not be in types yet
      const { data: agentsData, error: agentsError } = await (supabase
        .from("agents" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);

      if (agentsError) throw agentsError;

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      if (clientsError) throw clientsError;

      // Map client names to agents
      const clientMap = new Map((clientsData || []).map((c) => [c.id, c.name]));
      const agentsWithClientNames = ((agentsData as any[]) || []).map((agent) => ({
        ...agent,
        client_name: agent.client_id ? clientMap.get(agent.client_id) : undefined,
      })) as Agent[];

      setAgents(agentsWithClientNames);
      setClients(clientsData || []);
    } catch (error: any) {
      toast.error("Erro ao carregar agents: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getAgentStatus = (
    agent: Agent,
  ): { label: string; variant: "default" | "success" | "warning" | "destructive" } => {
    if (agent.revoked) {
      return { label: "Revogado", variant: "destructive" };
    }
    if (!agent.last_seen) {
      return { label: "Pendente", variant: "warning" };
    }
    const lastSeenDate = new Date(agent.last_seen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (lastSeenDate > fiveMinutesAgo) {
      return { label: "Online", variant: "success" };
    }
    return { label: "Offline", variant: "default" };
  };

  const generateActivationCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += "-";
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) {
      toast.error("Nome do agent é obrigatório");
      return;
    }

    setCreating(true);
    try {
      // Create activation code (expires in 48h)
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const code = generateActivationCode();

      // Create agent with activation code
      const { data: agentData, error: agentError } = await (supabase
        .from("agents" as any)
        .insert({
          name: newAgentName.trim(),
          client_id: newAgentClientId || null,
          created_by: user!.id,
          activation_code: code,
          activation_code_expires_at: expiresAt,
        })
        .select()
        .single() as any);

      if (agentError) throw agentError;

      setActivationCode(code);
      setActivationExpiresAt(expiresAt);
      toast.success("Agent criado com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao criar agent: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (activationCode) {
      await navigator.clipboard.writeText(activationCode);
      setCodeCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewAgentName("");
    setNewAgentClientId("");
    setActivationCode(null);
    setActivationExpiresAt(null);
    setCodeCopied(false);
  };

  const handleViewDetails = (agent: Agent) => {
    setSelectedAgent(agent);
    setNewActivationCode(null);
    setDetailsDialogOpen(true);
  };

  const handleGenerateNewCode = async () => {
    if (!selectedAgent) return;

    setGeneratingCode(true);
    try {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const code = generateActivationCode();

      // Update agent with new activation code
      const { error: updateError } = await (supabase
        .from("agents" as any)
        .update({
          activation_code: code,
          activation_code_expires_at: expiresAt,
        })
        .eq("id", selectedAgent.id) as any);

      if (updateError) throw updateError;

      setNewActivationCode({
        id: selectedAgent.id,
        code: code,
        expires_at: expiresAt,
        used_at: null,
      });

      toast.success("Novo código de ativação gerado!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao gerar código: " + error.message);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyNewCode = async () => {
    if (newActivationCode) {
      await navigator.clipboard.writeText(newActivationCode.code);
      toast.success("Código copiado!");
    }
  };

  const handleRevokeAgent = async () => {
    if (!agentToRevoke) return;

    setRevoking(true);
    try {
      // Revoke agent and clear activation code
      const { error: agentError } = await (supabase
        .from("agents" as any)
        .update({
          revoked: true,
          activation_code: null,
          activation_code_expires_at: null,
        })
        .eq("id", agentToRevoke.id) as any);

      if (agentError) throw agentError;

      toast.success("Agent revogado com sucesso!");
      setRevokeDialogOpen(false);
      setAgentToRevoke(null);
      setDetailsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao revogar agent: " + error.message);
    } finally {
      setRevoking(false);
    }
  };

  const openRevokeDialog = (agent: Agent) => {
    setAgentToRevoke(agent);
    setRevokeDialogOpen(true);
  };

  const openDeleteDialog = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteConfirmName("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete || deleteConfirmName !== agentToDelete.name) return;

    setDeleting(true);
    try {
      const { error } = await (supabase
        .from("agents" as any)
        .delete()
        .eq("id", agentToDelete.id) as any);

      if (error) throw error;

      toast.success("Agent deletado com sucesso!");
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
      setDeleteConfirmName("");
      setDetailsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao deletar agent: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !canAccessPage) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agents</h1>
            <p className="text-muted-foreground">Gerencie todos os agents externos do sistema</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Agent</DialogTitle>
                <DialogDescription>
                  {activationCode
                    ? "Agent criado! Copie o código de ativação abaixo."
                    : "Preencha as informações para criar um novo agent."}
                </DialogDescription>
              </DialogHeader>

              {!activationCode ? (
                <>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="agent-name">Nome do Agent</Label>
                      <Input
                        id="agent-name"
                        placeholder="Ex: Firewall Agent - Matriz"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="agent-client">Cliente (opcional)</Label>
                      <Select
                        value={newAgentClientId || "none"}
                        onValueChange={(val) => setNewAgentClientId(val === "none" ? "" : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseCreateDialog}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateAgent} disabled={creating}>
                      {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Criar Agent
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="py-4 space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <Label className="text-xs text-muted-foreground mb-2 block">Código de Ativação</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono break-all">{activationCode}</code>
                        <Button size="icon" variant="ghost" onClick={handleCopyCode}>
                          {codeCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-warning">
                      <Clock className="w-4 h-4" />
                      <span>
                        Este código expira em{" "}
                        {formatDistanceToNow(new Date(activationExpiresAt!), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use este código durante a instalação do agent. Após a ativação, o código não poderá mais ser
                      utilizado.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseCreateDialog}>Fechar</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Agents Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Lista de Agents
            </CardTitle>
            <CardDescription>{agents.length} agent(s) registrado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum agent encontrado</p>
                <p className="text-sm">Crie um agent para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const status = getAgentStatus(agent);
                    return (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{agent.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {agent.client_name ? (
                            <Badge variant="secondary" className="text-xs">
                              <Building className="w-3 h-3 mr-1" />
                              {agent.client_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              status.variant === "success"
                                ? "default"
                                : status.variant === "destructive"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={
                              status.variant === "success"
                                ? "bg-success/10 text-success hover:bg-success/20"
                                : status.variant === "warning"
                                  ? "bg-warning/10 text-warning hover:bg-warning/20"
                                  : ""
                            }
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {agent.last_seen
                            ? formatDistanceToNow(new Date(agent.last_seen), { locale: ptBR, addSuffix: true })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(agent)}
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!agent.revoked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openRevokeDialog(agent)}
                                title="Revogar agent"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            {agent.revoked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(agent)}
                                title="Deletar agent"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Agent</DialogTitle>
              <DialogDescription>Informações e gerenciamento do agent</DialogDescription>
            </DialogHeader>

            {selectedAgent && (
              <div className="space-y-4 py-4">
                {/* Agent Info Grid */}
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{selectedAgent.name}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <Badge
                        variant={
                          getAgentStatus(selectedAgent).variant === "success"
                            ? "default"
                            : getAgentStatus(selectedAgent).variant === "destructive"
                              ? "destructive"
                              : "secondary"
                        }
                        className={
                          getAgentStatus(selectedAgent).variant === "success"
                            ? "bg-success/10 text-success"
                            : getAgentStatus(selectedAgent).variant === "warning"
                              ? "bg-warning/10 text-warning"
                              : ""
                        }
                      >
                        {getAgentStatus(selectedAgent).label}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-sm">
                        {selectedAgent.client_name || <span className="text-muted-foreground">—</span>}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Criado em</Label>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-sm">{new Date(selectedAgent.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Seen</Label>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-sm">
                        {selectedAgent.last_seen ? new Date(selectedAgent.last_seen).toLocaleString("pt-BR") : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Agent ID</Label>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <code className="text-xs font-mono break-all text-muted-foreground">{selectedAgent.id}</code>
                  </div>
                </div>

                {/* Activation Code Section */}
                {!selectedAgent.revoked && (
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between mb-3">
                      <Label>Código de Ativação</Label>
                      <Button size="sm" variant="outline" onClick={handleGenerateNewCode} disabled={generatingCode}>
                        {generatingCode ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Gerar novo código
                      </Button>
                    </div>
                    {newActivationCode ? (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm font-mono break-all">{newActivationCode.code}</code>
                          <Button size="icon" variant="ghost" onClick={handleCopyNewCode}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-warning flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expira em{" "}
                          {formatDistanceToNow(new Date(newActivationCode.expires_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Gere um novo código para reativar este agent se necessário.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                Fechar
              </Button>
              {selectedAgent && !selectedAgent.revoked && (
                <Button variant="destructive" onClick={() => openRevokeDialog(selectedAgent)}>
                  <Ban className="w-4 h-4 mr-2" />
                  Revogar Agent
                </Button>
              )}
              {selectedAgent && selectedAgent.revoked && (
                <Button variant="destructive" onClick={() => openDeleteDialog(selectedAgent)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deletar Agent
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke Confirmation Dialog */}
        <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar Agent</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja revogar o agent "{agentToRevoke?.name}"? Esta ação invalidará todos os tokens do
                agent e ele não poderá mais se conectar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevokeAgent}
                disabled={revoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Revogar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Deletar Agent
              </DialogTitle>
              <DialogDescription>
                Esta ação é permanente e não pode ser desfeita. Todos os dados do agent serão removidos.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium">Para confirmar, digite o nome do agent:</p>
                <p className="text-sm font-mono mt-1">{agentToDelete?.name}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="delete-confirm-name">Nome do Agent</Label>
                <Input
                  id="delete-confirm-name"
                  placeholder="Digite o nome para confirmar"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setAgentToDelete(null);
                  setDeleteConfirmName("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAgent}
                disabled={deleting || deleteConfirmName !== agentToDelete?.name}
              >
                {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Deletar Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
