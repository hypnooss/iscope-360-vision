import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePreview } from "@/contexts/PreviewContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
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
import { AgentInstallInstructions } from "@/components/agents/AgentInstallInstructions";

interface Agent {
  id: string;
  name: string;
  client_id: string | null;
  created_at: string;
  last_seen: string | null;
  revoked: boolean;
  activation_code: string | null;
  activation_code_expires_at: string | null;
  agent_version: string | null;
  client_name?: string;
}

interface Client {
  id: string;
  name: string;
}

export default function AgentsPage() {
  const { user, loading: authLoading, isSuperAdmin, isAdmin } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();
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

  // Instructions dialog (pending agents)
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructionsAgent, setInstructionsAgent] = useState<Agent | null>(null);


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

  const fetchData = useCallback(async () => {
    try {
      // Get workspace IDs to filter by (use preview workspaces if in preview mode)
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      // Build queries with optional workspace filtering
      let agentsQuery = supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });
        
      let clientsQuery = supabase
        .from("clients")
        .select("id, name")
        .order("name");

      // Apply workspace filter if in preview mode
      if (workspaceIds && workspaceIds.length > 0) {
        agentsQuery = agentsQuery.in('client_id', workspaceIds);
        clientsQuery = clientsQuery.in('id', workspaceIds);
      }

      const [agentsRes, clientsRes] = await Promise.all([agentsQuery, clientsQuery]);

      if (agentsRes.error) throw agentsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      // Map client names to agents
      const clientMap = new Map((clientsRes.data || []).map((c) => [c.id, c.name]));
      const agentsWithClientNames = ((agentsRes.data as any[]) || []).map((agent) => ({
        ...agent,
        client_name: agent.client_id ? clientMap.get(agent.client_id) : undefined,
      })) as Agent[];

      setAgents(agentsWithClientNames);
      setClients(clientsRes.data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar agents: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [isPreviewMode, previewTarget]);

  useEffect(() => {
    if (user && canAccessPage) {
      fetchData();
      
      // Polling every 5 seconds to keep data synchronized
      const interval = setInterval(() => {
        fetchData();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [user, canAccessPage, fetchData]);

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
    if (!newAgentClientId) {
      toast.error("Cliente é obrigatório");
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

  const openInstructions = (agent: Agent) => {
    setInstructionsAgent(agent);
    setInstructionsOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewAgentName("");
    setNewAgentClientId("");
    setActivationCode(null);
    setActivationExpiresAt(null);
    setCodeCopied(false);
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
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Agents' }]} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Agent</DialogTitle>
                <DialogDescription>
                  {activationCode
                    ? "Agent criado! Copie o código de ativação abaixo."
                    : "Preencha as informações para criar um novo agent."}
                </DialogDescription>
              </DialogHeader>

              {!activationCode ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Nome do Agent *</Label>
                    <Input
                      id="agent-name"
                      placeholder="Ex: Firewall Agent - Matriz"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-client">Cliente *</Label>
                    <Select
                      value={newAgentClientId}
                      onValueChange={(val) => setNewAgentClientId(val)}
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
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Código de Ativação</Label>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono break-all">{activationCode}</code>
                        <Button size="icon" variant="ghost" onClick={handleCopyCode}>
                          {codeCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <AgentInstallInstructions activationCode={activationCode} />

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
              )}

              <DialogFooter>
                {!activationCode ? (
                  <>
                    <Button variant="outline" onClick={handleCloseCreateDialog}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateAgent} disabled={creating}>
                      {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Criar Agent
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleCloseCreateDialog}>Fechar</Button>
                )}
              </DialogFooter>
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
                    <TableHead>Versão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const status = getAgentStatus(agent);
                    const isPendingWithCode =
                      !agent.revoked && !agent.last_seen && !!agent.activation_code;
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
                          {agent.agent_version ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              v{agent.agent_version}
                            </code>
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
                            {isPendingWithCode && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openInstructions(agent)}
                                title="Instruções"
                              >
                                <Bot className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/agents/${agent.id}`)}
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

        {/* Instructions Dialog */}
        <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Instruções de Instalação</DialogTitle>
              <DialogDescription>
                Copie e cole o comando abaixo no servidor Linux para ativar o agent.
              </DialogDescription>
            </DialogHeader>

            {instructionsAgent?.activation_code && (
              <div className="py-2">
                <AgentInstallInstructions activationCode={instructionsAgent.activation_code} />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setInstructionsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

