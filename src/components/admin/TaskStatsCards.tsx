import { Card, CardContent } from "@/components/ui/card";
import { 
  ListTodo, 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Timer 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  timeout: number;
}

interface TaskStatsCardsProps {
  stats: TaskStats;
  isLoading?: boolean;
}

export function TaskStatsCards({ stats, isLoading }: TaskStatsCardsProps) {
  const cards = [
    {
      label: "Total",
      value: stats.total,
      icon: ListTodo,
      description: "tarefas",
      className: "text-primary",
    },
    {
      label: "Pendentes",
      value: stats.pending,
      icon: Clock,
      description: "aguardando",
      className: "text-yellow-500",
    },
    {
      label: "Executando",
      value: stats.running,
      icon: PlayCircle,
      description: "em curso",
      className: "text-blue-500",
    },
    {
      label: "Concluídas",
      value: stats.completed,
      icon: CheckCircle2,
      description: "sucesso",
      className: "text-green-500",
    },
    {
      label: "Falhas",
      value: stats.failed + stats.timeout,
      icon: XCircle,
      description: "erros",
      className: "text-destructive",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-8 w-16 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </div>
                <Icon className={cn("h-10 w-10 opacity-80", card.className)} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
