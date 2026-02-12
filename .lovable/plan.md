
# Fix: Race condition no seletor de Workspace em Dominios Externos

## Problema

O seletor de Workspace exibe "BRINQUEDOS ESTRELA" mas a tabela mostra dominios de PRECISIO, MOVECTA e OURO SAFRA. Isso ocorre por uma condicao de corrida (race condition) no carregamento dos dados:

1. O componente monta com `selectedWorkspaceId = null` e `isSuperRole = false` (role ainda nao carregou)
2. `fetchData` dispara imediatamente sem filtro, buscando TODOS os dominios
3. Depois, `effectiveRole` carrega como `super_admin`, o auto-select define o workspace
4. `fetchData` dispara novamente COM filtro
5. Se a busca sem filtro (passo 2) resolve DEPOIS da busca filtrada (passo 4), ela sobrescreve os dados corretos

## Solucao

### Arquivo: `src/pages/external-domain/ExternalDomainListPage.tsx`

**Impedir fetchData de rodar quando super role ainda nao tem workspace selecionado:**

Adicionar uma guarda no useEffect de fetch (linha 126): se o usuario e super role e nao esta em preview mode, so disparar fetchData quando `selectedWorkspaceId` estiver definido. Isso elimina a busca inicial sem filtro.

```typescript
useEffect(() => {
  if (user && hasModuleAccess('scope_external_domain')) {
    // Super roles must wait for workspace selection before fetching
    if (isSuperRole && !isPreviewMode && !selectedWorkspaceId) return;
    fetchData();
  }
}, [user, isPreviewMode, previewTarget, selectedWorkspaceId, isSuperRole]);
```

Mudancas:
- Adicionar `isSuperRole` ao array de dependencias
- Adicionar guarda: se `isSuperRole && !isPreviewMode && !selectedWorkspaceId`, retornar sem buscar

Essa mesma correcao deve ser verificada/aplicada nos outros arquivos que usam o mesmo padrao:
- `src/pages/firewall/FirewallListPage.tsx` (mesmo padrao)
- `src/pages/UsersPage.tsx` (mesmo padrao)
