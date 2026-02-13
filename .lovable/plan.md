

# Fix: Sparkline M365 mostrando cor errada (verde) com score vermelho (56)

## Causa raiz

A query de historico M365 usa `order('created_at', { ascending: false })` (DESC), mas a funcao `aggregateScoreHistory` assume dados em ordem ASC. Quando faz `dayMap.set(day, r.score)`, o ultimo valor iterado ganha -- em ordem DESC, isso e o registro **mais antigo** do dia, nao o mais recente.

Resultado: o sparkline exibe scores antigos/parciais (possivelmente altos, verde) enquanto o Score Atual exibe corretamente o valor mais recente (56, vermelho).

Os outros modulos (Firewall e External Domain) nao tem este problema porque suas queries ja usam `ascending: true`.

## Solucao

Alterar a query M365 na linha 139 de `ascending: false` para `ascending: true`, alinhando com os outros modulos.

O loop de "primeiro por tenant" (linhas 213-215 com `seen`) precisa ser ajustado: como agora os dados virao em ordem ASC, o primeiro registro visto sera o mais antigo. Entao a logica de `latestDate`/`latestScore` ja funciona corretamente (pega o maior `created_at`), mas o `seen` precisa ser removido ou invertido para que o ultimo registro por tenant (o mais recente) defina severidades e score.

**Abordagem**: remover o filtro `seen` do loop principal e deixar a logica de `latestDate` determinar o score. Para severidades, continuar usando apenas a analise mais recente por tenant -- inverter a logica para guardar a ultima ocorrencia de cada tenant.

## Alteracao

### Arquivo: `src/hooks/useDashboardStats.ts`

1. **Linha 139**: Mudar `ascending: false` para `ascending: true`

2. **Linhas 206-238**: Ajustar o loop M365 para funcionar com dados ASC:

```typescript
if (tenantIds.length > 0) {
  const m365History = (m365HistoryRes.data || []) as any[];
  let latestDate: string | null = null;
  let latestScore: number | null = null;
  let totalActiveUsers = 0;

  // Com dados ASC, o ultimo registro por tenant e o mais recente
  // Usar Map para que o ultimo sobrescreva
  const tenantLatest = new Map<string, any>();
  for (const h of m365History) {
    tenantLatest.set(h.tenant_record_id, h); // ultimo (mais recente) ganha
  }

  for (const [, h] of tenantLatest) {
    if (!latestDate || (h.created_at && h.created_at > latestDate)) {
      latestDate = h.created_at;
      if (h.score != null) latestScore = h.score;
    }
    const summary = h.summary as any;
    if (summary) {
      m365Health.severities.critical += summary.critical || 0;
      m365Health.severities.high += summary.high || 0;
      m365Health.severities.medium += summary.medium || 0;
      m365Health.severities.low += summary.low || 0;
    }
    const envMetrics = h.environment_metrics as any;
    if (envMetrics?.activeUsers != null) {
      totalActiveUsers += envMetrics.activeUsers;
    }
  }

  m365Health.score = latestScore;
  m365Health.lastAnalysisDate = latestDate;
  m365Health.scoreHistory = aggregateScoreHistory(
    m365History.map((h: any) => ({ score: h.score, created_at: h.created_at }))
  );
  m365Health.activeUsers = totalActiveUsers > 0 ? totalActiveUsers : null;
}
```

## Resultado esperado

- Sparkline M365 mostrara os scores finais de cada dia (nao os parciais antigos)
- A cor do sparkline sera consistente com o Score Atual
- Firewall e Dominio Externo continuam funcionando normalmente (ja usavam ASC)

## Arquivo alterado

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardStats.ts` | Query M365 ASC + loop com Map para ultimo por tenant |

