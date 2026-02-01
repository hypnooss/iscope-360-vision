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
  FileText,
  Settings,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

// Category colors matching the compliance report
const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  'Segurança DNS': { 
    border: 'border-cyan-600', 
    bg: 'bg-cyan-600/5', 
    text: 'text-cyan-600' 
  },
  'Infraestrutura de Email': { 
    border: 'border-violet-500', 
    bg: 'bg-violet-500/5', 
    text: 'text-violet-500' 
  },
  'Autenticação de Email - SPF': { 
    border: 'border-emerald-600', 
    bg: 'bg-emerald-600/5', 
    text: 'text-emerald-600' 
  },
  'Autenticação de Email - DKIM': { 
    border: 'border-pink-500', 
    bg: 'bg-pink-500/5', 
    text: 'text-pink-500' 
  },
  'Autenticação de Email - DMARC': { 
    border: 'border-amber-500', 
    bg: 'bg-amber-500/5', 
    text: 'text-amber-500' 
  },
};

// Default category color
const DEFAULT_CATEGORY_COLOR = { 
  border: 'border-muted-foreground', 
  bg: 'bg-muted/5', 
  text: 'text-muted-foreground' 
};

// Executor configurations
const EXECUTOR_CONFIG: Record<string, { 
  icon: React.ElementType; 
  label: string; 
}> = {
  dns_query: { icon: Globe, label: 'DNS Query' },
  http_request: { icon: Server, label: 'HTTP Request' },
  http_session: { icon: Wifi, label: 'HTTP Session' },
  ssh: { icon: Terminal, label: 'SSH Command' },
  snmp: { icon: Database, label: 'SNMP Query' },
};

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

// Category order for display
const CATEGORY_ORDER = [
  'Segurança DNS',
  'Infraestrutura de Email',
  'Autenticação de Email - SPF',
  'Autenticação de Email - DKIM',
  'Autenticação de Email - DMARC',
];

// Mapping of step_id to the fields it generates (for showing parses)
const STEP_FIELDS: Record<string, string[]> = {
  'dnssec_status': ['data.has_dnskey', 'data.has_ds', 'data.validated'],
  'ns_records': ['data.records', 'data.records[].host'],
  'soa_record': ['data.mname', 'data.rname', 'data.contact_email', 'data.refresh', 'data.retry', 'data.expire', 'data.minimum', 'data.serial', 'data.ttl'],
  'mx_records': ['data.records', 'data.records[].exchange', 'data.records[].priority', 'data.records[].resolved_ips'],
  'spf_record': ['data.raw', 'data.parsed.all', 'data.parsed.includes'],
  'dkim_records': ['data.found', 'data.found[].selector', 'data.found[].key_size_bits', 'data.found[].key_type'],
  'dmarc_record': ['data.raw', 'data.parsed.p', 'data.parsed.sp', 'data.parsed.rua', 'data.parsed.ruf', 'data.parsed.pct', 'data.parsed.aspf', 'data.parsed.adkim'],
};

// Label translations from EvidenceDisplay (temporary - will come from DB later)
const LABEL_TRANSLATIONS: Record<string, string> = {
  'data.has_dnskey': 'Status DNSSEC',
  'data.has_ds': 'Registro DS',
  'data.validated': 'Validação DNSSEC',
  'data.mname': 'Servidor Primário',
  'data.rname': 'Email do Responsável',
  'data.contact_email': 'Contato do Administrador',
  'data.refresh': 'Tempo de Refresh',
  'data.serial': 'Número Serial',
  'data.expire': 'Tempo de Expiração',
  'data.minimum': 'TTL Mínimo',
  'data.retry': 'Tempo de Retry',
  'data.ttl': 'TTL',
  'data.records': 'Registros',
  'data.records[].host': 'Nameserver',
  'data.records[].exchange': 'Servidor MX',
  'data.records[].priority': 'Prioridade',
  'data.records[].resolved_ips': 'IPs Resolvidos',
  'data.parsed.includes': 'Mecanismos Include',
  'data.parsed.all': 'Política ALL',
  'data.raw': 'Registro Bruto',
  'data.found': 'Registros DKIM',
  'data.found[].selector': 'Seletor DKIM',
  'data.found[].key_size_bits': 'Tamanho da Chave',
  'data.found[].key_type': 'Tipo de Chave',
  'data.parsed.aspf': 'Alinhamento SPF',
  'data.parsed.adkim': 'Alinhamento DKIM',
  'data.parsed.pct': 'Cobertura',
  'data.parsed.p': 'Política DMARC',
  'data.parsed.sp': 'Política de Subdomínio',
  'data.parsed.rua': 'Relatórios (RUA)',
  'data.parsed.ruf': 'Relatórios Forenses (RUF)',
};

// Value transformations (temporary - will come from DB later)
const VALUE_TRANSFORMATIONS: Record<string, Record<string, string>> = {
  'data.has_dnskey': { 'true': 'DNSSEC Ativado', 'false': 'DNSSEC Desativado' },
  'data.has_ds': { 'true': 'Presente', 'false': 'Ausente' },
  'data.validated': { 'true': 'Validação OK', 'false': 'Não validado' },
  'data.parsed.aspf': { 'r': 'Relaxado (r)', 's': 'Estrito (s)' },
  'data.parsed.adkim': { 'r': 'Relaxado (r)', 's': 'Estrito (s)' },
  'data.parsed.p': { 'reject': 'Rejeitar', 'quarantine': 'Quarentena', 'none': 'Nenhuma' },
  'data.parsed.sp': { 'reject': 'Rejeitar', 'quarantine': 'Quarentena', 'none': 'Nenhuma' },
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

// Get evaluation logic as readable string
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

// Get parses for a step
function getParsesForStep(stepId: string): { field: string; label: string; transformations?: Record<string, string> }[] {
  const fields = STEP_FIELDS[stepId] || [];
  return fields.map(field => ({
    field,
    label: LABEL_TRANSLATIONS[field] || field,
    transformations: VALUE_TRANSFORMATIONS[field],
  }));
}

// Rule Flow Card Component
interface RuleFlowCardProps {
  rule: ComplianceRule;
  step?: CollectionStep;
}

function RuleFlowCard({ rule, step }: RuleFlowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const stepId = rule.evaluation_logic?.step_id;
  const parses = stepId ? getParsesForStep(stepId) : [];
  const executorConfig = step ? EXECUTOR_CONFIG[step.executor] : null;
  const ExecutorIcon = executorConfig?.icon || Database;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        "border rounded-lg bg-card transition-colors",
        "hover:border-primary/30"
      )}>
        {/* Rule Header */}
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
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
                      SEVERITY_COLORS[rule.severity] || SEVERITY_COLORS.info
                    )}
                  >
                    {SEVERITY_LABELS[rule.severity] || rule.severity}
                  </Badge>
                </div>
                {!isExpanded && rule.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    {rule.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        
        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
            {/* Description */}
            {rule.description && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5" />
                  Descrição da Regra
                </div>
                <p className="text-sm text-foreground pl-5">
                  {rule.description}
                </p>
              </div>
            )}
            
            {/* Evaluation Logic */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Settings className="w-3.5 h-3.5" />
                Análise Efetuada
              </div>
              <div className="pl-5">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded text-primary">
                  {getEvaluationDescription(rule.evaluation_logic)}
                </code>
              </div>
            </div>
            
            {/* Collection Step */}
            {step && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5" />
                  Step de Coleta
                </div>
                <div className="pl-5 flex items-center gap-2">
                  <ExecutorIcon className="w-4 h-4 text-muted-foreground" />
                  <code className="text-xs font-mono text-foreground">{stepId}</code>
                  <Badge variant="outline" className="text-xs">
                    {executorConfig?.label || step.executor}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {getStepDescription(step)}
                  </span>
                </div>
              </div>
            )}
            
            {/* Parses */}
            {parses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Parses (Traduções)
                </div>
                <div className="pl-5 space-y-1.5">
                  {parses.slice(0, 5).map((parse) => (
                    <div key={parse.field} className="flex items-start gap-2 text-xs">
                      <code className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {parse.field}
                      </code>
                      <ArrowRight className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">"{parse.label}"</span>
                    </div>
                  ))}
                  {parses.length > 5 && (
                    <div className="text-xs text-muted-foreground italic">
                      +{parses.length - 5} campos adicionais
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Category Section Component
interface CategorySectionProps {
  category: string;
  rules: ComplianceRule[];
  steps: CollectionStep[];
}

function CategorySection({ category, rules, steps }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const colors = CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;
  
  // Create a map of step_id to step for quick lookup
  const stepsMap = useMemo(() => {
    const map: Record<string, CollectionStep> = {};
    steps.forEach(step => {
      map[step.id] = step;
    });
    return map;
  }, [steps]);
  
  const activeRules = rules.filter(r => r.is_active).length;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        "border-l-4 rounded-lg",
        colors.border,
        colors.bg
      )}>
        {/* Category Header */}
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className={cn("w-5 h-5", colors.text)} />
                <span className={cn("font-semibold", colors.text)}>
                  {category}
                </span>
                <Badge variant="outline" className="text-xs">
                  {activeRules}/{rules.length} regras
                </Badge>
              </div>
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        
        {/* Rules List */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {rules
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((rule) => {
                const stepId = rule.evaluation_logic?.step_id;
                const step = stepId ? stepsMap[stepId] : undefined;
                return (
                  <RuleFlowCard 
                    key={rule.id} 
                    rule={rule} 
                    step={step}
                  />
                );
              })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function BlueprintFlowVisualization({ blueprint, rules }: BlueprintFlowVisualizationProps) {
  const steps = blueprint.collection_steps?.steps || [];
  
  // Group rules by category
  const rulesByCategory = useMemo(() => {
    const map: Record<string, ComplianceRule[]> = {};
    
    rules.forEach((rule) => {
      const category = rule.category;
      if (!map[category]) {
        map[category] = [];
      }
      map[category].push(rule);
    });
    
    return map;
  }, [rules]);
  
  // Get sorted categories (predefined order first, then alphabetically)
  const sortedCategories = useMemo(() => {
    const categories = Object.keys(rulesByCategory);
    return categories.sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a);
      const indexB = CATEGORY_ORDER.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [rulesByCategory]);
  
  // Count active rules
  const activeRulesCount = useMemo(() => {
    return rules.filter(r => r.is_active).length;
  }, [rules]);
  
  if (rules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhuma regra de compliance configurada para este dispositivo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span><strong className="text-foreground">{rules.length}</strong> regras de compliance</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-primary" />
          <span><strong className="text-foreground">{activeRulesCount}</strong> ativas</span>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <span><strong className="text-foreground">{sortedCategories.length}</strong> categorias</span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span><strong className="text-foreground">{steps.length}</strong> steps de coleta</span>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground">
        Visualização organizada por regras de compliance, espelhando o relatório exibido ao cliente. 
        Cada regra mostra os steps de coleta que a alimentam e os parses usados para traduzir os dados técnicos.
      </p>

      {/* Categories List */}
      <div className="space-y-4">
        {sortedCategories.map((category) => (
          <CategorySection
            key={category}
            category={category}
            rules={rulesByCategory[category]}
            steps={steps}
          />
        ))}
      </div>
    </div>
  );
}
