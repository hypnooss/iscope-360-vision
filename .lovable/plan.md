
# Plano: Adaptar Visualização de Fluxo de Análise

## Objetivo

Transformar os cards da aba **Fluxo de Análise** em previews do relatório real, exibindo as informações cadastradas (Risco Técnico, Impacto no Negócio, Endpoint, etc.) em dois estados: **Sucesso** e **Falha**.

---

## Situação Atual

| Componente | Status |
|------------|--------|
| `ComplianceRuleBasic` | NÃO inclui campos `technical_risk`, `business_impact`, `api_endpoint` |
| `RuleFlowCard` em `BlueprintFlowVisualization.tsx` | Layout técnico focado em avaliação e parses |
| `ComplianceCard.tsx` | Layout do relatório real com seções expandidas |

---

## Alterações Necessárias

### 1. Atualizar `ComplianceRuleBasic` em `src/types/complianceRule.ts`

Incluir os campos de metadados no tipo simplificado:

```typescript
export interface ComplianceRuleBasic {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  severity: string;
  weight: number;
  evaluation_logic: Record<string, any>;
  is_active: boolean;
  // Campos adicionados
  recommendation: string | null;
  pass_description: string | null;
  fail_description: string | null;
  technical_risk: string | null;
  business_impact: string | null;
  api_endpoint: string | null;
}
```

---

### 2. Reescrever `RuleFlowCard` em `BlueprintFlowVisualization.tsx`

Criar um novo layout que simula o relatório real com toggle de estado:

**Header do Card:**
- Código da regra + Nome
- Badge de severidade (com cores condicionais)
- Toggle para alternar entre SUCESSO e FALHA

**Corpo do Card (colapsável):**

| Estado | Conteúdo |
|--------|----------|
| SUCESSO (pass) | Ícone verde, badge neutra, mensagem de sucesso (`pass_description`) |
| FALHA (fail) | Ícone vermelho, badge colorida, recomendação + seções completas |

**Seções Expandidas (apenas no estado FALHA):**

```text
┌─────────────────────────────────────────────────────────────┐
│ [Endpoint consultado] (admin only)                          │
│   GET /api/v2/cmdb/system/ha                                │
├─────────────────────────────────────────────────────────────┤
│ ANÁLISE EFETUADA                                            │
│   Verifica se há múltiplas interfaces de heartbeat...       │
├─────────────────────────────────────────────────────────────┤
│ RISCO TÉCNICO                                               │
│   Com apenas uma interface de heartbeat, uma falha...       │
├─────────────────────────────────────────────────────────────┤
│ IMPACTO NO NEGÓCIO                                          │
│   Split-brain causa queda total da rede: ambos os...        │
├─────────────────────────────────────────────────────────────┤
│ EVIDÊNCIAS (placeholder)                                    │
│   [Dados coletados em runtime pelo agente]                  │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. Estrutura do Novo Card

```tsx
function RulePreviewCard({ rule }: { rule: ComplianceRule }) {
  const [previewState, setPreviewState] = useState<'pass' | 'fail'>('fail');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusConfig = {
    pass: { 
      icon: CheckCircle, 
      className: 'status-pass', 
      label: 'Aprovado',
      message: rule.pass_description || 'Configuração conforme esperado'
    },
    fail: { 
      icon: XCircle, 
      className: 'status-fail', 
      label: 'Falha',
      message: rule.fail_description || 'Configuração fora do esperado'
    },
  };
  
  const config = statusConfig[previewState];
  const StatusIcon = config.icon;
  
  // Só mostra seções de risco quando em estado de falha
  const showRiskSections = previewState === 'fail';

  return (
    <div className="glass-card rounded-lg p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg border", config.className)}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-semibold">{rule.code}</code>
              <span className="text-muted-foreground">•</span>
              <span className="font-medium">{rule.name}</span>
              <SeverityBadge severity={rule.severity} status={previewState} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {config.message}
            </p>
          </div>
        </div>
        
        {/* Toggle Sucesso/Falha */}
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant={previewState === 'pass' ? 'default' : 'outline'}
            onClick={() => setPreviewState('pass')}
          >
            Sucesso
          </Button>
          <Button 
            size="sm" 
            variant={previewState === 'fail' ? 'destructive' : 'outline'}
            onClick={() => setPreviewState('fail')}
          >
            Falha
          </Button>
        </div>
      </div>
      
      {/* Recomendação (apenas em falha) */}
      {showRiskSections && rule.recommendation && (
        <p className="text-xs text-primary mt-2 flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          {rule.recommendation}
        </p>
      )}
      
      {/* Expandir detalhes */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ver detalhes do card</span>
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            
            {/* Endpoint consultado (admin only) */}
            {rule.api_endpoint && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="w-3 h-3" />
                <span>Endpoint: <code>{rule.api_endpoint}</code></span>
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
            <Section title="EVIDÊNCIAS COLETADAS" icon={FileText}>
              <span className="text-muted-foreground italic">
                [Dados coletados em runtime pelo agente]
              </span>
            </Section>
            
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
```

---

### 4. Diagrama Visual

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│  [✓] ha-003 • Heartbeat HA Redundante         [Crítico]   [Sucesso] [Falha]  │
│      Múltiplas interfaces de heartbeat configuradas                          │
│                                                                               │
│      ▶ Ver detalhes do card                                                  │
└───────────────────────────────────────────────────────────────────────────────┘

                    ▼ (toggle para Falha)

┌───────────────────────────────────────────────────────────────────────────────┐
│  [✗] ha-003 • Heartbeat HA Redundante         [Crítico]   [Sucesso] [Falha]  │
│      Apenas uma interface de heartbeat - sem redundância                     │
│      → Configure múltiplas interfaces de heartbeat para evitar split-brain   │
│                                                                               │
│      ▼ Ver detalhes do card                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Endpoint: GET /api/v2/monitor/system/ha-peer                            │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │ ANÁLISE EFETUADA                                                        │ │
│  │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ Verifica se há múltiplas interfaces de heartbeat configuradas...   │ │ │
│  │ └─────────────────────────────────────────────────────────────────────┘ │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │ RISCO TÉCNICO                                                           │ │
│  │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ Com apenas uma interface de heartbeat, uma falha nesse link pode   │ │ │
│  │ │ causar split-brain, onde ambos os firewalls assumem papel primário.│ │ │
│  │ └─────────────────────────────────────────────────────────────────────┘ │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │ IMPACTO NO NEGÓCIO                                                      │ │
│  │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ Split-brain causa queda total da rede: ambos os firewalls respondem│ │ │
│  │ │ pelo mesmo IP, corrompendo tabelas ARP, derrubando sessões ativas. │ │ │
│  │ └─────────────────────────────────────────────────────────────────────┘ │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │ EVIDÊNCIAS COLETADAS                                                    │ │
│  │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ [Dados coletados em runtime pelo agente]                            │ │ │
│  │ └─────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/types/complianceRule.ts` | Adicionar campos ao `ComplianceRuleBasic` |
| `src/components/admin/BlueprintFlowVisualization.tsx` | Reescrever `RuleFlowCard` com preview de estados |

---

## Benefícios

- Administrador visualiza exatamente como o card aparecerá no relatório
- Toggle permite verificar mensagens de sucesso e falha
- Campos de Risco Técnico e Impacto são visíveis no contexto correto
- Facilita revisão e ajuste de textos antes da publicação
