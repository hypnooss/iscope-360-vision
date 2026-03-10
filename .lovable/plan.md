

## Correção: Drill-down de Caixas Over Quota sem detalhes

### Causa raiz

O backend (`exchange-dashboard`) já lê `Storage Used (Byte)` e `Prohibit Send/Receive Quota (Byte)` para cada mailbox, mas **descarta a identidade e os valores** — salva apenas o contador `overQuota`. O frontend exibe "Rankings disponíveis após execução do Analyzer" porque não há lista de mailboxes over quota no cache do dashboard.

### Correção em 2 partes

**1. Backend: `supabase/functions/exchange-dashboard/index.ts`**

Acumular um array `overQuotaUsers` com detalhes de cada mailbox over quota:

```typescript
const overQuotaUsers: { name: string; usedGB: number; quotaGB: number; usagePct: number }[] = [];

// Dentro do loop (CSV e JSON):
if (quota > 0 && used >= quota * 0.9) {
  overQuota++;
  overQuotaUsers.push({
    name: upn,
    usedGB: Math.round(used / (1024**3) * 100) / 100,
    quotaGB: Math.round(quota / (1024**3) * 100) / 100,
    usagePct: Math.round((used / quota) * 1000) / 10,
  });
}
```

Incluir `overQuotaUsers: overQuotaUsers.slice(0, 50)` no objeto `mailboxes` do resultado.

**2. Frontend: `src/components/m365/exchange/ExchangeCategorySheet.tsx`**

No `renderMailboxContent` para `over_quota`:
- Ler `dashboardData.mailboxes.overQuotaUsers` em vez de depender dos rankings do analyzer
- Exibir cada mailbox com: endereço (UPN), uso atual em GB, cota em GB e percentual de uso
- Formatar como lista de ranking com barra de progresso ou texto detalhado à direita

