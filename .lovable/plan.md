

## Correção: Filtrar Clientes no Wizard de Conexão M365

### Problema Identificado

O wizard de conexão de tenant M365 (`TenantConnectionWizard`) exibe **todos os clientes** no dropdown, independentemente:
1. Da role do usuário (workspace_admin/user deveria ver apenas seus workspaces)
2. Do modo Preview (deveria ver apenas os workspaces do usuário alvo)

### Análise do Código Atual

```typescript
// TenantConnectionWizard.tsx - linhas 150-162
const fetchClients = async () => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');

    if (error) throw error;
    setClients(data || []);  // ← Não aplica filtro por preview/role
  } catch (error) {
    console.error('Error fetching clients:', error);
  }
};
```

**Nota:** O RLS na tabela `clients` já filtra para workspace_admin e users normais, mas o **Preview Mode** precisa de tratamento adicional porque o RLS usa o `auth.uid()` do admin real, não do usuário sendo visualizado.

---

### Solução

Aplicar o mesmo padrão usado em `FirewallListPage`:
1. Importar `usePreview` no componente
2. Ao buscar clientes, verificar se está em Preview Mode
3. Se sim, filtrar por `previewTarget.workspaces`
4. Se não, deixar o RLS fazer o trabalho (já filtra para não-admins)

---

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/m365/TenantConnectionWizard.tsx` | Adicionar filtro de workspaces no fetchClients |

---

### Mudanças no Código

#### 1. Adicionar import do PreviewContext

```typescript
import { usePreview } from '@/contexts/PreviewContext';
```

#### 2. Obter estado do Preview no componente

```typescript
export function TenantConnectionWizard({ open, onOpenChange, onSuccess }: TenantConnectionWizardProps) {
  const { user } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview(); // ← Adicionar
```

#### 3. Modificar fetchClients para filtrar por workspaces

**Antes:**
```typescript
const fetchClients = async () => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');

    if (error) throw error;
    setClients(data || []);
  } catch (error) {
    console.error('Error fetching clients:', error);
  }
};
```

**Depois:**
```typescript
const fetchClients = async () => {
  try {
    let query = supabase
      .from('clients')
      .select('id, name')
      .order('name');

    // Apply workspace filter if in preview mode
    if (isPreviewMode && previewTarget?.workspaces) {
      const workspaceIds = previewTarget.workspaces.map(w => w.id);
      if (workspaceIds.length > 0) {
        query = query.in('id', workspaceIds);
      }
    }

    const { data, error } = await query;

    if (error) throw error;
    setClients(data || []);
  } catch (error) {
    console.error('Error fetching clients:', error);
  }
};
```

#### 4. Atualizar useEffect para reagir a mudanças no Preview

```typescript
useEffect(() => {
  if (open) {
    fetchClients();
  }
}, [open, isPreviewMode, previewTarget]); // ← Adicionar dependências
```

---

### Comportamento Esperado

| Cenário | Clientes Exibidos |
|---------|-------------------|
| Super Admin (normal) | Todos |
| Workspace Admin (normal) | Apenas seus workspaces (RLS) |
| User (normal) | Apenas seus workspaces (RLS) |
| Admin em Preview Mode | Apenas workspaces do usuário alvo |

---

### Fluxo Visual

```text
┌───────────────────────────────────────────────────────────────┐
│                    WIZARD CONEXÃO M365                        │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Verificar isPreviewMode                                   │
│     ┌───────────────────────────────────────┐                 │
│     │ isPreviewMode = true?                 │                 │
│     └───────────────────────────────────────┘                 │
│              │                     │                          │
│         SIM ▼                 NÃO ▼                           │
│   ┌─────────────────┐    ┌─────────────────────┐              │
│   │ Filtrar por     │    │ RLS filtra         │              │
│   │ previewTarget.  │    │ automaticamente    │              │
│   │ workspaces      │    │ por user_clients   │              │
│   └─────────────────┘    └─────────────────────┘              │
│              │                     │                          │
│              └──────────┬──────────┘                          │
│                         ▼                                     │
│              ┌─────────────────────┐                          │
│              │ Exibir dropdown     │                          │
│              │ com clientes        │                          │
│              │ filtrados           │                          │
│              └─────────────────────┘                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

### Estimativa

| Tarefa | Tempo |
|--------|-------|
| Adicionar import e hook usePreview | 2min |
| Modificar fetchClients | 5min |
| Testar em modo normal e Preview | 10min |
| **Total** | **~17min** |

