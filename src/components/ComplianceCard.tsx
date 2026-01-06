import { ComplianceCheck, ComplianceStatus } from '@/types/compliance';
import { CheckCircle, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const config = statusConfig[check.status];
  const StatusIcon = config.icon;

  return (
    <div 
      className={cn(
        "glass-card rounded-lg p-4 cursor-pointer transition-all duration-200 hover:border-primary/50 group",
        "animate-fade-in"
      )}
      onClick={onClick}
      style={{ animationDelay: `${Math.random() * 0.3}s` }}
    >
      <div className="flex items-start gap-3">
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

        <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
