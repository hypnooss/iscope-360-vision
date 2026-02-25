import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Send, Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgentCommand {
  id: string;
  agent_id: string;
  command: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  timeout_seconds: number;
}

interface RemoteTerminalProps {
  agentId: string;
  agentName: string;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "Pendente", icon: <Clock className="w-3 h-3" />, color: "bg-warning/10 text-warning" },
  running: { label: "Executando", icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "bg-primary/10 text-primary" },
  completed: { label: "Concluído", icon: <CheckCircle className="w-3 h-3" />, color: "bg-success/10 text-success" },
  failed: { label: "Falhou", icon: <XCircle className="w-3 h-3" />, color: "bg-destructive/10 text-destructive" },
  timeout: { label: "Timeout", icon: <AlertTriangle className="w-3 h-3" />, color: "bg-warning/10 text-warning" },
};

export function RemoteTerminal({ agentId, agentName }: RemoteTerminalProps) {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSuperAdminUser = isSuperAdmin();

  // Fetch recent commands
  const { data: commands = [] } = useQuery({
    queryKey: ['agent-commands', agentId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('agent_commands' as any)
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50) as any);

      if (error) throw error;
      return (data || []) as AgentCommand[];
    },
    refetchInterval: (query) => {
      // Poll every 2s if there are pending/running commands
      const cmds = query.state.data as AgentCommand[] | undefined;
      const hasActive = cmds?.some(c => c.status === 'pending' || c.status === 'running');
      return hasActive ? 2000 : 10000;
    },
    enabled: isSuperAdminUser,
  });

  // Send command mutation
  const sendCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const { error } = await (supabase
        .from('agent_commands' as any)
        .insert({
          agent_id: agentId,
          command: cmd,
          created_by: user?.id,
          status: 'pending',
          timeout_seconds: 60,
        }) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      setCommand("");
      queryClient.invalidateQueries({ queryKey: ['agent-commands', agentId] });
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar comando: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) return;
    sendCommand.mutate(trimmed);
  };

  // Auto-scroll on new commands
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [commands.length]);

  // Only super_admin can use this
  if (!isSuperAdminUser) return null;

  return (
    <Card className="glass-card lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Terminal className="w-5 h-5" />
          Terminal Remoto
        </CardTitle>
        <CardDescription>
          Execute comandos no servidor do agent "{agentName}". Os comandos são executados como root via supervisor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Command input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="systemctl status iscope-agent"
              className="pl-7 font-mono text-sm"
              disabled={sendCommand.isPending}
            />
          </div>
          <Button type="submit" disabled={!command.trim() || sendCommand.isPending} size="default">
            {sendCommand.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="ml-2 hidden sm:inline">Executar</span>
          </Button>
        </form>

        {/* Commands list */}
        <ScrollArea className="h-[400px]" ref={scrollRef}>
          <div className="space-y-3">
            {commands.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum comando executado ainda.</p>
                <p className="text-xs mt-1">
                  O comando será executado no próximo heartbeat do agent (até ~120s).
                </p>
              </div>
            ) : (
              commands.map((cmd) => {
                const cfg = statusConfig[cmd.status] || statusConfig.pending;
                return (
                  <div
                    key={cmd.id}
                    className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden"
                  >
                    {/* Command header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-sm font-mono truncate text-foreground">$ {cmd.command}</code>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(cmd.created_at), { locale: ptBR, addSuffix: true })}
                        </span>
                        <Badge variant="secondary" className={`text-xs ${cfg.color}`}>
                          {cfg.icon}
                          <span className="ml-1">{cfg.label}</span>
                        </Badge>
                      </div>
                    </div>

                    {/* Output */}
                    {(cmd.status === 'completed' || cmd.status === 'failed' || cmd.status === 'timeout') && (
                      <div className="p-3">
                        {cmd.stdout && (
                          <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 max-h-48 overflow-auto">
                            {cmd.stdout}
                          </pre>
                        )}
                        {cmd.stderr && (
                          <pre className="text-xs font-mono whitespace-pre-wrap text-destructive/80 max-h-32 overflow-auto mt-1">
                            {cmd.stderr}
                          </pre>
                        )}
                        {cmd.exit_code !== null && cmd.exit_code !== 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Exit code: {cmd.exit_code}
                          </div>
                        )}
                        {!cmd.stdout && !cmd.stderr && (
                          <p className="text-xs text-muted-foreground italic">Sem output</p>
                        )}
                      </div>
                    )}

                    {/* Loading state */}
                    {(cmd.status === 'pending' || cmd.status === 'running') && (
                      <div className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {cmd.status === 'pending'
                          ? 'Aguardando próximo heartbeat do agent...'
                          : 'Executando no servidor...'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
