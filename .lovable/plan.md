

## Migrar dashboards M365 para janelas contíguas (sem duplicação)

### Problema
Três edge functions usam períodos fixos (D30/30d/7d), o que causa:
1. **Duplicação**: se o frontend agrega N snapshots de cache, cada um com D30, os mesmos dados são somados N vezes
2. **Inconsistência**: o cabeçalho mostra "Período agregado" do analyzer (contíguo), mas os KPIs mostram dados de janela fixa

### O que precisa mudar

#### 1. `exchange-dashboard/index.ts`

**Traffic (sent/received)**: Remover `getEmailActivityCounts(period='D30')`. Em vez disso, agregar `emailTraffic` dos snapshots do analyzer (que já usam janela contígua via `exoMessageTrace`). Mas primeiro precisamos que o analyzer grave esses totais (item 4).

**Rankings (topSenders/topRecipients)**: Também migrar para snapshots — o analyzer já grava `emailTrafficRankings` com `topSenders`, `topRecipients`, `topDestinationDomains`, `topSourceDomains`. Basta agregar dos snapshots.

**Security (spam/phishing/malware)**: Remover o cutoff fixo de 30 dias (`gte('created_at', securityCutoff)`). Buscar TODOS os snapshots completed — o frontend já controla quantos agrega.

**Mailbox usage (D30)**: Dados de ESTADO (storage, quota, inactive). Trocar `period='D30'` por `period='D7'`. Esses dados não são somados entre snapshots — cada execução do dashboard **substitui** o cache anterior. Portanto D7 é seguro e não duplica.

#### 2. `entra-id-dashboard/index.ts`

**Sign-in logs e audit logs**: Substituir `thirtyDaysAgo`/`sevenDaysAgo` hardcoded por janela contígua. Buscar `entra_dashboard_cached_at` do tenant como `periodStart`. Fallback: `now - 24h` se nunca executou.

```
const periodStart = tenant.entra_dashboard_cached_at
  ? tenant.entra_dashboard_cached_at  // já é ISO string
  : new Date(now.getTime() - 24*60*60*1000).toISOString();
```

Usar `periodStart` nos filtros de `signIns` e `directoryAudits` (ambas as queries de 30d e 7d).

Incluir `periodStart` e `periodEnd` no resultado para rastreabilidade.

#### 3. `collaboration-dashboard/index.ts`

**SharePoint usage (D30)**: Dado de ESTADO. Trocar `period='D30'` por `period='D7'`. O cache é substituído a cada execução, sem risco de duplicação.

#### 4. `m365-analyzer/index.ts`

Adicionar `emailTraffic` aos metrics do snapshot (bloco `allMetrics` ~linha 2306), contando a partir do `exoMessageTrace` que já respeita janela contígua:

```ts
emailTraffic: {
  sent: 0,    // contar msgs onde sender pertence ao tenant
  received: 0, // contar msgs onde recipient pertence ao tenant
  totalMessages: exoMessageTrace.length,
},
```

Usar `tenantDomains` (já disponível na ~linha 2240) para classificar sent vs received.

#### 5. Frontend — `useM365AnalyzerData.ts`

Agregar `emailTraffic` no `aggregateSnapshots` (somar sent/received/totalMessages de todos os snapshots).

#### 6. Frontend — `useExchangeDashboard.ts`

Quando o cache do dashboard não tiver traffic (por vir dos snapshots agora), usar os dados agregados do analyzer como fonte de traffic. Ou manter o cache — depende de como o `exchange-dashboard` vai gravar os totais agregados dos snapshots.

#### 7. `src/types/m365AnalyzerInsights.ts`

Adicionar ao tipo `M365AnalyzerMetrics`:
```ts
emailTraffic?: { sent: number; received: number; totalMessages: number };
```

### Resumo das mudanças por arquivo

| Arquivo | Mudança |
|---------|---------|
| `m365-analyzer/index.ts` | Gravar `emailTraffic` nos metrics |
| `exchange-dashboard/index.ts` | Traffic e rankings via snapshots; security sem cutoff 30d; mailbox D7 |
| `entra-id-dashboard/index.ts` | Janela contígua (`cached_at` → now) para logs |
| `collaboration-dashboard/index.ts` | SharePoint D7 |
| `src/types/m365AnalyzerInsights.ts` | Tipo `emailTraffic` |
| `src/hooks/useM365AnalyzerData.ts` | Agregar `emailTraffic` |

### Nota sobre select do tenant
`entra-id-dashboard` precisa incluir `entra_dashboard_cached_at` no select da query de tenant (linha 109). Mesma lógica pode ser aplicada ao `exchange-dashboard` se quisermos usar `exchange_dashboard_cached_at` como fallback.

