import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Power, PowerOff, Wifi, WifiOff, Loader2 } from "lucide-react";

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
  const isSuperAdminUser = isSuperAdmin();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pendingCommands, setPendingCommands] = useState<Set<string>>(new Set());
  const [currentCwd, setCurrentCwd] = useState("/");

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const prompt = `root@${agentName}:${currentCwd === "/" ? "/" : currentCwd}#`;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const focusInput = useCallback(() => {
    if (connected && channelReady) inputRef.current?.focus();
  }, [connected, channelReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        // Send disconnect event to agent
        channelRef.current.send({
          type: "broadcast",
          event: "disconnect",
          payload: {},
        });
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // Reset shell_session_active
      (supabase
        .from("agents" as any)
        .update({ shell_session_active: false })
        .eq("id", agentId) as any).then(() => {});
    };
  }, [agentId]);

  // Setup broadcast channel when connected
  useEffect(() => {
    if (!connected || !isSuperAdminUser) return;

    const channel = supabase.channel(`shell:${agentId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    // Listen for output events
    channel.on("broadcast", { event: "output" }, ({ payload }) => {
      if (!payload?.data) return;
      setLines((prev) => {
        const newLines = [...prev];
        payload.data.split("\n").forEach((line: string) => {
          newLines.push({ type: "output", text: line, commandId: payload.id });
        });
        return newLines;
      });
    });

    // Listen for error events
    channel.on("broadcast", { event: "error" }, ({ payload }) => {
      if (!payload?.data) return;
      setLines((prev) => {
        const newLines = [...prev];
        payload.data.split("\n").forEach((line: string) => {
          newLines.push({ type: "error", text: line, commandId: payload.id });
        });
        return newLines;
      });
    });

    // Listen for done events
    channel.on("broadcast", { event: "done" }, ({ payload }) => {
      if (payload?.cwd) setCurrentCwd(payload.cwd);
      setPendingCommands((prev) => {
        const next = new Set(prev);
        next.delete(payload?.id);
        return next;
      });
    });

    // Listen for ready event (agent confirms it joined the channel)
    channel.on("broadcast", { event: "ready" }, () => {
      setLines((prev) => [
        ...prev,
        { type: "system", text: "Agente conectado. Sessão remota pronta." },
        { type: "system", text: 'Digite "clear" para limpar ou "exit" para desconectar.' },
        { type: "system", text: "" },
      ]);
      setTimeout(() => inputRef.current?.focus(), 100);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setChannelReady(true);
        setConnecting(false);
        setLines((prev) => [
          ...prev,
          { type: "system", text: "Canal WebSocket estabelecido." },
          { type: "system", text: "Aguardando agente conectar..." },
        ]);
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setChannelReady(false);
    };
  }, [connected, agentId, isSuperAdminUser]);

  const handleConnect = async () => {
    setConnecting(true);
    setLines([
      { type: "system", text: `Conectando ao agent "${agentName}"...` },
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
    // Send disconnect event to agent via broadcast
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: "broadcast",
          event: "disconnect",
          payload: {},
        });
      } catch (e) {
        // ignore
      }
    }

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
    setChannelReady(false);
    setLines([]);
    setCommandHistory([]);
    setHistoryIndex(-1);
    setPendingCommands(new Set());
    setInputValue("");
    setCurrentCwd("/");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || !channelRef.current) return;

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

    const commandId = crypto.randomUUID();
    setPendingCommands((prev) => new Set(prev).add(commandId));

    channelRef.current.send({
      type: "broadcast",
      event: "command",
      payload: { command: trimmed, id: commandId },
    });
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "c" && hasPending) {
      e.preventDefault();
      setLines((prev) => [...prev, { type: "system", text: "^C" }]);
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: { signal: "SIGINT" },
        });
      }
      // Clear pending after a short delay
      setTimeout(() => setPendingCommands(new Set()), 3000);
      return;
    }
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
        <p className="text-sm text-green-400 font-mono animate-pulse">Estabelecendo conexão WebSocket...</p>
        <p className="text-xs text-gray-500 font-mono">Conectando a {agentName}</p>
      </div>
    );
  }

  const hasPending = pendingCommands.size > 0;
  const inputReady = connected && channelReady;

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
          {channelReady ? (
            <Badge variant="secondary" className="bg-green-900/50 text-green-400 text-[10px] border-green-700/50 px-1.5 py-0.5">
              <Wifi className="w-2.5 h-2.5 mr-1" />
              WebSocket
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

      {/* Terminal body */}
      <div
        className="flex-1 overflow-y-auto p-3 font-mono text-sm cursor-text outline-none"
        onClick={focusInput}
        onKeyDown={handleTerminalKeyDown}
        tabIndex={0}
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

        {!hasPending && inputReady && (
          <form onSubmit={handleSubmit} className="flex leading-5">
            <span className="text-green-400 shrink-0">{prompt}&nbsp;</span>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-gray-200 outline-none border-none font-mono text-sm caret-green-400"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
          </form>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
