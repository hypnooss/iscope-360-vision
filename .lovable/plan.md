

## Padronizar fallbacks para 1h e filtrar dados D7

### Situação atual

| Função | Fallback | Status |
|--------|----------|--------|
| `trigger-m365-analyzer` | 1h | ✅ OK |
| `firewall-analyzer` | 1h | ✅ OK |
| `entra-id-dashboard` | **24h** | ❌ Mudar para 1h |
| `m365-analyzer` (2 locais) | **24h** | ❌ Mudar para 1h |
| `collaboration-dashboard` | Usa `thirtyDaysAgo` para classificar sites ativos com dados D7 | ❌ Inconsistente |

### Alterações

**1. `supabase/functions/entra-id-dashboard/index.ts`** (linha 130-133)
- Mudar fallback de `24 * 60 * 60 * 1000` para `60 * 60 * 1000` (1h)
- Atualizar comentário

**2. `supabase/functions/m365-analyzer/index.ts`** (linhas 2147 e 2199)
- Dois locais com fallback `24 * 60 * 60 * 1000` → `60 * 60 * 1000` (1h)
- Atualizar comentários

**3. `supabase/functions/collaboration-dashboard/index.ts`** (linha 240)
- Mudar `thirtyDaysAgo` para `sevenDaysAgo` (`7 * 24 * 60 * 60 * 1000`) para ser coerente com o report D7
- O report D7 só traz atividade dos últimos 7 dias, então usar 30 dias como threshold de "ativo" nunca faria sentido — um site com atividade no D7 é ativo, sem atividade é inativo

**Nota:** Os thresholds de 30/60/90 dias no `exchange-dashboard` para classificar inatividade de mailbox são dados de ESTADO (mailbox usage detail traz `lastActivityDate` absoluto), não dependem do período D7 — são classificações legítimas e ficam como estão.

### Arquivos modificados
- `supabase/functions/entra-id-dashboard/index.ts`
- `supabase/functions/m365-analyzer/index.ts`
- `supabase/functions/collaboration-dashboard/index.ts`

