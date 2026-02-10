
# Ajustes no Dashboard: Workspace Selector + Espacamento + Infraestrutura

## 1. Dropdown de Workspace para Super Admins

Adicionar um dropdown (Select) no canto superior direito do header do Dashboard (area do retangulo vermelho na imagem) que permite Super Admins filtrar os dados por workspace.

- Visivel apenas para `super_admin` e `super_suporte`
- Opcao padrao: "Todos os workspaces" (sem filtro)
- Listar todos os workspaces da tabela `clients`
- Ao selecionar um workspace, os dados dos cards (Module Health + Infraestrutura) devem refletir apenas aquele workspace

### Implementacao:
- Buscar lista de workspaces (`clients`) via query Supabase no componente
- Armazenar `selectedWorkspaceId` em state local
- Modificar `useDashboardStats` para aceitar um parametro opcional `workspaceId: string | null` que, quando fornecido, filtra todas as queries por `client_id`
- Passar o `selectedWorkspaceId` para o hook

## 2. Corrigir espacamento (setas verdes)

O Dashboard atualmente usa `space-y-8` enquanto o padrao do sistema e `space-y-6`. Ajustar:
- Container principal: `space-y-8` para `space-y-6`
- Manter `p-6 lg:p-8` (padrao do sistema)

## 3. Card de Infraestrutura - cor e layout (setas azuis)

A borda e icone do card de Infraestrutura ja usam `primary` (teal), que e a cor do centro do gauge. Isso esta correto.

Sobre o numero distante do texto no card de Infraestrutura: o grid de 4 colunas usa `ml-auto` nos numeros, empurrando-os para longe. Vou ajustar para que o numero fique proximo ao label, removendo o `ml-auto` e usando `gap-1.5` mais compacto.

## Alteracoes tecnicas

### Arquivo: `src/hooks/useDashboardStats.ts`

- Adicionar parametro `selectedWorkspaceId?: string | null` ao hook
- Na logica de filtragem: se `selectedWorkspaceId` for fornecido, usar `eq('client_id', selectedWorkspaceId)` em vez de `in('client_id', workspaceIds)`
- Se preview mode estiver ativo, priorizar os filtros de preview (manter comportamento existente)
- Adicionar `selectedWorkspaceId` como dependencia do useEffect

### Arquivo: `src/pages/GeneralDashboardPage.tsx`

1. **Imports**: Adicionar `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` de `@/components/ui/select` e `useState` do React
2. **State**: `selectedWorkspaceId` (string | null, default null) e `workspaces` (array de {id, name})
3. **Fetch workspaces**: useEffect para buscar `clients` quando usuario for super_admin/super_suporte
4. **Dropdown**: Renderizar o Select no header, alinhado a direita, ao lado do titulo "Dashboard"
5. **Passar para hook**: `useDashboardStats(selectedWorkspaceId)`
6. **Espacamento**: Alterar `space-y-8` para `space-y-6`
7. **Numeros no Infra Card**: Remover `ml-auto` dos spans de contagem e ajustar layout para ficarem proximos ao label

### Resumo

| Arquivo | Acao |
|---------|------|
| `src/hooks/useDashboardStats.ts` | Aceitar `selectedWorkspaceId` para filtro por workspace |
| `src/pages/GeneralDashboardPage.tsx` | Dropdown workspace + espacamento + layout numeros |
