# Plano: Upload de Certificado para Service Principal

## Status: ✅ Corrigido

## Arquitetura

O Agent registra seu certificado no **Service Principal do tenant CLIENTE** via `PATCH /servicePrincipals/{sp_object_id}`.

### Fluxo

```
Agent → Backend → Azure (Tenant CLIENTE)
  1. Busca client_secret de m365_global_config
  2. Busca sp_object_id via m365_tenant_agents → m365_tenants → m365_app_credentials
  3. Token obtido contra o tenant CLIENTE
  4. PATCH /servicePrincipals/{sp_object_id} com keyCredentials
```

### Tabelas Envolvidas

| Tabela | Dados |
|--------|-------|
| `m365_global_config` | `app_id`, `client_secret_encrypted` |
| `m365_tenant_agents` | Link agent ↔ tenant |
| `m365_tenants` | `tenant_id`, `tenant_domain` |
| `m365_app_credentials` | `sp_object_id`, `azure_app_id` |

## Limpeza Realizada

Removidas TODAS as referências a "home tenant" / "tenant home" dos seguintes arquivos:

- `supabase/functions/agent-heartbeat/index.ts`
- `supabase/functions/register-agent/index.ts` (função deprecada)
- `supabase/functions/get-m365-config/index.ts`
- `supabase/functions/update-m365-config/index.ts`
- `supabase/functions/validate-m365-permissions/index.ts`
- `src/components/alerts/SystemAlertBanner.tsx`

O sistema agora usa APENAS o tenant cliente para operações de certificado.
