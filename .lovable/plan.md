
# Plano: Corrigir Contagem de Aplicativos Empresariais

## Problema Identificado

A contagem atual retorna **51** quando o portal mostra **47** porque:

| Tipo | O que é | Incluído atualmente | Mostrado no Portal |
|------|---------|--------------------|--------------------|
| Application | Apps de terceiros (Zoom, Slack, etc.) | Sim | Sim |
| ManagedIdentity | Identidades gerenciadas de VMs, Functions, etc. | **Sim** | **Nao** |
| Microsoft Apps | Apps internos da Microsoft | Nao | Nao |

O portal do Azure filtra por `servicePrincipalType eq 'Application'`, excluindo Managed Identities.

A diferença de 4 (51 - 47 = 4) provavelmente sao Managed Identities de recursos Azure no tenant.

---

## Solucao

Adicionar filtro por `servicePrincipalType eq 'Application'` para corresponder exatamente ao portal.

---

## Alteracao no Codigo

**Arquivo:** `supabase/functions/m365-security-posture/index.ts`

### Antes (linhas 193-200)
```typescript
// Enterprise apps (service principals) - excluding Microsoft internal apps
// Microsoft's tenant ID: f8cdef31-a31e-4b4a-93e4-5f571e91255a
const msftTenantId = 'f8cdef31-a31e-4b4a-93e4-5f571e91255a';
const { data: spCount } = await graphFetchSafe(
  accessToken, 
  `/servicePrincipals/$count?$filter=appOwnerOrganizationId ne ${msftTenantId}`, 
  { consistency: true }
);
```

### Depois
```typescript
// Enterprise apps (service principals) - matching Azure Portal "Enterprise Applications" view
// Filter: servicePrincipalType eq 'Application' (excludes ManagedIdentity)
// AND appOwnerOrganizationId ne Microsoft's tenant (excludes Microsoft internal apps)
const msftTenantId = 'f8cdef31-a31e-4b4a-93e4-5f571e91255a';
const { data: spCount } = await graphFetchSafe(
  accessToken, 
  `/servicePrincipals/$count?$filter=servicePrincipalType eq 'Application' and appOwnerOrganizationId ne ${msftTenantId}`, 
  { consistency: true }
);
```

---

## Query OData Final

```
/servicePrincipals/$count?$filter=servicePrincipalType eq 'Application' and appOwnerOrganizationId ne f8cdef31-a31e-4b4a-93e4-5f571e91255a
```

Esta query:
1. Inclui apenas Service Principals do tipo "Application"
2. Exclui Managed Identities (VMs, Functions, Logic Apps, etc.)
3. Exclui apps internos da Microsoft

---

## Resultado Esperado

**Antes:** `Empresariais: 51`

**Depois:** `Empresariais: 47` (correspondendo ao portal Azure)

---

## Resumo

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Adicionar filtro `servicePrincipalType eq 'Application'` na query de Service Principals |
