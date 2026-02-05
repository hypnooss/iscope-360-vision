

## Ajustes de Permissões no Preview Mode

### Problema Identificado

O Preview Mode está carregando os dados do usuário alvo corretamente, mas não está sendo utilizado pelos contexts e componentes:

1. **AppLayout** usa `role` do `AuthContext` (admin real) para mostrar/ocultar menu "Administração"
2. **ModuleContext** retorna `userModules` do admin, não do usuário sendo visualizado
3. **Páginas de dados** (Reports, Execuções) não filtram pelos workspaces do usuário alvo

---

### Solução

Criar conceito de "effective user" nos contexts que alterna entre dados reais e dados do preview.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Expor `effectiveRole` e `effectiveProfile` que consideram o Preview Mode |
| `src/contexts/ModuleContext.tsx` | Expor `effectiveUserModules` que retorna módulos do preview target |
| `src/components/layout/AppLayout.tsx` | Usar `effectiveRole` e `effectiveUserModules` para controlar sidebar |
| `src/pages/firewall/FirewallReportsPage.tsx` | Filtrar dados pelo workspace do preview target |
| `src/pages/firewall/TaskExecutionsPage.tsx` | Filtrar dados pelo workspace do preview target |
| `src/pages/external-domain/ExternalDomainListPage.tsx` | Já foi ajustado (verificar) |
| `src/pages/external-domain/ExternalDomainExecutionsPage.tsx` | Filtrar dados pelo workspace do preview target |
| `src/pages/external-domain/ExternalDomainReportsPage.tsx` | Filtrar dados pelo workspace do preview target |

---

### Detalhamento das Mudanças

#### 1. AuthContext - Adicionar "effective" fields

```typescript
interface AuthContextType {
  // Existentes
  user, session, profile, role, permissions, ...
  
  // NOVOS - consideram Preview Mode
  effectiveProfile: UserProfile | null;
  effectiveRole: AppRole | null;
  isViewingAsOther: boolean;
}
```

**Lógica:**
- Se `isPreviewMode === true` → retorna dados do `previewTarget`
- Se `isPreviewMode === false` → retorna dados do admin real

#### 2. ModuleContext - Adicionar effective modules

```typescript
interface ModuleContextType {
  // Existentes
  modules, userModules, ...
  
  // NOVOS
  effectiveUserModules: UserModuleAccess[];
}
```

**Lógica:**
- Se `isPreviewMode === true` → retorna `previewTarget.modules`
- Se `isPreviewMode === false` → retorna `userModules` normal

#### 3. AppLayout - Usar effective data

```typescript
// ANTES
const { profile, role, signOut } = useAuth();
const { userModules, ... } = useModules();

// DEPOIS
const { profile, role, effectiveProfile, effectiveRole, signOut } = useAuth();
const { effectiveUserModules, ... } = useModules();
const { isPreviewMode, previewTarget } = usePreview();

// Usar effectiveRole para menu Admin
const showAdminMenu = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

// Usar effectiveUserModules para sidebar
const accessibleModuleConfigs = effectiveUserModules.map(...)
```

#### 4. Páginas de Dados - Filtrar por workspaces do preview

Para cada página de listagem/relatórios:

```typescript
const { isPreviewMode, previewTarget } = usePreview();

const fetchData = async () => {
  let query = supabase.from('analysis_history').select(...);
  
  // Filtrar por workspaces do preview target
  if (isPreviewMode && previewTarget?.workspaces) {
    const workspaceIds = previewTarget.workspaces.map(w => w.id);
    // Filtrar firewalls que pertencem a esses workspaces
    query = query.in('firewall_id', firewallIdsDoWorkspace);
  }
  
  // ... resto da query
};
```

---

### Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    PREVIEW MODE - FLUXO CORRIGIDO                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Admin inicia Preview como usuário "admin@taschibra.com.br"          │
│                           │                                             │
│                           ▼                                             │
│  2. PreviewContext carrega:                                             │
│     - profile: { email: "admin@taschibra.com.br", ... }                 │
│     - role: "workspace_admin"                                           │
│     - workspaces: [{ id: "...", name: "Taschibra" }]                    │
│     - modules: [scope_firewall, scope_external_domain]                  │
│                           │                                             │
│                           ▼                                             │
│  3. AuthContext.effectiveRole = "workspace_admin"                       │
│     AuthContext.effectiveProfile = preview target profile               │
│                           │                                             │
│                           ▼                                             │
│  4. ModuleContext.effectiveUserModules = preview target modules         │
│                           │                                             │
│                           ▼                                             │
│  5. AppLayout renderiza:                                                │
│     ✗ Menu Administração (role != super_admin/super_suporte)            │
│     ✓ Apenas módulos do usuário alvo                                    │
│     ✓ Profile do usuário alvo no user menu                              │
│                           │                                             │
│                           ▼                                             │
│  6. Páginas de dados filtram:                                           │
│     - Apenas firewalls do workspace Taschibra                           │
│     - Apenas domínios do workspace Taschibra                            │
│     - Apenas relatórios de devices do workspace Taschibra               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Páginas a Ajustar (Filtragem de Dados)

| Página | Arquivo | Status |
|--------|---------|--------|
| Firewall > Firewalls | `FirewallListPage.tsx` | ✅ Já ajustado |
| Firewall > Execuções | `TaskExecutionsPage.tsx` | ⏳ Precisa ajustar |
| Firewall > Relatórios | `FirewallReportsPage.tsx` | ⏳ Precisa ajustar |
| Domínio > Domínios | `ExternalDomainListPage.tsx` | ⏳ Verificar |
| Domínio > Execuções | `ExternalDomainExecutionsPage.tsx` | ⏳ Precisa ajustar |
| Domínio > Relatórios | `ExternalDomainReportsPage.tsx` | ⏳ Precisa ajustar |
| Dashboard | `DashboardPage.tsx` | ⏳ Precisa ajustar |
| Usuários | `UsersPage.tsx` | ⏳ Filtrar por workspace |
| Agents | `AgentsPage.tsx` | ⏳ Filtrar por workspace |

---

### Seção Técnica

**Modificação do AuthContext para expor effective data:**

```typescript
// No AuthContext.tsx
import { usePreview } from '@/contexts/PreviewContext';

export function AuthProvider({ children }) {
  // ... código existente ...
  
  // Não podemos usar usePreview aqui diretamente pois AuthProvider 
  // está acima do PreviewProvider na árvore
  // Solução: criar um novo hook/context que combine ambos
}
```

**Alternativa Recomendada - Hook Combinado:**

Criar um novo hook `useEffectiveAuth` que combina AuthContext + PreviewContext:

```typescript
// src/hooks/useEffectiveAuth.ts
export function useEffectiveAuth() {
  const { profile, role, permissions, ... } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();
  
  const effectiveProfile = isPreviewMode && previewTarget 
    ? previewTarget.profile 
    : profile;
    
  const effectiveRole = isPreviewMode && previewTarget 
    ? previewTarget.role 
    : role;
    
  return {
    // Dados reais (sempre do admin)
    realProfile: profile,
    realRole: role,
    
    // Dados efetivos (preview ou real)
    effectiveProfile,
    effectiveRole,
    
    // Flag
    isViewingAsOther: isPreviewMode,
  };
}
```

**Hook Combinado para Módulos:**

```typescript
// src/hooks/useEffectiveModules.ts
export function useEffectiveModules() {
  const { userModules, ... } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  
  const effectiveUserModules = isPreviewMode && previewTarget?.modules
    ? previewTarget.modules.map(m => ({
        module: m.module as Module,
        permission: m.permission as ModulePermissionLevel,
      }))
    : userModules;
    
  return {
    realUserModules: userModules,
    effectiveUserModules,
    hasEffectiveModuleAccess: (code: string) => 
      effectiveUserModules.some(m => m.module.code === code),
  };
}
```

---

### Estimativa de Esforço

| Tarefa | Tempo |
|--------|-------|
| Criar useEffectiveAuth hook | 30min |
| Criar useEffectiveModules hook | 30min |
| Atualizar AppLayout | 1h |
| Atualizar FirewallReportsPage | 30min |
| Atualizar TaskExecutionsPage | 30min |
| Atualizar ExternalDomainExecutionsPage | 30min |
| Atualizar ExternalDomainReportsPage | 30min |
| Atualizar DashboardPage | 30min |
| Atualizar UsersPage (filtrar workspace) | 30min |
| Atualizar AgentsPage (filtrar workspace) | 30min |
| Testes | 1h |
| **Total** | **~6-7h** |

