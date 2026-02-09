

# Padronizar Cards de Conformidade em Todo o Sistema

## Situacao Atual: 5 Cards Diferentes

O sistema possui 5 componentes de card distintos, cada um com estrutura, tipo de dados e logica de expansao diferentes:

| Componente | Usado em | Campos exibidos | Expansao |
|---|---|---|---|
| `ComplianceCard` | Firewall, Dominio Externo | name, description, severity, recommendation, evidence, technicalRisk, businessImpact, apiEndpoint, rawData | Inline |
| `M365InsightCard` | M365 Postura | code, titulo, descricaoExecutiva, severity, product, riscoTecnico, impactoNegocio, affectedEntities, remediacao | Inline + Dialog |
| `InsightCard` | Entra ID Security | code, title, description, severity, affectedCount, category | Dialog |
| `ExoInsightCard` | Exchange Online | code, title, description, severity, affectedCount | Dialog |
| `AppInsightCard` | Entra ID Applications | code, title, description, severity, affectedCount, category | Dialog |
| `RulePreviewCard` | Admin Templates | code, name, description, severity, recommendation, pass/fail/not_found descriptions, technicalRisk, businessImpact, apiEndpoint | Inline (Collapsible) |

## Problemas

1. **Inconsistencia visual**: cada card tem layout, icones e espacamento diferentes
2. **Duplicacao de codigo**: logica de severidade, status e cores repetida em cada componente
3. **Experiencia fragmentada**: o usuario ve estilos diferentes dependendo do modulo
4. **Manutencao dificil**: qualquer mudanca de design precisa ser replicada em 5+ arquivos

## Proposta: Hierarquia de Informacao em 3 Niveis

Criar um **unico componente** `UnifiedComplianceCard` com informacoes organizadas em camadas progressivas de profundidade:

### Nivel 1 - Visao Rapida (sempre visivel)
Informacoes para decisao rapida em ~2 segundos:

- **Icone de Status** (pass/fail/warning/not_found) com cor contextual
- **Codigo** da regra (ex: `EXO-001`, `FW-012`)
- **Nome** da verificacao
- **Badge de Severidade** (colorido apenas em falha, neutro em pass)
- **Mensagem contextual**: pass_description, fail_description ou not_found_description conforme o status

### Nivel 2 - Contexto Estrategico (visivel apenas em falha/warning, inline)
Informacoes que aparecem automaticamente quando o item falha:

- **Recomendacao** (texto curto, destaque em primary)
- **Entidades afetadas** (contagem + link para drill-down, quando aplicavel)

### Nivel 3 - Detalhes Expandiveis (click para expandir)
Informacoes tecnicas sob demanda:

- **Endpoint consultado** (apenas Super Admin)
- **Analise Efetuada** (description/details)
- **Risco Tecnico** (apenas em falha)
- **Impacto no Negocio** (apenas em falha)
- **Evidencias Coletadas** (dados humanizados)
- **Dados Brutos JSON** (apenas Super Admin)

### Resumo Visual

```text
+----------------------------------------------------------+
| [icon] CODE  Nome da Regra              [Severidade]     |  Nivel 1
|        Mensagem contextual (pass/fail/not_found)          |
|                                                          |
|   > Recomendacao (apenas falha)                          |  Nivel 2
|   ! 3 itens afetados >                                   |
|                                                          |
|   [v] Detalhes                                           |  Nivel 3
|   +------------------------------------------------------+
|   | Endpoint: /api/...                (super admin)      |
|   | ANALISE EFETUADA: ...                                |
|   | RISCO TECNICO: ...                (apenas falha)     |
|   | IMPACTO NO NEGOCIO: ...           (apenas falha)     |
|   | EVIDENCIAS: ...                                      |
|   | JSON bruto                        (super admin)      |
|   +------------------------------------------------------+
+----------------------------------------------------------+
```

## Plano Tecnico de Implementacao

### 1. Interface unificada `UnifiedComplianceItem`

Criar em `src/types/unifiedCompliance.ts` uma interface que consolida todos os campos dos 5 tipos atuais:

```typescript
interface UnifiedComplianceItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'not_found' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  
  // Mensagens contextuais por status
  passDescription?: string;
  failDescription?: string;
  notFoundDescription?: string;
  
  // Contexto estrategico
  recommendation?: string;
  technicalRisk?: string;
  businessImpact?: string;
  
  // Evidencias e dados
  apiEndpoint?: string;
  evidence?: EvidenceItem[];
  rawData?: Record<string, unknown>;
  details?: string;
  
  // Entidades afetadas
  affectedEntities?: AffectedEntity[];
  affectedCount?: number;
  
  // Remediacao
  remediation?: RemediationGuide;
  
  // Metadata
  product?: string;
  source?: string;
}
```

### 2. Componente `UnifiedComplianceCard`

Criar em `src/components/compliance/UnifiedComplianceCard.tsx`:

- Reutiliza a estrutura do `ComplianceCard` atual (mais completo)
- Incorpora o sistema de `affectedEntities` do `M365InsightCard`
- Incorpora o botao "Como Corrigir" com dialog
- Suporte a `not_found` status do `RulePreviewCard`
- Logica de role-based visibility (endpoint e JSON para super_admin)

### 3. Funcoes adaptadoras (mappers)

Criar mappers em `src/lib/complianceMappers.ts` para converter cada tipo existente para `UnifiedComplianceItem`:

- `mapComplianceCheck(check: ComplianceCheck): UnifiedComplianceItem`
- `mapM365Insight(insight: M365Insight): UnifiedComplianceItem`
- `mapSecurityInsight(insight: SecurityInsight): UnifiedComplianceItem`
- `mapExchangeInsight(insight: ExchangeInsight): UnifiedComplianceItem`
- `mapApplicationInsight(insight: ApplicationInsight): UnifiedComplianceItem`

### 4. Migracao progressiva

Substituir os cards existentes modulo a modulo:

1. **Fase 1**: Criar `UnifiedComplianceCard` + tipo + mappers
2. **Fase 2**: Migrar `ComplianceCard` (Firewall/Dominio) -- maior uso
3. **Fase 3**: Migrar `M365InsightCard` (Postura M365)
4. **Fase 4**: Migrar `InsightCard`, `ExoInsightCard`, `AppInsightCard`
5. **Fase 5**: Atualizar `RulePreviewCard` para usar o mesmo componente com prop `previewMode`
6. **Fase 6**: Remover componentes antigos

### 5. Manter `RulePreviewCard` como wrapper

O `RulePreviewCard` continuara existindo como wrapper do `UnifiedComplianceCard` com:
- Botoes de toggle (Sucesso/Falha/N/A)
- Prop `previewMode` que desabilita interacoes reais

Isso garante que o admin veja exatamente o mesmo layout que o usuario final.

## Arquivos envolvidos

| Arquivo | Acao |
|---|---|
| `src/types/unifiedCompliance.ts` | **Novo** - Interface unificada |
| `src/lib/complianceMappers.ts` | **Novo** - Funcoes de conversao |
| `src/components/compliance/UnifiedComplianceCard.tsx` | **Novo** - Componente unico |
| `src/components/ComplianceCard.tsx` | Migrar para usar UnifiedComplianceCard |
| `src/components/m365/posture/M365InsightCard.tsx` | Migrar para usar UnifiedComplianceCard |
| `src/components/m365/insights/InsightCard.tsx` | Migrar para usar UnifiedComplianceCard |
| `src/components/m365/exchange/ExoInsightCard.tsx` | Migrar para usar UnifiedComplianceCard |
| `src/components/m365/applications/AppInsightCard.tsx` | Migrar para usar UnifiedComplianceCard |
| `src/components/admin/RulePreviewCard.tsx` | Atualizar para wrapper do UnifiedComplianceCard |

