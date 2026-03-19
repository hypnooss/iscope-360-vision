

## Problema

O snapshot do analyzer fica eternamente com `status = 'pending'` porque:
1. A `agent_task` associada expira após 1h (`expires_at`), mas o snapshot nunca é atualizado
2. A limpeza no `trigger-firewall-analyzer` só marca tasks como `timeout`, não os snapshots
3. O hook `useAnalyzerProgress` não valida idade do snapshot — se o último está `pending`, mostra "em andamento" para sempre

## Correções

### 1. Frontend: Tratar snapshots antigos como expirados no hook `useAnalyzerProgress`
**Arquivo:** `src/hooks/useAnalyzerData.ts`

Adicionar verificação de tempo: se o snapshot está `pending`/`processing` há mais de 60 minutos (mesmo TTL da task), tratá-lo como `timeout` no frontend, evitando a exibição eterna do progress card.

```typescript
// Se snapshot pending/processing > 60min, considerar expirado
const elapsed = Math.floor((Date.now() - new Date(snap.created_at).getTime()) / 1000);
if (elapsed > 3600) {
  return { status: 'timeout', elapsed: null };
}
```

### 2. Backend: Limpar snapshots órfãos junto com as tasks no `trigger-firewall-analyzer`
**Arquivo:** `supabase/functions/trigger-firewall-analyzer/index.ts`

Após as queries de cleanup de tasks expiradas (linhas ~123-133), adicionar update nos snapshots correspondentes:

```typescript
// Também marcar snapshots órfãos como timeout
await supabase
  .from('analyzer_snapshots')
  .update({ status: 'failed' })
  .eq('firewall_id', firewall_id)
  .in('status', ['pending', 'running'])
  .lt('created_at', staleThreshold);
```

### 3. Correção imediata: Atualizar manualmente o snapshot preso
O snapshot atual que está preso há 838min precisa ser marcado como `failed` no banco. Isso pode ser feito via SQL no Supabase Dashboard:

```sql
UPDATE analyzer_snapshots 
SET status = 'failed' 
WHERE firewall_id = '<id-do-firewall>' 
  AND status IN ('pending', 'running') 
  AND created_at < NOW() - INTERVAL '1 hour';
```

### Resumo
- **Hook frontend** ganha timeout de 60min para não ficar preso
- **Edge Function** limpa snapshots órfãos quando nova análise é disparada
- **Fix manual** resolve o snapshot atual imediatamente

