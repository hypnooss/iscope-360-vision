import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  PlayCircle, 
  Timer,
  Ban,
  Server,
  Bot,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Json } from "@/integrations/supabase/types";

interface TaskDetails {
  id: string;
  task_type: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
  error_message: string | null;
  result: Json | null;
  step_results: Json | null;
  payload: Json;
  firewall?: { name: string } | null;
  agent?: { name: string; client?: { name: string } | null } | null;
}

interface TaskDetailDialogProps {
  task: TaskDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { icon: Clock, label: "Pendente", variant: "secondary" },
  running: { icon: PlayCircle, label: "Executando", variant: "default" },
  completed: { icon: CheckCircle2, label: "Concluída", variant: "default" },
  failed: { icon: XCircle, label: "Falhou", variant: "destructive" },
  timeout: { icon: Timer, label: "Timeout", variant: "destructive" },
  cancelled: { icon: Ban, label: "Cancelada", variant: "outline" },
};

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  if (!task) return null;

  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const renderStepResults = () => {
    if (!task.step_results) return null;
    
    const steps = Array.isArray(task.step_results) 
      ? task.step_results 
      : (task.step_results as Record<string, unknown>).steps || [];
    
    if (!Array.isArray(steps) || steps.length === 0) {
      return <p className="text-muted-foreground text-sm">Sem dados de steps disponíveis</p>;
    }

    return (
      <div className="space-y-3">
        {steps.map((step: Record<string, unknown>, index: number) => (
          <div key={index} className="bg-muted/30 rounded-lg p-3 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">
                Step {index + 1}: {String(step.step_id || step.id || `step_${index}`)}
              </span>
              <Badge variant={step.success ? "default" : "destructive"}>
                {step.success ? "Sucesso" : "Falhou"}
              </Badge>
            </div>
            {step.error && (
              <p className="text-sm text-destructive mt-1">{String(step.error)}</p>
            )}
            {step.execution_time_ms && (
              <p className="text-xs text-muted-foreground mt-1">
                Duração: {formatDuration(Number(step.execution_time_ms))}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-border">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon className={cn(
              "h-5 w-5",
              task.status === "completed" && "text-green-500",
              task.status === "failed" && "text-destructive",
              task.status === "timeout" && "text-orange-500",
              task.status === "running" && "text-blue-500",
              task.status === "pending" && "text-yellow-500"
            )} />
            Detalhes da Tarefa
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-6 px-2">
            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Server className="h-4 w-4" />
                  <span className="text-xs">Firewall</span>
                </div>
                <p className="font-medium truncate">
                  {task.firewall?.name || "N/A"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Bot className="h-4 w-4" />
                  <span className="text-xs">Agent</span>
                </div>
                <p className="font-medium truncate">
                  {task.agent?.name || "N/A"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Building className="h-4 w-4" />
                  <span className="text-xs">Workspace</span>
                </div>
                <p className="font-medium truncate">
                  {task.agent?.client?.name || "N/A"}
                </p>
              </div>
            </div>

            {/* Status and Timing */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <h4 className="font-medium mb-3">Status e Tempo</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={status.variant} className="ml-2">
                    {status.label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="ml-2 font-mono">{task.task_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="ml-2">{formatDate(task.created_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Iniciado em:</span>
                  <span className="ml-2">{formatDate(task.started_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Concluído em:</span>
                  <span className="ml-2">{formatDate(task.completed_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração:</span>
                  <span className="ml-2 font-mono">{formatDuration(task.execution_time_ms)}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {task.error_message && (
              <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/30">
                <h4 className="font-medium text-destructive mb-2">Mensagem de Erro</h4>
                <p className="text-sm text-destructive/90 font-mono whitespace-pre-wrap">
                  {task.error_message}
                </p>
              </div>
            )}

            {/* Tabs for JSON data */}
            <Tabs defaultValue="steps" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="steps">Steps</TabsTrigger>
                <TabsTrigger value="result">Resultado</TabsTrigger>
                <TabsTrigger value="payload">Payload</TabsTrigger>
              </TabsList>
              
              <TabsContent value="steps" className="mt-4">
                {renderStepResults()}
              </TabsContent>
              
              <TabsContent value="result" className="mt-4">
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {task.result ? JSON.stringify(task.result, null, 2) : "Sem resultado"}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
              
              <TabsContent value="payload" className="mt-4">
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(task.payload, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
