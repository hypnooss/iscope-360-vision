

## Fix: Melhorar resiliência da chamada exchange-dashboard no agendamento

### Problema
O scheduler em `run-scheduled-analyses/index.ts` (linhas 411-417) chama `exchange-dashboard` imediatamente após `trigger-m365-analyzer`, mas usa `.catch()` que silencia erros. Se essa chamada falha, o cache fica vazio e a UI mostra "Dados não sincronizados".

### Solução
Substituir o `.catch()` silencioso por tratamento explícito com log detalhado e retry simples (1 tentativa adicional).

### Alteração em `supabase/functions/run-scheduled-analyses/index.ts` (linhas 411-417)

Substituir:
```typescript
const exchangeUrl = `${supabaseUrl}/functions/v1/exchange-dashboard`;
await fetch(exchangeUrl, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
}).catch(e => console.warn('[run-scheduled-analyses] exchange-dashboard failed:', e));
```

Por:
```typescript
try {
  const exchangeUrl = `${supabaseUrl}/functions/v1/exchange-dashboard`;
  const exchResp = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
  });
  const exchResult = await exchResp.json();
  if (exchResult.success) {
    console.log(`[run-scheduled-analyses] exchange-dashboard OK for tenant ${schedule.tenant_record_id}`);
  } else {
    console.error(`[run-scheduled-analyses] exchange-dashboard failed:`, exchResult.error);
    // Retry once
    const retryResp = await fetch(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
    });
    const retryResult = await retryResp.json();
    console.log(`[run-scheduled-analyses] exchange-dashboard retry:`, retryResult.success ? 'OK' : retryResult.error);
  }
} catch (e) {
  console.error(`[run-scheduled-analyses] exchange-dashboard error for tenant ${schedule.tenant_record_id}:`, e);
}
```

### Arquivo
- `supabase/functions/run-scheduled-analyses/index.ts`

### Resultado esperado
Com logs detalhados, será possível ver nos logs da Edge Function exatamente por que o `exchange-dashboard` falha. O retry resolve falhas transitórias (timeout, rede).

