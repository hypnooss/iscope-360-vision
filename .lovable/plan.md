
# Plano: Corrigir Módulos Não Aparecem para Super Admin

## Diagnóstico

O problema ocorreu devido a uma **condição de corrida** na otimização anterior:

```text
Fluxo Atual (Problemático)
--------------------------
1. AuthContext inicia: role = null, loading = true
2. AuthContext: loading = false (ainda buscando role)
3. ModuleContext detecta: !authLoading && user → chama fetchModules()
4. fetchModules verifica: role === 'super_admin' → FALSE (role ainda é null)
5. Código vai para else → busca user_modules → retorna vazio
6. AuthContext finalmente define: role = 'super_admin' (tarde demais)

Resultado: Super Admin não vê módulos
```

## Solucao

Modificar o `ModuleContext` para:

1. Esperar o `role` estar definido (não apenas `authLoading`)
2. Usar o valor atual de `role` dentro de `fetchModules()` via ref ou passando como parametro
3. Manter a otimizacao de nao re-buscar desnecessariamente

## Alteracoes Necessarias

### Arquivo: `src/contexts/ModuleContext.tsx`

**Mudanca 1:** Incluir `role` nas dependencias do useEffect, mas com verificacao adicional

```typescript
// ANTES (problemático)
useEffect(() => {
  if (!authLoading && user) {
    fetchModules();
  }
}, [user, authLoading]); // role não está aqui

// DEPOIS (corrigido)
useEffect(() => {
  // Só buscar quando authLoading terminar E role estiver definido
  if (!authLoading && user && role !== null) {
    fetchModules();
  } else if (!authLoading && !user) {
    setModules([]);
    setUserModules([]);
    setActiveModule(null);
    setLoading(false);
  }
}, [user, authLoading, role]); // role adicionado de volta
```

**Mudanca 2:** Adicionar flag para evitar re-fetch duplicado quando role mudar

```typescript
const hasFetchedRef = useRef(false);
const lastRoleRef = useRef<string | null>(null);

useEffect(() => {
  if (!authLoading && user && role !== null) {
    // Só re-buscar se role mudou ou é primeira vez
    if (!hasFetchedRef.current || lastRoleRef.current !== role) {
      hasFetchedRef.current = true;
      lastRoleRef.current = role;
      fetchModules();
    }
  } else if (!authLoading && !user) {
    hasFetchedRef.current = false;
    lastRoleRef.current = null;
    setModules([]);
    setUserModules([]);
    setActiveModule(null);
    setLoading(false);
  }
}, [user, authLoading, role]);
```

## Fluxo Corrigido

```text
Fluxo Novo (Corrigido)
----------------------
1. AuthContext inicia: role = null, loading = true
2. AuthContext busca dados...
3. ModuleContext detecta: role === null → NÃO chama fetchModules()
4. AuthContext define: role = 'super_admin', loading = false
5. ModuleContext detecta: role !== null → chama fetchModules()
6. fetchModules verifica: role === 'super_admin' → TRUE
7. Atribui todos os módulos com permissão 'edit'

Resultado: Super Admin vê todos os módulos
```

## Resumo das Alteracoes

| Arquivo | Alteracao | Impacto |
|---------|-----------|---------|
| `ModuleContext.tsx` | Esperar role estar definido antes de fetch | Corrige modulos nao aparecendo |
| `ModuleContext.tsx` | Flag para evitar re-fetch duplicado | Mantém performance |

## Secao Tecnica

A chave e adicionar uma verificacao `role !== null` no useEffect E usar refs para evitar que mudancas de role causem multiplos fetches:

```typescript
const hasFetchedRef = useRef(false);
const lastRoleRef = useRef<string | null>(null);

useEffect(() => {
  if (!authLoading && user && role !== null) {
    // Evita re-fetch se role nao mudou
    if (!hasFetchedRef.current || lastRoleRef.current !== role) {
      hasFetchedRef.current = true;
      lastRoleRef.current = role;
      fetchModules();
    }
  } else if (!authLoading && !user) {
    // Reset no logout
    hasFetchedRef.current = false;
    lastRoleRef.current = null;
    clearState();
  }
}, [user, authLoading, role]);
```
