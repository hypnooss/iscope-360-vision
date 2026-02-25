import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Power, PowerOff, Wifi, WifiOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  cwd?: string | null;
}

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
  commandId?: string;
}

interface RemoteTerminalProps {
  agentId: string;
  agentName: string;
}

export function RemoteTerminal({ agentId, agentName }: RemoteTerminalProps) {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdminUser = isSuperAdmin();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pendingCommandIds, setPendingCommandIds] = useState<Set<string>>(new Set());
  const [currentCwd, setCurrentCwd] = useState("/");
  // Track which command IDs have already had streaming lines added
  const streamedCommandIds = useRef<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const prompt = `root@${agentName}:${currentCwd === "/" ? "/" : currentCwd}#`;

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // Focus input when clicking terminal area
  const focusInput = useCallback(() => {
    if (connected && realtimeConnected) inputRef.current?.focus();
  }, [connected, realtimeConnected]);

  // Cleanup shell_session_active on unmount
  useEffect(() => {
    return () => {
      if (connected) {
        (supabase
          .from("agents" as any)
          .update({ shell_session_active: false })
          .eq("id", agentId) as any).then(() => {});
      }
    };
  }, [connected, agentId]);

  // Handle realtime subscription for command results
  useEffect(() => {
    if (!connected || !isSuperAdminUser) return;

    const channel = supabase
      .channel(`shell-results-${agentId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_commands",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload: any) => {
          const cmd = payload.new as AgentCommand;

          // Streaming partial output — status="running"
          if (cmd.status === "running") {
            // Mark agent as ready on first sign of life
            if (!agentReady) setAgentReady(true);

            if (cmd.cwd) setCurrentCwd(cmd.cwd);

            // Replace all previous streaming lines for this command with full accumulated output
            setLines((prev) => {
              // Remove old streaming lines for this command
              const filtered = prev.filter(
                (l) => !(l.commandId === cmd.id && (l.type === "output" || l.type === "error") && streamedCommandIds.current.has(cmd.id))
              );
              streamedCommandIds.current.add(cmd.id);

              const newLines = [...filtered];
              if (cmd.stdout) {
                cmd.stdout.split("\n").forEach((line) => {
                  newLines.push({ type: "output", text: line, commandId: cmd.id });
                });
              }
              if (cmd.stderr) {
                cmd.stderr.split("\n").forEach((line) => {
                  newLines.push({ type: "error", text: line, commandId: cmd.id });
                });
              }
              return newLines;
            });
            return;
          }

          if (cmd.status === "completed" || cmd.status === "failed" || cmd.status === "timeout") {
            // Mark agent as ready
            if (!agentReady) setAgentReady(true);

            // Update cwd from agent response
            if (cmd.cwd) setCurrentCwd(cmd.cwd);

            // Replace streaming lines with final output
            setLines((prev) => {
              // Remove old streaming lines for this command
              const filtered = prev.filter(
                (l) => !(l.commandId === cmd.id && (l.type === "output" || l.type === "error") && streamedCommandIds.current.has(cmd.id))
              );
              streamedCommandIds.current.delete(cmd.id);

              const newLines = [...filtered];
              if (cmd.stdout) {
                cmd.stdout.split("\n").forEach((line) => {
                  newLines.push({ type: "output", text: line, commandId: cmd.id });
                });
              }
              if (cmd.stderr) {
                cmd.stderr.split("\n").forEach((line) => {
                  newLines.push({ type: "error", text: line, commandId: cmd.id });
                });
              }
              if (cmd.status === "timeout") {
                newLines.push({ type: "error", text: "Erro: comando excedeu o tempo limite.", commandId: cmd.id });
              }
              return newLines;
            });
            setPendingCommandIds((prev) => {
              const next = new Set(prev);
              next.delete(cmd.id);
              return next;
            });
          }
        }
      )
      .subscribe((status: string) => {
        const isSubscribed = status === "SUBSCRIBED";
        setRealtimeConnected(isSubscribed);
        if (isSubscribed) {
          setConnecting(false);
          setLines((prev) => [
            ...prev,
            { type: "system", text: "Canal de comunicação estabelecido." },
            { type: "system", text: "Sessão remota iniciada. Digite comandos abaixo." },
            { type: "system", text: 'Digite "clear" para limpar ou "exit" para desconectar.' },
            { type: "system", text: "" },
          ]);
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setRealtimeConnected(false);
    };
  }, [connected, agentId, isSuperAdminUser]);

  // Send command mutation
  const sendCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const { data, error } = await (supabase
        .from("agent_commands" as any)
        .insert({
          agent_id: agentId,
          command: cmd,
          created_by: user?.id,
          status: "pending",
          timeout_seconds: 60,
        })
        .select()
        .single() as any);

      if (error) throw error;

      return data as AgentCommand;
    },
    onSuccess: (data) => {
      setPendingCommandIds((prev) => new Set(prev).add(data.id));
      queryClient.invalidateQueries({ queryKey: ["agent-commands", agentId] });
    },
    onError: (error: any) => {
      setLines((prev) => [...prev, { type: "error", text: `Erro ao enviar comando: ${error.message}` }]);
    },
  });

  const handleConnect = async () => {
    setConnecting(true);
    setAgentReady(false);
    setLines([
      { type: "system", text: `Conectando ao agent "${agentName}"...` },
      { type: "system", text: "Aguardando canal de comunicação..." },
    ]);

    try {
      await (supabase
        .from("agents" as any)
        .update({ shell_session_active: true })
        .eq("id", agentId) as any);
    } catch (e) {
      console.error("Failed to set shell_session_active:", e);
    }

    setConnected(true);
  };

  const handleDisconnect = async () => {
    try {
      await (supabase
        .from("agents" as any)
        .update({ shell_session_active: false })
        .eq("id", agentId) as any);
    } catch (e) {
      console.error("Failed to clear shell_session_active:", e);
    }

    setConnected(false);
    setConnecting(false);
    setAgentReady(false);
    setLines([]);
    setCommandHistory([]);
    setHistoryIndex(-1);
    setPendingCommandIds(new Set());
    setInputValue("");
    setCurrentCwd("/");
    streamedCommandIds.current.clear();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setLines((prev) => [...prev, { type: "input", text: `${prompt} ${trimmed}` }]);
    setInputValue("");
    setHistoryIndex(-1);

    setCommandHistory((prev) => [...prev, trimmed]);

    if (trimmed === "clear") {
      setLines([]);
      return;
    }
    if (trimmed === "exit") {
      handleDisconnect();
      return;
    }

    sendCommand.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      setLines([]);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInputValue(commandHistory[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInputValue("");
      } else {
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    }
  };

  if (!isSuperAdminUser) return null;

  if (!connected && !connecting) {
    return (
      <div className="lg:col-span-2 rounded-lg border border-border/50 bg-black/90 p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
        <Terminal className="w-10 h-10 text-green-500 opacity-60" />
        <p className="text-sm text-gray-400 font-mono">Terminal Remoto — {agentName}</p>
        <Button onClick={handleConnect} variant="outline" className="border-green-600 text-green-500 hover:bg-green-950 hover:text-green-400">
          <Power className="w-4 h-4 mr-2" />
          Conectar
        </Button>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="lg:col-span-2 rounded-lg border border-border/50 bg-black/90 p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
        <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
        <p className="text-sm text-green-400 font-mono animate-pulse">Aguardando canal de comunicação...</p>
        <p className="text-xs text-gray-500 font-mono">Estabelecendo conexão com {agentName}</p>
      </div>
    );
  }

  const hasPending = pendingCommandIds.size > 0;
  const inputReady = connected && realtimeConnected;

  return (
    <div className="lg:col-span-2 rounded-lg border border-gray-700 bg-black overflow-hidden flex flex-col" style={{ height: "500px" }}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer hover:brightness-125" onClick={handleDisconnect} title="Desconectar" />
            <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-50" />
            <div className="w-3 h-3 rounded-full bg-green-500 opacity-50" />
          </div>
          <span className="text-gray-400 text-xs font-mono ml-2">
            Terminal Remoto — {agentName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {realtimeConnected ? (
            <Badge variant="secondary" className="bg-green-900/50 text-green-400 text-[10px] border-green-700/50 px-1.5 py-0.5">
              <Wifi className="w-2.5 h-2.5 mr-1" />
              Realtime
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-800 text-gray-500 text-[10px] border-gray-700 px-1.5 py-0.5">
              <WifiOff className="w-2.5 h-2.5 mr-1" />
              Conectando...
            </Badge>
          )}
          <button
            onClick={handleDisconnect}
            className="text-gray-500 hover:text-red-400 transition-colors"
            title="Desconectar"
          >
            <PowerOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Agent not ready banner */}
      {!agentReady && realtimeConnected && (
        <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-800/30 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          <span className="text-amber-400 text-xs font-mono">
            Aguardando agente conectar... (comandos serão executados quando o agente responder)
          </span>
        </div>
      )}

      {/* Terminal body */}
      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-sm cursor-text"
        onClick={focusInput}
      >
        {lines.map((line, i) => (
          <div key={i} className="leading-5 whitespace-pre-wrap break-all">
            {line.type === "input" && (
              <span className="text-green-400">{line.text}</span>
            )}
            {line.type === "output" && (
              <span className="text-gray-300">{line.text}</span>
            )}
            {line.type === "error" && (
              <span className="text-red-400">{line.text}</span>
            )}
            {line.type === "system" && (
              <span className="text-yellow-600 italic">{line.text}</span>
            )}
          </div>
        ))}

        {hasPending && (
          <div className="leading-5 text-gray-500">
            <span className="animate-pulse">▌</span>
          </div>
        )}

        {!hasPending && inputReady && agentReady && (
          <form onSubmit={handleSubmit} className="flex leading-5">
            <span className="text-green-400 shrink-0">{prompt}&nbsp;</span>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-green-300 outline-none border-none caret-green-400 font-mono text-sm p-0 m-0"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </form>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
