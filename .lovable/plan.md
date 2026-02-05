
## Correções de Filtragem no Preview Mode - Stats Cards e Módulos

### Problema Identificado

Os stats cards e algumas páginas não estão considerando o filtro de workspaces do Preview Mode:

1. **`FirewallStatsCards`** - Faz queries internas sem filtrar por workspace (mostra 12 firewalls ao invés de 2)
2. **`FirewallDashboardPage`** - Busca análises recentes sem filtrar por workspace
3. **`AgentsPage`** - Lista todos os agents sem filtrar por workspace
4. **`UsersPage`** - Lista todos os usuários (pode não precisar filtrar, verificar comportamento)

---

### Solução

Modificar os componentes para receber os workspaceIds via props ou usar o PreviewContext diretamente.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/firewall/FirewallStatsCards.tsx` | Adicionar suporte a filtro por workspaceIds |
| `src/pages/firewall/FirewallListPage.tsx` | Passar workspaceIds para FirewallStatsCards |
| `src/pages/firewall/FirewallDashboardPage.tsx` | Filtrar análises recentes por workspace |
| `src/pages/AgentsPage.tsx` | Filtrar agents por workspace no Preview Mode |

---

### Detalhamento das Mudanças

#### 1. FirewallStatsCards.tsx - Adicionar suporte a workspaceIds

```typescript
interface FirewallStatsCardsProps {
  onStatsLoaded?: (stats: DashboardStats) => void;
  workspaceIds?: string[];  // NOVO - para filtrar no Preview Mode
}

export function FirewallStatsCards({ onStatsLoaded, workspaceIds }: FirewallStatsCardsProps) {
  // ...
  
  const fetchStats = async () => {
    // Build queries with optional filtering
    let countQuery = supabase.from('firewalls').select('id', { count: 'exact', head: true });
    let dataQuery = supabase.from('firewalls').select('id, last_score');
    
    // Apply workspace filter if provided
    if (workspaceIds && workspaceIds.length > 0) {
      countQuery = countQuery.in('client_id', workspaceIds);
      dataQuery = dataQuery.in('client_id', workspaceIds);
    }
    
    const [firewallsRes, firewallsWithScoreRes] = await Promise.all([
      countQuery,
      dataQuery,
    ]);
    // ...resto da lógica
  };
  
  // Adicionar dependency no useEffect
  useEffect(() => {
    fetchStats();
  }, [workspaceIds]);
}
```

#### 2. FirewallListPage.tsx - Passar workspaceIds para o componente

```typescript
// Dentro do componente
const workspaceIds = isPreviewMode && previewTarget?.workspaces
  ? previewTarget.workspaces.map(w => w.id)
  : undefined;

// No render
<FirewallStatsCards workspaceIds={workspaceIds} />
```

#### 3. FirewallDashboardPage.tsx - Filtrar por workspace

```typescript
import { usePreview } from '@/contexts/PreviewContext';

// No componente
const { isPreviewMode, previewTarget } = usePreview();

useEffect(() => {
  if (user && hasModuleAccess('scope_firewall')) {
    fetchRecentAnalyses();
  }
}, [user, isPreviewMode, previewTarget]);

const fetchRecentAnalyses = async () => {
  const workspaceIds = isPreviewMode && previewTarget?.workspaces
    ? previewTarget.workspaces.map(w => w.id)
    : null;

  // Se tiver filtro de workspace, primeiro buscar firewalls do workspace
  let firewallIdsFilter: string[] | null = null;
  if (workspaceIds && workspaceIds.length > 0) {
    const { data: firewallsData } = await supabase
      .from('firewalls')
      .select('id')
      .in('client_id', workspaceIds);
    firewallIdsFilter = firewallsData?.map(f => f.id) || [];
    
    if (firewallIdsFilter.length === 0) {
      setRecentAnalyses([]);
      setLoading(false);
      return;
    }
  }

  // Buscar análises com filtro opcional
  let analysisQuery = supabase
    .from('analysis_history')
    .select('id, score, created_at, firewall_id')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (firewallIdsFilter) {
    analysisQuery = analysisQuery.in('firewall_id', firewallIdsFilter);
  }
  
  const { data: recentData } = await analysisQuery;
  // ...resto da lógica
};
```

#### 4. AgentsPage.tsx - Filtrar por workspace

```typescript
import { usePreview } from '@/contexts/PreviewContext';

// No componente
const { isPreviewMode, previewTarget } = usePreview();

useEffect(() => {
  if (user && canAccessPage) {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }
}, [user, canAccessPage, isPreviewMode, previewTarget]);

const fetchData = async () => {
  const workspaceIds = isPreviewMode && previewTarget?.workspaces
    ? previewTarget.workspaces.map(w => w.id)
    : null;

  // Build queries with optional filtering
  let agentsQuery = supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
    
  let clientsQuery = supabase
    .from("clients")
    .select("id, name")
    .order("name");

  if (workspaceIds && workspaceIds.length > 0) {
    agentsQuery = agentsQuery.in('client_id', workspaceIds);
    clientsQuery = clientsQuery.in('id', workspaceIds);
  }

  const [agentsRes, clientsRes] = await Promise.all([agentsQuery, clientsQuery]);
  // ...resto da lógica
};
```

---

### Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    PREVIEW MODE - FILTRAGEM CORRIGIDA                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FirewallListPage (usuário visualizado: admin@nexta.com.br)             │
│                           │                                             │
│         ┌─────────────────┼─────────────────┐                           │
│         ▼                 ▼                 ▼                           │
│  FirewallStatsCards    Tabela          FirewallDash                     │
│  workspaceIds=[NEXTA]  filtrada        recentAnalyses                   │
│         │                               filtrado                        │
│         ▼                                   │                           │
│  Query: .in('client_id', [NEXTA])           ▼                           │
│         │               Query: .in('firewall_id', [fw do NEXTA])        │
│         ▼                                                               │
│  Resultado: 2 firewalls (correto!)                                      │
│                                                                         │
│  AgentsPage                                                             │
│  Query: .in('client_id', [NEXTA])                                       │
│  Resultado: Apenas agents do workspace NEXTA                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Seção Técnica

**Interface atualizada do FirewallStatsCards:**

```typescript
interface FirewallStatsCardsProps {
  onStatsLoaded?: (stats: DashboardStats) => void;
  workspaceIds?: string[];
}
```

**Padrão de filtragem a usar em todas as páginas:**

```typescript
// Obter workspaceIds do Preview Mode
const { isPreviewMode, previewTarget } = usePreview();

const workspaceIds = isPreviewMode && previewTarget?.workspaces
  ? previewTarget.workspaces.map(w => w.id)
  : null;

// Aplicar nas queries
if (workspaceIds && workspaceIds.length > 0) {
  query = query.in('client_id', workspaceIds);
}
```

---

### Estimativa de Esforço

| Tarefa | Tempo |
|--------|-------|
| Atualizar FirewallStatsCards | 20min |
| Atualizar FirewallListPage (passar props) | 5min |
| Atualizar FirewallDashboardPage | 25min |
| Atualizar AgentsPage | 20min |
| Testes | 15min |
| **Total** | **~1h30** |
