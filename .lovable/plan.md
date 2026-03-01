

## Resolver nomes em vez de IDs nas evidências do M365 Compliance

### Problema
No `count_oauth_consents` (APP-005 - Consentimentos OAuth), o campo `displayName` das entidades afetadas usa `g.clientId` (um GUID do service principal) em vez do nome legível da aplicação. O endpoint `oauth2PermissionGrants` retorna apenas `clientId` como referência — é preciso cruzar com os dados de `service_principals` para obter o `displayName`.

Há também um caso menor em `check_auth_methods` (linha 400) que usa `m.id` como displayName.

### Alterações

**1. Migration SQL — Adicionar `secondary_source_key` ao APP-005**
Criar nova migration para atualizar o `evaluation_logic` da regra APP-005, adicionando `"secondary_source_key": "service_principals"` para que os dados de service principals fiquem disponíveis no momento da avaliação.

```sql
UPDATE compliance_rules 
SET evaluation_logic = '{"source_key":"oauth2_permissions","secondary_source_key":"service_principals","evaluate":{"type":"count_oauth_consents","threshold":20}}'::jsonb 
WHERE code = 'APP-005';
```

**2. `supabase/functions/m365-security-posture/index.ts` — Resolver nomes no `count_oauth_consents`**
Na linha 697-712, usar `secondaryResult` (service principals) para resolver `clientId` → `displayName`:

```typescript
case 'count_oauth_consents': {
  const grants = (data as any)?.value || [];
  // Build lookup map from service principals
  const spList = (secondaryResult?.data as any)?.value || [];
  const spMap = new Map<string, string>();
  for (const sp of spList) {
    spMap.set(sp.id, sp.displayName || sp.appId || sp.id);
  }
  const allPrincipals = grants.filter(...);
  affectedEntities = allPrincipals.slice(0, 20).map((g: any) => ({
    id: g.id,
    displayName: spMap.get(g.clientId) || g.clientId || 'OAuth Grant',
    details: { scope: g.scope, consentType: g.consentType }
  }));
  ...
}
```

Também corrigir `check_auth_methods` (linha 400) para usar um nome mais descritivo: `displayName: m.id.replace(/([A-Z])/g, ' $1').trim()` ou mapear IDs conhecidos para nomes legíveis.

### Arquivos a editar
1. Nova migration SQL — adicionar `secondary_source_key` ao APP-005
2. `supabase/functions/m365-security-posture/index.ts` — resolver nomes via service principals lookup no `count_oauth_consents` e melhorar `check_auth_methods`

### Nota
Após deploy, será necessário re-executar a análise M365 Posture no tenant para que os nomes apareçam corretamente.

