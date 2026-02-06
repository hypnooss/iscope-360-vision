import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  ShieldAlert, 
  Building2, 
  ExternalLink,
  Layers,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ComplianceRuleBasic } from '@/types/complianceRule';

// Severity colors
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-muted text-muted-foreground border-border',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
  info: 'Info',
};

// Section component for expanded content
interface SectionProps {
  title: string;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'destructive';
  children: React.ReactNode;
}

function Section({ title, icon: Icon, variant = 'default', children }: SectionProps) {
  const variantStyles = {
    default: 'bg-muted/50 border-border/50',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    destructive: 'bg-red-500/10 border-red-500/30',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    warning: 'text-yellow-500',
    destructive: 'text-red-400',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icon className={cn("w-3.5 h-3.5", iconStyles[variant])} />
        {title}
      </div>
      <div className={cn(
        "text-sm text-foreground p-3 rounded-lg border-l-2",
        variantStyles[variant]
      )}>
        {children}
      </div>
    </div>
  );
}

interface RulePreviewCardProps {
  rule: ComplianceRuleBasic;
}

export function RulePreviewCard({ rule }: RulePreviewCardProps) {
  const [previewState, setPreviewState] = useState<'pass' | 'fail'>('fail');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusConfig = {
    pass: { 
      icon: CheckCircle, 
      iconClass: 'text-primary',
      bgClass: 'bg-primary/10 border-primary/30',
      label: 'Aprovado',
      message: rule.pass_description || 'Configuração conforme esperado'
    },
    fail: { 
      icon: XCircle, 
      iconClass: 'text-rose-400',
      bgClass: 'bg-rose-500/10 border-rose-500/30',
      label: 'Falha',
      message: rule.fail_description || 'Configuração fora do esperado'
    },
  };
  
  const config = statusConfig[previewState];
  const StatusIcon = config.icon;
  
  // Só mostra seções de risco quando em estado de falha
  const showRiskSections = previewState === 'fail';

  // Determina se a badge de severidade deve ter cor (apenas em falha)
  const severityClass = showRiskSections 
    ? SEVERITY_COLORS[rule.severity] || SEVERITY_COLORS.info
    : 'bg-muted text-muted-foreground border-border';

  // Verifica se há conteúdo para expandir
  const hasExpandableContent = rule.description || rule.technical_risk || rule.business_impact || rule.api_endpoint;

  return (
    <div className={cn(
      "border rounded-lg bg-card transition-all",
      "hover:border-primary/30"
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              "p-2 rounded-lg border flex-shrink-0",
              config.bgClass
            )}>
              <StatusIcon className={cn("w-4 h-4", config.iconClass)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm font-mono font-semibold text-foreground">
                  {rule.code}
                </code>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm font-medium text-foreground">
                  {rule.name}
                </span>
                <Badge 
                  className={cn(
                    "text-xs border ml-auto",
                    severityClass
                  )}
                >
                  {SEVERITY_LABELS[rule.severity] || rule.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {config.message}
              </p>
            </div>
          </div>
          
          {/* Toggle Sucesso/Falha */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              size="sm" 
              variant={previewState === 'pass' ? 'default' : 'outline'}
              className={cn(
                "h-7 px-2 text-xs",
                previewState === 'pass' && "bg-primary hover:bg-primary/90"
              )}
              onClick={() => setPreviewState('pass')}
            >
              Sucesso
            </Button>
            <Button 
              size="sm" 
              variant={previewState === 'fail' ? 'destructive' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => setPreviewState('fail')}
            >
              Falha
            </Button>
          </div>
        </div>
        
        {/* Recomendação (apenas em falha) */}
        {showRiskSections && rule.recommendation && (
          <p className="text-xs text-primary mt-3 flex items-start gap-1 pl-11">
            <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{rule.recommendation}</span>
          </p>
        )}
      </div>
      
      {/* Expandir detalhes */}
      {hasExpandableContent && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-4 pb-2 text-left">
              <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>Ver detalhes do card</span>
              </div>
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4 mx-4 mb-2">
              
              {/* Endpoint consultado */}
              {rule.api_endpoint && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Endpoint consultado:</span>
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                    {rule.api_endpoint}
                  </code>
                </div>
              )}
              
              {/* ANÁLISE EFETUADA */}
              {rule.description && (
                <Section title="ANÁLISE EFETUADA" icon={FileText}>
                  {rule.description}
                </Section>
              )}
              
              {/* RISCO TÉCNICO (apenas em falha) */}
              {showRiskSections && rule.technical_risk && (
                <Section title="RISCO TÉCNICO" icon={ShieldAlert} variant="warning">
                  {rule.technical_risk}
                </Section>
              )}
              
              {/* IMPACTO NO NEGÓCIO (apenas em falha) */}
              {showRiskSections && rule.business_impact && (
                <Section title="IMPACTO NO NEGÓCIO" icon={Building2} variant="destructive">
                  {rule.business_impact}
                </Section>
              )}
              
              {/* Placeholder para evidências */}
              <Section title="EVIDÊNCIAS COLETADAS" icon={Layers}>
                <span className="text-muted-foreground italic">
                  [Dados coletados em runtime pelo agente]
                </span>
              </Section>
              
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
