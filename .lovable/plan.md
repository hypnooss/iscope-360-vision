
# Redesign da pagina Agents (estilo Firewalls/Dominios Externos/Usuarios)

## Resumo

Aplicar o mesmo layout padrao: titulo atualizado para "Gerenciamento de Agents", seletor de workspace para super roles, cards compactos de estatisticas, barra de busca e tabela flat (sem CardHeader separado).

## Mudancas no arquivo `src/pages/AgentsPage.tsx`

### 1. Titulo
- "Agents" -> "Gerenciamento de Agents"
- Breadcrumb atualizado para "Gerenciamento de Agents"
- Subtitulo mantido

### 2. Seletor de Workspace (Super Admin / Super Suporte)
- Importar `useEffectiveAuth` e `useQuery` do tanstack
- Estado `selectedWorkspaceId` (inicial `null`)
- `useQuery` para buscar workspaces da tabela `clients` (staleTime 5min)
- Auto-selecionar primeiro workspace via useEffect
- Renderizar seletor entre o titulo e o botao "Novo Agent"
- Integrar filtro no `fetchData`: quando super role e workspace selecionado, filtrar agents por `client_id` e clients por `id`
- Guarda no useEffect de fetch: super roles aguardam workspace antes de buscar

### 3. Cards compactos de estatisticas (inline via useMemo)
Substituir o CardHeader "Lista de Agents" por 4 cards compactos:
- **Bot / Total Agents**: `agents.length`
- **Check / Online**: agents com last_seen nos ultimos 5 min e nao revogados
- **Clock / Pendentes**: agents sem last_seen e nao revogados
- **Ban / Revogados**: agents com `revoked === true`

### 4. Barra de busca
- Input com icone `Search` e placeholder "Buscar agent..."
- Filtro local por nome do agent ou nome do workspace (client_name)

### 5. Refatorar tabela (flat style)
- Remover `CardHeader` com "Lista de Agents"
- Usar `Card` + `CardContent p-0` (sem glass-card)
- Manter colunas: Nome, Cliente, Versao, Status, Last Seen, Acoes
- Badges de status com cores existentes (mantidas)
- Acoes mantidas identicas

### 6. Race condition fix
- Adicionar guarda no useEffect: `if (isSuperRole && !isPreviewMode && !selectedWorkspaceId) return;`
- Adicionar `selectedWorkspaceId` e `isSuperRole` nas dependencias do useEffect e do useCallback

### Secao tecnica

**Imports a adicionar**: `useEffectiveAuth`, `useQuery` do @tanstack/react-query, `Search`, `Building2`, `Shield`, `Skeleton`

**Imports a remover**: nenhum

**Workspace query e auto-select** (identico ao Firewall/Dominios/Usuarios):
```text
const { effectiveRole } = useEffectiveAuth();
const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
const [search, setSearch] = useState('');

const { data: allWorkspaces } = useQuery({
  queryKey: ['clients-list'],
  queryFn: ...,
  enabled: isSuperRole && !isPreviewMode,
  staleTime: 5min,
});
```

**fetchData atualizado** (useCallback):
```text
const workspaceIds = isPreviewMode && previewTarget?.workspaces
  ? previewTarget.workspaces.map(w => w.id)
  : (isSuperRole && selectedWorkspaceId ? [selectedWorkspaceId] : null);
```

**Stats**:
```text
const stats = useMemo(() => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  return {
    total: agents.length,
    online: agents.filter(a => !a.revoked && a.last_seen && new Date(a.last_seen) > fiveMinAgo).length,
    pending: agents.filter(a => !a.revoked && !a.last_seen).length,
    revoked: agents.filter(a => a.revoked).length,
  };
}, [agents]);
```

**Busca**:
```text
const filtered = useMemo(() => {
  if (!search) return agents;
  const q = search.toLowerCase();
  return agents.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.client_name?.toLowerCase().includes(q)
  );
}, [agents, search]);
```

**Dialogs e funcoes existentes**: `handleCreateAgent`, `handleRevokeAgent`, `handleDeleteAgent`, `openInstructions`, `getAgentStatus`, `generateActivationCode` -- todos permanecem inalterados.
