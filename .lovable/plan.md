

## Fix: Alerta do M365 Analyzer não exibe o nome do tenant

### Causa raiz

Na linha 2418 do `m365-analyzer/index.ts`, o código tenta usar `snapshot.tenant_display_name` e `snapshot.tenant_domain`, mas o `snapshot` vem da tabela `m365_analyzer_snapshots` que **não possui essas colunas**. Resultado: fallback para o texto genérico `"Tenant"`.

### Solução

Buscar o `display_name` e `tenant_domain` da tabela `m365_tenants` usando `snapshot.tenant_record_id` antes de criar o alerta. Reutilizar a query que já é feita na linha 2169 (para `tenantDomains`) ou fazer uma query dedicada com `display_name, tenant_domain`.

### Alteração

**`supabase/functions/m365-analyzer/index.ts`** (1 arquivo)

Antes do bloco de criação do alerta (linha ~2415), buscar o tenant:

```ts
const { data: tenantRow } = await supabase
  .from('m365_tenants')
  .select('display_name, tenant_domain')
  .eq('id', snapshot.tenant_record_id)
  .single();

const tenantName = tenantRow?.display_name || tenantRow?.tenant_domain || 'Tenant';
```

Substituir a linha 2418 atual que usa campos inexistentes do snapshot.

