

# Ajustes no Exchange Analyzer

## 1. Ocultar seções quando `dashboardData` é null

As seções **"Status das Políticas de Proteção"** (`ExchangeThreatProtectionSection`) e **"Insights de Segurança"** (`ExchangeSecurityInsightCards`) precisam ser condicionadas a `dashboardData` existir, assim como já foi feito para Stats Cards e Category Grid.

### Alteração em `ExchangeAnalyzerPage.tsx`

Linhas 234-245: adicionar `&& dashboardData` nas condições de renderização:

```tsx
{/* Threat Protection - só exibe se dashboardData existir */}
{selectedTenantId && !loading && dashboardData && (
  <ExchangeThreatProtectionSection ... />
)}

{/* Security Insights - só exibe se dashboardData existir */}
{selectedTenantId && !analyzerLoading && dashboardData && (
  <ExchangeSecurityInsightCards ... />
)}
```

---

## 2. Sobre o botão "Executar Análise"

O botão chama `supabase.functions.invoke('m365-exchange-analyze', ...)` -- porém **essa edge function não existe** no projeto. Não há nenhuma pasta `m365-exchange-analyze` em `supabase/functions/`.

As funções existentes relacionadas são:
- `trigger-m365-analyzer` -- dispara o analyzer geral do M365
- `exchange-dashboard` -- coleta dados do dashboard Exchange (cache)

O botão provavelmente deveria invocar `trigger-m365-analyzer` (que gera os snapshots com insights operacionais) ou uma combinação de `trigger-m365-analyzer` + `exchange-dashboard`.

**Preciso da sua orientação**: o "Executar Análise" deve disparar o `trigger-m365-analyzer` (que já popula os snapshots usados nesta tela), ou você quer criar uma edge function dedicada `m365-exchange-analyze`?

### Arquivo alterado
- `src/pages/m365/ExchangeAnalyzerPage.tsx`

