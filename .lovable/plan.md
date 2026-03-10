# Status: ✅ Confirmado

## Análise do fluxo "Executar Análise" no Exchange Analyzer

### Confirmação

O botão "Executar Análise" dispara corretamente **ambas** as coletas em paralelo:

| # | Edge Function | Fonte de dados | Tipo | Resultado |
|---|--------------|----------------|------|-----------|
| 1 | `trigger-m365-analyzer` | Agent PowerShell + Graph API (híbrido) | Assíncrono | Insights, metrics, threat protection |
| 2 | `exchange-dashboard` | Graph API direto | Imediato | KPIs de status (mailboxes, tráfego, segurança) |

### Fix já aplicado
- Retry + logging detalhado na chamada `exchange-dashboard` do scheduler (`run-scheduled-analyses`)

### Melhoria futura sugerida
- Adicionar polling no `useLatestM365AnalyzerSnapshot` para detectar quando o snapshot do Agent muda de `pending` para `completed`
