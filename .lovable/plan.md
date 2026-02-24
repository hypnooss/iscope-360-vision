

# Correcao de Logs Duplicados no Firewall Analyzer

## Problema Identificado

Com a paginacao implementada, o agente agora coleta mais logs do buffer de memoria do FortiGate. O problema e que a funcao `filterLogsByTime` (edge function `firewall-analyzer`) filtra apenas pelo limite inferior (`>= period_start`), sem aplicar um limite superior (`< period_end`).

Isso causa dois tipos de duplicacao:

1. **Sobreposicao de janela**: Logs no inicio da janela do snapshot B podem coincidir com logs no final da janela do snapshot A, pois o buffer de memoria do FortiGate nao e limpo entre coletas.
2. **Duplicacao na agregacao 24h**: O frontend (`useAnalyzerData.ts`) soma metricas de todos os snapshots. Se o mesmo log aparece em dois snapshots adjacentes, os contadores ficam inflados.

## Solucao

### 1. Adicionar filtro por `period_end` (limite superior)

**Arquivo:** `supabase/functions/firewall-analyzer/index.ts`

Buscar `period_end` do snapshot (alem do `period_start` que ja e buscado) e alterar `filterLogsByTime` para aceitar dois limites:

```text
// De:
.select('period_start')

// Para:
.select('period_start, period_end')
```

Alterar a funcao `filterLogsByTime` para filtrar `>= periodStart AND < periodEnd`:

```text
function filterLogsByTime(logs: any[], cutoffStart: Date, cutoffEnd: Date | null): any[] {
  return logs.filter(log => {
    const ms = extractTimestampMs(log);
    if (ms === null) return true; // keep unknowns
    if (ms < cutoffStart.getTime()) return false;      // antes da janela
    if (cutoffEnd && ms >= cutoffEnd.getTime()) return false; // apos a janela
    return true;
  });
}
```

Resultado: cada snapshot processa exclusivamente os logs da sua janela temporal `[period_start, period_end)`, sem sobreposicao.

### 2. Deduplicacao por `logid` no processamento de cada coleta

Adicionalmente, dentro de cada tipo de log processado, deduplicar por `logid` (identificador unico do FortiGate presente em cada registro):

```text
function deduplicateLogs(logs: any[]): any[] {
  const seen = new Set<string>();
  return logs.filter(log => {
    const key = log.logid && log.eventtime
      ? `${log.logid}_${log.eventtime}`
      : null;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

Aplicar apos o `filterLogsByTime` em cada colecao de logs.

### 3. Deploy

Fazer deploy da edge function `firewall-analyzer` com as correcoes.

## Resultado Esperado

| Cenario | Antes | Depois |
|---|---|---|
| Logs na fronteira entre snapshots | Contados em ambos | Contados apenas no snapshot correto |
| Metricas agregadas (24h) | Valores inflados por duplicatas | Valores precisos |
| Config changes | Protegidos pelo upsert (sem duplicatas na tabela) | Mantido + filtragem temporal precisa no snapshot |

## Arquivos Alterados

- `supabase/functions/firewall-analyzer/index.ts` (filterLogsByTime + deduplicateLogs)

