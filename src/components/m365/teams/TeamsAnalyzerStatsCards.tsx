import { Users, Eye, UserPlus, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CollaborationDashboardData } from '@/hooks/useCollaborationDashboard';

interface TeamsAnalyzerStatsCardsProps {
  data: CollaborationDashboardData;
}

export function TeamsAnalyzerStatsCards({ data }: TeamsAnalyzerStatsCardsProps) {
  const { teams, sharepoint } = data;

  const publicPct = teams.total > 0 ? ((teams.public / teams.total) * 100).toFixed(1) : '0.0';
  const guestPct = teams.total > 0 ? ((teams.withGuests / teams.total) * 100).toFixed(1) : '0.0';
  const extSharingPct = sharepoint.totalSites > 0 ? ((sharepoint.externalSharingEnabled / sharepoint.totalSites) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Teams */}
      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Users className="w-8 h-8 text-teal-400" />
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{teams.total.toLocaleString()}</p>
            </div>
            <p className="text-xs text-muted-foreground">Total de Teams</p>
          </div>
        </CardContent>
      </Card>

      {/* Teams Públicas */}
      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Eye className="w-8 h-8 text-red-500" />
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{publicPct}%</p>
              <p className="text-xs text-muted-foreground">({teams.public})</p>
            </div>
            <p className="text-xs text-muted-foreground">Teams Públicas</p>
          </div>
        </CardContent>
      </Card>

      {/* Convidados Externos */}
      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <UserPlus className="w-8 h-8 text-amber-500" />
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{guestPct}%</p>
              <p className="text-xs text-muted-foreground">({teams.withGuests})</p>
            </div>
            <p className="text-xs text-muted-foreground">Teams com Convidados</p>
          </div>
        </CardContent>
      </Card>

      {/* Compartilhamento Externo SPO */}
      <Card className="glass-card border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Share2 className="w-8 h-8 text-orange-500" />
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{extSharingPct}%</p>
              <p className="text-xs text-muted-foreground">({sharepoint.externalSharingEnabled})</p>
            </div>
            <p className="text-xs text-muted-foreground">Compartilhamento Externo SPO</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
