

## Diagnóstico Confirmado

Você está correto. Existem **dois problemas** separados:

### 1. Cards de KPI (Stats Cards do Exchange Dashboard)
Os contadores de **Phishing**, **Malware** e **Spam** nos cards do topo vêm da Edge Function `exchange-dashboard`, que consulta **apenas o último snapshot** do Analyzer (linha 325-332):
```ts
.order('created_at', { ascending: false })
.limit(1)
.maybeSingle();
```
Ou seja, mostra dados de ~1-2h, não 30 dias.

### 2. Rankings de Ameaças (Top SPAM, Phishing, Malware)
A função `aggregateSnapshots` no hook `useM365AnalyzerData.ts` busca 24 snapshots mas usa `const metrics = latest.metrics` (linha 252) — os rankings de `threatProtection` vêm **apenas do último snapshot**.

---

## Plano: Agregar dados de segurança em 30 dias

### Parte 1 — Backend: `exchange-dashboard/index.ts`

Alterar a consulta de security data para buscar **todos os snapshots completados nos últimos 30 dias** e somar os contadores:

```ts
// Em vez de .limit(1).maybeSingle()
const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();

const { data: snapshots } = await supabase
  .from('m365_analyzer_snapshots')
  .select('metrics')
  .eq('tenant_record_id', tenant_record_id)
  .eq('status', 'completed')
  .gte('created_at', thirtyDaysAgo)
  .order('created_at', { ascending: false });

// Somar contadores de todos os snapshots
for (const snap of snapshots || []) {
  const tp = snap.metrics?.threatProtection;
  if (tp) {
    spam += tp.spamBlocked || 0;
    phishing += tp.phishingDetected || 0;
    malware += tp.malwareBlocked || 0;
  }
}
maliciousInbound = phishing + malware;
```

Isso faz os **stats cards** mostrarem dados agregados de 30 dias.

### Parte 2 — Frontend: `useM365AnalyzerData.ts`

Na função `aggregateSnapshots`, agregar os **rankings de threatProtection** (e contadores) de todos os snapshots em vez de usar apenas o último:

1. **Contadores**: Somar `spamBlocked`, `phishingDetected`, `malwareBlocked`, etc. de todos os snapshots
2. **Rankings**: Merge + soma por chave (domain/user) de `topSpamSenderDomains`, `topPhishingTargets`, `topMalwareSenders`, `topSpamRecipients` — consolidando duplicatas e reordenando por count
3. **Limite de snapshots**: Aumentar `.limit(24)` para algo que cubra 30 dias (~720 snapshots). Como só buscamos `metrics` (sem `insights`), o payload é gerenciável. Alternativamente, criar uma DB function que faça a agregação server-side.

Exemplo de merge de rankings:
```ts
function mergeRankings(snapshots, key, labelField) {
  const map = new Map();
  for (const s of snapshots) {
    for (const item of s.metrics.threatProtection[key] || []) {
      const name = item[labelField];
      const existing = map.get(name) || { ...item, count: 0 };
      existing.count += item.count || 1;
      map.set(name, existing);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
}
```

### Parte 3 — Otimização (recomendada)

Para evitar buscar 720 rows com JSON grande no frontend, criar uma **DB function** `get_exchange_threat_aggregation(p_tenant_id, p_days)` que faça a agregação server-side e retorne apenas os totais + top 10 de cada ranking. O hook chamaria essa function via `supabase.rpc()`.

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `exchange-dashboard/index.ts` | Agregar contadores de security de 30 dias de snapshots |
| `useM365AnalyzerData.ts` | Agregar rankings de threatProtection de múltiplos snapshots |
| DB function (opcional) | Agregação server-side para performance |

