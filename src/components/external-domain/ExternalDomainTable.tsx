import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { ScheduleFrequency } from '@/components/external-domain/AddExternalDomainDialog';

export interface ExternalDomainRow {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  status: 'active' | 'inactive' | 'pending' | string;
  last_scan_at: string | null;
  last_score: number | null;
  client_id: string;
  client_name?: string;
  agent_name?: string | null;
  schedule_frequency?: ScheduleFrequency | null;
  created_at: string;
}

interface ExternalDomainTableProps {
  domains: ExternalDomainRow[];
  loading: boolean;
  canEdit: boolean;
}

const getScoreColor = (score: number | null) => {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 90) return 'bg-success/10 text-success';
  if (score >= 75) return 'bg-success/10 text-success';
  if (score >= 60) return 'bg-warning/10 text-warning';
  return 'bg-destructive/10 text-destructive';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-success/10 text-success">Ativo</Badge>;
    case 'inactive':
      return <Badge className="bg-muted text-muted-foreground">Inativo</Badge>;
    case 'pending':
      return <Badge className="bg-warning/10 text-warning">Pendente</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getScheduleLabel = (frequency?: string | null) => {
  switch (frequency) {
    case 'daily':
      return 'Diário';
    case 'weekly':
      return 'Semanal';
    case 'monthly':
      return 'Mensal';
    default:
      return 'Manual';
  }
};

export function ExternalDomainTable({ domains, loading, canEdit }: ExternalDomainTableProps) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Lista de Domínios
        </CardTitle>
        <CardDescription>{domains.length} domínio(s) cadastrado(s)</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum domínio cadastrado</p>
            <p className="text-sm mt-2">Adicione um domínio para começar o monitoramento</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domínio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Última Verificação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{domain.name}</p>
                      <p className="text-xs text-muted-foreground">{domain.domain}</p>
                    </div>
                  </TableCell>
                  <TableCell>{domain.client_name || 'N/A'}</TableCell>
                  <TableCell>{domain.agent_name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getScheduleLabel(domain.schedule_frequency)}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(domain.status)}</TableCell>
                  <TableCell>
                    {domain.last_score !== null ? (
                      <Badge className={getScoreColor(domain.last_score)}>{domain.last_score}%</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">-</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {domain.last_scan_at ? new Date(domain.last_scan_at).toLocaleDateString('pt-BR') : 'Nunca'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" title="Editar" disabled>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir" disabled>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
