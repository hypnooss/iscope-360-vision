

## Diagnóstico — "Detecções de Risco" com status incorreto

### Causa Raiz

O endpoint `/identityProtection/riskDetections` requer a permissão **`IdentityRiskEvent.Read.All`**, que **não está registrada** no sistema. A app só possui `IdentityRiskyUser.Read.All` (que cobre `/identityProtection/riskyUsers` — regra AUT-004, um endpoint diferente).

O erro real é `403: required scopes are missing in the token`, mas a `not_found_description` exibe "requer Azure AD P2", o que é enganoso — o problema é permissão, não licenciamento.

Dados do banco confirmam:
```
risk_detections: 403: "You cannot perform the requested operation, required scopes are missing in the token."
```

### Solução

Adicionar a permissão `IdentityRiskEvent.Read.All` em todos os pontos do sistema de permissões M365:

1. **`ensure-exchange-permission/index.ts`** — Adicionar o permission ID do Graph API para `IdentityRiskEvent.Read.All` na lista de permissões a provisionar no manifesto Azure
2. **`validate-m365-connection/index.ts`** — Adicionar na lista de permissões a validar, com endpoint de teste `/beta/identityProtection/riskDetections?$top=1`
3. **`validate-m365-permissions/index.ts`** — Adicionar na lista e no switch de validação
4. **`m365-oauth-callback/index.ts`** — Adicionar na lista de permissões e no quick-check
5. **`src/lib/m365PermissionDescriptions.ts`** — Adicionar descrição para exibição na UI

Adicionalmente, corrigir a `not_found_description` da regra AUT-003 para uma mensagem mais precisa (migração SQL):
- De: "Dados de detecção de risco não disponíveis (requer Azure AD P2)."
- Para: "Dados de detecção de risco não disponíveis. Verifique se a permissão IdentityRiskEvent.Read.All foi concedida."

### Detalhe Técnico — Permission ID

O `IdentityRiskEvent.Read.All` tem o Application Permission ID: `6e472fd1-ad78-48da-a0f0-97ab2c6b769e` no Microsoft Graph.

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/ensure-exchange-permission/index.ts` | Adicionar entry para `IdentityRiskEvent.Read.All` |
| `supabase/functions/validate-m365-connection/index.ts` | Adicionar na lista + lógica de teste |
| `supabase/functions/validate-m365-permissions/index.ts` | Adicionar na lista + case no switch |
| `supabase/functions/m365-oauth-callback/index.ts` | Adicionar na lista + quick-check |
| `src/lib/m365PermissionDescriptions.ts` | Adicionar descrição |
| Migração SQL | Corrigir `not_found_description` de AUT-003 |

Após essas alterações, o tenant precisará **revalidar permissões** (botão na tela Ambiente > Tenant) para que o Admin Consent seja disparado com o novo escopo.

