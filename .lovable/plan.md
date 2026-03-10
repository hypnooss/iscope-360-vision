

# Coleta unificada para o Exchange Analyzer

## Situação atual

A página Exchange Analyzer depende de **duas fontes de dados independentes**:

1. **`exchange-dashboard`** — Edge Function que chama a Graph API diretamente (mailboxes, tráfego, segurança). Popula o `exchange_dashboard_cache` na tabela `m365_tenants`. Alimenta os KPI cards e a grade de categorias.

2. **`trigger-m365-analyzer`** → Agent PowerShell → snapshots (`m365_analyzer_snapshots`). Alimenta Threat Protection e Insights de Segurança operacionais.

**Problema**: O botão "Executar Análise" só dispara `trigger-m365-analyzer`. O `exchange-dashboard` nunca é chamado automaticamente — só pelo botão "Atualizar Dashboard" do empty state. Quando um agendamento roda, também só chama `trigger-m365-analyzer`.

## Solução

Encadear a chamada do `exchange-dashboard` em dois pontos:

### 1. Botão "Executar Análise" (frontend)
Em `ExchangeAnalyzerPage.tsx`, na função `handleTriggerAnalysis`, após disparar `trigger-m365-analyzer`, também invocar `exchange-dashboard` em paralelo para popular o cache dos KPIs.

```tsx
const handleTriggerAnalysis = async () => {
  setTriggering(true);
  try {
    const [analyzerResult] = await Promise.all([
      supabase.functions.invoke('trigger-m365-analyzer', { body: { tenant_record_id: selectedTenantId } }),
      supabase.functions.invoke('exchange-dashboard', { body: { tenant_record_id: selectedTenantId } }),
    ]);
    // após exchange-dashboard completar, recarregar o cache local
    refreshDashboard(); // ou loadCache se preferir
  } finally {
    setTriggering(false);
  }
};
```

### 2. Agendamento automático (backend)
Em `run-scheduled-analyses/index.ts`, no bloco de M365 Analyzer Schedules (~linha 400), após chamar `trigger-m365-analyzer` com sucesso, também chamar `exchange-dashboard` para o mesmo tenant:

```ts
// Após trigger-m365-analyzer bem-sucedido
const exchangeUrl = `${supabaseUrl}/functions/v1/exchange-dashboard`;
await fetch(exchangeUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
  body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
}).catch(e => console.warn('[run-scheduled-analyses] exchange-dashboard failed:', e));
```

### Arquivos alterados
- `src/pages/m365/ExchangeAnalyzerPage.tsx` — `handleTriggerAnalysis` chama ambas as functions em paralelo
- `supabase/functions/run-scheduled-analyses/index.ts` — adicionar chamada `exchange-dashboard` após trigger bem-sucedido

