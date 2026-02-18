import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface AssetItem {
  id: string;
  name: string;
  type?: string;
  agentName: string | null;
  workspaceName: string;
  score: number | null;
  status: string;
  navigationUrl: string;
  scheduleFrequency?: string | null;
  scheduleHour?: number;
  scheduleDayOfWeek?: number;
  scheduleDayOfMonth?: number;
}

interface AssetCategorySectionProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: AssetItem[];
  totalCount: number;
  isLoading: boolean;
  showFrequency?: boolean;
  renderActions?: (asset: AssetItem) => React.ReactNode;
}

const FREQUENCY_BADGE_STYLES: Record<string, string> = {
  daily:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  weekly:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  manual:  'bg-muted text-muted-foreground border-border',
};
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', manual: 'Manual',
};
const DAYS_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};

const translateStatus = (status: string): string => {
  const map: Record<string, string> = {
    analyzed: 'Analisado',
    pending: 'Pendente',
    partial: 'Parcial',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    error: 'Erro',
    active: 'Ativo',
  };
  return map[status.toLowerCase()] || status;
};

const getScoreColor = (score: number | null) => {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 75) return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
  if (score >= 50) return 'bg-warning/20 text-warning border-warning/30';
  return 'bg-destructive/20 text-destructive border-destructive/30';
};

export function AssetCategorySection({ title, icon: Icon, iconColor, items, totalCount, isLoading, showFrequency, renderActions }: AssetCategorySectionProps) {
  const navigate = useNavigate();

  if (!isLoading && totalCount === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary" className="text-xs">{isLoading ? '…' : totalCount}</Badge>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Monitor className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum ativo encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Workspace</TableHead>
                  {showFrequency && <TableHead>Frequência</TableHead>}
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(asset => {
                  const freq = asset.scheduleFrequency || 'manual';
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium text-foreground">{asset.name}</TableCell>
                      <TableCell className={asset.agentName ? 'text-foreground' : 'text-muted-foreground'}>
                        {asset.agentName || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{asset.workspaceName}</TableCell>
                      {showFrequency && (
                        <TableCell>
                          <div className="flex flex-row flex-wrap items-center gap-1">
                            <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES[freq] || FREQUENCY_BADGE_STYLES.manual}`}>
                              {FREQUENCY_LABELS[freq] || freq}
                            </Badge>
                            {freq === 'daily' && (
                              <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES.daily}`}>
                                {String(asset.scheduleHour ?? 0).padStart(2, '0')}:00
                              </Badge>
                            )}
                            {freq === 'weekly' && (
                              <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES.weekly}`}>
                                {DAYS_OF_WEEK_SHORT[asset.scheduleDayOfWeek ?? 1]} · {String(asset.scheduleHour ?? 0).padStart(2, '0')}:00
                              </Badge>
                            )}
                            {freq === 'monthly' && (
                              <Badge variant="outline" className={`text-xs ${FREQUENCY_BADGE_STYLES.monthly}`}>
                                Dia {asset.scheduleDayOfMonth ?? 1} · {String(asset.scheduleHour ?? 0).padStart(2, '0')}:00
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {asset.score !== null ? (
                          <Badge variant="outline" className={getScoreColor(asset.score)}>
                            {asset.score}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{translateStatus(asset.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {renderActions ? renderActions(asset) : (
                          <Button variant="ghost" size="sm" onClick={() => navigate(asset.navigationUrl)}>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Abrir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
