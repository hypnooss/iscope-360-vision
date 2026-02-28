

## Diagnóstico: Resumo Executivo do M365 Analyzer com dados zerados

### Causa Raiz

A função `getGraphToken()` no edge function `m365-analyzer` busca credenciais na tabela `m365_app_credentials`, que para este tenant tem `client_secret_encrypted = NULL`. Isso faz o enriquecimento via Graph API falhar silenciosamente, e as 5 categorias do Resumo Executivo (Seguranca e Risco, Identidade, Conditional Access, Exchange Health, Auditoria) ficam zeradas.

**Fluxo atual:**
1. Agent coleta dados PowerShell do Exchange Online (exo_*) -- funciona
2. `m365-analyzer` tenta enriquecer com Graph API para sign-in logs, risky users, conditional access policies, etc.
3. `getGraphToken()` busca em `m365_app_credentials` -- encontra registro SEM client_secret
4. Retorna null -- Graph API nunca e consultada
5. Metricas do resumo executivo ficam todas zeradas

**Enquanto isso**, todos os outros edge functions (entra-id-compliance, exchange-online-insights, etc.) usam `m365_global_config` que TEM o client_secret. So o m365-analyzer esta usando a tabela errada.

### Correcao

Atualizar `getGraphToken()` em `supabase/functions/m365-analyzer/index.ts` para:
1. Tentar `m365_app_credentials` primeiro (per-tenant secret) -- manter retrocompatibilidade
2. Se nao encontrar secret, fazer fallback para `m365_global_config` (multi-tenant app com secret global) -- mesmo padrao de todos os outros edge functions

### Mudancas tecnicas

**Arquivo: `supabase/functions/m365-analyzer/index.ts`**

Alterar a funcao `getGraphToken()` (linhas 86-137):

```typescript
async function getGraphToken(supabase: any, tenantRecordId: string): Promise<string | null> {
  const { data: tenant } = await supabase
    .from('m365_tenants')
    .select('tenant_id')
    .eq('id', tenantRecordId)
    .single();

  if (!tenant) return null;

  // Strategy 1: Per-tenant credentials (m365_app_credentials)
  const { data: cred } = await supabase
    .from('m365_app_credentials')
    .select('azure_app_id, client_secret_encrypted, auth_type')
    .eq('tenant_record_id', tenantRecordId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (cred?.client_secret_encrypted) {
    // ... decrypt and get token (existing logic)
  }

  // Strategy 2: Global multi-tenant app (m365_global_config)
  const { data: globalConfig } = await supabase
    .from('m365_global_config')
    .select('app_id, client_secret_encrypted')
    .limit(1)
    .maybeSingle();

  if (globalConfig?.client_secret_encrypted) {
    // Decrypt using same encryption key
    // Request token using client_credentials flow
    // with globalConfig.app_id and decrypted secret
  }

  return null;
}
```

### Resultado Esperado

Apos a correcao e redeploy:
- Os dados do Resumo Executivo serao populados a partir da proxima execucao do Analyzer
- Conditional Access: mostrara as 9 politicas (2 desabilitadas, 1 report-only, etc.)
- Seguranca e Risco: mostrara sign-ins arriscados, falhas MFA, contas bloqueadas
- Identidade: usuarios sem MFA, app registrations recentes
- Exchange Health: incidentes, conectores
- Auditoria: mudancas administrativas, delegacoes

