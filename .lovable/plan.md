

# Plano: Cores por Categoria no Relatório de Domínios Externos

## Objetivo

Aplicar o esquema visual de cores por categorias (como no módulo Security Insights) no relatório de domínios externos, subdividir a categoria "Autenticação de Email" em SPF, DKIM e DMARC, e incluir a **pontuação de aprovação** no header de cada categoria.

---

## Parte 1: Atualização do Banco de Dados

### Migração SQL

Criar uma migração para atualizar o campo `category` das regras existentes:

| Regra | Categoria Atual | Nova Categoria |
|-------|-----------------|----------------|
| SPF-001, SPF-002, SPF-003 | Autenticação de Email | Autenticação de Email - SPF |
| DKIM-001, DKIM-002, DKIM-003 | Autenticação de Email | Autenticação de Email - DKIM |
| DMARC-001 a DMARC-005 | Autenticação de Email | Autenticação de Email - DMARC |
| DNS-001 a DNS-006 | Segurança DNS | (mantém) |
| MX-001 a MX-005 | Infraestrutura de Email | (mantém) |

```sql
UPDATE compliance_rules 
SET category = 'Autenticação de Email - SPF'
WHERE code LIKE 'SPF-%';

UPDATE compliance_rules 
SET category = 'Autenticação de Email - DKIM'
WHERE code LIKE 'DKIM-%';

UPDATE compliance_rules 
SET category = 'Autenticação de Email - DMARC'
WHERE code LIKE 'DMARC-%';
```

---

## Parte 2: Novo Componente de Categoria

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

Componente inspirado no `InsightCategorySection`, adaptado para compliance de domínios externos.

### Layout do Header (Atualizado)

```text
+---------------------------------------------------------------------------------+
| [Icone] Nome da Categoria  [X verificações] [Y críticos]        [XX% aprovação] |
+---------------------------------------------------------------------------------+
|   +-- ComplianceCard 1 (item existente - não modificar)                         |
|   +-- ComplianceCard 2                                                          |
|   +-- ComplianceCard 3                                                          |
+---------------------------------------------------------------------------------+
```

### Esquema de Cores (Cores Frias)

| Categoria | Cor | Classes Tailwind |
|-----------|-----|------------------|
| Autenticação de Email - SPF | Azul | `bg-blue-500/10`, `text-blue-500`, `border-blue-500/30` |
| Autenticação de Email - DKIM | Ciano | `bg-cyan-500/10`, `text-cyan-500`, `border-cyan-500/30` |
| Autenticação de Email - DMARC | Indigo | `bg-indigo-500/10`, `text-indigo-500`, `border-indigo-500/30` |
| Segurança DNS | Verde-esmeralda | `bg-emerald-500/10`, `text-emerald-500`, `border-emerald-500/30` |
| Infraestrutura de Email | Violeta | `bg-violet-500/10`, `text-violet-500`, `border-violet-500/30` |

### Ícones por Categoria

| Categoria | Ícone Lucide |
|-----------|--------------|
| Autenticação de Email - SPF | `ShieldCheck` |
| Autenticação de Email - DKIM | `KeyRound` |
| Autenticação de Email - DMARC | `ShieldAlert` |
| Segurança DNS | `Globe` |
| Infraestrutura de Email | `Mail` |

### Funcionalidades do Componente

1. **Header colapsável** com cor de fundo e ícone da categoria
2. **Badge de verificações** mostrando quantidade total
3. **Badge de críticos/altos** (se houver falhas)
4. **Pontuação de aprovação** (`passRate`) no lado direito, com cores:
   - Verde (≥80%): `text-emerald-500`
   - Amarelo (≥60%): `text-amber-500`
   - Vermelho (<60%): `text-red-500`
5. **Chevron** para indicar estado expandido/colapsado
6. **ComplianceCards** (componente existente, sem modificações)

---

## Parte 3: Atualização da Página de Relatório

### Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

Alterações:

1. Importar o novo componente `ExternalDomainCategorySection`
2. Substituir `CategorySection` por `ExternalDomainCategorySection` na renderização
3. Manter todas as outras funcionalidades inalteradas

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Novo componente de categoria com cores e pontuação |
| `supabase/migrations/[timestamp]_split_email_auth_categories.sql` | Migração para subdividir categorias de email |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` | Usar novo componente de categoria |

## Arquivos que NÃO serão modificados

| Arquivo | Motivo |
|---------|--------|
| `src/components/ComplianceCard.tsx` | Itens dentro das categorias permanecem inalterados |
| `src/components/CategorySection.tsx` | Componente usado por outros módulos (Firewall) |

---

## Seção Técnica

### Estrutura do Novo Componente

```typescript
interface ExternalDomainCategorySectionProps {
  category: ComplianceCategory;
  index: number;
  defaultOpen?: boolean;
}

// Mapa de cores por categoria
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Autenticação de Email - SPF': { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  'Autenticação de Email - DKIM': { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/30' },
  'Autenticação de Email - DMARC': { bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/30' },
  'Segurança DNS': { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  'Infraestrutura de Email': { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/30' },
};

// Mapa de ícones por categoria
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Autenticação de Email - SPF': ShieldCheck,
  'Autenticação de Email - DKIM': KeyRound,
  'Autenticação de Email - DMARC': ShieldAlert,
  'Segurança DNS': Globe,
  'Infraestrutura de Email': Mail,
};
```

### Cálculo de Badges

```typescript
// Contagem de críticos/altos (falhas com severidade crítica ou alta)
const criticalCount = category.checks.filter(
  c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high')
).length;

// Cor da pontuação baseada no passRate
const getPassRateColor = (passRate: number) => {
  if (passRate >= 80) return 'text-emerald-500';
  if (passRate >= 60) return 'text-amber-500';
  return 'text-red-500';
};
```

---

## Resultado Esperado

Antes:
```text
[Fundo genérico] Autenticação de Email    12 verificações    85%
  - SPF-001, DKIM-001, DMARC-001...
```

Depois:
```text
[Fundo Azul]     Autenticação de Email - SPF    3 verificações    [0 críticos]    100%
  - SPF-001, SPF-002, SPF-003

[Fundo Ciano]    Autenticação de Email - DKIM   3 verificações    [1 crítico]     67%
  - DKIM-001, DKIM-002, DKIM-003

[Fundo Indigo]   Autenticação de Email - DMARC  5 verificações    [2 críticos]    60%
  - DMARC-001, DMARC-002...

[Fundo Verde]    Segurança DNS                  6 verificações    [0 críticos]    100%
  - DNS-001, DNS-002...

[Fundo Violeta]  Infraestrutura de Email        5 verificações    [0 críticos]    80%
  - MX-001, MX-002...
```

---

## Critérios de Aceite

1. Cada categoria tem cor de fundo e ícone específico (cores frias)
2. Header mostra: ícone, nome, quantidade de verificações, críticos (se houver) e pontuação
3. Pontuação usa cores semânticas (verde/amarelo/vermelho) baseadas no percentual
4. Categoria "Autenticação de Email" subdividida em SPF, DKIM e DMARC
5. ComplianceCards dentro das categorias permanecem inalterados
6. Cores quentes (vermelho/laranja/amarelo) reservadas para severidade de alertas

