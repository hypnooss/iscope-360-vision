

# Redesign da pagina Usuarios (estilo Firewalls/Agendamentos)

## Resumo

Aplicar o mesmo layout das paginas de Firewalls e Dominios Externos: titulo atualizado, seletor de workspace para super roles, cards compactos de estatisticas, barra de busca e tabela com badges coloridos (sem card wrapper com header separado).

## Mudancas no arquivo `src/pages/UsersPage.tsx`

### 1. Titulo
- "Usuarios" -> "Gerenciamento de Usuarios"
- Breadcrumb atualizado para "Gerenciamento de Usuarios"

### 2. Seletor de Workspace (Super Admin / Super Suporte)
Identico ao FirewallListPage:
- Importar `useEffectiveAuth`, `useQuery` do tanstack
- Estado `selectedWorkspaceId` (inicial `null`)
- `useQuery` para buscar workspaces da tabela `clients` (staleTime 5min)
- Auto-selecionar primeiro workspace
- Renderizar seletor ao lado do botao "Convidar Usuario"
- Integrar filtro no `fetchData`: quando super role e workspace selecionado, filtrar `user_clients` e `clients` por esse workspace

### 3. Cards compactos de estatisticas (inline)
Substituir o card "Lista de Usuarios" por 4 cards compactos calculados via `useMemo`:
- **Total de Usuarios** (Users icon)
- **Workspace Admins** (Shield icon) - contagem de users com role workspace_admin
- **Com Modulos** (Layers icon) - usuarios com pelo menos 1 modulo atribuido
- **Sem Workspace** (Building icon) - usuarios sem nenhum client_id

### 4. Barra de busca
- Input com icone `Search` e placeholder "Buscar usuario..."
- Filtro local por nome, email ou workspace name

### 5. Refatorar tabela (flat style)
Remover `CardHeader` com "Lista de Usuarios". Usar `Card` + `CardContent p-0`:
- **Usuario**: font-medium + email em text-muted-foreground (manter como esta)
- **Role**: Badge colorido (manter `getRoleBadge` existente)
- **Modulos**: Badges secondary (manter logica existente)
- **Clientes**: Badges secondary (manter logica existente)
- **Cadastro**: data formatada
- **Acoes**: botoes ghost (manter como estao)

### Secao tecnica

**Imports a adicionar**: `useEffectiveAuth`, `useQuery` do @tanstack/react-query, `Search`, `Input`, `Building2`, `TrendingUp`, `AlertTriangle`

**Workspace query** (identico ao Firewall):
```
const { effectiveRole } = useEffectiveAuth();
const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

const { data: allWorkspaces } = useQuery({
  queryKey: ['clients-list'],
  queryFn: async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    return data ?? [];
  },
  enabled: isSuperRole && !isPreviewMode,
  staleTime: 1000 * 60 * 5,
});
```

**Auto-selecao**:
```
useEffect(() => {
  if (isSuperRole && allWorkspaces?.length && !selectedWorkspaceId) {
    setSelectedWorkspaceId(allWorkspaces[0].id);
  }
}, [isSuperRole, allWorkspaces, selectedWorkspaceId]);
```

**Filtro de workspace no fetchData**: Quando `isSuperRole && selectedWorkspaceId`, usar `selectedWorkspaceId` como filtro (mesma logica do preview mode). Adicionar `selectedWorkspaceId` ao array de dependencias do useEffect de fetch.

**Stats**:
```
const stats = useMemo(() => ({
  total: users.length,
  admins: users.filter(u => u.role === 'workspace_admin').length,
  withModules: users.filter(u => (u.module_permissions?.filter(p => p.permission !== 'none').length || 0) > 0).length,
  noWorkspace: users.filter(u => !u.client_ids?.length).length,
}), [users]);
```

**Busca**:
```
const [search, setSearch] = useState('');
const filtered = useMemo(() => {
  if (!search) return users;
  const q = search.toLowerCase();
  return users.filter(u =>
    u.full_name?.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    getClientNames(u.client_ids).some(n => n.toLowerCase().includes(q))
  );
}, [users, search, clients]);
```

**Dialogs e funcoes existentes**: `openEditDialog`, `handleSave`, `handleDeleteUser`, `getRoleBadge`, `toggleClient`, `setModulePermission`, `getClientNames`, `getModuleNames`, `canEditUser`, `canDeleteUser`, `getAssignableClients`, `getAvailableRoles` -- todos permanecem inalterados.

