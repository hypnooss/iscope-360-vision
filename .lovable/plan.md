

## Diagnóstico: "Executar Análise" manual não cria tarefa para o Agent

### Causa Raiz

O problema está no **tratamento de erro do frontend**. A Edge Function `trigger-m365-analyzer` retorna erros como `ALREADY_RUNNING` e `AGENT_OFFLINE` com **HTTP 200** e `{ success: false, ... }` no body. Porém, o frontend só verifica `analyzerResult.error` — que é o erro de transporte do Supabase client (HTTP ≥ 400), não o erro de lógica no `data`.

```text
Edge Function retorna:
  HTTP 200 → { success: false, code: "ALREADY_RUNNING" }

Frontend verifica:
  analyzerResult.error → null (HTTP 200, sem erro de transporte)
  analyzerResult.data  → { success: false, ... }  ← NUNCA VERIFICADO
```

Resultado: o botão "Executar Análise" silenciosamente ignora o erro, o usuário pensa que disparou, mas nenhuma tarefa foi criada. No seu caso específico, provavelmente havia uma task `pending` antiga (ou o agent estava momentaneamente offline), e o trigger retornou `ALREADY_RUNNING` ou `AGENT_OFFLINE` sem feedback visual.

### Correção

Adicionar verificação de `analyzerResult.data?.success === false` e exibir toast com a mensagem de erro. Aplicar nas 4 páginas que usam o mesmo padrão:

| Arquivo | Função |
|---------|--------|
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | `handleTriggerAnalysis` |
| `src/pages/m365/EntraIdAnalyzerPage.tsx` | `handleTriggerAnalysis` |
| `src/pages/m365/TeamsAnalyzerPage.tsx` | `handleTriggerAnalysis` |
| `src/pages/m365/M365AnalyzerDashboardPage.tsx` | `handleTrigger` |

A lógica será:

```typescript
const [analyzerResult] = await Promise.all([...]);
if (analyzerResult.error) throw analyzerResult.error;

// Nova verificação: erros de lógica retornados com HTTP 200
if (analyzerResult.data && !analyzerResult.data.success) {
  const msg = analyzerResult.data.error || 'Erro ao disparar análise';
  const code = analyzerResult.data.code;
  toast.error(
    code === 'ALREADY_RUNNING' ? 'Análise já em andamento' :
    code === 'AGENT_OFFLINE'   ? 'Agent offline' : msg,
    { description: analyzerResult.data.message || msg }
  );
  setTriggering(false);
  return;
}
```

### Sobre os dados de Phishing

A boa notícia: os logs do agent agora mostram que `exo_message_trace` está retornando **21 mensagens** com dados reais. O fix do `powershell.py` funcionou. Após a próxima execução do `m365-analyzer` (Edge Function que processa o snapshot), os contadores de tráfego, phishing, malware e spam devem ser populados corretamente no dashboard.

