
# Dados Agregados das Últimas 24h: Snapshots por Hora

## Diagnóstico da Situação Atual

Confirmado via banco de dados: todos os snapshots têm `avg_period_hours: 12.00` — cada execução coleta e analisa as últimas 12 horas de logs. Com agendamento de 1h, cada nova snapshot re-analisa 11h de dados já vistos anteriormente, criando duplicação massiva. O dashboard só exibe o snapshot mais recente (`.limit(1)`).

O que precisa mudar:
1. Cada snapshot deve cobrir apenas **1 hora** de logs (sem overlap)
2. O dashboard deve **agregar** as últimas 24 snapshots para exibir uma visão consolidada de 24h

---

## Estratégia de Solução

### Abordagem: Agregação no Frontend com Janelas de 1h

A solução mais limpa e sem risco de perda de dados históricos:

- **Backend (`trigger-firewall-analyzer`)**: mudar `period_start = now - 1h` (de 12h para 1h)
- **Frontend**: buscar as últimas 24 snapshots completadas e agregar as métricas somando contagens e re-rankando os top IPs/países
- O backend (`firewall-analyzer`) não precisa mudar — ele já recebe os logs do agente, apenas o período de coleta muda

### Por que não agregar no backend?

Agregar no backend (edge function) seria mais complexo e exigiria uma query extra para buscar snapshots anteriores dentro da mesma task. A agregação no frontend é simples, rápida e já temos todos os dados disponíveis via `useAnalyzerData` (que já busca até 10 snapshots).

---

## Mudanças Necessárias

### 1. `supabase/functions/trigger-firewall-analyzer/index.ts`

**Mudar janela de coleta de 12h para 1h:**

```ts
// ANTES:
period_start: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),

// DEPOIS:
period_start: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
```

O campo `period_start`/`period_end` é enviado no payload da task para o agente, que usa esses timestamps para filtrar os logs que coleta do FortiGate. Reduzindo para 1h, cada snapshot terá exatamente 1h de dados, sem overlap com o snapshot anterior.

**Nota importante:** Os snapshots históricos existentes no banco cobrem 12h cada um. Eles não serão afetados — continuarão funcionando. Novos snapshots cobrirão 1h.

### 2. `src/hooks/useAnalyzerData.ts` — Novo hook `useAggregatedAnalyzerData`

Criar uma função de agregação que:
- Busca as últimas **24 snapshots completadas** de um firewall (de 10 → 24 no limite)
- Combina todas as métricas somando contadores e re-rankando listas (top IPs, países)
- Retorna um objeto `AnalyzerSnapshot` único com dados consolidados do período

```ts
// Função auxiliar de agregação de métricas
function aggregateSnapshots(snapshots: AnalyzerSnapshot[]): AnalyzerSnapshot | null {
  if (!snapshots.length) return null;
  const latest = snapshots[0]; // período, score, summary do mais recente como base

  // Combinar summary: somar todas as severidades
  const summary = snapshots.reduce((acc, s) => ({
    critical: acc.critical + (s.summary?.critical ?? 0),
    high: acc.high + (s.summary?.high ?? 0),
    medium: acc.medium + (s.summary?.medium ?? 0),
    low: acc.low + (s.summary?.low ?? 0),
    info: acc.info + (s.summary?.info ?? 0),
  }), { critical: 0, high: 0, medium: 0, low: 0, info: 0 });

  // Combinar métricas numéricas (somar)
  const totalEvents = snapshots.reduce((a, s) => a + (s.metrics.totalEvents ?? 0), 0);
  const totalDenied = snapshots.reduce((a, s) => a + (s.metrics.totalDenied ?? 0), 0);
  const vpnFailures = snapshots.reduce((a, s) => a + (s.metrics.vpnFailures ?? 0), 0);
  // ... etc para cada campo numérico

  // Combinar rankings (merge + re-rank por contagem)
  const mergedBlockedIPs = mergeIPRankings(snapshots.flatMap(s => s.metrics.topBlockedIPs));
  const mergedBlockedCountries = mergeCountryRankings(snapshots.flatMap(s => s.metrics.topCountries));
  // ... etc para cada ranking

  return {
    ...latest,
    period_start: snapshots[snapshots.length - 1].period_start, // início do mais antigo
    summary,
    insights: deduplicateInsights(snapshots.flatMap(s => s.insights)), // insights únicos
    metrics: { ...latest.metrics, totalEvents, totalDenied, /* ... */ topBlockedIPs: mergedBlockedIPs, /* ... */ }
  };
}

// Helper para re-rankar IPs somando contagens de múltiplos snapshots
function mergeIPRankings(ips: TopBlockedIP[]): TopBlockedIP[] {
  const map = new Map<string, TopBlockedIP>();
  for (const ip of ips) {
    const existing = map.get(ip.ip);
    if (existing) {
      existing.count += ip.count;
      // Merge targetPorts (unique)
      existing.targetPorts = [...new Set([...existing.targetPorts, ...(ip.targetPorts ?? [])])];
    } else {
      map.set(ip.ip, { ...ip });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 15);
}

function mergeCountryRankings(countries: TopCountry[]): TopCountry[] {
  const map = new Map<string, number>();
  for (const c of countries) { map.set(c.country, (map.get(c.country) ?? 0) + c.count); }
  return [...map.entries()].map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count).slice(0, 15);
}
```

**Hook atualizado:**
```ts
export function useLatestAnalyzerSnapshot(firewallId?: string) {
  return useQuery({
    queryKey: ['analyzer-latest', firewallId],
    queryFn: async () => {
      // Buscar as últimas 24 snapshots completadas
      const { data } = await supabase
        .from('analyzer_snapshots' as any)
        .select('*')
        .eq('firewall_id', firewallId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(24);

      const rows = (data as any[]) || [];
      if (!rows.length) return null;
      
      const snapshots = rows.map(r => parseSnapshot(r));
      return aggregateSnapshots(snapshots); // retorna snapshot consolidado
    },
    enabled: !!firewallId,
    staleTime: 1000 * 30,
  });
}
```

### 3. `src/pages/firewall/AnalyzerDashboardPage.tsx` — Indicador de período agregado

**Mostrar o período coberto pelos dados** (ex: "Últimas 24h — 19 fev 00:00 → 16:00"):

No cabeçalho, onde já existe `latest?.period_start` e `latest?.period_end`, substituir o texto "Período Analisado" por "Período Agregado (24h)" e mostrar o intervalo completo do primeiro ao último snapshot.

**Mostrar quantos snapshots estão na agregação** (opcional):
```tsx
<Badge variant="outline" className="text-xs">
  {snapshots.length} coletas agregadas
</Badge>
```

---

## Impacto nos Dados Existentes

Os snapshots históricos têm `period = 12h`. A agregação ainda funciona corretamente, pois:
- Cada snapshot é somado independentemente das suas janelas
- As métricas numéricas (totalDenied, vpnFailures, etc.) são somadas
- Os rankings (topBlockedIPs) são re-rankados pelo total acumulado

Porém, com snapshots antigos de 12h + novos de 1h, pode haver alguma duplicação nos primeiros dias enquanto os snapshots antigos de 12h ainda estão dentro da janela de 24 snapshots buscados. Isso se resolve naturalmente em ~24h após a mudança.

---

## Arquivos a Modificar

| Arquivo | O que muda |
|---|---|
| `supabase/functions/trigger-firewall-analyzer/index.ts` | `period_start = now - 1h` (era 12h) |
| `src/hooks/useAnalyzerData.ts` | Adicionar `aggregateSnapshots`, `mergeIPRankings`, `mergeCountryRankings`; atualizar `useLatestAnalyzerSnapshot` para buscar 24 snapshots e agregar |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Mostrar "Período agregado (24h)" no cabeçalho com o intervalo completo; mostrar contador de snapshots |

A edge function `trigger-firewall-analyzer` precisa ser reimplantada. O `firewall-analyzer` (que executa a análise) não precisa de mudanças.
