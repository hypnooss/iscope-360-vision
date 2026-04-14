import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ApiJob {
  id: string;
  job_type: string;
  status: string;
  steps: any[];
  current_step: string | null;
  domain_id: string | null;
  metadata: any;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface PipelineJobDetailProps {
  job: ApiJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="w-5 h-5 text-green-500" />,
  failed: <XCircle className="w-5 h-5 text-destructive" />,
  running: <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />,
  pending: <Clock className="w-5 h-5 text-muted-foreground" />,
  skipped: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
};

const JOB_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  queued: 'outline',
  running: 'default',
  completed: 'default',
  failed: 'destructive',
  partial: 'secondary',
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function PipelineJobDetail({ job, open, onOpenChange }: PipelineJobDetailProps) {
  if (!job) return null;

  const steps = job.steps || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-lg">Detalhes do Job</SheetTitle>
        </SheetHeader>

        {/* Header info */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Domínio</span>
            <span className="font-mono text-sm">{job.metadata?.domain || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tipo</span>
            <Badge variant="outline" className="text-xs">{job.job_type}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={JOB_STATUS_VARIANT[job.status] || 'outline'} className="text-xs">
              {job.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Criado em</span>
            <span className="text-xs">{format(new Date(job.created_at), 'dd/MM/yyyy HH:mm:ss')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Duração total</span>
            <span className="text-xs">{formatDuration(job.started_at, job.completed_at)}</span>
          </div>
          {job.error_message && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
              <p className="text-xs text-destructive font-medium">Erro geral</p>
              <p className="text-xs text-destructive/80 mt-1">{job.error_message}</p>
            </div>
          )}
        </div>

        {/* Steps Timeline */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Steps</h3>
          <div className="relative">
            {steps.map((step: any, i: number) => (
              <div key={i} className="flex gap-3 pb-4 last:pb-0">
                {/* Timeline line + icon */}
                <div className="flex flex-col items-center">
                  <div className="flex-shrink-0">
                    {STATUS_ICON[step.status] || STATUS_ICON.pending}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{step.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        step.status === 'completed' ? 'border-green-500/30 text-green-500' :
                        step.status === 'failed' ? 'border-destructive/30 text-destructive' :
                        step.status === 'running' ? 'border-blue-500/30 text-blue-400' :
                        ''
                      }`}
                    >
                      {step.status}
                    </Badge>
                  </div>

                  {/* Timestamps */}
                  {step.started_at && (
                    <p className="text-xs text-muted-foreground">
                      Início: {format(new Date(step.started_at), 'HH:mm:ss')}
                      {step.completed_at && (
                        <> — Fim: {format(new Date(step.completed_at), 'HH:mm:ss')}
                          <span className="ml-1 text-foreground/70">
                            ({formatDuration(step.started_at, step.completed_at)})
                          </span>
                        </>
                      )}
                    </p>
                  )}

                  {/* Result data */}
                  {step.result && Object.keys(step.result).length > 0 && (
                    <div className="mt-2 bg-muted/30 rounded p-2 space-y-1">
                      {Object.entries(step.result).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{key}:</span>
                          <span className="text-xs font-mono break-all">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {step.error && (
                    <div className="mt-2 bg-destructive/10 border border-destructive/20 rounded p-2">
                      <p className="text-xs text-destructive break-all">{step.error}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Metadata</h3>
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Job ID</span>
              <span className="text-xs font-mono">{job.id.slice(0, 8)}...</span>
            </div>
            {job.domain_id && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Domain ID</span>
                <span className="text-xs font-mono">{job.domain_id.slice(0, 8)}...</span>
              </div>
            )}
            {job.metadata?.email_to && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Email</span>
                <span className="text-xs">{job.metadata.email_to}</span>
              </div>
            )}
            {job.metadata?.agent_id && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Agent ID</span>
                <span className="text-xs font-mono">{job.metadata.agent_id.slice(0, 8)}...</span>
              </div>
            )}
            {job.metadata?.api_key_name && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">API Key</span>
                <span className="text-xs">{job.metadata.api_key_name}</span>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
