import { Card, CardContent } from '@/components/ui/card';
import { Globe } from 'lucide-react';

interface ExternalDomainStatsCardsProps {
  total: number;
  active: number;
  pending: number;
  issues: number;
}

export function ExternalDomainStatsCards({ total, active, pending, issues }: ExternalDomainStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">Total de Domínios</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <Globe className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{active}</p>
              <p className="text-sm text-muted-foreground">Domínios Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <Globe className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pending}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <Globe className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{issues}</p>
              <p className="text-sm text-muted-foreground">Com Problemas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
