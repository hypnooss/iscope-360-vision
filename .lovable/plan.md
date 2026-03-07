

## Diagnóstico

Os dados existem -- a edge function retorna dados reais (263 users, 7 admins, etc.), mas o `UPDATE` na tabela `m365_tenants` para salvar o cache está falhando silenciosamente. Quando o `loadCache()` é chamado após o refresh, ele lê `null` do banco e mostra zeros.

A evidência está nos network requests:
- Edge function retorna: `{"success":true,"users":{"total":263,...}}`
- Mas `loadCache` logo após retorna: `{"entra_dashboard_cache":null,"entra_dashboard_cached_at":null}`

## Causa provável

A edge function pode não ter sido redeployada com o código de cache, ou o `UPDATE` falha silenciosamente sem log. Independente da causa raiz do UPDATE, o hook deveria usar os dados retornados diretamente pela edge function como fallback.

## Solução

### 1. `src/hooks/useEntraIdDashboard.ts`

No `refresh`, usar os dados retornados diretamente pela edge function em vez de depender exclusivamente do `loadCache()`:

```ts
const refresh = async () => {
  const { data: result } = await supabase.functions.invoke('entra-id-dashboard', { body: { ... } });
  if (result?.success) {
    setData({
      users: result.users,
      admins: result.admins,
      // ... mapear todos os campos
      analyzedAt: result.analyzedAt,
    });
  }
  // Também tenta recarregar do cache (para futuras visitas)
  await loadCache();
};
```

Isso garante que os dados aparecem imediatamente após o refresh, mesmo que o cache no banco ainda não tenha sido persistido.

### 2. `supabase/functions/entra-id-dashboard/index.ts`

Redeployar a edge function garantindo que o bloco de UPDATE do cache está presente e logando erros:

```ts
const { error: updateError } = await supabase.from('m365_tenants').update({
  entra_dashboard_cache: result,
  entra_dashboard_cached_at: now.toISOString(),
}).eq('id', tenant_record_id);

if (updateError) console.error('Failed to save cache:', updateError);
```

### Arquivos modificados

1. `src/hooks/useEntraIdDashboard.ts` -- usar resultado direto da edge function + fallback para cache
2. `supabase/functions/entra-id-dashboard/index.ts` -- adicionar log de erro no UPDATE do cache

