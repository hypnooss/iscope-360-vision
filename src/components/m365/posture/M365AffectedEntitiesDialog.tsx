import { useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Users, Info, Download, FileText } from 'lucide-react';
import { M365Insight, SEVERITY_LABELS } from '@/types/m365Insights';
import { cn } from '@/lib/utils';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { M365AffectedEntitiesPDF } from '@/components/pdf/M365AffectedEntitiesPDF';

interface M365AffectedEntitiesDialogProps {
  insight: M365Insight;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  info: 'bg-muted/50 text-muted-foreground border-muted',
};

function exportCSV(insight: M365Insight, detailKeys: string[]) {
  const headers = ['Nome', 'Identificador', ...detailKeys];
  const rows = insight.affectedEntities.map(e => [
    e.displayName,
    e.userPrincipalName || e.email || '',
    ...detailKeys.map(k => String(e.details?.[k] ?? ''))
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizePDFFilename(insight.code)}-entidades-${getPDFDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function M365AffectedEntitiesDialog({ insight, open, onOpenChange }: M365AffectedEntitiesDialogProps) {
  const remaining = insight.affectedCount - insight.affectedEntities.length;
  const { downloadPDF, isGenerating } = usePDFDownload();

  const detailKeys = useMemo(() => {
    const keys = new Set<string>();
    insight.affectedEntities.forEach(e => {
      if (e.details) Object.keys(e.details).forEach(k => keys.add(k));
    });
    return Array.from(keys);
  }, [insight.affectedEntities]);

  const handleExportCSV = useCallback(() => {
    exportCSV(insight, detailKeys);
  }, [insight, detailKeys]);

  const handleExportPDF = useCallback(async () => {
    const doc = <M365AffectedEntitiesPDF insight={insight} detailKeys={detailKeys} />;
    const filename = `${sanitizePDFFilename(insight.code)}-entidades-${getPDFDateString()}`;
    await downloadPDF(doc, filename);
  }, [insight, detailKeys, downloadPDF]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-mono">{insight.code}</Badge>
                <Badge className={cn('text-xs border', SEVERITY_BADGE[insight.severity])}>
                  {SEVERITY_LABELS[insight.severity]}
                </Badge>
              </div>
              <DialogTitle className="text-base">{insight.titulo}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-1.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isGenerating}>
                <FileText className="w-4 h-4 mr-1.5" />
                {isGenerating ? 'Gerando...' : 'PDF'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Users className="w-4 h-4" />
          <span>{insight.affectedCount} {insight.affectedCount === 1 ? 'item afetado' : 'itens afetados'}</span>
        </div>

        <ScrollArea className="max-h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Identificador</TableHead>
                {detailKeys.map(key => (
                  <TableHead key={key} className="capitalize">{key}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {insight.affectedEntities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell className="font-medium">{entity.displayName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {entity.userPrincipalName || entity.email || '—'}
                  </TableCell>
                  {detailKeys.map(key => (
                    <TableCell key={key} className="text-xs">
                      {entity.details?.[key] != null ? String(entity.details[key]) : '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {remaining > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <Info className="w-3.5 h-3.5" />
            <span>e mais {remaining} {remaining === 1 ? 'entidade' : 'entidades'} não listadas</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
