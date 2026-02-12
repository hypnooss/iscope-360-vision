

# Redesign de Dominio Externo > Dominios Externos (estilo Firewalls)

## Resumo

Aplicar na pagina de Dominios Externos o mesmo layout ja implementado em Firewall > Firewalls: seletor de workspace para super roles, cards compactos inline, barra de busca, tabela com badges coloridos e titulo atualizado.

## Mudancas

### Arquivo: `src/pages/external-domain/ExternalDomainListPage.tsx`

#### 1. Titulo
- "Dominios Externos" -> "Gerenciamento de Dominios Externos"

#### 2. Seletor de Workspace (Super Admin / Super Suporte)
Identico ao FirewallListPage:
- Importar `useEffectiveAuth`, `useQuery`, `Select`, `Building2`
- Estado `selectedWorkspaceId` (inicial `null`)
- `useQuery` para buscar workspaces da tabela `clients` (staleTime 5min)
- Auto-selecionar primeiro workspace
- Renderizar seletor ao lado esquerdo do botao "Adicionar Dominio"
- Integrar filtro no `fetchData` (preview mode tem prioridade)

#### 3. Substituir ExternalDomainStatsCards por cards inline
Remover componente externo `ExternalDomainStatsCards` e usar cards compactos (p-4) identicos ao Firewall:
- Globe / Dominios
- TrendingUp / Score Medio (com cor dinamica)
- AlertTriangle / Alertas Criticos
- Shield / Falhas Criticas

#### 4. Adicionar barra de busca
- Input com icone `Search` e placeholder "Buscar ativo..."
- Filtro local por nome do dominio ou nome do workspace

#### 5. Substituir ExternalDomainTable por tabela inline
Remover componente externo `ExternalDomainTable` e criar tabela diretamente na pagina com Card + CardContent p-0:

Colunas:
- **Dominio**: font-medium
- **Workspace**: text-muted-foreground
- **Agent**: Badge cyan (ou "—")
- **Frequencia**: Badge com cores (daily=azul, weekly=roxo, monthly=amber)
- **Ultimo Score**: Badge com cor por faixa (verde >=75, amarelo >=60, vermelho <60)
- **Acoes**: Play, Edit, Delete (ghost buttons)

#### 6. Manter funcionalidades existentes
- `handleAddDomain`, `handleAnalyze`, `openEditPage`, `handleDeleteDomain` permanecem iguais
- `DeleteExternalDomainDialog` permanece
- `AddExternalDomainDialog` permanece (agora ao lado do seletor de workspace)

### Secao tecnica

**Imports a adicionar**: `useEffectiveAuth`, `useQuery`, `Select/SelectTrigger/SelectContent/SelectItem`, `Building2`, `Search`, `Server`, `Pencil`, `Loader2`, `Play`, `Trash2`, `TrendingUp`, `AlertTriangle`, `Shield`, `Globe`, `Card/CardContent`, `Table/*`, `Badge`, `Input`, `Skeleton`

**Imports a remover**: `ExternalDomainStatsCards`, `ExternalDomainTable`

**Constantes a adicionar** (identicas ao FirewallListPage):
```
FREQUENCY_LABELS, FREQUENCY_COLORS
getScoreColor(score)
```

**Estado e queries a adicionar**:
```
const { effectiveRole } = useEffectiveAuth();
const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
const [search, setSearch] = useState('');

const { data: allWorkspaces } = useQuery({...}); // identico ao Firewall
```

**Filtro de workspace no fetchData**:
```
let workspaceIds = null;
if (isPreviewMode && previewTarget?.workspaces) {
  workspaceIds = previewTarget.workspaces.map(w => w.id);
} else if (isSuperRole && selectedWorkspaceId) {
  workspaceIds = [selectedWorkspaceId];
}
```

**useEffect de re-fetch** deve reagir a `selectedWorkspaceId`.

