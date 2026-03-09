import { Mail, Forward, Reply, UserX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ExchangeDashboardData } from '@/hooks/useExchangeDashboard';

interface ExchangeAnalyzerStatsCardsProps {
  data: ExchangeDashboardData;
}

export function ExchangeAnalyzerStatsCards({ data }: ExchangeAnalyzerStatsCardsProps) {
  const { mailboxes } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Mail className="w-8 h-8 text-primary" />
          <div>
            <p className="text-2xl font-bold">{mailboxes.total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total de Mailboxes</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Forward className="w-8 h-8 text-amber-500" />
          <div>
            <p className="text-2xl font-bold">{mailboxes.forwardingEnabled}</p>
            <p className="text-xs text-muted-foreground">Forwarding Habilitado</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Reply className="w-8 h-8 text-orange-500" />
          <div>
            <p className="text-2xl font-bold">{mailboxes.autoReplyExternal}</p>
            <p className="text-xs text-muted-foreground">Auto-Reply Externo</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <UserX className="w-8 h-8 text-red-500" />
          <div>
            <p className="text-2xl font-bold">{mailboxes.notLoggedIn30d}</p>
            <p className="text-xs text-muted-foreground">Sem Login 30d</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
