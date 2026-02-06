
# Plano: Filtrar Apenas Aplicativos Empresariais (Excluir Apps Microsoft)

## Problema Atual

A API `/servicePrincipals/$count` retorna **todos** os Service Principals, incluindo:
- Apps de sistema Microsoft (Azure AD, Office 365, Graph, etc.)
- Conectores internos do Azure
- Apps empresariais reais (terceiros + internos)

No caso da Nexta: **330 total**, mas apenas **~47** são aplicativos empresariais relevantes.

## Solução

Filtrar Service Principals para excluir apps da Microsoft usando o campo `appOwnerOrganizationId`.

### Critério de Filtro

Apps da Microsoft têm `appOwnerOrganizationId` = `f8cdef31-a31e-4b4a-93e4-5f571e91255a` (ID do tenant Microsoft).

Para contar apenas apps empresariais:
```
/servicePrincipals/$count?$filter=appOwnerOrganizationId ne f8cdef31-a31e-4b4a-93e4-5f571e91255a
```

---

## Alteração no Código

**Arquivo:** `supabase/functions/m365-security-posture/index.ts`

### Antes (linhas 193-195)
```typescript
// Enterprise apps (service principals)
const { data: spCount } = await graphFetchSafe(accessToken, '/servicePrincipals/$count', { consistency: true });
metrics.enterpriseAppsCount = typeof spCount === 'number' ? spCount : 0;
```

### Depois
```typescript
// Enterprise apps (service principals) - excluding Microsoft internal apps
// Microsoft's tenant ID: f8cdef31-a31e-4b4a-93e4-5f571e91255a
const msftTenantId = 'f8cdef31-a31e-4b4a-93e4-5f571e91255a';
const { data: spCount } = await graphFetchSafe(
  accessToken, 
  `/servicePrincipals/$count?$filter=appOwnerOrganizationId ne ${msftTenantId}`, 
  { consistency: true }
);
metrics.enterpriseAppsCount = typeof spCount === 'number' ? spCount : 0;
```

---

## Atualizar Label no Frontend

**Arquivo:** `src/pages/m365/M365PostureReportPage.tsx`

### Antes (linha 660)
```tsx
? `Enterprise: ${envMetrics.enterpriseAppsCount} | Apps: ${envMetrics.appRegistrationsCount}`
```

### Depois
```tsx
? `Empresariais: ${envMetrics.enterpriseAppsCount} | Apps: ${envMetrics.appRegistrationsCount}`
```

---

## Resultado Esperado

**Antes:** `Enterprise: 330 | Apps: 6`

**Depois:** `Empresariais: 47 | Apps: 6`

Onde:
- **Empresariais: 47** = Apps de terceiros + apps internos autorizados no tenant (excluindo Microsoft)
- **Apps: 6** = App Registrations criados pela própria organização

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/m365-security-posture/index.ts` | Adicionar filtro `appOwnerOrganizationId ne f8cdef31-...` na contagem de Service Principals |
| `src/pages/m365/M365PostureReportPage.tsx` | Alterar label "Enterprise" para "Empresariais" |

---

## Nota Técnica

O filtro OData `ne` (not equals) exclui todos os apps onde o `appOwnerOrganizationId` é o tenant da Microsoft. Isso deixa apenas:
- Apps de terceiros (Zoom, Slack, Salesforce, etc.)
- Apps empresariais personalizados
- Integrações autorizadas pelo administrador
