

## Documentação de Layouts e Visualização de Blueprints/Regras

### Objetivo

Criar dois entregáveis:

1. **Documentação de layouts reutilizáveis** (web e PDF) para replicar em outros módulos
2. **Nova visualização na tela Administração > Coletas** que mostra a relação entre blueprints, steps e regras de forma visual e humanizada

---

## Parte 1: Documentação de Layouts Reutilizáveis

### Estrutura de Componentes Web (Relatório de Compliance)

```text
┌─────────────────────────────────────────────────────────────────┐
│  ExternalDomainAnalysisReportPage.tsx                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  COMMAND CENTER HEADER                                       ││
│  │  ├── ScoreGauge (circular, 180px)                           ││
│  │  ├── MiniStat[] (Total, Aprovadas, Falhas)                  ││
│  │  │   ├── variant: primary (Sky-400)                         ││
│  │  │   ├── variant: success (Primary/Teal)                    ││
│  │  │   └── variant: destructive (Rose-400)                    ││
│  │  └── DetailRow[] (informações contextuais)                  ││
│  │      ├── Nameservers                                        ││
│  │      ├── DNSSEC Status                                      ││
│  │      ├── SPF/DKIM/DMARC indicators                         ││
│  │      └── divider gradiente entre linhas                     ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  CATEGORY SECTIONS (Collapsible)                            ││
│  │  ExternalDomainCategorySection.tsx                          ││
│  │  ├── Header com ícone + nome + badges de severidade         ││
│  │  │   ├── criticalCount → Badge vermelho                    ││
│  │  │   ├── highCount → Badge laranja                         ││
│  │  │   ├── mediumCount → Badge amarelo                       ││
│  │  │   └── lowCount → Badge azul                             ││
│  │  ├── Pass rate no lado direito                              ││
│  │  └── Lista de ComplianceCard[]                              ││
│  │      ├── Estado contraído: nome + descrição + recomendação ││
│  │      └── Estado expandido: + análise + evidências           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Estrutura de Componentes PDF

```text
┌─────────────────────────────────────────────────────────────────┐
│  ExternalDomainPDF.tsx / FirewallPDF.tsx                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PÁGINA 1: RESUMO EXECUTIVO                                  ││
│  │  ├── PDFHeader (cyber-grid + logo + título)                 ││
│  │  ├── PDFScoreGauge (gauge circular)                         ││
│  │  ├── PDFComplianceStats (cards de estatísticas)             ││
│  │  ├── PDFDomainInfo / PDFFirewallInfo (painel de detalhes)   ││
│  │  └── PDFCategorySummaryTable (tabela resumo por categoria)  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PÁGINA 2: PROBLEMAS ENCONTRADOS                            ││
│  │  └── PDFIssuesSummary (lista de até 20 issues)              ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PÁGINAS 3+: DETALHAMENTO POR CATEGORIA                     ││
│  │  ├── securityNotice (aviso sobre evidências)                ││
│  │  └── PDFCategorySection[] (cards individuais)               ││
│  │      ├── Header com cor da categoria                        ││
│  │      ├── Checks com falha (expandidos)                      ││
│  │      └── Checks aprovados (compactos)                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Paleta de Cores por Categoria (Domínios Externos)

| Categoria | Cor Tailwind | Hex | Uso |
|-----------|--------------|-----|-----|
| Segurança DNS | Cyan-600 | #0891B2 | Bordas, ícones, texto |
| Infraestrutura de Email | Violet-500 | #8B5CF6 | Bordas, ícones, texto |
| SPF | Emerald-600 | #059669 | Bordas, ícones, texto |
| DKIM | Pink-500 | #EC4899 | Bordas, ícones, texto |
| DMARC | Amber-500 | #F59E0B | Bordas, ícones, texto |

### Componentes Reutilizáveis para Novos Módulos

| Componente | Localização | Propósito |
|------------|-------------|-----------|
| `ScoreGauge` | `src/components/ScoreGauge.tsx` | Gauge circular de score |
| `ComplianceCard` | `src/components/ComplianceCard.tsx` | Card de verificação individual |
| `CategorySection` | `src/components/CategorySection.tsx` | Seção colapsável de categoria |
| `StatCard` | `src/components/StatCard.tsx` | Cards de estatísticas |
| `EvidenceDisplay` | `src/components/compliance/EvidenceDisplay.tsx` | Exibição humanizada de evidências |

---

## Parte 2: Nova Visualização na Tela de Coletas

### Conceito

Transformar a visualização técnica atual (JSON bruto) em um diagrama visual que mostra:

```text
┌─────────────────────────────────────────────────────────────────┐
│  BLUEPRINT: External Domain DNS Scan                            │
│  ├── 7 steps de coleta                                          │
│  └── 23 regras de compliance                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐       ┌──────────────────────────────────┐│
│  │  STEP: ns_records│──────▶│  REGRAS:                         ││
│  │  Tipo: dns_query │       │  ├── DNS-003: Redundância NS     ││
│  │  Query: NS       │       │  └── DNS-004: Diversidade NS     ││
│  └──────────────────┘       └──────────────────────────────────┘│
│                                                                 │
│  ┌──────────────────┐       ┌──────────────────────────────────┐│
│  │  STEP: mx_records│──────▶│  REGRAS:                         ││
│  │  Tipo: dns_query │       │  ├── MX-001: MX Configurado      ││
│  │  Query: MX       │       │  ├── MX-002: Redundância MX      ││
│  │                  │       │  ├── MX-003: Prioridades MX      ││
│  │                  │       │  └── MX-004: MX Hostname         ││
│  └──────────────────┘       └──────────────────────────────────┘│
│                                                                 │
│  ┌──────────────────┐       ┌──────────────────────────────────┐│
│  │  STEP: spf_record│──────▶│  REGRAS:                         ││
│  │  Tipo: dns_query │       │  ├── SPF-001: SPF Configurado    ││
│  │  Query: SPF      │       │  ├── SPF-002: Política Restritiva││
│  │                  │       │  └── SPF-003: Limite DNS Lookups ││
│  └──────────────────┘       └──────────────────────────────────┘│
│                                                                 │
│  ... (demais steps)                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Arquivos a Criar

1. **`src/components/admin/BlueprintFlowVisualization.tsx`**
   - Componente que renderiza o diagrama visual
   - Conecta steps do blueprint às regras de compliance
   - Mostra o fluxo de dados

2. **Modificar `src/components/admin/DeviceTypeCard.tsx`**
   - Adicionar aba/seção "Visualização do Fluxo"
   - Integrar o novo componente

### Lógica de Conexão Step → Regras

Para cada step do blueprint, buscar regras onde:
```typescript
rule.evaluation_logic.step_id === step.id
```

Exemplo de mapeamento:
```typescript
const stepToRulesMap = {
  'ns_records': ['DNS-003', 'DNS-004'],
  'mx_records': ['MX-001', 'MX-002', 'MX-003', 'MX-004'],
  'soa_record': ['MX-005', 'DNS-005', 'DNS-006'],
  'spf_record': ['SPF-001', 'SPF-002', 'SPF-003'],
  'dmarc_record': ['DMARC-001', 'DMARC-002', 'DMARC-003', 'DMARC-004', 'DMARC-005', 'DMARC-006'],
  'dkim_records': ['DKIM-001', 'DKIM-002', 'DKIM-003'],
  'dnssec_status': ['DNS-001', 'DNS-002'],
};
```

### Informações a Exibir por Step

| Campo | Origem | Exibição |
|-------|--------|----------|
| ID do Step | `step.id` | Nome identificador |
| Tipo | `step.type` | `dns_query`, `http_request`, etc. |
| Configuração | `step.config` | Query type, parâmetros |
| Regras Dependentes | `rules.filter(r => r.evaluation_logic.step_id === step.id)` | Lista de códigos |

### Informações a Exibir por Regra (Tooltip/Expandido)

| Campo | Exibição |
|-------|----------|
| Código | `SPF-001` |
| Nome | Nome humanizado |
| Categoria | Categoria no relatório |
| Severidade | Badge colorido |
| Campo Avaliado | `evaluation_logic.field` |
| Operador | `eq`, `not_null`, `in`, etc. |
| Valor Esperado | `evaluation_logic.value` |

### Interface do Componente

```typescript
interface BlueprintFlowVisualizationProps {
  blueprint: Blueprint;
  rules: ComplianceRule[];
}

// Cada step terá um card visual
interface StepCard {
  id: string;
  type: string;
  config: Record<string, any>;
  linkedRules: ComplianceRule[];
}
```

### Estilos Visuais

- Steps: Cards com borda esquerda colorida (por tipo de executor)
- Conexões: Linhas ou setas visuais (CSS)
- Regras: Lista com badges de severidade
- Agrupamento por categoria no lado das regras

---

## Resumo da Implementação

### Fase 1: Documentação
- Criar arquivo markdown em `docs/layouts/compliance-report-structure.md`
- Documentar todos os componentes, props e estilos
- Incluir exemplos de uso para novos módulos

### Fase 2: Visualização de Fluxo
- Criar `BlueprintFlowVisualization.tsx`
- Integrar na tela de Coletas
- Adicionar toggle para alternar entre visualização JSON e visual

### Estimativa de Complexidade
- Documentação: Baixa
- Visualização de Fluxo: Média (novo componente + lógica de mapeamento)

