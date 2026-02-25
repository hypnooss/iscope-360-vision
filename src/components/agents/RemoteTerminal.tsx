import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Power, PowerOff, Wifi, WifiOff } from "lucide-react";
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
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pendingCommandIds, setPendingCommandIds] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const prompt = `root@${agentName}:~#`;

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // Focus input when clicking terminal area
  const focusInput = useCallback(() => {
    if (connected) inputRef.current?.focus();
  }, [connected]);

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
          if (cmd.status === "completed" || cmd.status === "failed" || cmd.status === "timeout") {
            // Add output lines
            setLines((prev) => {
              const newLines = [...prev];
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
              if (!cmd.stdout && !cmd.stderr && cmd.status !== "timeout") {
                // Command completed with no output - that's fine, just show next prompt
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
        setRealtimeConnected(status === "SUBSCRIBED");
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

      // Broadcast for instant delivery
      const broadcastChannel = supabase.channel(`agent-cmd-${agentId}`);
      await broadcastChannel.send({
        type: "broadcast",
        event: "command",
        payload: { id: data.id, command: cmd, timeout_seconds: 60 },
      });
      supabase.removeChannel(broadcastChannel);

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
    setConnected(true);
    setLines([
      { type: "system", text: `Conectando ao agent "${agentName}"...` },
      { type: "system", text: "Sessão remota iniciada. Digite comandos abaixo." },
      { type: "system", text: 'Digite "clear" para limpar ou "exit" para desconectar.' },
      { type: "system", text: "" },
    ]);

    // Load recent commands as context
    try {
      const { data } = await (supabase
        .from("agent_commands" as any)
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: true })
        .limit(20) as any);

      if (data && data.length > 0) {
        const historyLines: TerminalLine[] = [
          { type: "system", text: "── Histórico recente ──" },
        ];
        (data as AgentCommand[]).forEach((cmd) => {
          historyLines.push({ type: "input", text: `${prompt} ${cmd.command}` });
          if (cmd.stdout) {
            cmd.stdout.split("\n").forEach((l) => historyLines.push({ type: "output", text: l }));
          }
          if (cmd.stderr) {
            cmd.stderr.split("\n").forEach((l) => historyLines.push({ type: "error", text: l }));
          }
        });
        historyLines.push({ type: "system", text: "── Fim do histórico ──" });
        historyLines.push({ type: "system", text: "" });
        setLines((prev) => [...prev, ...historyLines]);
        setCommandHistory(data.map((c: AgentCommand) => c.command));
      }
    } catch {
      // Ignore history load errors
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setLines([]);
    setCommandHistory([]);
    setHistoryIndex(-1);
    setPendingCommandIds(new Set());
    setInputValue("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Add input line
    setLines((prev) => [...prev, { type: "input", text: `${prompt} ${trimmed}` }]);
    setInputValue("");
    setHistoryIndex(-1);

    // Update command history
    setCommandHistory((prev) => [...prev, trimmed]);

    // Local commands
    if (trimmed === "clear") {
      setLines([]);
      return;
    }
    if (trimmed === "exit") {
      handleDisconnect();
      return;
    }

    // Send to agent
    sendCommand.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+L = clear
    if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      setLines([]);
      return;
    }

    // Arrow up/down for history
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

  // Disconnected state - show connect button
  if (!connected) {
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

  const hasPending = pendingCommandIds.size > 0;

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
              Polling
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

      {/* Terminal body */}
      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-sm cursor-text"
        onClick={focusInput}
      >
        {/* Rendered lines */}
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

        {/* Pending indicator */}
        {hasPending && (
          <div className="leading-5 text-gray-500">
            <span className="animate-pulse">▌</span>
          </div>
        )}

        {/* Active prompt + input */}
        {!hasPending && (
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
