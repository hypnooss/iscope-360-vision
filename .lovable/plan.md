

## Plano: Remover seletores de contexto das páginas de Execuções

Remover os seletores de Workspace/Firewall/Domain/Tenant que foram adicionados no topo das 3 páginas de Execuções, junto com seus hooks e lógica de filtragem associada.

### Arquivos a editar

1. **`src/pages/firewall/TaskExecutionsPage.tsx`** — Remover imports e uso de `useWorkspaceSelector`, `useFirewallSelector`, `Select*`, e os componentes `<Select>` do header. Remover filtragem por `selectedFirewallId`/`selectedWorkspaceId` na query.

2. **`src/pages/external-domain/ExternalDomainExecutionsPage.tsx`** — Remover imports e uso de `useWorkspaceSelector`, `useDomainSelector`, `Select*`, e os componentes `<Select>` do header. Remover filtragem por `selectedDomainId`/`selectedWorkspaceId`.

3. **`src/pages/m365/M365ExecutionsPage.tsx`** — Remover imports e uso de `useM365TenantSelector`, `useWorkspaceSelector`, `TenantSelector`, e os componentes do header. Remover filtragem por `selectedTenantId`/`selectedWorkspaceId`.

As queries voltam a buscar todas as execuções sem filtro de target específico.

