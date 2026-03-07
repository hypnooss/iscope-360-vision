

## Plano: Cache do Dashboard Entra ID para carregamento rápido

### Problema
Atualmente, toda troca de tenant chama a edge function que faz ~10 requests ao Graph API, demorando segundos. O usuário quer ver dados cached instantaneamente e só buscar dados frescos ao clicar "Atualizar".

### Solução

Salvar o resultado da edge function no banco e carregar o cache direto no frontend.

#### 1. Edge Function `entra-id-dashboard/index.ts`

Após agregar os dados, salvar/atualizar na tabela `m365_tenants` usando uma coluna JSONB `entra_dashboard_cache`:

```sql
-- Adicionar coluna na tabela existente
ALTER TABLE m365_tenants ADD COLUMN IF NOT EXISTS entra_dashboard_cache jsonb;
ALTER TABLE m365_tenants ADD COLUMN IF NOT EXISTS entra_dashboard_cached_at timestamptz;
```

No final da edge function, antes de retornar:
```ts
await supabase.from('m365_tenants').update({
  entra_dashboard_cache: result,
  entra_dashboard_cached_at: now.toISOString(),
}).eq('id', tenant_record_id);
```

#### 2. Hook `src/hooks/useEntraIdDashboard.ts`

- Ao mudar de tenant, primeiro buscar `entra_dashboard_cache` e `entra_dashboard_cached_at` direto da tabela `m365_tenants` (query Supabase rápida)
- Exibir dados do cache imediatamente
- O botão "Atualizar" chama a edge function (que atualiza o cache)
- Após refresh, recarregar do cache atualizado

```ts
// loadCache — chamado no useEffect ao trocar tenant
const loadCache = async () => {
  const { data } = await supabase
    .from('m365_tenants')
    .select('entra_dashboard_cache, entra_dashboard_cached_at')
    .eq('id', tenantRecordId)
    .single();
  if (data?.entra_dashboard_cache) {
    setData({ ...data.entra_dashboard_cache, analyzedAt: data.entra_dashboard_cached_at });
  }
};

// refresh — chamado pelo botão Atualizar
const refresh = async () => {
  await supabase.functions.invoke('entra-id-dashboard', { body: { tenant_record_id } });
  await loadCache(); // recarrega do banco
};
```

#### 3. Migração SQL

Adicionar as duas colunas à tabela `m365_tenants`.

### Arquivos

1. `supabase/migrations/add_entra_dashboard_cache.sql` — nova migração
2. `supabase/functions/entra-id-dashboard/index.ts` — salvar cache após coleta
3. `src/hooks/useEntraIdDashboard.ts` — carregar cache primeiro, refresh sob demanda

