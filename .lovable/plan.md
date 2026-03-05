

## Diagnóstico: Movimento Externo sem dados

### Problema identificado

A edge function `m365-external-movement` existe e está deployada, mas **ninguém a invoca**. O `m365-analyzer` finaliza o snapshot (linha ~2082) e gera alertas de sistema, mas nunca chama `m365-external-movement` para processar métricas de movimento externo por usuário.

Há também um bug secundário no hook `useBaselineMaturity`: consulta a coluna `stat_date` que não existe na tabela (a coluna real é `date`).

### Correção necessária

**1. `supabase/functions/m365-analyzer/index.ts`** (principal)

Após salvar o snapshot como `completed` (~linha 2082), adicionar uma chamada à function `m365-external-movement` passando os `user_metrics` extraídos do módulo de exfiltração (message trace). O analyzer já tem os dados necessários:
- `exfiltration.metrics.topExternalDomains` e `userExternalSent` por usuário
- `messageTrace` com detalhes de envio externo

Construir o array `user_metrics` a partir do `messageTrace` (agrupar por remetente: total emails, total MB estimado, domínios únicos, hora média) e chamar:

```typescript
await fetch(`${supabaseUrl}/functions/v1/m365-external-movement`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
  body: JSON.stringify({
    tenant_record_id: snapshot.tenant_record_id,
    client_id: snapshot.client_id,
    snapshot_id,
    user_metrics: userMetricsArray,
    security_signals: securitySignalsMap,
  }),
});
```

**2. `src/hooks/useExternalMovementData.ts`** (bug fix)

No `useBaselineMaturity`, trocar `.select('stat_date')` por `.select('date')` e ajustar o `.map` para usar `r.date` em vez de `r.stat_date`.

### Resumo

| Item | Causa | Fix |
|---|---|---|
| Sem alertas de movimento externo | `m365-analyzer` nunca chama `m365-external-movement` | Adicionar invocação após snapshot completed |
| Baseline sempre 0 | Hook consulta coluna `stat_date` inexistente (coluna real: `date`) | Corrigir nome da coluna |
| Dados diários vazios | Sem invocação = sem upserts em `m365_user_external_daily_stats` | Resolvido pelo fix #1 |

