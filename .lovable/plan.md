

## Plano: Restaurar seletor de Workspace nas 3 páginas de Execuções

O seletor de Workspace (usado por super_admin/super_suporte) foi removido indevidamente junto com os seletores de Firewall/Domain/Tenant. Preciso restaurá-lo nas 3 páginas.

### Padrão a restaurar (igual ao AnalyzerDashboardPage)

Cada página precisa:
1. Import de `useEffectiveAuth`, `useWorkspaceSelector`, `Building2`
2. Hook `useEffectiveAuth()` para obter `effectiveRole`
3. Flag `isSuperRole` derivada do `effectiveRole`
4. Query `clients-list` (habilitada quando `isSuperRole && !isPreviewMode`)
5. Hook `useWorkspaceSelector(allWorkspaces, isSuperRole)`
6. Componente `<Select>` no header (condicional `isSuperRole && !isPreviewMode`)
7. Queries de dados filtradas por `selectedWorkspaceId` quando `isSuperRole`

### Arquivos a editar

1. **`src/pages/firewall/TaskExecutionsPage.tsx`**
   - Adicionar imports: `useEffectiveAuth`, `useWorkspaceSelector`, `Building2`
   - Adicionar hooks e query de workspaces no componente
   - Filtrar a query de firewalls por `selectedWorkspaceId` quando `isSuperRole`
   - Adicionar `<Select>` de workspace no header (ao lado do botão Atualizar)

2. **`src/pages/external-domain/ExternalDomainExecutionsPage.tsx`**
   - Mesma estrutura acima
   - Filtrar `accessibleDomainIds` também por `selectedWorkspaceId` quando `isSuperRole`
   - Filtrar `attack_surface_snapshots` por `selectedWorkspaceId`

3. **`src/pages/m365/M365ExecutionsPage.tsx`**
   - Mesma estrutura acima
   - Filtrar queries de tenants e posture_history por `selectedWorkspaceId` quando `isSuperRole`

### Detalhes técnicos

Nas queries, o filtro de workspace deve funcionar assim:
- Se `isSuperRole && selectedWorkspaceId`: filtrar por `.eq('client_id', selectedWorkspaceId)`
- Se em preview mode: manter o filtro por `workspaceIds` existente
- Caso contrário: sem filtro (RLS do Supabase cuida)

O `<Select>` de workspace fica no `<div className="flex items-center gap-3 flex-wrap">` do header, antes do botão Atualizar, condicional a `isSuperRole && !isPreviewMode`.

