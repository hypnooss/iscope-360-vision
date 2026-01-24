import { ComplianceCheck, ComplianceStatus } from '@/types/compliance';
import { CheckCircle, XCircle, AlertTriangle, ChevronRight, ChevronDown, Code, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ComplianceCardProps {
  check: ComplianceCheck;
  onClick?: () => void;
}

const statusConfig: Record<ComplianceStatus, { icon: typeof CheckCircle; className: string; label: string }> = {
  pass: { icon: CheckCircle, className: 'status-pass', label: 'Aprovado' },
  fail: { icon: XCircle, className: 'status-fail', label: 'Falha' },
  warning: { icon: AlertTriangle, className: 'status-warning', label: 'Atenção' },
  pending: { icon: AlertTriangle, className: 'text-muted-foreground bg-muted/50 border-muted', label: 'Pendente' },
};

const severityColors: Record<string, string> = {
  critical: 'bg-destructive/20 text-destructive',
  high: 'bg-warning/20 text-warning',
  medium: 'bg-primary/20 text-primary',
  low: 'bg-muted text-muted-foreground',
};

export function ComplianceCard({ check, onClick }: ComplianceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Normalize status: 'warn' -> 'warning', ensure valid status
  const rawStatus = check.status as string;
  const normalizedStatus = (rawStatus === 'warn' ? 'warning' : rawStatus) as ComplianceStatus;
  const config = statusConfig[normalizedStatus] || statusConfig.pending;
  const StatusIcon = config.icon;
  const hasEvidence = check.evidence && check.evidence.length > 0;

  return (
    <div 
      className={cn(
        "glass-card rounded-lg p-4 transition-all duration-200 hover:border-primary/50 group",
        "animate-fade-in"
      )}
      style={{ animationDelay: `${Math.random() * 0.3}s` }}
    >
      <div 
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => hasEvidence ? setIsExpanded(!isExpanded) : onClick?.()}
      >
        <div className={cn("p-2 rounded-lg border", config.className)}>
          <StatusIcon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground truncate">{check.name}</h4>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium uppercase", severityColors[check.severity])}>
              {check.severity}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{check.description}</p>
          
          {check.recommendation && check.status !== 'pass' && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              {check.recommendation}
            </p>
          )}
        </div>

        {hasEvidence ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Detalhes</span>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-primary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Evidências expandidas */}
      {isExpanded && hasEvidence && (
        <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
          {check.apiEndpoint && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span>Endpoint consultado: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{check.apiEndpoint}</code></span>
            </div>
          )}
          
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              Evidências Coletadas
            </h5>
            
            {check.evidence?.map((item, index) => (
              <div key={index} className="bg-muted/30 rounded-md p-3 border border-border/30">
                <span className="text-xs font-medium text-muted-foreground block mb-1">{item.label}</span>
                {item.type === 'code' ? (
                  <code className="text-xs text-primary bg-background/50 px-2 py-1 rounded block overflow-x-auto">
                    {item.value}
                  </code>
                ) : (
                  <p className="text-sm text-foreground">{item.value}</p>
                )}
              </div>
            ))}
          </div>

          {check.rawData && Object.keys(check.rawData).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Code className="w-3 h-3" />
                Ver dados brutos (JSON)
              </summary>
              <pre className="mt-2 bg-muted/50 p-3 rounded-md overflow-x-auto text-[10px] text-muted-foreground">
                {JSON.stringify(check.rawData, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
