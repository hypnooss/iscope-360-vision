import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AssetItem {
  id: string;
  name: string;
  agentName: string | null;
  workspaceName: string;
  score: number | null;
  status: string;
  navigationUrl: string;
}

interface AssetCategorySectionProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: AssetItem[];
  totalCount: number;
  isLoading: boolean;
}

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

export function AssetCategorySection({ title, icon: Icon, iconColor, items, totalCount, isLoading }: AssetCategorySectionProps) {
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
                  <TableHead className="w-[25%]">Nome</TableHead>
                  <TableHead className="w-[18%]">Agent</TableHead>
                  <TableHead className="w-[22%]">Workspace</TableHead>
                  <TableHead className="w-[12%]">Score</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  <TableHead className="w-[11%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(asset => (
                  <TableRow key={asset.id}>
                    <TableCell className="w-[25%] font-medium text-foreground">{asset.name}</TableCell>
                    <TableCell className={`w-[18%] ${asset.agentName ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {asset.agentName || '—'}
                    </TableCell>
                    <TableCell className="w-[22%] text-muted-foreground">{asset.workspaceName}</TableCell>
                    <TableCell className="w-[12%]">
                      {asset.score !== null ? (
                        <Badge variant="outline" className={getScoreColor(asset.score)}>
                          {asset.score}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="w-[12%]">
                      <Badge variant="outline" className="capitalize">{translateStatus(asset.status)}</Badge>
                    </TableCell>
                    <TableCell className="w-[11%] text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(asset.navigationUrl)}>
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
