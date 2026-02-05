

## Preview Mode - Visualizar Como Usuário

### Objetivo

Implementar um **modo de visualização somente-leitura** que permite super_admins e super_suportes verem o sistema exatamente como um usuário específico de um workspace específico veria, preparando a arquitetura para futura expansão ao Impersonate completo.

---

### Arquitetura Expansível

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASE 1: PREVIEW MODE (Read-Only)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    PreviewContext (NOVO)                          │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  - isPreviewMode: boolean                                         │   │
│  │  - previewTargetUserId: string | null                             │   │
│  │  - previewTargetWorkspaceId: string | null                        │   │
│  │  - previewUserProfile: UserProfile | null                         │   │
│  │  - previewUserRole: AppRole | null                                │   │
│  │  - previewUserPermissions: ModulePermissions | null               │   │
│  │  - previewUserModules: UserModuleAccess[] | null                  │   │
│  │                                                                   │   │
│  │  - startPreview(userId, workspaceId): Promise<void>               │   │
│  │  - stopPreview(): void                                            │   │
│  │  - canStartPreview(): boolean                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                          │                                              │
│                          ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              AuthContext + ModuleContext (MODIFICADOS)            │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  - Expõem "effectiveUser" que pode ser o real ou o preview        │   │
│  │  - Métodos retornam dados do preview se ativo                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                          │                                              │
│                          ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     PreviewBanner (NOVO)                          │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  Banner amarelo fixo no topo:                                     │   │
│  │  "Visualizando como [Nome do Usuário] | Modo somente leitura"     │   │
│  │  [Botão: Encerrar Visualização]                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                  Bloqueio de Ações (Read-Only)                    │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  - Botões de criar/editar/excluir ficam disabled                  │   │
│  │  - Toast "Ação bloqueada no modo visualização" se tentar clicar   │   │
│  │  - Visual feedback (ícone de cadeado ou badge "somente leitura")  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                  FASE 2: IMPERSONATE (Evolução Futura)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Reutiliza:                                                             │
│  - PreviewContext (renomeia para ImpersonateContext ou adiciona flag)  │
│  - PreviewBanner (muda texto para "Atuando como...")                   │
│  - Tabela preview_sessions (adiciona coluna mode: preview/impersonate) │
│  - Auditoria (já implementada)                                         │
│                                                                         │
│  Adiciona:                                                              │
│  - Remove bloqueio de ações (readOnly = false)                          │
│  - Edge function para queries com service_role                          │
│  - Timeout automático de sessão                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Componentes e Arquivos

#### 1. Banco de Dados

**Nova tabela: `preview_sessions`**

Esta tabela serve para:
- Auditoria completa de quem acessou como quem
- Preparação para Impersonate (adiciona coluna `mode` depois)
- Timeout de sessões longas

```sql
CREATE TABLE public.preview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_workspace_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  reason text,
  ip_address text,
  user_agent text,
  mode text NOT NULL DEFAULT 'preview', -- 'preview' ou 'impersonate' (futuro)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Apenas super_admin/super_suporte podem ver/criar
ALTER TABLE public.preview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage preview sessions"
ON public.preview_sessions
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'super_suporte')
);
```

#### 2. Novo Context: PreviewContext

**Arquivo:** `src/contexts/PreviewContext.tsx`

```typescript
interface PreviewContextType {
  // Estado
  isPreviewMode: boolean;
  previewTarget: {
    userId: string;
    workspaceId: string;
    profile: UserProfile;
    role: AppRole;
    permissions: ModulePermissions;
    modules: UserModuleAccess[];
  } | null;
  
  // Ações
  startPreview: (userId: string, workspaceId: string) => Promise<void>;
  stopPreview: () => void;
  canStartPreview: () => boolean;
  
  // Session info
  previewSessionId: string | null;
  previewStartedAt: Date | null;
}
```

**Responsabilidades:**
- Gerencia estado do preview (ativo/inativo)
- Carrega dados do usuário alvo usando service_role (via edge function)
- Registra sessão na tabela `preview_sessions`
- Armazena sessão em `sessionStorage` para persistir entre navegações
- Limpa automaticamente ao fazer logout

#### 3. Modificações no AuthContext

**Arquivo:** `src/contexts/AuthContext.tsx`

Adiciona suporte a "effective user":

```typescript
interface AuthContextType {
  // Existentes (não mudam)
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  permissions: ModulePermissions;
  
  // NOVOS - para preview
  realUser: User | null;           // Sempre o admin logado
  effectiveProfile: UserProfile | null;  // Profile atual (real ou preview)
  effectiveRole: AppRole | null;         // Role atual (real ou preview)
  effectivePermissions: ModulePermissions; // Permissions atuais
  isViewingAsOther: boolean;       // true se em preview mode
}
```

**Lógica:**
- Se `isPreviewMode` do PreviewContext for true, retorna dados do preview
- Caso contrário, retorna dados reais do admin

#### 4. Modificações no ModuleContext

**Arquivo:** `src/contexts/ModuleContext.tsx`

Similar ao AuthContext:
- Se em preview mode, retorna módulos do usuário alvo
- Caso contrário, retorna módulos do admin

#### 5. Novo Componente: PreviewBanner

**Arquivo:** `src/components/preview/PreviewBanner.tsx`

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 👁 Visualizando como João Silva (joao@empresa.com) | Modo Leitura      │
│                                                    [Encerrar Visualização]│
└─────────────────────────────────────────────────────────────────────────┘
```

**Características:**
- Banner amarelo/âmbar fixo no topo (similar ao SystemAlertBanner)
- Mostra nome e email do usuário sendo visualizado
- Botão para encerrar imediatamente
- Não pode ser dispensado (apenas via botão)
- Z-index alto para sempre aparecer

#### 6. Novo Componente: PreviewUserDialog

**Arquivo:** `src/components/preview/PreviewUserDialog.tsx`

Dialog para iniciar preview:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Visualizar Como Usuário                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Usuário selecionado: [João Silva - joao@empresa.com]                   │
│                                                                         │
│  Workspace:                                                             │
│  [▼ Selecione um workspace                              ]               │
│     • Empresa ABC                                                       │
│     • Empresa XYZ                                                       │
│                                                                         │
│  Motivo (opcional):                                                     │
│  [________________________________________________]                     │
│                                                                         │
│  ⚠ Você verá o sistema exatamente como este usuário vê.                 │
│    Todas as ações estarão bloqueadas (modo somente leitura).            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                              [Cancelar]  [Iniciar Visualização]         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 7. Edge Function: get-user-preview-data

**Arquivo:** `supabase/functions/get-user-preview-data/index.ts`

Carrega dados completos de um usuário usando service_role:
- Profile
- Role
- Permissions
- Módulos
- Workspaces

**Validações:**
- Chamador deve ser super_admin ou super_suporte
- Usuário alvo não pode ser super_admin ou super_suporte
- Registra sessão de preview

#### 8. Hook: usePreviewGuard

**Arquivo:** `src/hooks/usePreviewGuard.ts`

Hook para usar em componentes que têm ações:

```typescript
const { isBlocked, showBlockedMessage } = usePreviewGuard();

// Em um botão:
<Button 
  disabled={isBlocked} 
  onClick={isBlocked ? showBlockedMessage : handleAction}
>
  {isBlocked && <Lock className="w-4 h-4 mr-2" />}
  Criar Novo
</Button>
```

#### 9. Integração com Páginas

**Arquivos a modificar:**
- `UsersPage.tsx` - Adicionar botão "Visualizar como" em cada usuário
- `ClientsPage.tsx` - Adicionar opção de preview por workspace
- `AppLayout.tsx` - Integrar PreviewBanner

---

### Fluxo de Uso

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DO PREVIEW MODE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Super Admin abre página de Usuários                                 │
│                           │                                             │
│                           ▼                                             │
│  2. Clica em "👁 Visualizar" em um usuário da lista                     │
│                           │                                             │
│                           ▼                                             │
│  3. Dialog abre pedindo para selecionar Workspace                       │
│     (se usuário tem acesso a múltiplos)                                 │
│                           │                                             │
│                           ▼                                             │
│  4. Sistema carrega dados do usuário via Edge Function                  │
│     - Cria registro em preview_sessions                                 │
│     - Armazena dados no PreviewContext                                  │
│     - Salva em sessionStorage                                           │
│                           │                                             │
│                           ▼                                             │
│  5. Banner amarelo aparece no topo de todas as páginas                  │
│     "Visualizando como João Silva | Modo Leitura [Encerrar]"            │
│                           │                                             │
│                           ▼                                             │
│  6. Admin navega normalmente, vendo:                                    │
│     - Sidebar com módulos do usuário                                    │
│     - Dados filtrados pelo workspace selecionado                        │
│     - Botões de ação desabilitados com ícone de cadeado                 │
│                           │                                             │
│                           ▼                                             │
│  7. Ao clicar "Encerrar":                                               │
│     - Atualiza ended_at em preview_sessions                             │
│     - Limpa PreviewContext                                              │
│     - Limpa sessionStorage                                              │
│     - Restaura visão normal do admin                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Segurança

| Aspecto | Implementação |
|---------|---------------|
| **Quem pode usar** | Apenas super_admin e super_suporte |
| **Quem pode ser visualizado** | workspace_admin e user (nunca outros super_*) |
| **Auditoria** | Toda sessão é registrada com IP, user-agent, duração |
| **Ações bloqueadas** | Todas as mutações (criar, editar, excluir) são bloqueadas |
| **Timeout** | Sessão em sessionStorage, limpa ao fechar navegador |
| **Escape hatch** | Banner sempre visível com botão de encerrar |

---

### Resumo de Arquivos

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| **Novo** | `src/contexts/PreviewContext.tsx` | Context para gerenciar estado do preview |
| **Novo** | `src/components/preview/PreviewBanner.tsx` | Banner indicando modo preview |
| **Novo** | `src/components/preview/PreviewUserDialog.tsx` | Dialog para iniciar preview |
| **Novo** | `src/hooks/usePreviewGuard.ts` | Hook para bloquear ações |
| **Novo** | `supabase/functions/get-user-preview-data/index.ts` | Edge function para carregar dados |
| **Modificar** | `src/contexts/AuthContext.tsx` | Adicionar effective user |
| **Modificar** | `src/contexts/ModuleContext.tsx` | Adicionar effective modules |
| **Modificar** | `src/components/layout/AppLayout.tsx` | Integrar PreviewBanner |
| **Modificar** | `src/pages/UsersPage.tsx` | Adicionar botão de preview |
| **Modificar** | `src/pages/AdministratorsPage.tsx` | Adicionar botão de preview |
| **Migração** | Tabela `preview_sessions` | Auditoria de sessões |

---

### Estimativa de Esforço

| Tarefa | Tempo |
|--------|-------|
| Tabela preview_sessions + RLS | 1h |
| PreviewContext | 3-4h |
| Modificar AuthContext | 2h |
| Modificar ModuleContext | 1h |
| PreviewBanner | 1h |
| PreviewUserDialog | 2h |
| Edge function get-user-preview-data | 2h |
| usePreviewGuard hook | 1h |
| Integrar em UsersPage | 1h |
| Integrar em AppLayout | 1h |
| Testes e ajustes | 2h |
| **Total** | **17-19h (2-3 dias)** |

---

### Preparação para Impersonate (Fase 2)

Quando precisar evoluir para Impersonate:

1. **Adicionar flag `mode` ao PreviewContext:**
   - `'preview'` = read-only (atual)
   - `'impersonate'` = full access

2. **Modificar usePreviewGuard:**
   - Se mode === 'impersonate', não bloqueia ações

3. **Criar edge function para mutations:**
   - Executa queries como service_role
   - Valida permissões do usuário alvo

4. **Ajustar banner:**
   - Cor diferente (laranja vs amarelo)
   - Texto diferente ("Atuando como" vs "Visualizando como")

**Reaproveitamento: ~80% do código do Preview Mode**

