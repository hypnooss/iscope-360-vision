import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Globe, 
  Server, 
  Terminal, 
  Wifi,
  Shield,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Types
interface CollectionStep {
  id: string;
  executor: string;
  config: Record<string, any>;
}

interface Blueprint {
  id: string;
  name: string;
  description: string | null;
  collection_steps: {
    steps: CollectionStep[];
  };
}

interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  severity: string;
  weight: number;
  evaluation_logic: Record<string, any>;
  is_active: boolean;
}

interface BlueprintFlowVisualizationProps {
  blueprint: Blueprint;
  rules: ComplianceRule[];
}

// Executor configurations with dark-mode friendly colors
const EXECUTOR_CONFIG: Record<string, { 
  icon: React.ElementType; 
  label: string; 
  barColor: string;
}> = {
  dns_query: { 
    icon: Globe, 
    label: 'DNS Query', 
    barColor: 'bg-cyan-500',
  },
  http_request: { 
    icon: Server, 
    label: 'HTTP Request', 
    barColor: 'bg-blue-500',
  },
  http_session: { 
    icon: Wifi, 
    label: 'HTTP Session', 
    barColor: 'bg-indigo-500',
  },
  ssh: { 
    icon: Terminal, 
    label: 'SSH Command', 
    barColor: 'bg-emerald-500',
  },
  snmp: { 
    icon: Database, 
    label: 'SNMP Query', 
    barColor: 'bg-amber-500',
  },
};

// Severity colors - dark mode friendly
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

// Get a human-readable description of the step configuration
function getStepDescription(step: CollectionStep): string {
  const { executor, config } = step;
  
  if (executor === 'dns_query') {
    const queryType = config.query_type || config.record_type || 'N/A';
    return `Consulta ${queryType}`;
  }
  
  if (executor === 'http_request') {
    const method = config.method || 'GET';
    const endpoint = config.endpoint || config.path || '';
    return `${method} ${endpoint}`.slice(0, 50);
  }
  
  if (executor === 'ssh') {
    const cmd = config.command || '';
    return cmd.slice(0, 40) + (cmd.length > 40 ? '...' : '');
  }
  
  if (executor === 'snmp') {
    const oid = config.oid || '';
    return `OID: ${oid}`.slice(0, 40);
  }
  
  return JSON.stringify(config).slice(0, 50);
}

// Get evaluation logic description
function getEvaluationDescription(logic: Record<string, any>): string {
  if (!logic) return 'N/A';
  
  const field = logic.field || logic.path || '';
  const operator = logic.operator || logic.op || 'eq';
  const value = logic.value !== undefined ? JSON.stringify(logic.value) : 'N/A';
  
  const operatorLabels: Record<string, string> = {
    eq: '=',
    neq: '≠',
    not_null: '≠ null',
    is_null: '= null',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    in: 'contém',
    not_in: 'não contém',
    contains: 'inclui',
    starts_with: 'começa com',
    ends_with: 'termina com',
    regex: 'regex',
    exists: 'existe',
  };
  
  const opLabel = operatorLabels[operator] || operator;
  
  if (operator === 'not_null' || operator === 'exists') {
    return `${field} ${opLabel}`;
  }
  
  return `${field} ${opLabel} ${value}`;
}

export function BlueprintFlowVisualization({ blueprint, rules }: BlueprintFlowVisualizationProps) {
  const steps = blueprint.collection_steps?.steps || [];
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  
  // Group rules by step_id from evaluation_logic
  const rulesByStep = useMemo(() => {
    const map: Record<string, ComplianceRule[]> = {};
    
    rules.forEach((rule) => {
      const stepId = rule.evaluation_logic?.step_id;
      if (stepId) {
        if (!map[stepId]) {
          map[stepId] = [];
        }
        map[stepId].push(rule);
      }
    });
    
    return map;
  }, [rules]);
  
  // Group rules without step_id (orphan rules)
  const orphanRules = useMemo(() => {
    return rules.filter((rule) => !rule.evaluation_logic?.step_id);
  }, [rules]);
  
  // Count active rules
  const activeRulesCount = useMemo(() => {
    return rules.filter(r => r.is_active).length;
  }, [rules]);
  
  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum step de coleta configurado neste blueprint.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Summary Header */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span><strong className="text-foreground">{steps.length}</strong> steps de coleta</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span><strong className="text-foreground">{rules.length}</strong> regras de compliance</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span><strong className="text-foreground">{activeRulesCount}</strong> ativas</span>
          </div>
        </div>

        {/* Vertical Step List */}
        <div className="space-y-2">
          {steps.map((step) => {
            const linkedRules = rulesByStep[step.id] || [];
            const executorConfig = EXECUTOR_CONFIG[step.executor] || {
              icon: Database,
              label: step.executor,
              barColor: 'bg-muted-foreground',
            };
            const ExecutorIcon = executorConfig.icon;
            const isExpanded = expandedStep === step.id;
            
            return (
              <Collapsible
                key={step.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedStep(open ? step.id : null)}
              >
                <div 
                  className={cn(
                    "flex items-stretch rounded-lg bg-card border border-border transition-colors",
                    "hover:border-primary/50"
                  )}
                >
                  {/* Colored bar indicator */}
                  <div className={cn(
                    "w-1.5 rounded-l-lg flex-shrink-0",
                    executorConfig.barColor
                  )} />
                  
                  <div className="flex-1 p-4 min-w-0">
                    {/* Step Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <ExecutorIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-sm font-medium text-foreground">
                        {step.id}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {executorConfig.label}
                      </Badge>
                      {linkedRules.length === 0 && (
                        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Sem regras
                        </Badge>
                      )}
                    </div>
                    
                    {/* Step Description */}
                    <p className="text-xs text-muted-foreground mb-3 font-mono">
                      {getStepDescription(step)}
                    </p>
                    
                    {/* Rules Inline Badges */}
                    {linkedRules.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground mr-1">Regras:</span>
                        {linkedRules.slice(0, 6).map((rule) => (
                          <Tooltip key={rule.id}>
                            <TooltipTrigger asChild>
                              <Badge 
                                className={cn(
                                  "text-xs cursor-default border",
                                  SEVERITY_COLORS[rule.severity] || SEVERITY_COLORS.info,
                                  !rule.is_active && "opacity-50"
                                )}
                              >
                                {rule.code}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-medium">{rule.name}</div>
                                <div className="text-xs text-muted-foreground">{rule.category}</div>
                                <div className="text-xs">
                                  Severidade: <strong>{SEVERITY_LABELS[rule.severity] || rule.severity}</strong>
                                </div>
                                {!rule.is_active && (
                                  <div className="text-xs text-amber-500">⚠ Regra inativa</div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {linkedRules.length > 6 && (
                          <CollapsibleTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className="text-xs cursor-pointer hover:bg-accent"
                            >
                              +{linkedRules.length - 6}
                            </Badge>
                          </CollapsibleTrigger>
                        )}
                        {linkedRules.length > 0 && (
                          <CollapsibleTrigger asChild>
                            <button className="ml-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  Ocultar detalhes
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-3 h-3" />
                                  Ver detalhes
                                </>
                              )}
                            </button>
                          </CollapsibleTrigger>
                        )}
                      </div>
                    )}
                    
                    {/* Expanded Rules Details */}
                    <CollapsibleContent>
                      {linkedRules.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Detalhes das Regras
                          </div>
                          {linkedRules.map((rule) => (
                            <div 
                              key={rule.id}
                              className={cn(
                                "p-3 rounded-md bg-muted/30 border border-border/50",
                                !rule.is_active && "opacity-60"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {rule.code}
                                  </code>
                                  <Badge 
                                    className={cn(
                                      "text-xs border",
                                      SEVERITY_COLORS[rule.severity] || SEVERITY_COLORS.info
                                    )}
                                  >
                                    {SEVERITY_LABELS[rule.severity] || rule.severity}
                                  </Badge>
                                  {!rule.is_active && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inativo
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm font-medium text-foreground mb-1">
                                {rule.name}
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {rule.category}
                              </div>
                              <div className="text-xs bg-muted/50 px-2 py-1.5 rounded font-mono text-muted-foreground">
                                {getEvaluationDescription(rule.evaluation_logic)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </div>
              </Collapsible>
            );
          })}
        </div>
        
        {/* Orphan Rules Section */}
        {orphanRules.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>
                <strong className="text-foreground">{orphanRules.length}</strong> regra{orphanRules.length !== 1 ? 's' : ''} sem step vinculado
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {orphanRules.map((rule) => (
                <Tooltip key={rule.id}>
                  <TooltipTrigger asChild>
                    <Badge 
                      className={cn(
                        "text-xs cursor-default border",
                        SEVERITY_COLORS[rule.severity] || SEVERITY_COLORS.info,
                        !rule.is_active && "opacity-50"
                      )}
                    >
                      {rule.code}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-xs text-muted-foreground">{rule.category}</div>
                      <div className="text-xs">
                        Severidade: <strong>{SEVERITY_LABELS[rule.severity] || rule.severity}</strong>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
