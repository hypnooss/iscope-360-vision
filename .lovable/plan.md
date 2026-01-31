
# Plano: Ajustes Finais no Relatório de Domínio Externo

## Resumo das Alterações

Três ajustes visuais e de lógica:

1. **Badges nas categorias**: Mostrar TODOS os níveis de severidade ATIVOS (itens com status `fail`)
2. **Banner vermelho**: Contar SOMENTE itens com severidade `critical`
3. **Gauge (ScoreGauge)**: Usar a cor verde-água (primary) do tema

---

## 1. Badges nas Categorias

### Arquivo: `src/components/external-domain/ExternalDomainCategorySection.tsx`

Adicionar contagem para medium e low, além de critical e high:

**Adicionar após linha 79 (depois de highCount):**
```typescript
const mediumCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'medium'
).length;

const lowCount = category.checks.filter(
  c => c.status === 'fail' && c.severity === 'low'
).length;
```

**Adicionar badges após linha 118 (depois do badge de alto):**
```tsx
{mediumCount > 0 && (
  <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
    {mediumCount} médio{mediumCount !== 1 ? 's' : ''}
  </Badge>
)}
{lowCount > 0 && (
  <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/20 text-xs">
    {lowCount} baixo{lowCount !== 1 ? 's' : ''}
  </Badge>
)}
```

---

## 2. Banner de Problemas Críticos

### Arquivo: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

O problema está em `report.failed` que conta TODAS as falhas. Precisamos contar apenas itens com `severity === 'critical'`.

**Adicionar cálculo (após linha 319, junto com os outros useMemo/cálculos):**
```typescript
const criticalOnlyCount = useMemo(() => {
  if (!report?.categories) return 0;
  return report.categories
    .flatMap(c => c.checks)
    .filter(check => check.status === 'fail' && check.severity === 'critical')
    .length;
}, [report]);
```

**Alterar o banner (linhas 580-593):**

De:
```tsx
{report.failed > 0 && (
  ...
  <h3 className="font-semibold text-destructive">
    {report.failed} {report.failed === 1 ? 'problema crítico encontrado' : 'problemas críticos encontrados'}
  </h3>
```

Para:
```tsx
{criticalOnlyCount > 0 && (
  ...
  <h3 className="font-semibold text-destructive">
    {criticalOnlyCount} {criticalOnlyCount === 1 ? 'problema crítico encontrado' : 'problemas críticos encontrados'}
  </h3>
```

---

## 3. Cor do Gauge

### Arquivo: `src/components/ScoreGauge.tsx`

Usar a cor primary (verde-água `hsl(175 80% 45%)`) para todos os scores bons (>=75).

**Alterar função getColor (linhas 37-42):**

De:
```typescript
const getColor = () => {
  if (score >= 90) return 'hsl(var(--success))';
  if (score >= 75) return 'hsl(142, 71%, 45%)'; // Verde mais claro para "Bom"
  if (score >= 60) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
};
```

Para:
```typescript
const getColor = () => {
  if (score >= 75) return 'hsl(var(--primary))'; // Verde-água (175 80% 45%)
  if (score >= 60) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
};
```

---

## Resumo Visual

| Item | Antes | Depois |
|------|-------|--------|
| **Badges categoria** | Só crítico e alto | Crítico, alto, médio, baixo |
| **Banner vermelho** | "6 problemas críticos" (todas falhas) | Apenas falhas com `severity === 'critical'` |
| **Gauge** | Verde (#22c55e) para scores altos | Verde-água (hsl 175 80% 45%) para scores ≥75 |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/external-domain/ExternalDomainCategorySection.tsx` | Adicionar badges para médio e baixo |
| `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` | Calcular e exibir apenas problemas críticos no banner |
| `src/components/ScoreGauge.tsx` | Usar cor verde-água (primary) do tema |
