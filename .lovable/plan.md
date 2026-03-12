

## Problema: Sheet de Tráfego de Email sem dados de ranking

### Diagnóstico

A sheet lateral do "Tráfego de Email" busca rankings (Top Remetentes, Top Destinatários, Top Domínios) de `analyzerMetrics.emailTrafficRankings`, que vem do snapshot do M365 Analyzer (PowerShell `exoMessageTrace`). Para o tenant IE MADEIRA, o PowerShell não retornou dados de message trace — os arrays estão vazios no banco.

Porém, a **edge function `exchange-dashboard`** já coleta o relatório de atividade de email via Graph API (`getEmailActivity`), que contém contagens de envio/recebimento **por usuário**. Esses dados já estão sendo iterados para somar os totais, mas os detalhes por usuário são descartados.

### Solução

Enriquecer a `exchange-dashboard` para extrair rankings de tráfego diretamente do relatório Graph API e persistir no cache. Ajustar o frontend para usar esses rankings do cache como fallback quando os do analyzer estiverem vazios.

### Alterações

**1. Edge Function `supabase/functions/exchange-dashboard/index.ts`**

No bloco de parsing do email activity report (linhas 276-291), coletar top senders e top recipients:

```ts
const senderRanking: { name: string; count: number }[] = [];
const recipientRanking: { name: string; count: number }[] = [];

rows.forEach((row: any) => {
  const upn = row['User Principal Name'] || row.userPrincipalName || '';
  const s = parseInt(row['Send'] || row['Send Count'] || '0', 10);
  const r = parseInt(row['Receive'] || row['Receive Count'] || '0', 10);
  sent += s;
  received += r;
  if (upn && s > 0) senderRanking.push({ name: upn, count: s });
  if (upn && r > 0) recipientRanking.push({ name: upn, count: r });
});

// Sort and take top 15
senderRanking.sort((a, b) => b.count - a.count);
recipientRanking.sort((a, b) => b.count - a.count);
```

Adicionar ao objeto `result`:
```ts
trafficRankings: {
  topSenders: senderRanking.slice(0, 15),
  topRecipients: recipientRanking.slice(0, 15),
},
```

**2. Hook `src/hooks/useExchangeDashboard.ts`**

Expandir `ExchangeDashboardData` para incluir `trafficRankings`:
```ts
trafficRankings?: {
  topSenders: { name: string; count: number }[];
  topRecipients: { name: string; count: number }[];
};
```

Mapear no `mapToData`:
```ts
trafficRankings: cache.trafficRankings || undefined,
```

**3. Sheet `src/components/m365/exchange/ExchangeCategorySheet.tsx`**

No `renderTrafficContent`, usar rankings do dashboard cache como fallback:
```ts
const trafficRankings = analyzerMetrics?.emailTrafficRankings;
const cacheRankings = dashboardData?.trafficRankings;

// Use analyzer rankings if available, otherwise fall back to cache
const topSenders = trafficRankings?.topSenders?.length ? trafficRankings.topSenders : cacheRankings?.topSenders || [];
const topRecipients = trafficRankings?.topRecipients?.length ? trafficRankings.topRecipients : cacheRankings?.topRecipients || [];
// Domains only available from analyzer
const topDestDomains = trafficRankings?.topDestinationDomains || [];
const topSrcDomains = trafficRankings?.topSourceDomains || [];
```

### Resultado

- Os rankings de remetentes/destinatários serão populados pela Graph API (sempre disponível), sem depender do PowerShell
- Rankings de domínios continuam dependendo do analyzer (PowerShell) mas falham graciosamente
- O cache é atualizado tanto em execuções manuais quanto agendadas

