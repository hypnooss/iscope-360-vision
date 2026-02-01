# Estrutura de Relatórios de Compliance

Este documento descreve os layouts reutilizáveis para relatórios de compliance, tanto na versão web quanto na exportação para PDF.

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    RELATÓRIO DE COMPLIANCE                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌──────────────────────────────────────┐ │
│  │  Score Gauge    │   │  Stats Cards (Total/Pass/Fail)       │ │
│  │  (Circular)     │   │  + Info Panel (detalhes contextuais) │ │
│  └─────────────────┘   └──────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Category Sections (Collapsible)                             ││
│  │  ├── Header: Ícone + Nome + Badges de Severidade + PassRate ││
│  │  └── Content: Lista de ComplianceCards                       ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Parte 1: Componentes Web

### 1.1 Command Center Header

O cabeçalho principal do relatório com score gauge e estatísticas.

**Localização:** Inline em cada página de relatório (pode ser extraído para componente reutilizável)

```typescript
interface CommandCenterHeaderProps {
  score: number;           // 0-100
  totalChecks: number;
  passed: number;
  failed: number;
  warnings?: number;
  contextualInfo?: DetailRowProps[];  // Informações específicas do módulo
}
```

#### MiniStat Component

Cards compactos para estatísticas.

```typescript
interface MiniStatProps {
  value: number;
  label: string;
  variant?: "default" | "primary" | "success" | "destructive";
}

// Variantes de cor:
// - primary: Sky-400/Blue (Total)
// - success: Primary/Teal (Aprovadas)
// - destructive: Rose-400 (Falhas)
```

#### DetailRow Component

Linhas de informação estruturada com label e valor.

```typescript
interface DetailRowProps {
  label: string;
  value: string | string[];
  indicator?: "success" | "error";  // Bolinha colorida
  highlight?: boolean;              // Destaque em cor primária
}
```

---

### 1.2 Score Gauge

Gauge circular para exibição de pontuação.

**Localização:** `src/components/ScoreGauge.tsx`

```typescript
interface ScoreGaugeProps {
  score: number;           // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
```

**Cores:**
- Score ≥ 75: `text-primary` (Teal/Verde-água)
- Score ≥ 50: `text-yellow-500`
- Score < 50: `text-red-500`

---

### 1.3 StatCard

Cards de estatísticas com ícone.

**Localização:** `src/components/StatCard.tsx`

```typescript
interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'success' | 'destructive' | 'warning' | 'default';
  delay?: number;      // Animation delay
  compact?: boolean;   // Modo compacto
}
```

**Estilos por Variante:**
| Variante | Fundo | Borda | Texto |
|----------|-------|-------|-------|
| success | `bg-success/5` | `border-success/30` | `text-success` |
| destructive | `bg-destructive/5` | `border-destructive/30` | `text-destructive` |
| warning | `bg-warning/5` | `border-warning/30` | `text-warning` |
| default | `bg-primary/5` | `border-primary/30` | `text-primary` |

---

### 1.4 CategorySection (Collapsible)

Seção colapsável que agrupa verificações por categoria.

**Localização:** `src/components/external-domain/ExternalDomainCategorySection.tsx`

```typescript
interface CategorySectionProps {
  category: ComplianceCategory;
  index: number;             // Para animação de delay
  defaultOpen?: boolean;
}

interface ComplianceCategory {
  name: string;
  icon: string;
  checks: ComplianceCheck[];
  passRate: number;          // 0-100
}
```

**Header da Categoria:**
- Ícone específico da categoria
- Nome da categoria
- Badge com total de verificações
- Badges de severidade (apenas para falhas):
  - Crítico: `bg-red-500/10 text-red-500`
  - Alto: `bg-orange-500/10 text-orange-500`
  - Médio: `bg-yellow-500/10 text-yellow-500`
  - Baixo: `bg-blue-400/10 text-blue-400`
- Pass rate no lado direito

---

### 1.5 ComplianceCard

Card individual para cada verificação de compliance.

**Localização:** `src/components/ComplianceCard.tsx`

```typescript
interface ComplianceCardProps {
  check: ComplianceCheck;
  variant?: 'firewall' | 'external_domain';
  categoryColorKey?: string;
}

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation?: string;
  details?: string;
  evidence?: EvidenceItem[];
  rawData?: Record<string, unknown>;  // Para super_admin
  apiEndpoint?: string;               // Para super_admin
}
```

**Estados do Card:**
| Estado | Conteúdo Visível |
|--------|------------------|
| Contraído | Nome, descrição, recomendação |
| Expandido | + Análise detalhada, evidências coletadas |

---

### 1.6 EvidenceDisplay

Exibição humanizada de evidências técnicas.

**Localização:** `src/components/compliance/EvidenceDisplay.tsx`

```typescript
interface EvidenceDisplayProps {
  evidence: EvidenceItem[];
  ruleId?: string;        // Para filtragem específica por regra
  rawData?: Record<string, unknown>;
}

interface EvidenceItem {
  label: string;
  value: string;
  type?: 'text' | 'code' | 'list' | 'json';
}
```

**Estilos:**
- Borda esquerda verde: `border-l-2 border-primary/30 pl-3`
- Múltiplos valores renderizados em blocos individuais

---

## Parte 2: Componentes PDF

### 2.1 Estrutura de Páginas

```
┌─────────────────────────────────────────────────────────────────┐
│  PÁGINA 1: RESUMO EXECUTIVO                                      │
│  ├── PDFHeader (cyber-grid + logo + título)                     │
│  ├── PDFScoreGauge (gauge circular)                             │
│  ├── PDFComplianceStats (cards de estatísticas)                 │
│  ├── PDFDomainInfo / PDFFirewallInfo (painel de detalhes)       │
│  └── PDFCategorySummaryTable (tabela resumo por categoria)      │
├─────────────────────────────────────────────────────────────────┤
│  PÁGINA 2: PROBLEMAS ENCONTRADOS                                 │
│  └── PDFIssuesSummary (lista de até 20 issues)                  │
├─────────────────────────────────────────────────────────────────┤
│  PÁGINAS 3+: DETALHAMENTO POR CATEGORIA                          │
│  ├── securityNotice (aviso sobre evidências)                    │
│  └── PDFCategorySection[] (cards individuais)                   │
│      ├── Header com cor da categoria                            │
│      ├── Checks com falha (expandidos)                          │
│      └── Checks aprovados (compactos)                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Componentes Reutilizáveis

**Localização:** `src/components/pdf/sections/`

| Componente | Arquivo | Propósito |
|------------|---------|-----------|
| PDFHeader | `PDFHeader.tsx` | Cabeçalho com cyber-grid, logo e título |
| PDFScoreGauge | `PDFScoreGauge.tsx` | Gauge circular para PDF |
| PDFComplianceStats | N/A (inline) | Cards de estatísticas |
| PDFDomainInfo | `PDFDomainInfo.tsx` | Painel de info para domínios |
| PDFFirewallInfo | `PDFFirewallInfo.tsx` | Painel de info para firewalls |
| PDFCategorySummaryTable | `PDFCategorySummaryTable.tsx` | Tabela resumo |
| PDFCategorySection | `PDFCategorySection.tsx` | Seção de categoria com checks |
| PDFIssuesSummary | `PDFIssuesSummary.tsx` | Lista de problemas |
| PDFFooter | `PDFFooter.tsx` | Rodapé com paginação |

### 2.3 Estilos Comuns

**Localização:** `src/components/pdf/styles/pdfStyles.ts`

```typescript
// Cores
export const colors = {
  primary: '#0D9488',      // Teal-600
  textPrimary: '#1F2937',  // Gray-800
  textSecondary: '#6B7280', // Gray-500
  border: '#E5E7EB',       // Gray-200
  background: '#FFFFFF',
  // Severidades
  critical: '#EF4444',     // Red-500
  high: '#F97316',         // Orange-500
  medium: '#EAB308',       // Yellow-500
  low: '#3B82F6',          // Blue-500
};

// Tipografia
export const typography = {
  title: 20,
  heading: 14,
  body: 10,
  bodySmall: 9,
  caption: 8,
  bold: 'Helvetica-Bold',
  regular: 'Helvetica',
};

// Espaçamentos
export const spacing = {
  pageMargin: 40,
  sectionGap: 20,
  cardGap: 12,
  itemGap: 8,
  tight: 4,
};
```

---

## Parte 3: Paleta de Cores por Categoria

### Domínios Externos

| Categoria | Tailwind | Hex | Uso |
|-----------|----------|-----|-----|
| Segurança DNS | `cyan-600` | `#0891B2` | Bordas, ícones, texto |
| Infraestrutura de Email | `violet-500` | `#8B5CF6` | Bordas, ícones, texto |
| SPF | `emerald-600` | `#059669` | Bordas, ícones, texto |
| DKIM | `pink-500` | `#EC4899` | Bordas, ícones, texto |
| DMARC | `amber-500` | `#F59E0B` | Bordas, ícones, texto |

### Firewall (Sugestão)

| Categoria | Tailwind | Hex | Uso |
|-----------|----------|-----|-----|
| Segurança de Rede | `blue-600` | `#2563EB` | Bordas, ícones, texto |
| Autenticação | `indigo-500` | `#6366F1` | Bordas, ícones, texto |
| Logging | `slate-500` | `#64748B` | Bordas, ícones, texto |
| VPN | `purple-500` | `#A855F7` | Bordas, ícones, texto |
| Configuração | `teal-500` | `#14B8A6` | Bordas, ícones, texto |

### Severidades (Universal)

| Severidade | Tailwind | Hex |
|------------|----------|-----|
| Crítico | `red-500` | `#EF4444` |
| Alto | `orange-500` | `#F97316` |
| Médio | `yellow-500` | `#EAB308` |
| Baixo | `blue-400` | `#60A5FA` |
| Info | `gray-500` | `#6B7280` |

---

## Parte 4: Guia de Implementação para Novos Módulos

### Passo 1: Criar CategorySection Específico

```typescript
// src/components/{module}/ModuleCategorySection.tsx
import { CategorySection } from '../CategorySection'; // Base

const CATEGORY_COLORS: Record<string, CategoryColors> = {
  'Nome da Categoria': {
    bg: 'bg-blue-600/5',
    text: 'text-blue-600',
    border: 'border-blue-600/30'
  },
  // ...
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Nome da Categoria': ShieldIcon,
  // ...
};
```

### Passo 2: Criar Página de Relatório

```typescript
// src/pages/{module}/ModuleAnalysisReportPage.tsx
// Seguir estrutura de ExternalDomainAnalysisReportPage.tsx:
// 1. Command Center Header com Score + Stats
// 2. Painel de informações contextuais
// 3. Seções de categorias colapsáveis
```

### Passo 3: Criar Componente PDF

```typescript
// src/components/pdf/ModulePDF.tsx
// Seguir estrutura de ExternalDomainPDF.tsx:
// 1. Página 1: Resumo Executivo
// 2. Página 2: Problemas Encontrados
// 3. Páginas 3+: Detalhamento por Categoria
```

### Passo 4: Integrar com Hook de Download

```typescript
import { usePDFDownload } from '@/hooks/usePDFDownload';
import { ModulePDF } from '@/components/pdf/ModulePDF';

const { downloadPDF, isGenerating } = usePDFDownload();

const handleExport = () => {
  downloadPDF(
    <ModulePDF report={report} moduleInfo={info} />,
    filename
  );
};
```

---

## Parte 5: Fluxo de Dados

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Blueprint    │────▶│   Agent Task    │────▶│  Step Results   │
│  (collection    │     │   (execução)    │     │  (dados brutos) │
│    steps)       │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Relatório     │◀────│  Regras de      │◀────│   Avaliação     │
│   (Frontend)    │     │   Compliance    │     │   (Backend)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Estrutura de Regra de Compliance

```typescript
interface ComplianceRule {
  id: string;
  code: string;           // Ex: "SPF-001"
  name: string;           // Nome humanizado
  description: string;    // O que a regra verifica
  category: string;       // Categoria no relatório
  severity: Severity;     // Impacto da falha
  weight: number;         // Peso no cálculo do score
  recommendation: string; // O que fazer se falhar
  pass_description: string;  // Mensagem de sucesso
  fail_description: string;  // Mensagem de falha
  evaluation_logic: {
    step_id: string;      // ID do step que fornece os dados
    field: string;        // Campo a ser avaliado
    operator: string;     // 'eq', 'not_null', 'in', 'gt', 'lt'
    value: any;           // Valor esperado
  };
}
```

---

## Changelog

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-02-01 | 1.0.0 | Documentação inicial baseada no módulo de Domínios Externos |
