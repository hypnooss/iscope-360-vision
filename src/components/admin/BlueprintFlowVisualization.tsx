import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowRight, 
  Database, 
  Globe, 
  Server, 
  Terminal, 
  Wifi,
  Shield,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Executor type configurations
const EXECUTOR_CONFIG: Record<string, { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  dns_query: { 
    icon: Globe, 
    label: 'DNS Query', 
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-300'
  },
  http_request: { 
    icon: Server, 
    label: 'HTTP Request', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300'
  },
  http_session: { 
    icon: Wifi, 
    label: 'HTTP Session', 
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300'
  },
  ssh: { 
    icon: Terminal, 
    label: 'SSH Command', 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300'
  },
  snmp: { 
    icon: Database, 
    label: 'SNMP Query', 
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300'
  },
};

const SEVERITY_CONFIG: Record<string, { 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  critical: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Crítico' },
  high: { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Alto' },
  medium: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Médio' },
  low: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Baixo' },
  info: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Info' },
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
    return `${method} ${endpoint}`.slice(0, 40);
  }
  
  if (executor === 'ssh') {
    const cmd = config.command || '';
    return cmd.slice(0, 30) + (cmd.length > 30 ? '...' : '');
  }
  
  if (executor === 'snmp') {
    const oid = config.oid || '';
    return `OID: ${oid}`.slice(0, 30);
  }
  
  return JSON.stringify(config).slice(0, 40);
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
  
  return `${field} ${opLabel} ${value}`.slice(0, 50);
}

export function BlueprintFlowVisualization({ blueprint, rules }: BlueprintFlowVisualizationProps) {
  const steps = blueprint.collection_steps?.steps || [];
  
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
  
  // Group rules by category
  const rulesByCategory = useMemo(() => {
    const map: Record<string, ComplianceRule[]> = {};
    rules.forEach((rule) => {
      if (!map[rule.category]) {
        map[rule.category] = [];
      }
      map[rule.category].push(rule);
    });
    return map;
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
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>{steps.length} steps de coleta</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>{rules.length} regras de compliance</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-primary" />
          <span>{rules.filter(r => r.is_active).length} ativas</span>
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const linkedRules = rulesByStep[step.id] || [];
          const executorConfig = EXECUTOR_CONFIG[step.executor] || {
            icon: Database,
            label: step.executor,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
            borderColor: 'border-gray-300'
          };
          const ExecutorIcon = executorConfig.icon;
          
          return (
            <div key={step.id} className="relative">
              {/* Connection line to next step */}
              {index < steps.length - 1 && (
                <div className="absolute left-[140px] top-full w-0.5 h-4 bg-gradient-to-b from-border to-transparent z-0" />
              )}
              
              <div className="flex items-start gap-4">
                {/* Step Card */}
                <Card className={cn(
                  "w-[280px] flex-shrink-0 border-2",
                  executorConfig.borderColor,
                  executorConfig.bgColor
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        executorConfig.bgColor
                      )}>
                        <ExecutorIcon className={cn("w-5 h-5", executorConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">
                          {step.id}
                        </div>
                        <div className={cn("text-xs", executorConfig.color)}>
                          {executorConfig.label}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border/50">
                      <code className="break-all">{getStepDescription(step)}</code>
                    </div>
                    
                    {linkedRules.length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <span className="font-medium">{linkedRules.length}</span> regra{linkedRules.length !== 1 ? 's' : ''} vinculada{linkedRules.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Arrow */}
                {linkedRules.length > 0 && (
                  <div className="flex items-center pt-6">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                
                {/* Rules Card */}
                {linkedRules.length > 0 && (
                  <Card className="flex-1 border-border/50">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Regras de Compliance
                      </div>
                      <div className="space-y-2">
                        {linkedRules.map((rule) => {
                          const severityConfig = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.info;
                          
                          return (
                            <div 
                              key={rule.id}
                              className={cn(
                                "p-3 rounded-lg border",
                                rule.is_active ? 'bg-background' : 'bg-muted/30 opacity-60',
                                "border-border/50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                      {rule.code}
                                    </code>
                                    <Badge 
                                      className={cn(
                                        "text-[10px] px-1.5 py-0",
                                        severityConfig.bgColor,
                                        severityConfig.color
                                      )}
                                    >
                                      {severityConfig.label}
                                    </Badge>
                                    {!rule.is_active && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        Inativo
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm font-medium text-foreground truncate">
                                    {rule.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {rule.category}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Evaluation Logic */}
                              <div className="mt-2 pt-2 border-t border-border/30">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                  Lógica de Avaliação
                                </div>
                                <code className="text-xs bg-muted/50 px-2 py-1 rounded block text-muted-foreground">
                                  {getEvaluationDescription(rule.evaluation_logic)}
                                </code>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Empty rules placeholder */}
                {linkedRules.length === 0 && (
                  <div className="flex items-center pt-6 text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                    Nenhuma regra vinculada a este step
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Orphan Rules Section */}
      {orphanRules.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>{orphanRules.length} regra{orphanRules.length !== 1 ? 's' : ''} sem step vinculado</span>
          </div>
          <div className="grid gap-2">
            {orphanRules.map((rule) => {
              const severityConfig = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.info;
              
              return (
                <div 
                  key={rule.id}
                  className="flex items-center gap-3 p-2 rounded bg-amber-50 border border-amber-200"
                >
                  <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">
                    {rule.code}
                  </code>
                  <span className="text-sm text-foreground">{rule.name}</span>
                  <Badge 
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      severityConfig.bgColor,
                      severityConfig.color
                    )}
                  >
                    {severityConfig.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Categories Summary */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="text-sm font-medium text-foreground mb-4">
          Resumo por Categoria
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(rulesByCategory).map(([category, categoryRules]) => (
            <div 
              key={category}
              className="p-3 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="text-sm font-medium text-foreground truncate" title={category}>
                {category}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {categoryRules.length} regra{categoryRules.length !== 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {['critical', 'high', 'medium', 'low'].map((severity) => {
                  const count = categoryRules.filter(r => r.severity === severity).length;
                  if (count === 0) return null;
                  const config = SEVERITY_CONFIG[severity];
                  return (
                    <Badge 
                      key={severity}
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        config.bgColor,
                        config.color
                      )}
                    >
                      {count}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
