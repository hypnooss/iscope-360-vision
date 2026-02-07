

# Seletor de Tenant Global no Modulo Microsoft 365

## Problema
Atualmente, apenas a pagina "Postura de Seguranca" possui um seletor de tenant. As demais paginas (Entra ID, Exchange Online, e subpaginas como Security Insights, Application Insights, Analysis) pegam automaticamente o primeiro tenant conectado, sem permitir que o Super Admin escolha qual tenant deseja visualizar.

## Solucao

Criar um **hook centralizado** (`useM365TenantSelector`) que gerencia a selecao de tenant e persiste a escolha via URL (`?tenant=ID`). Todas as paginas do modulo M365 passarao a usar esse hook + o componente `TenantSelector` ja existente.

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useM365TenantSelector.ts` | Hook centralizado que carrega tenants, gerencia selecao via searchParams e expoe tenant selecionado |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/m365/ExchangeOnlinePage.tsx` | Substituir logica de "primeiro tenant" pelo hook + adicionar TenantSelector no header |
| `src/pages/m365/EntraIdPage.tsx` | Idem |
| `src/pages/m365/EntraIdAnalysisPage.tsx` | Idem |
| `src/pages/m365/EntraIdSecurityInsightsPage.tsx` | Idem |
| `src/pages/m365/EntraIdApplicationInsightsPage.tsx` | Idem |
| `src/pages/m365/M365PosturePage.tsx` | Refatorar para usar o hook centralizado (remover logica duplicada) |

## Detalhes Tecnicos

### Hook `useM365TenantSelector`

```typescript
export function useM365TenantSelector() {
  // 1. Carrega tenants conectados (status 'connected' ou 'partial')
  // 2. Filtra por workspaces do preview mode
  // 3. Le tenant da URL (?tenant=ID)
  // 4. Se nao ha parametro, seleciona o primeiro e atualiza URL
  // 5. Retorna:
  return {
    tenants,           // TenantOption[]
    selectedTenantId,  // string | null
    selectedTenant,    // TenantOption | null
    selectTenant,      // (id: string) => void (atualiza URL)
    loading,           // boolean
  };
}
```

### Padrao de Uso nas Paginas

Cada pagina substituira:
```typescript
// ANTES
const { tenants, loading: tenantsLoading, hasConnectedTenant } = useTenantConnection();
const connectedTenant = tenants.find(t => t.connection_status === 'connected' || ...);
```

Por:
```typescript
// DEPOIS
const { tenants, selectedTenantId, selectedTenant, selectTenant, loading: tenantsLoading } = useM365TenantSelector();
```

E adicionara o componente `TenantSelector` no header de cada pagina:
```tsx
<TenantSelector
  tenants={tenants}
  selectedId={selectedTenantId}
  onSelect={selectTenant}
  loading={tenantsLoading}
/>
```

### Persistencia da Selecao

A selecao e mantida via `useSearchParams` (query string `?tenant=UUID`). Ao navegar entre subpaginas do M365, se o parametro `tenant` ja estiver na URL, ele sera preservado. Se nao, o hook seleciona automaticamente o primeiro tenant disponivel.

