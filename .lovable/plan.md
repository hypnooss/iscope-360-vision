

## Plano: Unificar execução do M365 Analyzer para popular as 3 telas de uma vez

### Problema

Cada página (Exchange, Entra ID, Teams) invoca `trigger-m365-analyzer` + **apenas seu próprio dashboard cache** (`exchange-dashboard`, `entra-id-dashboard`, `collaboration-dashboard`). O snapshot do Analyzer já coleta dados para todos os módulos, mas os KPIs de cada dashboard ficam sem cache. Resultado: o empty state (`!dashboardData`) persiste nas outras duas páginas.

### Solução

Quando o usuário clicar em "Executar Análise" em **qualquer** das 3 páginas, invocar os 3 dashboards simultaneamente junto com o analyzer. Isso garante que uma única execução popule todas as telas.

### Mudanças

#### 1. `src/pages/m365/ExchangeAnalyzerPage.tsx` (~linha 127-147)

No `handleTriggerAnalysis`, adicionar as invocações dos outros 2 dashboards:

```tsx
const [analyzerResult] = await Promise.all([
  supabase.functions.invoke('trigger-m365-analyzer', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('exchange-dashboard', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('entra-id-dashboard', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('collaboration-dashboard', { body: { tenant_record_id: selectedTenantId } }),
]);
```

#### 2. `src/pages/m365/EntraIdAnalyzerPage.tsx` (~linha 100-117)

Mesmo padrão — adicionar `exchange-dashboard` e `collaboration-dashboard`:

```tsx
const [analyzerResult] = await Promise.all([
  supabase.functions.invoke('trigger-m365-analyzer', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('entra-id-dashboard', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('exchange-dashboard', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('collaboration-dashboard', { body: { tenant_record_id: selectedTenantId } }),
]);
```

#### 3. `src/pages/m365/TeamsAnalyzerPage.tsx` (~linha 81-98)

Mesmo padrão — adicionar `exchange-dashboard` e `entra-id-dashboard`:

```tsx
const [analyzerResult] = await Promise.all([
  supabase.functions.invoke('trigger-m365-analyzer', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('collaboration-dashboard', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('exchange-dashboard', { body: { tenant_record_id: selectedTenantId } }),
  supabase.functions.invoke('entra-id-dashboard', { body: { tenant_record_id: selectedTenantId } }),
]);
```

### Resultado

Uma única execução do "Executar Análise" em qualquer página popular os caches de KPIs dos 3 dashboards + o snapshot unificado do Analyzer, eliminando a necessidade de executar 3 vezes.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | Adicionar 2 invocações de dashboard |
| `src/pages/m365/EntraIdAnalyzerPage.tsx` | Adicionar 2 invocações de dashboard |
| `src/pages/m365/TeamsAnalyzerPage.tsx` | Adicionar 2 invocações de dashboard |

