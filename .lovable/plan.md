

## Diagnóstico e Correções — M365 Compliance

### 3 Problemas Identificados

**1. Erro `invalid input syntax for type integer: "71.54"`**
- A função RPC `get_posture_insights_lite` faz `COALESCE((elem->>'affectedCount')::int, ...)` — o cast `::int` falha quando o valor é um decimal como `71.54`.
- **Fix**: Trocar `::int` por `::numeric::int` (ou `FLOOR()`) na migração SQL para truncar decimais corretamente.

**2. Tela recarregando sozinha (loop de re-render)**
- O hook `useM365TenantSelector` inclui `setSearchParams` e `paramTenantId` no dependency array do `useCallback` para `loadTenants`. O `setSearchParams` é uma nova referência a cada render do react-router, causando loop:
  1. `loadTenants` roda → chama `setSearchParams` → URL muda
  2. `paramTenantId` muda → `loadTenants` recria → `useEffect` dispara novamente
- **Fix**: Remover `setSearchParams` e `paramTenantId` das dependências de `loadTenants`. Usar um `useRef` para `setSearchParams` e mover a lógica de auto-select para um `useEffect` separado.

**3. Seletor de tenant não mantém a opção após troca de tela**
- Quando o usuário navega para outra página e volta, o `useEffect` em `loadTenants` reexecuta, e a lógica `if (!paramTenantId && options.length > 0)` sobrescreve o tenant selecionado se o URL param não persistir. Além disso, `setSearchParams({ tenant: id })` **substitui todos os params** (usa objeto, não merge).
- **Fix**: Usar `setSearchParams(prev => { prev.set('tenant', id); return prev; })` para preservar outros params e garantir que o tenant selecionado via URL persiste.

### Arquivos a Modificar

1. **Migração SQL** — Corrigir o cast de `affectedCount` na função `get_posture_insights_lite`
2. **`src/hooks/useM365TenantSelector.ts`** — Corrigir loop de dependências e persistência do tenant selecionado

### Detalhes Técnicos

**Migração SQL:**
```sql
ALTER the get_posture_insights_lite function to use:
COALESCE((elem->>'affectedCount')::numeric::int, jsonb_array_length(...))
-- instead of:
COALESCE((elem->>'affectedCount')::int, jsonb_array_length(...))
```

**Hook `useM365TenantSelector`:**
- Estabilizar `loadTenants` removendo `paramTenantId` e `setSearchParams` das dependências
- Usar `useRef` para `setSearchParams` para evitar re-criação do callback
- Separar a lógica de auto-select em um `useEffect` dedicado que só roda quando `tenants` carregam e não há tenant no URL
- Usar merge de params em vez de substituição

