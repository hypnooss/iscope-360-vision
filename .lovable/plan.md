
# Migrar Regras Entra ID para o Pipeline Data-Driven

## Problema Raiz

As 25 regras de compliance do Entra ID (IDT-*, AUT-*, ADM-*, APP-*) usam um formato legado de `evaluation_logic` que nao contem `source_key`. A funcao `evaluateRule` retorna `null` na linha 199 quando `source_key` esta ausente, resultando em **0 insights gerados**.

Formato legado (atual):
```text
{ "type": "count_threshold", "field": "globalAdmins", "operator": "gt", "threshold": 5 }
```

Formato esperado:
```text
{ "source_key": "directory_roles", "evaluate": { "type": "count_role_members", ... } }
```

## Solucao

### 1. Migrar `evaluation_logic` de todas as 25 regras Entra ID (SQL)

Atualizar o campo `evaluation_logic` de cada regra para incluir `source_key` (apontando para o step do blueprint) e `evaluate` (com o tipo de avaliacao compativel com `evaluateRule`).

**Mapeamento completo:**

| Regra | source_key | evaluate.type |
|-------|-----------|---------------|
| IDT-001 | mfa_registration_details | count_missing_mfa |
| IDT-002 | users_signin_activity | count_inactive_users |
| IDT-003 | guests_list | count_problematic_guests (novo) |
| IDT-004 | guests_signin_activity | count_inactive_guests (novo) |
| IDT-005 | users_password_info | count_old_passwords (novo) |
| IDT-006 | users_disabled_count | count_only |
| AUT-001 | security_defaults | check_boolean |
| AUT-002 | conditional_access_policies | check_ca_policies |
| AUT-003 | risk_detections | count_risk_detections |
| AUT-004 | risky_users | count_risky_users |
| AUT-005 | auth_methods_policy | count_enabled_methods |
| AUT-007 | named_locations | check_named_locations_exist |
| ADM-001 | directory_roles | count_global_admins (novo) |
| ADM-002 | directory_roles | check_admin_mfa (novo - cruza com mfa_registration_details) |
| ADM-003 | directory_roles | count_privileged_users (novo) |
| ADM-004 | directory_roles | count_multi_role_admins (novo) |
| ADM-005 | directory_roles | count_guest_admins (novo) |
| ADM-006 | service_principals | count_sp_admins (novo) |
| APP-001 | applications | count_expiring_credentials (novo) |
| APP-002 | applications | count_expired_credentials (novo) |
| APP-003 | applications | count_high_privilege_apps (novo) |
| APP-004 | applications | count_no_owner_apps (novo) |
| APP-005 | oauth2_permissions | count_oauth_consents (novo) |
| APP-006 | enterprise_apps_count | count_only |
| APP-007 | applications_count | count_only |

### 2. Adicionar novos tipos de avaliacao ao `evaluateRule` (Edge Function)

**Arquivo:** `supabase/functions/m365-security-posture/index.ts`

Adicionar os seguintes `case` ao `switch (evaluate?.type)`:

- **count_problematic_guests**: Filtra guests com `externalUserState != 'Accepted'`
- **count_inactive_guests**: Filtra guests sem login > 60 dias
- **count_old_passwords**: Filtra usuarios com `lastPasswordChangeDateTime` > 1 ano
- **count_global_admins**: Conta membros da role "Global Administrator" (requer step adicional ou cruzamento com `directory_roles`)
- **check_admin_mfa**: Cruza Global Admins com dados de MFA (requer `secondary_source_key`)
- **count_privileged_users**: Conta usuarios com qualquer role privilegiada
- **count_multi_role_admins**: Conta usuarios com >1 role admin
- **count_guest_admins**: Conta guests com roles admin
- **count_sp_admins**: Conta service principals com roles admin
- **count_expiring_credentials**: Filtra apps com credenciais expirando em 30 dias
- **count_expired_credentials**: Filtra apps com credenciais ja expiradas
- **count_high_privilege_apps**: Filtra apps com permissoes elevadas (ex: Mail.ReadWrite, Directory.ReadWrite.All)
- **count_no_owner_apps**: Filtra apps sem owners
- **count_oauth_consents**: Conta consentimentos OAuth com scope "AllPrincipals"

Para regras que precisam cruzar dados de 2 steps (ex: ADM-002 precisa de `directory_roles` + `mfa_registration_details`), adicionar suporte a `secondary_source_key` no `evaluateRule`:

```text
const evalLogic = rule.evaluation_logic;
const stepResult = stepResults.get(evalLogic.source_key);
const secondaryResult = evalLogic.secondary_source_key 
  ? stepResults.get(evalLogic.secondary_source_key) 
  : null;
```

### 3. Adicionar step de membros de roles ao blueprint (SQL)

O step `directory_roles` retorna apenas as roles, nao seus membros. Para avaliar ADM-001 a ADM-005, e necessario um step adicional que busque os membros. Duas opcoes:

**Opcao A - Step separado por role (complexo):** Criar steps individuais para cada role importante. Nao escalavel.

**Opcao B - Usar `directoryRoles` expandido com membros (preferido):** Alterar o endpoint do step `directory_roles` para incluir `$expand=members` e processar tudo em um unico step.

```text
Endpoint atualizado: /directoryRoles?$expand=members($select=id,displayName,userPrincipalName,userType)
```

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Atualizar `evaluation_logic` de 25 regras + alterar endpoint do step `directory_roles` |
| `supabase/functions/m365-security-posture/index.ts` | Adicionar ~14 novos `case` no `evaluateRule` + suporte a `secondary_source_key` |

## Resultado esperado

- Todas as 25 regras Entra ID geram insights (pass/fail/not_found)
- A pagina Entra ID exibe cards de conformidade preenchidos
- Erros 403 geram insights "Nao Encontrado" (ja implementado)
- Regras informacionais (IDT-006, APP-006, APP-007) exibem contagens neutras
