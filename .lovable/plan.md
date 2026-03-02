

## Diagnóstico — DEF-001, DEF-002, DEF-005 com status N/A

### Causa Raiz

Dois problemas distintos:

**DEF-001 (Alertas) e DEF-002 (Incidentes):** O App Registration tem `SecurityEvents.Read.All` no manifest, mas os endpoints `/security/alerts_v2` e `/security/incidents` requerem as permissões mais novas `SecurityAlert.Read.All` e `SecurityIncident.Read.All`. Essas permissões estão no manifest (`ensure-exchange-permission`) mas **não foram consentidas** pelo Admin — o token não as possui.

A validação marca falsamente como `granted` porque a lógica de tolerância na linha 805 trata todo 403 em endpoints `/security/` como "problema de licenciamento" (exceto se contiver "insufficient privileges"). O erro real diz "Missing application roles", que é uma falta de permissão, não de licença.

**DEF-005 (Labels):** Erro 400 — o serviço MIP (Microsoft Information Protection) está desabilitado neste tenant. Isso é legítimo como N/A.

### Solução

1. **Corrigir lógica de tolerância em `validate-m365-connection`**: Adicionar verificação para "missing application roles" e "missing role" como indicadores de permissão faltante (não licenciamento). Quando o 403 contiver essas frases, NÃO tratar como `granted`.

2. **Após o fix**, o usuário precisa **Revalidar Permissões** do tenant para que:
   - `SecurityAlert.Read.All` e `SecurityIncident.Read.All` apareçam como `pending`
   - O popup de Admin Consent seja disparado
   - As permissões sejam efetivamente concedidas

### Alteração técnica

No `validate-m365-connection/index.ts`, na lógica de tolerância para 403 em security endpoints (linha ~805):

```typescript
// ANTES:
const isSecurityLicenseIssue = isSecurityEndpoint && !lowerMsg.includes('insufficient privileges');

// DEPOIS:
const isMissingRoles = lowerMsg.includes('missing application roles') || lowerMsg.includes('missing role');
const isSecurityLicenseIssue = isSecurityEndpoint && !lowerMsg.includes('insufficient privileges') && !isMissingRoles;
```

### Arquivo a modificar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/validate-m365-connection/index.ts` | Corrigir tolerância de 403 para detectar "missing application roles" |

