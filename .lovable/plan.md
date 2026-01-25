
# Plano: Otimização de Performance - Chamadas de API Duplicadas

## Diagnóstico

A lentidão no sistema é causada por **chamadas de API excessivas e duplicadas**:

| Endpoint | Chamadas em 2s | Problema |
|----------|----------------|----------|
| `profiles` | 8x | Cada componente refaz a chamada |
| `user_roles` | 7x | Contextos sem cache |
| `user_module_permissions` | 7x | Re-renders desnecessários |
| `modules` | 2x | Duplicação entre contextos |

---

## Solução: Otimização dos Contextos de Autenticação e Módulos

### 1. Corrigir AuthContext - Evitar fetch duplicado

**Arquivo:** `src/contexts/AuthContext.tsx`

O problema: `fetchUserData` é chamado tanto no `onAuthStateChange` quanto no `getSession`. Isso causa chamadas duplicadas.

**Correção:**
- Usar uma flag para evitar fetch duplicado
- Adicionar debounce/cache para evitar múltiplas chamadas

```typescript
// Adicionar ref para controlar fetch em andamento
const fetchingRef = useRef(false);

const fetchUserData = async (userId: string) => {
  // Evitar chamadas duplicadas
  if (fetchingRef.current) return;
  fetchingRef.current = true;
  
  try {
    // ... fetch logic ...
  } finally {
    fetchingRef.current = false;
    setLoading(false);
  }
};
```

### 2. Corrigir ModuleContext - Remover dependência desnecessária do role

**Arquivo:** `src/contexts/ModuleContext.tsx`

O problema: O useEffect tem `role` como dependência, causando re-fetch toda vez que o role é definido.

**Correção:**
```typescript
// ANTES (problemático)
useEffect(() => {
  // ...
}, [user, authLoading, role]); // role causa re-fetch

// DEPOIS (otimizado)
useEffect(() => {
  // ...
}, [user, authLoading]); // remover role
```

### 3. Implementar cache local para dados de usuário

**Arquivo:** `src/contexts/AuthContext.tsx`

Usar sessionStorage para cachear dados do usuário e evitar chamadas repetidas:

```typescript
const fetchUserData = async (userId: string) => {
  // Tentar cache primeiro
  const cachedData = sessionStorage.getItem(`user_data_${userId}`);
  if (cachedData) {
    const parsed = JSON.parse(cachedData);
    setProfile(parsed.profile);
    setRole(parsed.role);
    setPermissions(parsed.permissions);
    setLoading(false);
    return;
  }
  
  // Fetch e cachear
  // ...
  sessionStorage.setItem(`user_data_${userId}`, JSON.stringify({
    profile: profileData,
    role: roleData.role,
    permissions: perms
  }));
};
```

### 4. Corrigir o warning do Skeleton

**Arquivo:** `src/components/ui/skeleton.tsx`

Adicionar `forwardRef` para suportar refs corretamente:

```typescript
import { forwardRef } from "react";

const Skeleton = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("animate-pulse rounded-md bg-muted", className)}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
```

### 5. Usar React Query para gerenciar cache automaticamente

**Arquivos:** `src/contexts/AuthContext.tsx`, `src/contexts/ModuleContext.tsx`

Migrar as chamadas de dados para React Query, que já está instalado no projeto e oferece:
- Cache automático
- Deduplicação de requests
- Refetch inteligente

---

## Resumo das Alterações

| Arquivo | Alteração | Impacto |
|---------|-----------|---------|
| `AuthContext.tsx` | Flag para evitar fetch duplicado + cache | -50% chamadas |
| `ModuleContext.tsx` | Remover `role` das dependências | -30% chamadas |
| `skeleton.tsx` | Adicionar forwardRef | Corrige warning |

## Resultado Esperado

- Redução de ~8 chamadas para ~2-3 por carregamento de página
- Tempo de carregamento inicial reduzido em ~60%
- Eliminação do warning de console

---

## Seção Técnica

### Diagrama de fluxo atual (problemático)

```text
Login/Refresh
    |
    v
+---------------+
| getSession()  |-----> fetchUserData() ----+
+---------------+                           |
    |                                       v
    v                                  [API calls x3]
+-------------------+                       |
| onAuthStateChange |-----> fetchUserData() +---> [API calls x3]
+-------------------+                       |
    |                                       v
    v                                  Total: 6+ calls
+---------------+
| ModuleContext |-----> fetchModules() ---> [API calls x2]
+---------------+   (triggered by role change)
```

### Diagrama de fluxo otimizado

```text
Login/Refresh
    |
    v
+---------------+
| getSession()  |-----> fetchUserData() ----+
+---------------+     (with dedup flag)     |
    |                                       v
    v                                  [API calls x3]
+-------------------+                       |
| onAuthStateChange |-----> (skipped - already fetching)
+-------------------+                       |
    |                                       |
    v                                       v
+---------------+                      Total: 3 calls
| ModuleContext |-----> fetchModules() ---> [API call x1]
+---------------+   (no role dependency)
```
